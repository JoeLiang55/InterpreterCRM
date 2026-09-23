using System;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Bpf = InterpreterCRM.Plugins.DataverseSchema.InterpreterAccreditationProcess;

namespace InterpreterCRM.Plugins
{
    public sealed class SyncApplicantStatusFromBpfStagePlugin : IPlugin
    {
        private const int PostOperationStage = 40;
        private const int SynchronousMode = 0;

        public void Execute(IServiceProvider serviceProvider)
        {
            if (serviceProvider == null)
                throw new InvalidPluginExecutionException("The plug-in service provider is unavailable.");

            var tracing = RequireService<ITracingService>(serviceProvider);
            try
            {
                var context = RequireService<IPluginExecutionContext>(serviceProvider);
                ValidateContext(context);

                var target = context.InputParameters.Contains(DataverseSchema.TargetParameter)
                    ? context.InputParameters[DataverseSchema.TargetParameter] as Entity : null;
                if (target == null || target.Id == Guid.Empty || target.LogicalName != DataverseSchema.InterpreterAccreditationProcess.Table)
                    throw new InvalidPluginExecutionException("The Update Target must be a saved Interpreter Accreditation Process record.");

                if (!target.Attributes.TryGetValue(Bpf.ActiveStage, out var stageValue))
                    return;
                var newStage = stageValue as EntityReference;
                if (!IsStage(newStage, Bpf.ProfileCreationStage))
                    return;

                var preImages = context.PreEntityImages;
                if (preImages == null || !preImages.Contains(Bpf.PreImageAlias))
                    throw new InvalidPluginExecutionException("The BpfStagePreImage is missing. Register a pre-image containing activestageid.");
                var preImage = preImages[Bpf.PreImageAlias];
                if (preImage == null)
                    throw new InvalidPluginExecutionException("The BpfStagePreImage is unavailable.");
                var oldStage = preImage.GetAttributeValue<EntityReference>(Bpf.ActiveStage);
                if (!IsStage(oldStage, Bpf.ScreeningStage))
                    return;

                var factory = RequireService<IOrganizationServiceFactory>(serviceProvider);
                var service = factory.CreateOrganizationService(context.UserId);
                if (service == null)
                    throw new InvalidPluginExecutionException("The Dataverse organization service is unavailable.");

                var bpfInstance = service.Retrieve(Bpf.Table, target.Id, new ColumnSet(Bpf.Applicant));
                if (bpfInstance == null)
                    throw new InvalidPluginExecutionException("The Business Process Flow instance could not be retrieved.");
                bpfInstance.Attributes.TryGetValue(Bpf.Applicant, out var applicantLookup);
                var applicantReference = applicantLookup as EntityReference;
                if (applicantReference == null || applicantReference.Id == Guid.Empty || applicantReference.LogicalName != DataverseSchema.Applicant.Table)
                {
                    tracing.Trace("BPF instance {0} has no valid Applicant lookup; status update skipped.", target.Id);
                    return;
                }

                var applicant = service.Retrieve(
                    DataverseSchema.Applicant.Table,
                    applicantReference.Id,
                    new ColumnSet(DataverseSchema.Applicant.ApplicationStatus));
                if (applicant == null)
                    throw new InvalidPluginExecutionException("The related Applicant could not be retrieved.");
                var currentStatus = applicant.GetAttributeValue<OptionSetValue>(DataverseSchema.Applicant.ApplicationStatus);
                if (currentStatus != null && currentStatus.Value == DataverseSchema.Applicant.ScreeningCompleted)
                    return;

                var update = new Entity(DataverseSchema.Applicant.Table, applicantReference.Id);
                update[DataverseSchema.Applicant.ApplicationStatus] = new OptionSetValue(DataverseSchema.Applicant.ScreeningCompleted);
                service.Update(update);
                tracing.Trace("Applicant {0} set to Screening Completed after BPF stage transition.", applicantReference.Id);
            }
            catch (InvalidPluginExecutionException exception)
            {
                tracing.Trace("BPF status synchronization rejected: {0}", exception.Message);
                throw;
            }
            catch (FaultException<OrganizationServiceFault> exception)
            {
                tracing.Trace("Dataverse BPF status synchronization fault. Code={0}; ActivityId={1}.",
                    exception.Detail.ErrorCode, exception.Detail.ActivityId);
                throw new InvalidPluginExecutionException("Unable to synchronize Applicant Application Status. Ask an administrator to check permissions and the plug-in trace log.", exception);
            }
            catch (Exception exception)
            {
                tracing.Trace("Unexpected BPF status synchronization failure. ExceptionType={0}.", exception.GetType().FullName);
                throw new InvalidPluginExecutionException("Unable to synchronize Applicant Application Status. Contact an administrator with the plug-in trace details.", exception);
            }
        }

        private static bool IsStage(EntityReference stage, Guid stageId)
        {
            return stage != null && stage.LogicalName == DataverseSchema.InterpreterAccreditationProcess.StageTable && stage.Id == stageId;
        }

        private static void ValidateContext(IPluginExecutionContext context)
        {
            if (context.MessageName != "Update" ||
                context.PrimaryEntityName != DataverseSchema.InterpreterAccreditationProcess.Table ||
                context.Stage != PostOperationStage)
                throw new InvalidPluginExecutionException("This plug-in must run on Interpreter Accreditation Process Update in PostOperation.");
            if (context.Mode != SynchronousMode || !context.IsInTransaction)
                throw new InvalidPluginExecutionException("BPF status synchronization requires synchronous execution within a Dataverse transaction.");
        }

        private static T RequireService<T>(IServiceProvider provider) where T : class
        {
            return provider.GetService(typeof(T)) as T
                ?? throw new InvalidPluginExecutionException("Required plug-in service is unavailable: " + typeof(T).Name + ".");
        }
    }
}
