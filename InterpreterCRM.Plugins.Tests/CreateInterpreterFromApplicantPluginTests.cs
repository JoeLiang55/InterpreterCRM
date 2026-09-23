using System;
using System.Collections.Generic;
using System.Linq;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using Xunit;

namespace InterpreterCRM.Plugins.Tests
{
    public sealed class CreateInterpreterFromApplicantPluginTests
    {
        [Fact]
        public void DataverseSchemaUsesVerifiedLogicalNamesAndApiContract()
        {
            Assert.Equal("gsic_CreateInterpreterFromApplicant", DataverseSchema.CreateInterpreterMessage);
            Assert.Equal("Target", DataverseSchema.TargetParameter);
            Assert.Equal("InterpreterId", DataverseSchema.InterpreterIdResponse);

            Assert.Equal("gsic_applicant", DataverseSchema.Applicant.Table);
            Assert.Equal("gsic_applicantname", DataverseSchema.Applicant.Name);
            Assert.Equal("gsic_emailaddress", DataverseSchema.Applicant.Email);
            Assert.Equal("gsic_applicationstatus", DataverseSchema.Applicant.ApplicationStatus);
            Assert.Equal(472540001, DataverseSchema.Applicant.ScreeningCompleted);
            Assert.Equal("gsic_phone", DataverseSchema.Applicant.Phone);
            Assert.Equal("gsic_address", DataverseSchema.Applicant.Address);
            Assert.Equal("gsic_city", DataverseSchema.Applicant.City);
            Assert.Equal("gsic_province", DataverseSchema.Applicant.Province);
            Assert.Equal("gsic_postalcode", DataverseSchema.Applicant.PostalCode);
            Assert.Equal("gsic_country", DataverseSchema.Applicant.Country);
            Assert.Equal("gsic_courtregion", DataverseSchema.Applicant.CourtRegion);
            Assert.Equal("gsic_interpreter", DataverseSchema.Applicant.Interpreter);
            Assert.Equal("gsic_archiveapplication", DataverseSchema.Applicant.ArchiveApplication);

            Assert.Equal("gsic_interpreter", DataverseSchema.Interpreter.Table);
            Assert.Equal("gsic_name", DataverseSchema.Interpreter.Name);
            Assert.Equal("gsic_phone", DataverseSchema.Interpreter.Phone);
            Assert.Equal("gsic_address", DataverseSchema.Interpreter.Address);
            Assert.Equal("gsic_region", DataverseSchema.Interpreter.Region);
            Assert.Equal(2, DataverseSchema.OptionalTextMappings.Count);
            Assert.Equal(DataverseSchema.Interpreter.Phone, DataverseSchema.OptionalTextMappings[DataverseSchema.Applicant.Phone]);
            Assert.Equal(DataverseSchema.Interpreter.Address, DataverseSchema.OptionalTextMappings[DataverseSchema.Applicant.Address]);
        }

        [Fact]
        public void ValidApplicantCreatesExactlyOneInterpreter()
        {
            var test = new Harness();
            test.Run();
            var created = Assert.Single(test.Created);
            Assert.Equal(DataverseSchema.Interpreter.Table, created.LogicalName);
            Assert.Equal(test.InterpreterId, test.Output[DataverseSchema.InterpreterIdResponse]);
            test.Service.Verify(service => service.Create(It.IsAny<Entity>()), Times.Once);
        }

        [Fact]
        public void CopiesApplicantNameOptionalTextFieldsAndCourtRegion()
        {
            var test = new Harness();
            test.Applicant[DataverseSchema.Applicant.Name] = "  Ada Lovelace  ";
            foreach (var mapping in DataverseSchema.OptionalTextMappings)
                test.Applicant[mapping.Key] = "Value for " + mapping.Key;
            test.Applicant[DataverseSchema.Applicant.CourtRegion] = new OptionSetValue(472540002);

            test.Run();
            var created = Assert.Single(test.Created);
            Assert.Equal("Ada Lovelace", created[DataverseSchema.Interpreter.Name]);
            foreach (var mapping in DataverseSchema.OptionalTextMappings)
                Assert.Equal(test.Applicant[mapping.Key], created[mapping.Value]);
            Assert.Equal(new OptionSetValue(472540002), created.GetAttributeValue<OptionSetValue>(DataverseSchema.Interpreter.Region));
            Assert.Equal(2 + DataverseSchema.OptionalTextMappings.Count, created.Attributes.Count);
        }

