using System;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;

namespace InterpreterCRM.Plugins
{
    public sealed class CreateInterpreterAfterScreeningPlugin : IPlugin
    {
        private const int PostOperationStage = 40;
        private const int SynchronousMode = 0;
        private const int ConcurrencyVersionMismatch = -2147088254;

        public void Execute(IServiceProvider serviceProvider)
        {
            if (serviceProvider == null)
                throw new InvalidPluginExecutionException("The plug-in service provider is unavailable.");

            var tracing = RequireService<ITracingService>(serviceProvider);
            try
            {
                var context = RequireService<IPluginExecutionContext>(serviceProvider);
                tracing.Trace("CreateInterpreterAfterScreening started. CorrelationId={0}; Stage={1}; Mode={2}.",
                    context.CorrelationId, context.Stage, context.Mode);
                ValidateContext(context);

                var target = context.InputParameters.Contains(DataverseSchema.TargetParameter)
                    ? context.InputParameters[DataverseSchema.TargetParameter] as Entity : null;
                if (target == null || target.Id == Guid.Empty || target.LogicalName != DataverseSchema.Applicant.Table)
                    throw new InvalidPluginExecutionException("The Update Target must be a saved Applicant record.");

                // Filtering attributes are also configured on the step; keep this guard for direct or misconfigured calls.
                if (!target.Attributes.TryGetValue(DataverseSchema.Applicant.ApplicationStatus, out var targetStatus))
                {
                    tracing.Trace("Application Status is not in the Update Target; conversion skipped.");
                    return;
                }
                if (!(targetStatus is OptionSetValue newStatus))
                    throw new InvalidPluginExecutionException("Applicant Application Status must be a Choice column.");
                if (newStatus.Value != DataverseSchema.Applicant.ScreeningCompleted)
                {
                    tracing.Trace("Application Status is not Screening Completed; conversion skipped.");
                    return;
                }

                if (!context.PreEntityImages.Contains(DataverseSchema.ScreeningStatusPreImage))
                    throw new InvalidPluginExecutionException("The ScreeningStatusPreImage is missing. Register a pre-image containing Applicant Application Status.");
                var preImage = context.PreEntityImages[DataverseSchema.ScreeningStatusPreImage];
                if (preImage == null)
                    throw new InvalidPluginExecutionException("The ScreeningStatusPreImage is unavailable.");

                var previousStatus = preImage.GetAttributeValue<OptionSetValue>(DataverseSchema.Applicant.ApplicationStatus);
                if (previousStatus != null && previousStatus.Value == DataverseSchema.Applicant.ScreeningCompleted)
                {
                    tracing.Trace("Applicant was already Screening Completed; conversion skipped.");
                    return;
                }

                var factory = RequireService<IOrganizationServiceFactory>(serviceProvider);
                var service = factory.CreateOrganizationService(context.UserId);
                if (service == null)
                    throw new InvalidPluginExecutionException("The Dataverse organization service is unavailable.");

                var interpreterId = ApplicantInterpreterConverter.CreateAndLink(service, tracing, target.Id, false);
                if (interpreterId.HasValue)
                    tracing.Trace("CreateInterpreterAfterScreening completed. InterpreterId={0}.", interpreterId.Value);
            }
            catch (InvalidPluginExecutionException exception)
            {
                tracing.Trace("Screening conversion rejected: {0}", exception.Message);
                throw;
            }
            catch (FaultException<OrganizationServiceFault> exception)
            {
                tracing.Trace("Dataverse screening conversion fault. Code={0}; ActivityId={1}.", exception.Detail.ErrorCode, exception.Detail.ActivityId);
                if (exception.Detail.ErrorCode == ConcurrencyVersionMismatch)
                    throw new InvalidPluginExecutionException("The Applicant changed during conversion. Refresh the record and check its Interpreter lookup.", exception);
                throw new InvalidPluginExecutionException("Unable to create the Interpreter profile. Ask an administrator to check permissions, schema configuration, and the plug-in trace log.", exception);
            }
            catch (Exception exception)
            {
                tracing.Trace("Unexpected screening conversion failure. ExceptionType={0}.", exception.GetType().FullName);
                throw new InvalidPluginExecutionException("Unable to create the Interpreter profile. Contact an administrator with the plug-in trace details.", exception);
            }
        }

        private static void ValidateContext(IPluginExecutionContext context)
        {
            if (context.MessageName != "Update" || context.PrimaryEntityName != DataverseSchema.Applicant.Table || context.Stage != PostOperationStage)
                throw new InvalidPluginExecutionException("This plug-in must run on Applicant Update in PostOperation.");
            if (context.Mode != SynchronousMode || !context.IsInTransaction)
                throw new InvalidPluginExecutionException("Interpreter creation requires synchronous execution within a Dataverse transaction.");
        }

        private static T RequireService<T>(IServiceProvider provider) where T : class
        {
            return provider.GetService(typeof(T)) as T
                ?? throw new InvalidPluginExecutionException("Required plug-in service is unavailable: " + typeof(T).Name + ".");
        }
    }
}
