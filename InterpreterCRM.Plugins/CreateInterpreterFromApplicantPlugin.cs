using System;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;

namespace InterpreterCRM.Plugins
{
    public sealed class CreateInterpreterFromApplicantPlugin : IPlugin
    {
        private const int MainOperationStage = 30;
        private const int SynchronousMode = 0;
        // Documented SDK fault code, not a business Choice value.
        private const int ConcurrencyVersionMismatch = -2147088254;
        public void Execute(IServiceProvider serviceProvider)
        {
            if (serviceProvider == null)
                throw new InvalidPluginExecutionException("The plug-in service provider is unavailable.");

            var tracing = RequireService<ITracingService>(serviceProvider);
            try
            {
                var context = RequireService<IPluginExecutionContext>(serviceProvider);
                tracing.Trace("CreateInterpreterFromApplicant started. CorrelationId={0}; Stage={1}; Mode={2}.",
                    context.CorrelationId, context.Stage, context.Mode);
                ValidateContext(context);

                var target = context.InputParameters.Contains(DataverseSchema.TargetParameter)
                    ? context.InputParameters[DataverseSchema.TargetParameter] as EntityReference : null;
                if (target == null || target.Id == Guid.Empty || target.LogicalName != DataverseSchema.Applicant.Table)
                    throw new InvalidPluginExecutionException("Provide a saved Applicant record as the bound Target.");

                var factory = RequireService<IOrganizationServiceFactory>(serviceProvider);
                var service = factory.CreateOrganizationService(context.UserId);
                if (service == null)
                    throw new InvalidPluginExecutionException("The Dataverse organization service is unavailable.");

                var interpreterId = ApplicantInterpreterConverter.CreateAndLink(service, tracing, target.Id, true).Value;
                context.OutputParameters[DataverseSchema.InterpreterIdResponse] = interpreterId;
                tracing.Trace("CreateInterpreterFromApplicant completed. InterpreterId={0}.", interpreterId);
            }
            catch (InvalidPluginExecutionException exception)
            {
                tracing.Trace("Conversion rejected: {0}", exception.Message);
                throw;
            }
            catch (FaultException<OrganizationServiceFault> exception)
            {
                tracing.Trace("Dataverse conversion fault. Code={0}; ActivityId={1}.", exception.Detail.ErrorCode, exception.Detail.ActivityId);
                if (exception.Detail.ErrorCode == ConcurrencyVersionMismatch)
                    throw new InvalidPluginExecutionException("The Applicant changed during conversion. Refresh the record and check its Interpreter lookup before trying again.", exception);
                throw new InvalidPluginExecutionException("Unable to create the Interpreter profile. The conversion was not completed. Ask an administrator to check permissions, schema configuration, and the plug-in trace log.", exception);
            }
            catch (Exception exception)
            {
                // Avoid logging Applicant field values or raw service messages containing personal data.
                tracing.Trace("Unexpected conversion failure. ExceptionType={0}.", exception.GetType().FullName);
                throw new InvalidPluginExecutionException("Unable to create the Interpreter profile. The conversion was not completed. Contact an administrator with the plug-in trace details.", exception);
            }
        }

        private static void ValidateContext(IPluginExecutionContext context)
        {
            if (context.MessageName != DataverseSchema.CreateInterpreterMessage || context.Stage != MainOperationStage)
                throw new InvalidPluginExecutionException("This plug-in must run as the main operation of the Create Interpreter from Applicant Custom API.");
            if (context.Mode != SynchronousMode || !context.IsInTransaction)
                throw new InvalidPluginExecutionException("Interpreter conversion requires synchronous execution within a Dataverse transaction.");
            for (var parent = context.ParentContext; parent != null; parent = parent.ParentContext)
            {
                if (parent.MessageName == DataverseSchema.CreateInterpreterMessage)
                    throw new InvalidPluginExecutionException("Recursive Interpreter conversion is not allowed.");
            }
        }

        private static T RequireService<T>(IServiceProvider provider) where T : class
        {
            return provider.GetService(typeof(T)) as T
                ?? throw new InvalidPluginExecutionException("Required plug-in service is unavailable: " + typeof(T).Name + ".");
        }
    }
}
