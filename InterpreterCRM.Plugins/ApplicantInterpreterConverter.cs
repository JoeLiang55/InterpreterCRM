using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
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
                DataverseSchema.Applicant.ArchiveApplication
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

            // A concurrent caller must fail this row-version check and roll back its Interpreter creation.
            tracing.Trace("Linking Interpreter {0} to Applicant {1} with a row-version check.", interpreterId, applicantId);
            service.Execute(new UpdateRequest { Target = update, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
            return interpreterId;
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
