using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Moq;
using Xunit;
using Bpf = InterpreterCRM.Plugins.DataverseSchema.InterpreterAccreditationProcess;

namespace InterpreterCRM.Plugins.Tests
{
    public sealed class SyncApplicantStatusFromBpfStagePluginTests
    {
        [Fact]
        public void ScreeningToProfileCreationUpdatesOnlyApplicantStatus()
        {
            var test = new Harness();
            test.SetStageChange(Bpf.ScreeningStage, Bpf.ProfileCreationStage);
            test.Run();

            var update = Assert.Single(test.Updates);
            Assert.Equal(DataverseSchema.Applicant.Table, update.LogicalName);
            Assert.Equal(test.Applicant.Id, update.Id);
            Assert.Single(update.Attributes);
            Assert.Equal(DataverseSchema.Applicant.ScreeningCompleted,
                update.GetAttributeValue<OptionSetValue>(DataverseSchema.Applicant.ApplicationStatus).Value);
            test.Service.Verify(service => service.Create(It.IsAny<Entity>()), Times.Never);
        }

        [Fact]
        public void ApplicationReceivedToScreeningDoesNotUpdateApplicant()
        {
            var test = new Harness();
            test.SetStageChange(Bpf.ApplicationReceivedStage, Bpf.ScreeningStage);
            test.Run();
            test.VerifyNoServiceCalls();
        }

        [Fact]
        public void UnchangedActiveStageDoesNotUpdateApplicant()
        {
            var test = new Harness();
            test.SetStageChange(Bpf.ProfileCreationStage, Bpf.ProfileCreationStage);
            test.Run();
            test.VerifyNoServiceCalls();
        }

        [Fact]
        public void UnrelatedBpfUpdateDoesNotRetrieveApplicant()
        {
            var test = new Harness();
            test.Target[Bpf.Applicant] = test.BpfInstance[Bpf.Applicant];
            test.Run();
            test.VerifyNoServiceCalls();
        }

        [Fact]
        public void ApplicantAlreadyScreeningCompletedDoesNotReceiveAnotherUpdate()
        {
            var test = new Harness();
            test.SetStageChange(Bpf.ScreeningStage, Bpf.ProfileCreationStage);
            test.Applicant[DataverseSchema.Applicant.ApplicationStatus] =
                new OptionSetValue(DataverseSchema.Applicant.ScreeningCompleted);
            test.Run();
            Assert.Empty(test.Updates);
            test.Service.Verify(service => service.Retrieve(DataverseSchema.Applicant.Table, test.Applicant.Id, It.IsAny<ColumnSet>()), Times.Once);
            test.Service.Verify(service => service.Update(It.IsAny<Entity>()), Times.Never);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(1)]
        [InlineData(2)]
        [InlineData(3)]
        public void MissingOrInvalidApplicantLookupSkipsStatusUpdate(int invalidLookup)
        {
            var test = new Harness();
            test.SetStageChange(Bpf.ScreeningStage, Bpf.ProfileCreationStage);
            if (invalidLookup == 0) test.BpfInstance.Attributes.Remove(Bpf.Applicant);
            if (invalidLookup == 1) test.BpfInstance[Bpf.Applicant] = new EntityReference(DataverseSchema.Interpreter.Table, Guid.NewGuid());
            if (invalidLookup == 2) test.BpfInstance[Bpf.Applicant] = new EntityReference(DataverseSchema.Applicant.Table, Guid.Empty);
            if (invalidLookup == 3) test.BpfInstance[Bpf.Applicant] = "invalid lookup";

            test.Run();
            Assert.Empty(test.Updates);
            test.Service.Verify(service => service.Retrieve(DataverseSchema.Applicant.Table, It.IsAny<Guid>(), It.IsAny<ColumnSet>()), Times.Never);
            test.Service.Verify(service => service.Update(It.IsAny<Entity>()), Times.Never);
        }

        [Fact]
        public void MissingPreImageRejectsWithoutServiceCalls()
        {
            var test = new Harness();
            test.SetStageChange(Bpf.ScreeningStage, Bpf.ProfileCreationStage);
            test.PreImages.Clear();
            Assert.Contains("pre-image", Assert.Throws<InvalidPluginExecutionException>(test.Run).Message);
            test.VerifyNoServiceCalls();
        }

