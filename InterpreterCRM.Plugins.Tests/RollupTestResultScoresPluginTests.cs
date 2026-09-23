using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using Xunit;
using Language = InterpreterCRM.Plugins.DataverseSchema.InterpreterLanguage;
using Result = InterpreterCRM.Plugins.DataverseSchema.TestResult;

namespace InterpreterCRM.Plugins.Tests
{
    public sealed class RollupTestResultScoresPluginTests
    {
        private static readonly string[] Bilingual = { Result.SightTranslationScore, Result.ConsecutiveInterpretingScore, Result.SimultaneousInterpretingScore };
        private static readonly string[] English = { Result.OralRecallScore, Result.ConsecutiveDialogScore, Result.ShadowingScore, Result.SightConsecutiveScore };

        [Fact]
        public void BilingualCreateRollsUpThreeScoresAndAccredits()
        {
            var test = new Harness(Language.Bilingual);
            test.AddAttempt(test.A, Bilingual, 76, 72, 91);
            test.Run("Create", null, test.A);
            test.AssertScores(test.A, Bilingual, 76, 72, 91);
            test.AssertStatus(test.A, Language.Accredited);
            Assert.Single(test.Updates);
        }

        [Fact]
        public void MultipleAttemptsChooseIndependentMaximaAndIgnoreOtherLanguages()
        {
            var test = new Harness(Language.Bilingual);
            test.AddAttempt(test.A, Bilingual, 76, 50, 60);
            test.AddAttempt(test.A, Bilingual, 82, 72, 55);
            test.AddAttempt(test.A, Bilingual, 79, 68, 91);
            test.AddAttempt(test.B, Bilingual, 99, 99, 99);
            test.Run("Create", null, test.A);
            test.AssertScores(test.A, Bilingual, 82, 72, 91);
            Assert.Single(test.Updates);
        }

        [Fact]
        public void RollupReadsEveryPageOfAttempts()
        {
            var test = new Harness(Language.Bilingual) { PageSize = 2 };
            test.AddAttempt(test.A, Bilingual, 70, 70, 70);
            test.AddAttempt(test.A, Bilingual, 80, 80, 80);
            test.AddAttempt(test.A, Bilingual, 90, 75, 95);
            test.Run("Create", null, test.A);
            test.AssertScores(test.A, Bilingual, 90, 80, 95);
        }

        [Theory]
        [InlineData(Language.English)]
        [InlineData(Language.FirstNation)]
        public void EnglishAndFirstNationRollUpFourApplicableScores(int category)
        {
            var test = new Harness(category);
            test.AddAttempt(test.A, English, 70, 71, 72, 73);
            test.Run("Create", null, test.A);
            test.AssertScores(test.A, English, 70, 71, 72, 73);
            test.AssertStatus(test.A, Language.Accredited);
            Assert.Equal(5, test.Updates.Single().Attributes.Count);
        }

        [Fact]
        public void NewerLowerAttemptCannotReplaceOlderMaximum()
        {
            var test = new Harness(Language.Bilingual);
            test.SetParentScores(test.A, Bilingual, 90, 85, 80);
            test.SetParentStatus(test.A, Language.Accredited);
            test.AddAttempt(test.A, Bilingual, 90, 85, 80);
            test.AddAttempt(test.A, Bilingual, 60, 55, 50);
            test.Run("Create", null, test.A);
            Assert.Empty(test.Updates);
        }

        [Fact]
        public void LoweringMaximumRevealsNextHighest()
        {
            var test = new Harness(Language.Bilingual);
            test.SetParentScores(test.A, Bilingual, 90, 90, 90);
            test.SetParentStatus(test.A, Language.Accredited);
            test.AddAttempt(test.A, Bilingual, 80, 75, 72);
            test.AddAttempt(test.A, Bilingual, 70, 90, 90);
            test.Run("Update", test.A, test.A);
            test.AssertScores(test.A, Bilingual, 80, 90, 90);
            Assert.Single(test.Updates.Single().Attributes);
        }

        [Fact]
        public void UpdatingNonMaximumDoesNotLowerParent()
        {
            var test = new Harness(Language.Bilingual);
            test.SetParentScores(test.A, Bilingual, 90, 85, 80);
            test.SetParentStatus(test.A, Language.Accredited);
            test.AddAttempt(test.A, Bilingual, 90, 85, 80);
            test.AddAttempt(test.A, Bilingual, 60, 50, 55);
            test.Run("Update", test.A, test.A);
            Assert.Empty(test.Updates);
        }

        [Fact]
        public void DeletingMaximumRevealsNextHighest()
        {
            var test = new Harness(Language.Bilingual);
            test.SetParentScores(test.A, Bilingual, 90, 85, 80);
            test.AddAttempt(test.A, Bilingual, 75, 72, 71);
            test.Run("Delete", test.A, null);
            test.AssertScores(test.A, Bilingual, 75, 72, 71);
            test.AssertStatus(test.A, Language.Accredited);
        }

