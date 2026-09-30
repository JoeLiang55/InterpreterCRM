using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

namespace InterpreterCRM.Plugins
{
    internal static class ApplicantInterpreterConverter
    {
        private const string AlreadyCreated = "An Interpreter profile has already been created for this applicant.";

        public static Guid? CreateAndLink(
            IOrganizationService service,
            ITracingService tracing,
            Guid applicantId,
            bool rejectIfAlreadyLinked)
        {
            var columns = new List<string>
            {
                DataverseSchema.Applicant.Name,
                DataverseSchema.Applicant.CourtRegion,
                DataverseSchema.Applicant.Interpreter,
                DataverseSchema.Applicant.ArchiveApplication,
                DataverseSchema.Applicant.LanguagesAppliedFor,
                DataverseSchema.Applicant.OtherLanguages,
                DataverseSchema.Applicant.FirstNationsLanguages
            };
            columns.AddRange(DataverseSchema.OptionalTextMappings.Keys);

            tracing.Trace("Retrieving Applicant {0} for conversion.", applicantId);
            var applicant = service.Retrieve(
                DataverseSchema.Applicant.Table,
                applicantId,
                new ColumnSet(columns.Distinct().ToArray()));
            if (applicant == null)
                throw new InvalidPluginExecutionException("The Applicant could not be retrieved.");
            if (applicant.GetAttributeValue<EntityReference>(DataverseSchema.Applicant.Interpreter) != null)
            {
                if (rejectIfAlreadyLinked)
                    throw new InvalidPluginExecutionException(AlreadyCreated);

                tracing.Trace("Applicant {0} already has an Interpreter; conversion skipped.", applicantId);
                return null;
            }

            var applicantName = ReadText(applicant, DataverseSchema.Applicant.Name);
            if (string.IsNullOrWhiteSpace(applicantName))
                throw new InvalidPluginExecutionException("Applicant Name is required to create an Interpreter profile.");
            if (string.IsNullOrWhiteSpace(applicant.RowVersion))
                throw new InvalidPluginExecutionException("Applicant row version is unavailable. Ask an administrator to verify optimistic concurrency is enabled.");

            // Resolve every selected option before creating anything, so unknown values cannot be silently lost.
            var languages = ReadLanguages(service, applicant);

            var interpreter = new Entity(DataverseSchema.Interpreter.Table);
            interpreter[DataverseSchema.Interpreter.Name] = applicantName.Trim();
            foreach (var mapping in DataverseSchema.OptionalTextMappings)
            {
                var value = ReadText(applicant, mapping.Key);
                if (!string.IsNullOrWhiteSpace(value))
                    interpreter[mapping.Value] = value;
            }
            if (applicant.Attributes.TryGetValue(DataverseSchema.Applicant.CourtRegion, out var courtRegion) && courtRegion != null)
            {
                if (!(courtRegion is OptionSetValue))
                    throw new InvalidPluginExecutionException("Applicant Court Region must be a Choice column. Ask an administrator to verify the schema configuration.");
                // Applicant Court Region and Interpreter Region share the same Choice option values.
                interpreter[DataverseSchema.Interpreter.Region] = courtRegion;
            }

            // Prepare and validate the update before any write occurs.
            var update = new Entity(DataverseSchema.Applicant.Table, applicantId) { RowVersion = applicant.RowVersion };
            if (!applicant.GetAttributeValue<bool>(DataverseSchema.Applicant.ArchiveApplication))
                update[DataverseSchema.Applicant.ArchiveApplication] = true;

            tracing.Trace("Creating Interpreter for Applicant {0}.", applicantId);
            var interpreterId = service.Create(interpreter);
            if (interpreterId == Guid.Empty)
                throw new InvalidPluginExecutionException("Dataverse did not return an Interpreter ID. The conversion cannot complete.");
            update[DataverseSchema.Applicant.Interpreter] = new EntityReference(DataverseSchema.Interpreter.Table, interpreterId);

            foreach (var language in languages)
            {
                var interpreterLanguage = new Entity(DataverseSchema.InterpreterLanguage.Table);
                interpreterLanguage[DataverseSchema.InterpreterLanguage.Interpreter] =
                    new EntityReference(DataverseSchema.Interpreter.Table, interpreterId);
                interpreterLanguage[DataverseSchema.InterpreterLanguage.LanguageName] = language.Name;
                interpreterLanguage[DataverseSchema.InterpreterLanguage.LanguageCategory] = new OptionSetValue(language.Category);
                if (language.Code.HasValue)
                    interpreterLanguage[DataverseSchema.InterpreterLanguage.LanguageCode] = new OptionSetValue(language.Code.Value);
                if (service.Create(interpreterLanguage) == Guid.Empty)
                    throw new InvalidPluginExecutionException("Dataverse did not return an Interpreter Language ID. The conversion cannot complete.");
            }
            tracing.Trace("Created {0} Interpreter Language records for Interpreter {1}.", languages.Count, interpreterId);

            // A concurrent caller must fail this row-version check and roll back its Interpreter creation.
            tracing.Trace("Linking Interpreter {0} to Applicant {1} with a row-version check.", interpreterId, applicantId);
            service.Execute(new UpdateRequest { Target = update, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
            return interpreterId;
        }

        private sealed class LanguageSelection
        {
            public string Name { get; set; }
            public int Category { get; set; }
            public int? Code { get; set; }
        }

        private static List<LanguageSelection> ReadLanguages(IOrganizationService service, Entity applicant)
        {
            var byName = new Dictionary<string, LanguageSelection>(StringComparer.OrdinalIgnoreCase);
            AddSelections(service, applicant, DataverseSchema.Applicant.LanguagesAppliedFor, false, byName);
            AddSelections(service, applicant, DataverseSchema.Applicant.OtherLanguages, false, byName);
            AddSelections(service, applicant, DataverseSchema.Applicant.FirstNationsLanguages, true, byName);

            var languages = byName.Values.ToList();
            if (languages.Count == 0)
                return languages;

            var codeMetadata = RetrieveAttribute<PicklistAttributeMetadata>(
                service, DataverseSchema.InterpreterLanguage.Table, DataverseSchema.InterpreterLanguage.LanguageCode);
            var codeOptions = codeMetadata.OptionSet?.Options;
            if (codeOptions == null)
                throw new InvalidPluginExecutionException("Interpreter Language Code choice metadata is unavailable.");

            foreach (var language in languages)
            {
                var codeOption = codeOptions.FirstOrDefault(option =>
                    string.Equals(ReadOptionLabel(option), language.Name, StringComparison.OrdinalIgnoreCase));
                language.Code = codeOption?.Value;
                if (!language.Code.HasValue && codeMetadata.RequiredLevel != null &&
                    (codeMetadata.RequiredLevel.Value == AttributeRequiredLevel.ApplicationRequired ||
                     codeMetadata.RequiredLevel.Value == AttributeRequiredLevel.SystemRequired))
                    throw new InvalidPluginExecutionException(
                        "Interpreter Language Code is required but has no option for a selected Applicant language.");
            }

            return languages;
        }

        private static void AddSelections(
            IOrganizationService service,
            Entity applicant,
            string column,
            bool firstNation,
            Dictionary<string, LanguageSelection> byName)
        {
            if (!applicant.Attributes.TryGetValue(column, out var value) || value == null)
                return;
            if (!(value is OptionSetValueCollection selectedValues))
                throw new InvalidPluginExecutionException("Applicant language field must be a multi-select Choice: " + column + ".");
            if (selectedValues.Count == 0)
                return;

            var metadata = RetrieveAttribute<MultiSelectPicklistAttributeMetadata>(service, DataverseSchema.Applicant.Table, column);
            var options = metadata.OptionSet?.Options;
            if (options == null)
                throw new InvalidPluginExecutionException("Applicant language choice metadata is unavailable: " + column + ".");

            foreach (var selected in selectedValues)
            {
                var option = selected == null ? null : options.FirstOrDefault(item => item.Value == selected.Value);
                var name = ReadOptionLabel(option);
                if (string.IsNullOrWhiteSpace(name))
                    throw new InvalidPluginExecutionException("A selected Applicant language has no published label: " + column + ".");
                name = name.Trim();

                var category = string.Equals(name, "English", StringComparison.OrdinalIgnoreCase)
                    ? DataverseSchema.InterpreterLanguage.English
                    : firstNation ? DataverseSchema.InterpreterLanguage.FirstNation : DataverseSchema.InterpreterLanguage.Bilingual;
                if (byName.TryGetValue(name, out var existing))
                {
                    if (category == DataverseSchema.InterpreterLanguage.FirstNation)
                        existing.Category = category;
                }
                else
                {
                    byName.Add(name, new LanguageSelection { Name = name, Category = category });
                }
            }
        }

        private static T RetrieveAttribute<T>(IOrganizationService service, string table, string column)
            where T : AttributeMetadata
        {
            var response = (RetrieveAttributeResponse)service.Execute(new RetrieveAttributeRequest
            {
                EntityLogicalName = table,
                LogicalName = column,
                RetrieveAsIfPublished = false
            });
            if (!(response.AttributeMetadata is T metadata))
                throw new InvalidPluginExecutionException("Unexpected Dataverse choice metadata type: " + table + "." + column + ".");
            return metadata;
        }

        private static string ReadOptionLabel(OptionMetadata option)
        {
            var label = option?.Label;
            return label?.LocalizedLabels?.FirstOrDefault(item => item.LanguageCode == 1033)?.Label
                ?? label?.UserLocalizedLabel?.Label;
        }

        private static string ReadText(Entity entity, string column)
        {
            if (!entity.Attributes.TryGetValue(column, out var value) || value == null)
                return null;
            if (!(value is string text))
                throw new InvalidPluginExecutionException("Applicant field mapping requires a text column: " + column + ". Ask an administrator to verify the schema configuration.");
            return text;
        }
    }
}
