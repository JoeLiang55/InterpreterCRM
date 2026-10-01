using System;
using System.Collections.Generic;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Metadata;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using Xunit;

namespace InterpreterCRM.Plugins.Tests
{
    public sealed class ConversionReferenceNumberTests
    {
        [Fact]
        public void UsesConfirmedReferenceColumnNames()
        {
            Assert.Equal("gsic_applicationreferencenumber", DataverseSchema.Applicant.ApplicationReferenceNumber);
            Assert.Equal("gsic_interpreterreferencenumber", DataverseSchema.Interpreter.ReferenceNumber);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void ReferenceCopyPreservesRelatedLanguageCreation(bool automatic)
        {
            var test = new Harness(automatic);
            test.Applicant[DataverseSchema.Applicant.LanguagesAppliedFor] =
                new OptionSetValueCollection { new OptionSetValue(472540000) };
            test.Service.Setup(service => service.Execute(It.IsAny<OrganizationRequest>()))
                .Returns<OrganizationRequest>(request =>
                {
                    if (request is RetrieveAttributeRequest retrieve)
                    {
                        var options = new OptionSetMetadata();
                        options.Options.Add(new OptionMetadata(new Label("English", 1033), 472540000));
                        AttributeMetadata metadata = retrieve.EntityLogicalName == DataverseSchema.Applicant.Table
                            ? (AttributeMetadata)new MultiSelectPicklistAttributeMetadata { OptionSet = options }
                            : new PicklistAttributeMetadata { OptionSet = options };
                        var response = new RetrieveAttributeResponse();
                        response.Results["AttributeMetadata"] = metadata;
                        return response;
                    }
                    test.Updates.Add(Assert.IsType<UpdateRequest>(request));
                    return new UpdateResponse();
                });
            test.Run();
            Assert.Equal(2, test.Created.Count);
            var interpreter = test.Created[0];
            Assert.Equal("26-0010", interpreter[DataverseSchema.Interpreter.ReferenceNumber]);
            var language = test.Created[1];
            Assert.Equal(DataverseSchema.InterpreterLanguage.Table, language.LogicalName);
            Assert.Equal("English", language[DataverseSchema.InterpreterLanguage.LanguageName]);
            Assert.Equal(DataverseSchema.InterpreterLanguage.English,
                language.GetAttributeValue<OptionSetValue>(DataverseSchema.InterpreterLanguage.LanguageCategory).Value);
            var lookup = language.GetAttributeValue<EntityReference>(DataverseSchema.InterpreterLanguage.Interpreter);
            Assert.Equal(DataverseSchema.Interpreter.Table, lookup.LogicalName);
            Assert.Equal(test.InterpreterId, lookup.Id);
            Assert.Single(test.Updates);
        }

        [Theory]
        [InlineData(false, "26-0010")]
        [InlineData(true, "26-0010")]
        [InlineData(false, "APP-000001")]
        [InlineData(true, "APP-000001")]
        [InlineData(false, "0000123")]
        [InlineData(true, "0000123")]
        [InlineData(false, "  AbC-0007  ")]
        [InlineData(true, "  AbC-0007  ")]
        public void BothEntryPointsCopyExactReferenceAndPreserveMappings(bool automatic, string reference)
        {
            var test = new Harness(automatic);
            test.Applicant[DataverseSchema.Applicant.ApplicationReferenceNumber] = reference;
            test.Run();

            var interpreter = Assert.Single(test.Created);
            Assert.Equal(reference, interpreter[DataverseSchema.Interpreter.ReferenceNumber]);
            Assert.Equal("Ada Example", interpreter[DataverseSchema.Interpreter.Name]);
            Assert.Equal("555-0100", interpreter[DataverseSchema.Interpreter.Phone]);
            Assert.Equal("10 Main Street", interpreter[DataverseSchema.Interpreter.Address]);
            Assert.Equal(472540002, interpreter.GetAttributeValue<OptionSetValue>(DataverseSchema.Interpreter.Region).Value);
            Assert.Contains(DataverseSchema.Applicant.ApplicationReferenceNumber, test.RetrievedColumns.Columns);
            Assert.False(test.RetrievedColumns.AllColumns);

            var update = Assert.Single(test.Updates);
            Assert.Equal(ConcurrencyBehavior.IfRowVersionMatches, update.ConcurrencyBehavior);
            Assert.Equal("123", update.Target.RowVersion);
            Assert.Equal(test.Applicant.Id, update.Target.Id);
            Assert.True(update.Target.GetAttributeValue<bool>(DataverseSchema.Applicant.ArchiveApplication));
            var lookup = update.Target.GetAttributeValue<EntityReference>(DataverseSchema.Applicant.Interpreter);
            Assert.Equal(DataverseSchema.Interpreter.Table, lookup.LogicalName);
            Assert.Equal(test.InterpreterId, lookup.Id);
            Assert.Equal(2, update.Target.Attributes.Count);
            Assert.Equal(reference, test.Applicant[DataverseSchema.Applicant.ApplicationReferenceNumber]);
            if (!automatic)
                Assert.Equal(test.InterpreterId, test.Output[DataverseSchema.InterpreterIdResponse]);
        }

        [Theory]
        [InlineData(false, null)]
        [InlineData(true, null)]
        [InlineData(false, "")]
        [InlineData(true, "")]
        [InlineData(false, " \t\r\n")]
        [InlineData(true, " \t\r\n")]
        public void MissingReferenceRejectsBeforeAnyWrite(bool automatic, string reference)
        {
            var test = new Harness(automatic);
            if (reference == null)
                test.Applicant.Attributes.Remove(DataverseSchema.Applicant.ApplicationReferenceNumber);
            else
                test.Applicant[DataverseSchema.Applicant.ApplicationReferenceNumber] = reference;
            Assert.Equal("Applicant Application Reference Number is required to create an Interpreter profile.",
                Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.VerifyNoWrites();
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void NumericSourceRejectsRatherThanLosingFormatting(bool automatic)
        {
            var test = new Harness(automatic);
            test.Applicant[DataverseSchema.Applicant.ApplicationReferenceNumber] = 10;
            Assert.Contains("text column", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.VerifyNoWrites();
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void AlreadyLinkedApplicantDoesNotChangeExistingInterpreterEvenWithoutSource(bool automatic)
        {
            var test = new Harness(automatic);
            test.Applicant[DataverseSchema.Applicant.Interpreter] =
                new EntityReference(DataverseSchema.Interpreter.Table, Guid.NewGuid());
            test.Applicant.Attributes.Remove(DataverseSchema.Applicant.ApplicationReferenceNumber);
            if (automatic)
                test.Run();
            else
                Assert.Contains("already been created", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.VerifyNoWrites();
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void ConcurrentApplicantChangeStillUsesConditionalUpdateAndReturnsNoSuccess(bool automatic)
        {
            var test = new Harness(automatic);
            test.Service.Setup(service => service.Execute(It.IsAny<OrganizationRequest>()))
                .Callback<OrganizationRequest>(request => test.Updates.Add((UpdateRequest)request))
                .Throws(new FaultException<OrganizationServiceFault>(
                    new OrganizationServiceFault { ErrorCode = -2147088254 }));
            Assert.Contains("Applicant changed during conversion", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            Assert.Single(test.Created); // Mocks do not model platform transaction rollback.
            Assert.Equal(ConcurrencyBehavior.IfRowVersionMatches, Assert.Single(test.Updates).ConcurrencyBehavior);
            Assert.Empty(test.Output);
        }

        [Theory]
        [InlineData(false)]
        [InlineData(true)]
        public void MissingRowVersionStillRejectsBeforeCreating(bool automatic)
        {
            var test = new Harness(automatic);
            test.Applicant.RowVersion = null;
            Assert.Contains("row version", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.VerifyNoWrites();
        }

        [Fact]
        public void UnrelatedAndRepeatedScreeningUpdatesDoNotConvert()
        {
            var test = new Harness(true);
            test.Target.Attributes.Clear();
            test.Run();
            test.Target[DataverseSchema.Applicant.ApplicationStatus] = new OptionSetValue(DataverseSchema.Applicant.ScreeningCompleted);
            test.PreImage[DataverseSchema.Applicant.ApplicationStatus] = new OptionSetValue(DataverseSchema.Applicant.ScreeningCompleted);
            test.Run();
            test.Service.VerifyNoOtherCalls();
        }

        private sealed class Harness
        {
            private readonly bool automatic;
            private readonly Mock<IServiceProvider> provider = new Mock<IServiceProvider>(MockBehavior.Strict);
            public Entity Applicant { get; } = new Entity(DataverseSchema.Applicant.Table, Guid.NewGuid())
            {
                RowVersion = "123",
                [DataverseSchema.Applicant.Name] = " Ada Example ",
                [DataverseSchema.Applicant.ApplicationReferenceNumber] = "26-0010",
                [DataverseSchema.Applicant.Phone] = "555-0100",
                [DataverseSchema.Applicant.Address] = "10 Main Street",
                [DataverseSchema.Applicant.CourtRegion] = new OptionSetValue(472540002)
            };
            public Entity Target { get; }
            public Entity PreImage { get; }
            public Guid InterpreterId { get; } = Guid.NewGuid();
            public Mock<IOrganizationService> Service { get; } = new Mock<IOrganizationService>(MockBehavior.Strict);
            public List<Entity> Created { get; } = new List<Entity>();
            public List<UpdateRequest> Updates { get; } = new List<UpdateRequest>();
            public ParameterCollection Output { get; } = new ParameterCollection();
            public ColumnSet RetrievedColumns { get; private set; }

            public Harness(bool automatic)
            {
                this.automatic = automatic;
                Target = new Entity(DataverseSchema.Applicant.Table, Applicant.Id)
                {
                    [DataverseSchema.Applicant.ApplicationStatus] = new OptionSetValue(DataverseSchema.Applicant.ScreeningCompleted)
                };
                PreImage = new Entity(DataverseSchema.Applicant.Table, Applicant.Id)
                {
                    [DataverseSchema.Applicant.ApplicationStatus] = new OptionSetValue(DataverseSchema.Applicant.ToBeScreened)
                };
                var context = new Mock<IPluginExecutionContext>();
                var userId = Guid.NewGuid();
                context.SetupGet(value => value.MessageName).Returns(automatic ? "Update" : DataverseSchema.CreateInterpreterMessage);
                context.SetupGet(value => value.PrimaryEntityName).Returns(DataverseSchema.Applicant.Table);
                context.SetupGet(value => value.Stage).Returns(automatic ? 40 : 30);
                context.SetupGet(value => value.Mode).Returns(0);
                context.SetupGet(value => value.IsInTransaction).Returns(true);
                context.SetupGet(value => value.UserId).Returns(userId);
                context.SetupGet(value => value.OutputParameters).Returns(Output);
                context.SetupGet(value => value.InputParameters).Returns(new ParameterCollection
                {
                    [DataverseSchema.TargetParameter] = automatic ? (object)Target : Applicant.ToEntityReference()
                });
                context.SetupGet(value => value.PreEntityImages).Returns(new EntityImageCollection
                {
                    [DataverseSchema.ScreeningStatusPreImage] = PreImage
                });
                var factory = new Mock<IOrganizationServiceFactory>(MockBehavior.Strict);
                factory.Setup(value => value.CreateOrganizationService(userId)).Returns(Service.Object);
                provider.Setup(value => value.GetService(typeof(IPluginExecutionContext))).Returns(context.Object);
                provider.Setup(value => value.GetService(typeof(ITracingService))).Returns(new Mock<ITracingService>().Object);
                provider.Setup(value => value.GetService(typeof(IOrganizationServiceFactory))).Returns(factory.Object);
                Service.Setup(value => value.Retrieve(DataverseSchema.Applicant.Table, Applicant.Id, It.IsAny<ColumnSet>()))
                    .Returns<string, Guid, ColumnSet>((table, id, columns) =>
                    {
                        RetrievedColumns = columns;
                        var result = new Entity(table, id) { RowVersion = Applicant.RowVersion };
                        foreach (var column in columns.Columns)
                            if (Applicant.Contains(column)) result[column] = Applicant[column];
                        return result;
                    });
                Service.Setup(value => value.Create(It.IsAny<Entity>()))
                    .Callback<Entity>(entity => Created.Add(entity)).Returns(InterpreterId);
                Service.Setup(value => value.Execute(It.IsAny<OrganizationRequest>()))
                    .Returns<OrganizationRequest>(request =>
                    {
                        var update = Assert.IsType<UpdateRequest>(request);
                        Updates.Add(update);
                        return new UpdateResponse();
                    });
            }

            public void Run()
            {
                IPlugin plugin = automatic ? (IPlugin)new CreateInterpreterAfterScreeningPlugin() : new CreateInterpreterFromApplicantPlugin();
                plugin.Execute(provider.Object);
            }

            public void VerifyNoWrites()
            {
                Assert.Empty(Created);
                Assert.Empty(Updates);
                Assert.Empty(Output);
                Service.Verify(value => value.Create(It.IsAny<Entity>()), Times.Never);
                Service.Verify(value => value.Execute(It.IsAny<OrganizationRequest>()), Times.Never);
                Service.Verify(value => value.Update(It.IsAny<Entity>()), Times.Never);
            }
        }
    }
}