        [Fact]
        public void IncorrectPreImageStageDoesNotUpdateApplicant()
        {
            var test = new Harness();
            test.SetStageChange(Bpf.ApplicationReceivedStage, Bpf.ProfileCreationStage);
            test.Run();
            test.VerifyNoServiceCalls();
        }

        private sealed class Harness
        {
            public Entity Target { get; }
            public Entity BpfInstance { get; }
            public Entity Applicant { get; }
            public EntityImageCollection PreImages { get; } = new EntityImageCollection();
            public Mock<IOrganizationService> Service { get; } = new Mock<IOrganizationService>(MockBehavior.Strict);
            public Mock<IOrganizationServiceFactory> Factory { get; } = new Mock<IOrganizationServiceFactory>(MockBehavior.Strict);
            public List<Entity> Updates { get; } = new List<Entity>();
            private readonly Mock<IPluginExecutionContext> context = new Mock<IPluginExecutionContext>();
            private readonly Mock<IServiceProvider> provider = new Mock<IServiceProvider>(MockBehavior.Strict);

            public Harness()
            {
                var bpfId = Guid.NewGuid();
                var applicantId = Guid.NewGuid();
                var userId = Guid.NewGuid();
                Target = new Entity(Bpf.Table, bpfId);
                BpfInstance = new Entity(Bpf.Table, bpfId)
                {
                    [Bpf.Applicant] = new EntityReference(DataverseSchema.Applicant.Table, applicantId)
                };
                Applicant = new Entity(DataverseSchema.Applicant.Table, applicantId)
                {
                    [DataverseSchema.Applicant.ApplicationStatus] = new OptionSetValue(DataverseSchema.Applicant.ToBeScreened)
                };

                context.SetupGet(value => value.InputParameters).Returns(new ParameterCollection
                {
                    [DataverseSchema.TargetParameter] = Target
                });
                context.SetupGet(value => value.PreEntityImages).Returns(PreImages);
                context.SetupGet(value => value.MessageName).Returns("Update");
                context.SetupGet(value => value.PrimaryEntityName).Returns(Bpf.Table);
                context.SetupGet(value => value.Stage).Returns(40);
                context.SetupGet(value => value.Mode).Returns(0);
                context.SetupGet(value => value.IsInTransaction).Returns(true);
                context.SetupGet(value => value.UserId).Returns(userId);

                var tracing = new Mock<ITracingService>();
                Factory.Setup(value => value.CreateOrganizationService(userId)).Returns(Service.Object);
                provider.Setup(value => value.GetService(typeof(IPluginExecutionContext))).Returns(context.Object);
                provider.Setup(value => value.GetService(typeof(ITracingService))).Returns(tracing.Object);
                provider.Setup(value => value.GetService(typeof(IOrganizationServiceFactory))).Returns(Factory.Object);

                Service.Setup(value => value.Retrieve(Bpf.Table, bpfId, It.IsAny<ColumnSet>()))
                    .Returns<string, Guid, ColumnSet>((table, id, columns) => CopyColumns(BpfInstance, columns));
                Service.Setup(value => value.Retrieve(DataverseSchema.Applicant.Table, applicantId, It.IsAny<ColumnSet>()))
                    .Returns<string, Guid, ColumnSet>((table, id, columns) => CopyColumns(Applicant, columns));
                Service.Setup(value => value.Update(It.IsAny<Entity>()))
                    .Callback<Entity>(update => Updates.Add(update));
            }

            public void SetStageChange(Guid oldStage, Guid newStage)
            {
                Target[Bpf.ActiveStage] = new EntityReference(Bpf.StageTable, newStage);
                PreImages[Bpf.PreImageAlias] = new Entity(Bpf.Table, Target.Id)
                {
                    [Bpf.ActiveStage] = new EntityReference(Bpf.StageTable, oldStage)
                };
            }

            public void Run() => new SyncApplicantStatusFromBpfStagePlugin().Execute(provider.Object);

            public void VerifyNoServiceCalls()
            {
                Service.VerifyNoOtherCalls();
                Factory.Verify(factory => factory.CreateOrganizationService(It.IsAny<Guid>()), Times.Never);
            }

            private static Entity CopyColumns(Entity source, ColumnSet columns)
            {
                var copy = new Entity(source.LogicalName, source.Id);
                foreach (var column in columns.Columns)
                    if (source.Contains(column)) copy[column] = source[column];
                return copy;
            }
        }
    }
}