        [Theory]
        [InlineData(472540000)]
        [InlineData(472540001)]
        [InlineData(472540002)]
        [InlineData(472540003)]
        public void CopiesCourtRegionChoiceValueDirectly(int optionValue)
        {
            var test = new Harness();
            test.Applicant[DataverseSchema.Applicant.CourtRegion] = new OptionSetValue(optionValue);
            test.Run();
            Assert.Equal(optionValue, Assert.Single(test.Created).GetAttributeValue<OptionSetValue>(DataverseSchema.Interpreter.Region).Value);
        }

        [Fact]
        public void MissingCourtRegionDoesNotWriteInterpreterRegion()
        {
            var test = new Harness();
            test.Run();
            Assert.False(Assert.Single(test.Created).Contains(DataverseSchema.Interpreter.Region));
        }

        [Fact]
        public void LinksApplicantAndArchivesUsingConditionalMinimalUpdate()
        {
            var test = new Harness();
            test.Run();
            var request = Assert.Single(test.Updates);
            Assert.Equal(ConcurrencyBehavior.IfRowVersionMatches, request.ConcurrencyBehavior);
            Assert.Equal("123", request.Target.RowVersion);
            Assert.Equal(test.Applicant.Id, request.Target.Id);
            Assert.Equal(DataverseSchema.Applicant.Table, request.Target.LogicalName);
            var reference = request.Target.GetAttributeValue<EntityReference>(DataverseSchema.Applicant.Interpreter);
            Assert.Equal(test.InterpreterId, reference.Id);
            Assert.Equal(DataverseSchema.Interpreter.Table, reference.LogicalName);
            Assert.True(request.Target.GetAttributeValue<bool>(DataverseSchema.Applicant.ArchiveApplication));
            Assert.Equal(2, request.Target.Attributes.Count); // No status, language, or unrelated writes.
        }

        [Fact]
        public void AlreadyArchivedDoesNotWriteArchiveAgain()
        {
            var test = new Harness();
            test.Applicant[DataverseSchema.Applicant.ArchiveApplication] = true;
            test.Run();
            Assert.False(Assert.Single(test.Updates).Target.Contains(DataverseSchema.Applicant.ArchiveApplication));
        }

        [Fact]
        public void ExistingInterpreterRejectsBeforeValidationOrCreation()
        {
            var test = new Harness();
            test.Applicant[DataverseSchema.Applicant.Interpreter] = new EntityReference(DataverseSchema.Interpreter.Table, Guid.NewGuid());
            test.Applicant.Attributes.Remove(DataverseSchema.Applicant.Name);
            var exception = Assert.Throws<InvalidPluginExecutionException>(test.Run);
            Assert.Equal("An Interpreter profile has already been created for this applicant.", exception.Message);
            test.VerifyNoWrites();
        }

        [Fact]
        public void RepeatInvocationDoesNotCreateDuplicate()
        {
            var test = new Harness();
            test.Run();
            Assert.Throws<InvalidPluginExecutionException>(test.Run);
            Assert.Single(test.Created);
            Assert.Single(test.Updates);
            test.Service.Verify(service => service.Create(It.IsAny<Entity>()), Times.Once);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("  ")]
        public void MissingRequiredNameRejectsBeforeCreation(string value)
        {
            var test = new Harness();
            test.Applicant[DataverseSchema.Applicant.Name] = value;
            var exception = Assert.Throws<InvalidPluginExecutionException>(test.Run);
            Assert.Contains("Applicant Name is required", exception.Message);
            test.VerifyNoWrites();
        }

