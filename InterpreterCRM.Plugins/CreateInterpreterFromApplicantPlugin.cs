using System;
using System.Collections.Generic;
using System.Linq;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;

namespace InterpreterCRM.Plugins
{
    public sealed class CreateInterpreterFromApplicantPlugin : IPlugin
    {
        private const int MainOperationStage = 30;
        private const int SynchronousMode = 0;
        // Documented SDK fault code, not a business Choice value.
        private const int ConcurrencyVersionMismatch = -2147088254;
        private const string AlreadyCreated = "An Interpreter profile has already been created for this applicant.";

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

                var columns = new List<string>
                {
                    DataverseSchema.Applicant.FirstName, DataverseSchema.Applicant.LastName,
                    DataverseSchema.Applicant.Interpreter, DataverseSchema.Applicant.ArchiveApplication
                };
                columns.AddRange(DataverseSchema.OptionalTextMappings.Keys);
                if (DataverseSchema.CopyApplicantName)
                    columns.Add(DataverseSchema.Applicant.Name);

                tracing.Trace("Retrieving Applicant {0} for conversion.", target.Id);
                var applicant = service.Retrieve(target.LogicalName, target.Id, new ColumnSet(columns.Distinct().ToArray()));
                if (applicant == null)
                    throw new InvalidPluginExecutionException("The Applicant could not be retrieved.");
                if (applicant.GetAttributeValue<EntityReference>(DataverseSchema.Applicant.Interpreter) != null)
                    throw new InvalidPluginExecutionException(AlreadyCreated);

                var firstName = ReadText(applicant, DataverseSchema.Applicant.FirstName);
                var lastName = ReadText(applicant, DataverseSchema.Applicant.LastName);
                if (string.IsNullOrWhiteSpace(firstName) || string.IsNullOrWhiteSpace(lastName))
                    throw new InvalidPluginExecutionException("First Name and Last Name are required to create an Interpreter profile.");
                if (string.IsNullOrWhiteSpace(applicant.RowVersion))
                    throw new InvalidPluginExecutionException("Applicant row version is unavailable. Ask an administrator to verify optimistic concurrency is enabled.");

                var interpreter = new Entity(DataverseSchema.Interpreter.Table);
                interpreter[DataverseSchema.Interpreter.FirstName] = firstName.Trim();
                interpreter[DataverseSchema.Interpreter.LastName] = lastName.Trim();
                var applicantName = DataverseSchema.CopyApplicantName ? ReadText(applicant, DataverseSchema.Applicant.Name) : null;
                interpreter[DataverseSchema.Interpreter.Name] = string.IsNullOrWhiteSpace(applicantName)
                    ? firstName.Trim() + " " + lastName.Trim() : applicantName.Trim();
                foreach (var mapping in DataverseSchema.OptionalTextMappings)
                {
                    var value = ReadText(applicant, mapping.Key);
                    if (!string.IsNullOrWhiteSpace(value))
                        interpreter[mapping.Value] = value;
                }

                // Prepare and validate the update before any write occurs.
                var update = new Entity(DataverseSchema.Applicant.Table, target.Id) { RowVersion = applicant.RowVersion };
                if (!applicant.GetAttributeValue<bool>(DataverseSchema.Applicant.ArchiveApplication))
                    update[DataverseSchema.Applicant.ArchiveApplication] = true;

                tracing.Trace("Creating Interpreter for Applicant {0}.", target.Id);
                var interpreterId = service.Create(interpreter);
                if (interpreterId == Guid.Empty)
                    throw new InvalidPluginExecutionException("Dataverse did not return an Interpreter ID. The conversion cannot complete.");
                update[DataverseSchema.Applicant.Interpreter] = new EntityReference(DataverseSchema.Interpreter.Table, interpreterId);

                // Two concurrent callers may both reach Create. Only one can update the original row
                // version; the other's transaction must fail and roll back its newly created Interpreter.
                tracing.Trace("Linking Interpreter {0} to Applicant {1} with a row-version check.", interpreterId, target.Id);
                service.Execute(new UpdateRequest { Target = update, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
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

        private static string ReadText(Entity entity, string column)
        {
            if (!entity.Attributes.TryGetValue(column, out var value) || value == null)
                return null;
            if (!(value is string text))
                throw new InvalidPluginExecutionException("Applicant field mapping requires a text column: " + column + ". Ask an administrator to verify the schema configuration.");
            return text;
        }

        private static T RequireService<T>(IServiceProvider provider) where T : class
        {
            return provider.GetService(typeof(T)) as T
                ?? throw new InvalidPluginExecutionException("Required plug-in service is unavailable: " + typeof(T).Name + ".");
        }
    }
}
