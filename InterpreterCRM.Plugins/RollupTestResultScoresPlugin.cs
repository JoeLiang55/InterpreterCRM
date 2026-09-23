using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Language = InterpreterCRM.Plugins.DataverseSchema.InterpreterLanguage;
using Result = InterpreterCRM.Plugins.DataverseSchema.TestResult;

namespace InterpreterCRM.Plugins
{
    /// <summary>Recomputes Interpreter Language scores after a Test Result has changed.</summary>
    public sealed class RollupTestResultScoresPlugin : IPlugin
    {
        private const int PostOperationStage = 40;
        private const int SynchronousMode = 0;

        public void Execute(IServiceProvider serviceProvider)
        {
            if (serviceProvider == null)
                throw new InvalidPluginExecutionException("The plug-in service provider is unavailable.");

            var context = Require<IPluginExecutionContext>(serviceProvider);
            if (context.PrimaryEntityName != Result.Table || context.Stage != PostOperationStage ||
                context.Mode != SynchronousMode || !context.IsInTransaction ||
                (context.MessageName != "Create" && context.MessageName != "Update" && context.MessageName != "Delete"))
                throw new InvalidPluginExecutionException("Test Result rollup requires synchronous PostOperation Create, Update, or Delete in a transaction.");

            var affected = new HashSet<Guid>();
            if (context.MessageName == "Update" || context.MessageName == "Delete")
                AddLanguage(affected, GetImage(context.PreEntityImages, Result.PreImageAlias));
            if (context.MessageName == "Update" || context.MessageName == "Create")
                AddLanguage(affected, GetImage(context.PostEntityImages, Result.PostImageAlias));
            if (affected.Count == 0)
                return;

            var factory = Require<IOrganizationServiceFactory>(serviceProvider);
            var service = factory.CreateOrganizationService(context.UserId);
            if (service == null)
                throw new InvalidPluginExecutionException("The Dataverse organization service is unavailable.");
            var tracing = Require<ITracingService>(serviceProvider);

            foreach (var languageId in affected)
            {
                Recalculate(service, languageId);
                tracing.Trace("Test Result score rollup recalculated Interpreter Language {0}.", languageId);
            }
        }

        private static Entity GetImage(EntityImageCollection images, string alias)
        {
            if (images == null || !images.Contains(alias) || images[alias] == null)
                throw new InvalidPluginExecutionException("Required Test Result image is missing: " + alias + ".");
            return images[alias];
        }

        private static void AddLanguage(ISet<Guid> affected, Entity image)
        {
            var language = image.GetAttributeValue<EntityReference>(Result.InterpreterLanguage);
            if (language == null)
                return;
            if (language.LogicalName != Language.Table || language.Id == Guid.Empty)
                throw new InvalidPluginExecutionException("Test Result has an invalid Interpreter Language lookup.");
            affected.Add(language.Id);
        }

        private static void Recalculate(IOrganizationService service, Guid languageId)
        {
            var columns = new ColumnSet(Result.ComponentScores);
            var query = new QueryExpression(Result.Table)
            {
                ColumnSet = columns,
                Criteria = new FilterExpression(LogicalOperator.And),
                PageInfo = new PagingInfo { Count = 5000, PageNumber = 1 }
            };
            query.Criteria.AddCondition(Result.InterpreterLanguage, ConditionOperator.Equal, languageId);

            var maxima = new Dictionary<string, decimal?>();
            foreach (var score in Result.ComponentScores)
                maxima[score] = null;

            while (true)
            {
                var page = service.RetrieveMultiple(query);
                foreach (var attempt in page.Entities)
                    foreach (var score in Result.ComponentScores)
                    {
                        var value = attempt.GetAttributeValue<decimal?>(score);
                        if (value.HasValue && (!maxima[score].HasValue || value.Value > maxima[score].Value))
                            maxima[score] = value;
                    }

                if (!page.MoreRecords)
                    break;
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }

            var parentColumns = new ColumnSet(Result.ComponentScores.Concat(new[]
            {
                Language.LanguageCategory, Language.AccreditationStatus
            }).ToArray());
            var language = service.Retrieve(Language.Table, languageId, parentColumns);
            if (language == null)
                throw new InvalidPluginExecutionException("The Interpreter Language could not be retrieved.");

            var update = new Entity(Language.Table, languageId);
            foreach (var score in Result.ComponentScores)
                if (language.GetAttributeValue<decimal?>(score) != maxima[score])
                    update[score] = maxima[score].HasValue ? (object)maxima[score].Value : null;

            var category = language.GetAttributeValue<OptionSetValue>(Language.LanguageCategory);
            var applicable = ApplicableScores(category);
            var status = CalculateAccreditation(maxima, applicable);
            if (status.HasValue && language.GetAttributeValue<OptionSetValue>(Language.AccreditationStatus)?.Value != status.Value)
                update[Language.AccreditationStatus] = new OptionSetValue(status.Value);

            if (update.Attributes.Count > 0)
                service.Update(update);
        }

        private static string[] ApplicableScores(OptionSetValue category)
        {
            if (category == null)
                throw new InvalidPluginExecutionException("Interpreter Language has no Language Category.");
            switch (category.Value)
            {
                case Language.Bilingual:
                    return new[] { Language.SightTranslationScore, Language.ConsecutiveInterpretingScore, Language.SimultaneousInterpretingScore };
                case Language.English:
                case Language.FirstNation:
                    return new[] { Language.OralRecallScore, Language.ConsecutiveDialogScore, Language.ShadowingScore, Language.SightConsecutiveScore };
                default:
                    throw new InvalidPluginExecutionException("Interpreter Language has an unsupported Language Category: " + category.Value + ".");
            }
        }

        private static int? CalculateAccreditation(IDictionary<string, decimal?> maxima, IEnumerable<string> applicable)
        {
            var scores = applicable.Select(column => maxima[column]).ToArray();
            // No business rule for incomplete applicable scores has been confirmed. Leave status unchanged.
            if (scores.Any(score => !score.HasValue))
                return null;
            if (scores.Any(score => score.Value < 50m))
                return Language.Unaccredited;
            if (scores.All(score => score.Value >= 70m))
                return Language.Accredited;
            return Language.ConditionalAccredited;
        }

        private static T Require<T>(IServiceProvider provider) where T : class
        {
            return provider.GetService(typeof(T)) as T
                ?? throw new InvalidPluginExecutionException("Required plug-in service is unavailable: " + typeof(T).Name + ".");
        }
    }
}