        [Fact]
        public void AbsentApplicantNameRejectsBeforeCreation()
        {
            var test = new Harness();
            test.Applicant.Attributes.Remove(DataverseSchema.Applicant.Name);
            Assert.Contains("Applicant Name is required", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.VerifyNoWrites();
        }

        [Fact]
        public void RetrievesOnlyRequiredColumnsFromBoundTarget()
        {
            var test = new Harness();
            test.Run();
            Assert.False(test.RetrievedColumns.AllColumns);
            var expected = DataverseSchema.OptionalTextMappings.Keys.Concat(new[]
            {
                DataverseSchema.Applicant.Name, DataverseSchema.Applicant.CourtRegion,
                DataverseSchema.Applicant.Interpreter, DataverseSchema.Applicant.ArchiveApplication
            }).OrderBy(column => column);
            Assert.Equal(expected, test.RetrievedColumns.Columns.OrderBy(column => column));
            test.Service.Verify(service => service.RetrieveMultiple(It.IsAny<QueryBase>()), Times.Never);
            test.Service.Verify(service => service.Retrieve(DataverseSchema.Applicant.Table, test.Applicant.Id, It.IsAny<ColumnSet>()), Times.Once);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(1)]
        [InlineData(2)]
        [InlineData(3)]
        public void InvalidBoundTargetRejectsBeforeRetrieval(int invalidTarget)
        {
            var test = new Harness();
            test.Input.Clear();
            if (invalidTarget == 1) test.Input[DataverseSchema.TargetParameter] = test.Applicant;
            if (invalidTarget == 2) test.Input[DataverseSchema.TargetParameter] = new EntityReference(DataverseSchema.Interpreter.Table, Guid.NewGuid());
            if (invalidTarget == 3) test.Input[DataverseSchema.TargetParameter] = new EntityReference(DataverseSchema.Applicant.Table, Guid.Empty);
            Assert.Contains("bound Target", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.Service.VerifyNoOtherCalls();
        }

        [Theory]
        [InlineData("Update", 30, 0, true)]
        [InlineData(null, 20, 0, true)]
        [InlineData(null, 30, 1, true)]
        [InlineData(null, 30, 0, false)]
        public void WrongMessageStageModeOrTransactionRejects(string message, int stage, int mode, bool inTransaction)
        {
            var test = new Harness();
            test.Context.SetupGet(context => context.MessageName).Returns(message ?? DataverseSchema.CreateInterpreterMessage);
            test.Context.SetupGet(context => context.Stage).Returns(stage);
            test.Context.SetupGet(context => context.Mode).Returns(mode);
            test.Context.SetupGet(context => context.IsInTransaction).Returns(inTransaction);
            Assert.Throws<InvalidPluginExecutionException>(test.Run);
            test.Service.VerifyNoOtherCalls();
        }

        [Fact]
        public void RecursiveConversionRejectsBeforeRetrieval()
        {
            var test = new Harness();
            var parent = new Mock<IPluginExecutionContext>();
            parent.SetupGet(context => context.MessageName).Returns(DataverseSchema.CreateInterpreterMessage);
            test.Context.SetupGet(context => context.ParentContext).Returns(parent.Object);
            Assert.Contains("Recursive", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.Service.VerifyNoOtherCalls();
        }

        [Fact]
        public void MissingRowVersionRejectsBeforeCreation()
        {
            var test = new Harness();
            test.Applicant.RowVersion = null;
            Assert.Contains("row version", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.VerifyNoWrites();
        }

        [Fact]
        public void IncompatibleTextFieldRejectsBeforeCreation()
        {
            var test = new Harness();
            test.Applicant[DataverseSchema.Applicant.Phone] = new OptionSetValue(1); // Test-only incompatible type.
            Assert.Contains("text column", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.VerifyNoWrites();
        }

        [Fact]
        public void BlankOptionalValuesAreNotWritten()
        {
            var test = new Harness();
            test.Applicant[DataverseSchema.Applicant.Address] = "  ";
            test.Applicant[DataverseSchema.Applicant.Phone] = null;
            test.Run();
            Assert.Single(Assert.Single(test.Created).Attributes);
        }

        [Fact]
        public void SuccessfulExecutionTracesProgressWithoutApplicantValues()
        {
            var test = new Harness();
            test.Run();
            Assert.Contains(test.Traces, trace => trace.Contains("started") && trace.Contains("CorrelationId="));
            Assert.Contains(test.Traces, trace => trace.Contains("Retrieving Applicant"));
            Assert.Contains(test.Traces, trace => trace.Contains("Creating Interpreter"));
            Assert.Contains(test.Traces, trace => trace.Contains("row-version check"));
            Assert.Contains(test.Traces, trace => trace.Contains("completed"));
            Assert.DoesNotContain(test.Traces, trace => trace.Contains("Ada") || trace.Contains("Lovelace"));
        }

        [Fact]
        public void ValidationFailureIsTraced()
        {
            var test = new Harness();
            test.Applicant[DataverseSchema.Applicant.Name] = null;
            Assert.Throws<InvalidPluginExecutionException>(test.Run);
            Assert.Contains(test.Traces, trace => trace.Contains("Conversion rejected:") && trace.Contains("Applicant Name"));
        }

        [Fact]
        public void RetrieveFaultIsWrappedAndCreatesNothing()
        {
            var test = new Harness();
            var fault = new FaultException<OrganizationServiceFault>(new OrganizationServiceFault { ErrorCode = -1 });
            test.Service.Setup(service => service.Retrieve(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<ColumnSet>())).Throws(fault);
            var exception = Assert.Throws<InvalidPluginExecutionException>(test.Run);
            Assert.Same(fault, exception.InnerException);
            Assert.Contains("permissions", exception.Message);
            Assert.Contains(test.Traces, trace => trace.Contains("Code=-1"));
            test.VerifyNoWrites();
        }

        [Fact]
        public void CreateFailureDoesNotUpdateOrReturnSuccess()
        {
            var test = new Harness();
            var failure = new InvalidOperationException("Simulated internal failure");
            test.Service.Setup(service => service.Create(It.IsAny<Entity>())).Throws(failure);
            var exception = Assert.Throws<InvalidPluginExecutionException>(test.Run);
            Assert.Same(failure, exception.InnerException);
            Assert.Empty(test.Updates);
            Assert.Empty(test.Output);
            Assert.Contains(test.Traces, trace => trace.Contains("Unexpected conversion failure"));
        }

        [Theory]
        [InlineData(-1, "conversion was not completed")]
        [InlineData(-2147088254, "Applicant changed during conversion")]
        public void UpdateFailurePropagatesAfterCreateForPlatformRollback(int faultCode, string message)
        {
            var test = new Harness();
            var fault = new FaultException<OrganizationServiceFault>(new OrganizationServiceFault { ErrorCode = faultCode });
            test.Service.Setup(service => service.Execute(It.IsAny<OrganizationRequest>())).Throws(fault);
            var exception = Assert.Throws<InvalidPluginExecutionException>(test.Run);
            Assert.Contains(message, exception.Message);
            Assert.Same(fault, exception.InnerException);
            Assert.Single(test.Created); // Mock has no database transaction: NOT a rollback assertion.
            Assert.Empty(test.Output);
            Assert.DoesNotContain(test.Traces, trace => trace.Contains("completed"));
            test.Service.Verify(service => service.Create(It.IsAny<Entity>()), Times.Once);
            test.Service.Verify(service => service.Execute(It.Is<UpdateRequest>(request => request.ConcurrencyBehavior == ConcurrencyBehavior.IfRowVersionMatches)), Times.Once);
        }

        [Fact]
        public void EmptyCreatedIdRejectsWithoutUpdatingApplicant()
        {
            var test = new Harness();
            test.Service.Setup(service => service.Create(It.IsAny<Entity>())).Returns(Guid.Empty);
            Assert.Contains("Interpreter ID", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            Assert.Empty(test.Updates);
            Assert.Empty(test.Output);
        }

        [Fact]
        public void MissingServiceProviderHasUsefulError()
        {
            Assert.Contains("service provider", Assert.Throws<InvalidPluginExecutionException>(
                () => new CreateInterpreterFromApplicantPlugin().Execute(null)).Message);
        }

        private sealed class Harness
        {
            public Entity Applicant { get; } = new Entity(DataverseSchema.Applicant.Table, Guid.NewGuid())
            {
                RowVersion = "123",
                [DataverseSchema.Applicant.Name] = "Ada Lovelace"
            };
            public Guid InterpreterId { get; } = Guid.NewGuid();
            public Mock<IOrganizationService> Service { get; } = new Mock<IOrganizationService>(MockBehavior.Strict);
            public Mock<IPluginExecutionContext> Context { get; } = new Mock<IPluginExecutionContext>();
            public ParameterCollection Input { get; } = new ParameterCollection();
            public ParameterCollection Output { get; } = new ParameterCollection();
            public List<Entity> Created { get; } = new List<Entity>();
            public List<UpdateRequest> Updates { get; } = new List<UpdateRequest>();
            public List<string> Traces { get; } = new List<string>();
            public ColumnSet RetrievedColumns { get; private set; }
            private readonly Mock<IServiceProvider> provider = new Mock<IServiceProvider>(MockBehavior.Strict);

            public Harness()
            {
                var userId = Guid.NewGuid();
                Input[DataverseSchema.TargetParameter] = Applicant.ToEntityReference();
                Context.SetupGet(context => context.InputParameters).Returns(Input);
                Context.SetupGet(context => context.OutputParameters).Returns(Output);
                Context.SetupGet(context => context.MessageName).Returns(DataverseSchema.CreateInterpreterMessage);
                Context.SetupGet(context => context.Stage).Returns(30);
                Context.SetupGet(context => context.Mode).Returns(0);
                Context.SetupGet(context => context.IsInTransaction).Returns(true);
                Context.SetupGet(context => context.UserId).Returns(userId);
                Context.SetupGet(context => context.CorrelationId).Returns(Guid.NewGuid());
                var tracing = new Mock<ITracingService>();
                tracing.Setup(service => service.Trace(It.IsAny<string>(), It.IsAny<object[]>()))
                    .Callback<string, object[]>((format, values) => Traces.Add(string.Format(format, values)));
                var factory = new Mock<IOrganizationServiceFactory>(MockBehavior.Strict);
                factory.Setup(service => service.CreateOrganizationService(userId)).Returns(Service.Object);
                provider.Setup(service => service.GetService(typeof(IPluginExecutionContext))).Returns(Context.Object);
                provider.Setup(service => service.GetService(typeof(ITracingService))).Returns(tracing.Object);
                provider.Setup(service => service.GetService(typeof(IOrganizationServiceFactory))).Returns(factory.Object);
                Service.Setup(service => service.Retrieve(DataverseSchema.Applicant.Table, Applicant.Id, It.IsAny<ColumnSet>()))
                    .Returns<string, Guid, ColumnSet>((table, id, columns) =>
                    {
                        RetrievedColumns = columns;
                        var retrieved = new Entity(table, id) { RowVersion = Applicant.RowVersion };
                        foreach (var column in columns.Columns)
                            if (Applicant.Contains(column)) retrieved[column] = Applicant[column];
                        return retrieved;
                    });
                Service.Setup(service => service.Create(It.IsAny<Entity>()))
                    .Callback<Entity>(entity => Created.Add(entity)).Returns(InterpreterId);
                Service.Setup(service => service.Execute(It.IsAny<OrganizationRequest>()))
                    .Returns<OrganizationRequest>(request =>
                    {
                        var update = Assert.IsType<UpdateRequest>(request);
                        Updates.Add(update);
                        foreach (var field in update.Target.Attributes) Applicant[field.Key] = field.Value;
                        Applicant.RowVersion = "124";
                        return new UpdateResponse();
                    });
            }

            public void Run() => new CreateInterpreterFromApplicantPlugin().Execute(provider.Object);

            public void VerifyNoWrites()
            {
                Assert.Empty(Created);
                Assert.Empty(Updates);
                Assert.Empty(Output);
                Service.Verify(service => service.Create(It.IsAny<Entity>()), Times.Never);
                Service.Verify(service => service.Execute(It.IsAny<OrganizationRequest>()), Times.Never);
                Service.Verify(service => service.Update(It.IsAny<Entity>()), Times.Never);
            }
        }
    }
}