        [Fact]
        public void DeletingFinalResultClearsAllSevenSummaryScoresAndPreservesUndefinedStatus()
        {
            var test = new Harness(Language.Bilingual);
            test.SetParentScores(test.A, Bilingual, 75, 72, 71);
            test.SetParentScores(test.A, English, 80, 81, 82, 83);
            test.SetParentStatus(test.A, Language.Accredited);
            test.Run("Delete", test.A, null);
            foreach (var score in Result.ComponentScores)
                Assert.Null(test.Parents[test.A].GetAttributeValue<decimal?>(score));
            Assert.Equal(7, test.Updates.Single().Attributes.Count);
            test.AssertStatus(test.A, Language.Accredited);
        }

        [Fact]
        public void MovingAttemptRecalculatesBothLanguages()
        {
            var test = new Harness(Language.Bilingual);
            test.SetParentScores(test.A, Bilingual, 90, 80, 75);
            test.AddAttempt(test.A, Bilingual, 70, 70, 70);
            test.AddAttempt(test.B, Bilingual, 90, 80, 75);
            test.AddAttempt(test.B, Bilingual, 95, 72, 71);
            test.Run("Update", test.A, test.B);
            test.AssertScores(test.A, Bilingual, 70, 70, 70);
            test.AssertScores(test.B, Bilingual, 95, 80, 75);
            Assert.Equal(2, test.Updates.Count);
        }

        [Theory]
        [InlineData(70, 70, 70, Language.Accredited)]
        [InlineData(70, 49, 90, Language.Unaccredited)]
        [InlineData(70, 60, 90, Language.ConditionalAccredited)]
        [InlineData(50, 69, 90, Language.ConditionalAccredited)]
        public void BilingualAccreditationUsesThresholds(int a, int b, int c, int status)
        {
            var test = new Harness(Language.Bilingual);
            test.AddAttempt(test.A, Bilingual, a, b, c);
            test.Run("Create", null, test.A);
            test.AssertStatus(test.A, status);
        }

        [Theory]
        [InlineData(Language.English, 70, 71, 72, 73, Language.Accredited)]
        [InlineData(Language.FirstNation, 70, 49, 72, 73, Language.Unaccredited)]
        [InlineData(Language.English, 70, 65, 72, 73, Language.ConditionalAccredited)]
        [InlineData(Language.FirstNation, 70, 65, 72, 73, Language.ConditionalAccredited)]
        public void EnglishAndFirstNationAccreditationUsesOnlyFourApplicableScores(int category, int a, int b, int c, int d, int status)
        {
            var test = new Harness(category);
            test.AddAttempt(test.A, Bilingual, 0, 0, 0);
            test.AddAttempt(test.A, English, a, b, c, d);
            test.Run("Create", null, test.A);
            test.AssertStatus(test.A, status);
        }

        [Fact]
        public void IncompleteApplicableScoresUpdateKnownMaximaButLeaveStatusUntouched()
        {
            var test = new Harness(Language.Bilingual);
            test.SetParentStatus(test.A, Language.Accredited);
            test.AddAttempt(test.A, Bilingual.Take(2).ToArray(), 40, 80);
            test.Run("Create", null, test.A);
            test.AssertScores(test.A, Bilingual.Take(2).ToArray(), 40, 80);
            Assert.False(test.Updates.Single().Contains(Language.AccreditationStatus));
            test.AssertStatus(test.A, Language.Accredited);
        }

        [Fact]
        public void MissingDeletePreImageFailsBeforeQuery()
        {
            var test = new Harness(Language.Bilingual);
            Assert.Contains(Result.PreImageAlias, Assert.Throws<InvalidPluginExecutionException>(() => test.Run("Delete", null, null)).Message);
            Assert.Empty(test.Updates);
        }

        private sealed class Harness
        {
            public readonly Guid A = Guid.NewGuid();
            public readonly Guid B = Guid.NewGuid();
            public readonly Dictionary<Guid, Entity> Parents = new Dictionary<Guid, Entity>();
            public readonly List<Entity> Attempts = new List<Entity>();
            public readonly List<Entity> Updates = new List<Entity>();
            public int PageSize { get; set; } = int.MaxValue;
            private readonly Mock<IOrganizationService> service = new Mock<IOrganizationService>(MockBehavior.Strict);
            private readonly Mock<IPluginExecutionContext> context = new Mock<IPluginExecutionContext>();
            private readonly Mock<IServiceProvider> provider = new Mock<IServiceProvider>();
            private readonly EntityImageCollection preImages = new EntityImageCollection();
            private readonly EntityImageCollection postImages = new EntityImageCollection();

