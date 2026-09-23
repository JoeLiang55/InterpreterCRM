using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using Xunit;

namespace InterpreterCRM.Plugins.Tests
{
    public sealed class CreateInterpreterAfterScreeningPluginTests
    {
        [Fact]
        public void UnrelatedApplicantUpdateDoesNotRetrieveOrCreateInterpreter()
        {
            var test = new Harness();
            test.Run();
            test.Service.VerifyNoOtherCalls();
            test.Factory.Verify(factory => factory.CreateOrganizationService(It.IsAny<Guid>()), Times.Never);
        }

        [Fact]
        public void StatusOtherThanScreeningCompletedDoesNotCreateInterpreter()
        {
            var test = new Harness();
            test.SetStatusChange(472540000, 472540002);
            test.Run();
            test.Service.VerifyNoOtherCalls();
            test.Factory.Verify(factory => factory.CreateOrganizationService(It.IsAny<Guid>()), Times.Never);
        }

        [Fact]
        public void ApplicantAlreadyAtScreeningCompletedDoesNotCreateInterpreterAgain()
        {
            var test = new Harness();
            test.SetStatusChange(DataverseSchema.Applicant.ScreeningCompleted, DataverseSchema.Applicant.ScreeningCompleted);
            test.Run();
            test.Service.VerifyNoOtherCalls();
            test.Factory.Verify(factory => factory.CreateOrganizationService(It.IsAny<Guid>()), Times.Never);
        }

        [Fact]
        public void TransitionToScreeningCompletedCreatesAndLinksMappedInterpreter()
        {
            var test = new Harness();
            test.SetStatusChange(DataverseSchema.Applicant.ScreeningCompleted, 472540002);
            test.Run();

            var interpreter = Assert.Single(test.Created);
            Assert.Equal(DataverseSchema.Interpreter.Table, interpreter.LogicalName);
            Assert.Equal("Mina Example", interpreter[DataverseSchema.Interpreter.Name]);
            Assert.Equal("555-0100", interpreter[DataverseSchema.Interpreter.Phone]);
            Assert.Equal("10 Main Street", interpreter[DataverseSchema.Interpreter.Address]);
            Assert.Equal(472540003, interpreter.GetAttributeValue<OptionSetValue>(DataverseSchema.Interpreter.Region).Value);

            var update = Assert.Single(test.Updates).Target;
            Assert.True(update.GetAttributeValue<bool>(DataverseSchema.Applicant.ArchiveApplication));
            var interpreterReference = update.GetAttributeValue<EntityReference>(DataverseSchema.Applicant.Interpreter);
            Assert.Equal(test.InterpreterId, interpreterReference.Id);
            Assert.Equal(DataverseSchema.Interpreter.Table, interpreterReference.LogicalName);
            test.Service.Verify(service => service.Create(It.IsAny<Entity>()), Times.Once);
        }

        [Fact]
        public void ApplicantAlreadyLinkedSkipsInterpreterCreation()
        {
            var test = new Harness();
            test.SetStatusChange(DataverseSchema.Applicant.ScreeningCompleted, 472540002);
            test.Applicant[DataverseSchema.Applicant.Interpreter] = new EntityReference(DataverseSchema.Interpreter.Table, Guid.NewGuid());
            test.Run();
            Assert.Empty(test.Created);
            Assert.Empty(test.Updates);
            test.Service.Verify(service => service.Create(It.IsAny<Entity>()), Times.Never);
            test.Service.Verify(service => service.Execute(It.IsAny<OrganizationRequest>()), Times.Never);
        }

        private sealed class Harness
        {
            public Guid ApplicantId { get; } = Guid.NewGuid();
            public Guid InterpreterId { get; } = Guid.NewGuid();
            public Entity Applicant { get; }
            public Entity Target { get; }
            public EntityImageCollection PreImages { get; } = new EntityImageCollection();
            public Mock<IOrganizationService> Service { get; } = new Mock<IOrganizationService>(MockBehavior.Strict);
            public Mock<IOrganizationServiceFactory> Factory { get; } = new Mock<IOrganizationServiceFactory>(MockBehavior.Strict);
            public List<Entity> Created { get; } = new List<Entity>();
            public List<UpdateRequest> Updates { get; } = new List<UpdateRequest>();
            private readonly Mock<IPluginExecutionContext> context = new Mock<IPluginExecutionContext>();
            private readonly Mock<IServiceProvider> provider = new Mock<IServiceProvider>(MockBehavior.Strict);

            public Harness()
            {
                Applicant = new Entity(DataverseSchema.Applicant.Table, ApplicantId)
                {
                    RowVersion = "123",
                    [DataverseSchema.Applicant.Name] = "Mina Example",
                    [DataverseSchema.Applicant.Phone] = "555-0100",
                    [DataverseSchema.Applicant.Address] = "10 Main Street",
                    [DataverseSchema.Applicant.CourtRegion] = new OptionSetValue(472540003)
                };
                Target = new Entity(DataverseSchema.Applicant.Table, ApplicantId);

                var userId = Guid.NewGuid();
                context.SetupGet(value => value.InputParameters).Returns(new ParameterCollection
                {
                    [DataverseSchema.TargetParameter] = Target
                });
                context.SetupGet(value => value.PreEntityImages).Returns(PreImages);
                context.SetupGet(value => value.MessageName).Returns("Update");
                context.SetupGet(value => value.PrimaryEntityName).Returns(DataverseSchema.Applicant.Table);
                context.SetupGet(value => value.Stage).Returns(40);
                context.SetupGet(value => value.Mode).Returns(0);
                context.SetupGet(value => value.IsInTransaction).Returns(true);
                context.SetupGet(value => value.UserId).Returns(userId);
                context.SetupGet(value => value.CorrelationId).Returns(Guid.NewGuid());

                var tracing = new Mock<ITracingService>();
                var callbackFactory = Factory;
                Factory.Setup(value => value.CreateOrganizationService(userId)).Returns(Service.Object);
                provider.Setup(value => value.GetService(typeof(IPluginExecutionContext))).Returns(context.Object);
                provider.Setup(value => value.GetService(typeof(ITracingService))).Returns(tracing.Object);
                provider.Setup(value => value.GetService(typeof(IOrganizationServiceFactory))).Returns(callbackFactory.Object);

                Service.Setup(value => value.Retrieve(DataverseSchema.Applicant.Table, ApplicantId, It.IsAny<ColumnSet>()))
                    .Returns<string, Guid, ColumnSet>((table, id, columns) =>
                    {
                        var retrieved = new Entity(table, id) { RowVersion = Applicant.RowVersion };
                        foreach (var column in columns.Columns)
                            if (Applicant.Contains(column)) retrieved[column] = Applicant[column];
                        return retrieved;
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

            public void SetStatusChange(int newStatus, int oldStatus)
            {
                Target[DataverseSchema.Applicant.ApplicationStatus] = new OptionSetValue(newStatus);
                PreImages[DataverseSchema.ScreeningStatusPreImage] = new Entity(DataverseSchema.Applicant.Table, ApplicantId)
                {
                    [DataverseSchema.Applicant.ApplicationStatus] = new OptionSetValue(oldStatus)
                };
            }

            public void Run() => new CreateInterpreterAfterScreeningPlugin().Execute(provider.Object);
        }
    }
}
