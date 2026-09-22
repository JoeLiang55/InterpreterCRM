using System.Collections.Generic;

namespace InterpreterCRM.Plugins
{
    /// <summary>
    /// Deployment checklist: replace every __...__ placeholder with verified logical metadata.
    /// Remove optional mappings when no compatible, writable destination column exists.
    /// These deliberately invalid names are NOT a proposed Dataverse schema.
    /// </summary>
    public static class DataverseSchema
    {
        public const string CreateInterpreterMessage = "__PUBLISHER_PREFIX___CreateInterpreterFromApplicant";
        public const string TargetParameter = "Target";
        // New API contract, not an existing Dataverse column.
        public const string InterpreterIdResponse = "InterpreterId";

        public static class Applicant
        {
            public const string Table = "__APPLICANT_TABLE__";
            public const string Name = "__APPLICANT_NAME__";
            public const string FirstName = "__APPLICANT_FIRST_NAME__";
            public const string LastName = "__APPLICANT_LAST_NAME__";
            public const string Email = "__APPLICANT_EMAIL__";
            public const string Phone = "__APPLICANT_PHONE__";
            public const string AddressLine1 = "__APPLICANT_ADDRESS_LINE1__";
            public const string AddressLine2 = "__APPLICANT_ADDRESS_LINE2__";
            public const string AddressLine3 = "__APPLICANT_ADDRESS_LINE3__";
            public const string City = "__APPLICANT_CITY__";
            public const string StateOrProvince = "__APPLICANT_STATE_OR_PROVINCE__";
            public const string PostalCode = "__APPLICANT_POSTAL_CODE__";
            public const string Country = "__APPLICANT_COUNTRY__";
            public const string CourtRegion = "__APPLICANT_COURT_REGION__";
            public const string Interpreter = "__APPLICANT_INTERPRETER_LOOKUP__";
            public const string ArchiveApplication = "__APPLICANT_ARCHIVE_APPLICATION__";
        }

        public static class Interpreter
        {
            public const string Table = "__INTERPRETER_TABLE__";
            public const string Name = "__INTERPRETER_NAME__";
            public const string FirstName = "__INTERPRETER_FIRST_NAME__";
            public const string LastName = "__INTERPRETER_LAST_NAME__";
            public const string Email = "__INTERPRETER_EMAIL__";
            public const string Phone = "__INTERPRETER_PHONE__";
            public const string AddressLine1 = "__INTERPRETER_ADDRESS_LINE1__";
            public const string AddressLine2 = "__INTERPRETER_ADDRESS_LINE2__";
            public const string AddressLine3 = "__INTERPRETER_ADDRESS_LINE3__";
            public const string City = "__INTERPRETER_CITY__";
            public const string StateOrProvince = "__INTERPRETER_STATE_OR_PROVINCE__";
            public const string PostalCode = "__INTERPRETER_POSTAL_CODE__";
            public const string Country = "__INTERPRETER_COUNTRY__";
            public const string Region = "__INTERPRETER_REGION__";
        }

        // Conservative default: Applicant Name might be an application number rather than a person.
        // Enable only after confirming it is a person's full name.
        public static bool CopyApplicantName { get; } = false;

        // Region is intentionally unmapped until metadata establishes lookup targets or Choice semantics.
        // If both are text columns, add the pair here. Otherwise add a typed mapping once verified.
        public static IReadOnlyDictionary<string, string> OptionalTextMappings { get; } =
            new System.Collections.ObjectModel.ReadOnlyDictionary<string, string>(
                new Dictionary<string, string>
                {
                    { Applicant.Email, Interpreter.Email },
                    { Applicant.Phone, Interpreter.Phone },
                    { Applicant.AddressLine1, Interpreter.AddressLine1 },
                    { Applicant.AddressLine2, Interpreter.AddressLine2 },
                    { Applicant.AddressLine3, Interpreter.AddressLine3 },
                    { Applicant.City, Interpreter.City },
                    { Applicant.StateOrProvince, Interpreter.StateOrProvince },
                    { Applicant.PostalCode, Interpreter.PostalCode },
                    { Applicant.Country, Interpreter.Country }
                });
    }
}