            public Harness(int category)
            {
                Parents[A] = Parent(A, category);
                Parents[B] = Parent(B, category);
                var user = Guid.NewGuid();
                context.SetupGet(x => x.PrimaryEntityName).Returns(Result.Table);
                context.SetupGet(x => x.Stage).Returns(40);
                context.SetupGet(x => x.Mode).Returns(0);
                context.SetupGet(x => x.IsInTransaction).Returns(true);
                context.SetupGet(x => x.UserId).Returns(user);
                context.SetupGet(x => x.PreEntityImages).Returns(preImages);
                context.SetupGet(x => x.PostEntityImages).Returns(postImages);
                var factory = new Mock<IOrganizationServiceFactory>();
                factory.Setup(x => x.CreateOrganizationService(user)).Returns(service.Object);
                provider.Setup(x => x.GetService(typeof(IPluginExecutionContext))).Returns(context.Object);
                provider.Setup(x => x.GetService(typeof(IOrganizationServiceFactory))).Returns(factory.Object);
                provider.Setup(x => x.GetService(typeof(ITracingService))).Returns(new Mock<ITracingService>().Object);
                service.Setup(x => x.RetrieveMultiple(It.IsAny<QueryBase>()))
                    .Returns<QueryBase>(query =>
                    {
                        var expression = Assert.IsType<QueryExpression>(query);
                        var languageId = Assert.IsType<Guid>(expression.Criteria.Conditions.Single().Values.Single());
                        var matching = Attempts.Where(attempt =>
                            attempt.GetAttributeValue<EntityReference>(Result.InterpreterLanguage).Id == languageId).ToList();
                        var result = new EntityCollection(matching
                            .Skip((expression.PageInfo.PageNumber - 1) * PageSize).Take(PageSize).ToList())
                        {
                            MoreRecords = matching.Count > expression.PageInfo.PageNumber * PageSize,
                            PagingCookie = "page-" + expression.PageInfo.PageNumber
                        };
                        return result;
                    });
                service.Setup(x => x.Retrieve(Language.Table, It.IsAny<Guid>(), It.IsAny<ColumnSet>()))
                    .Returns<string, Guid, ColumnSet>((table, id, columns) => Copy(Parents[id], columns));
                service.Setup(x => x.Update(It.IsAny<Entity>())).Callback<Entity>(update =>
                {
                    Updates.Add(update);
                    foreach (var pair in update.Attributes)
                        Parents[update.Id][pair.Key] = pair.Value;
                });
            }

            public void AddAttempt(Guid languageId, string[] columns, params int[] values)
            {
                var attempt = new Entity(Result.Table, Guid.NewGuid())
                {
                    [Result.InterpreterLanguage] = new EntityReference(Language.Table, languageId)
                };
                for (var i = 0; i < columns.Length; i++) attempt[columns[i]] = (decimal)values[i];
                Attempts.Add(attempt);
            }

            public void SetParentScores(Guid id, string[] columns, params int[] values)
            {
                for (var i = 0; i < columns.Length; i++) Parents[id][columns[i]] = (decimal)values[i];
            }

            public void SetParentStatus(Guid id, int status) => Parents[id][Language.AccreditationStatus] = new OptionSetValue(status);

            public void Run(string message, Guid? oldLanguage, Guid? newLanguage)
            {
                context.SetupGet(x => x.MessageName).Returns(message);
                preImages.Clear();
                postImages.Clear();
                if (oldLanguage.HasValue) preImages[Result.PreImageAlias] = Image(oldLanguage.Value);
                if (newLanguage.HasValue) postImages[Result.PostImageAlias] = Image(newLanguage.Value);
                new RollupTestResultScoresPlugin().Execute(provider.Object);
            }

            public void AssertScores(Guid id, string[] columns, params int[] values)
            {
                for (var i = 0; i < columns.Length; i++)
                    Assert.Equal((decimal)values[i], Parents[id].GetAttributeValue<decimal?>(columns[i]));
            }

            public void AssertStatus(Guid id, int status) =>
                Assert.Equal(status, Parents[id].GetAttributeValue<OptionSetValue>(Language.AccreditationStatus).Value);

            private static Entity Parent(Guid id, int category) => new Entity(Language.Table, id)
            {
                [Language.LanguageCategory] = new OptionSetValue(category)
            };

            private static Entity Image(Guid languageId) => new Entity(Result.Table, Guid.NewGuid())
            {
                [Result.InterpreterLanguage] = new EntityReference(Language.Table, languageId)
            };

            private static Entity Copy(Entity source, ColumnSet columns)
            {
                var copy = new Entity(source.LogicalName, source.Id);
                foreach (var column in columns.Columns)
                    if (source.Contains(column)) copy[column] = source[column];
                return copy;
            }
        }
    }
}
