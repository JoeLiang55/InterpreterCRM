using System;
using System.Collections.Generic;

namespace InterpreterCRM.Plugins
{
    /// <summary>Verified Dataverse logical names used by the conversion plug-in.</summary>
    public static class DataverseSchema
    {
        public const string CreateInterpreterMessage = "gsic_CreateInterpreterFromApplicant";
        public const string TargetParameter = "Target";
        // New API contract, not an existing Dataverse column.
        public const string InterpreterIdResponse = "InterpreterId";
        public const string ScreeningStatusPreImage = "ScreeningStatusPreImage";

        public static class Applicant
        {
            public const string Table = "gsic_applicant";
            public const string Name = "gsic_applicantname";
            public const string Email = "gsic_emailaddress";
            public const string Phone = "gsic_phone";
            public const string Address = "gsic_address";
            public const string City = "gsic_city";
            public const string Province = "gsic_province";
            public const string PostalCode = "gsic_postalcode";
            public const string Country = "gsic_country";
            public const string CourtRegion = "gsic_courtregion";
            public const string Interpreter = "gsic_interpreter";
            public const string ArchiveApplication = "gsic_archiveapplication";
            public const string ApplicationStatus = "gsic_applicationstatus";
            public const int ToBeScreened = 472540000;
            public const int ScreeningCompleted = 472540001;
        }

        public static class Interpreter
        {
            public const string Table = "gsic_interpreter";
            public const string Name = "gsic_name";
            public const string Phone = "gsic_phone";
            public const string Address = "gsic_address";
            public const string Region = "gsic_region";
        }

        public static class InterpreterAccreditationProcess
        {
            public const string Table = "gsic_interpreteraccreditationprocess";
            public const string Applicant = "bpf_gsic_applicantid";
            public const string ActiveStage = "activestageid";
            public const string StageTable = "processstage";
            public const string PreImageAlias = "BpfStagePreImage";

            public static readonly Guid ApplicationReceivedStage = new Guid("28e6e747-dc85-4b9e-a322-43344c22052a");
            public static readonly Guid ScreeningStage = new Guid("018026fe-1157-4105-8cad-b4e2469e7927");
            public static readonly Guid ProfileCreationStage = new Guid("5b35d1de-a8cc-4daa-bd37-4733f917e587");
        }

        // Only verified compatible text destinations are mapped here. Court Region is copied separately as a Choice.
        public static IReadOnlyDictionary<string, string> OptionalTextMappings { get; } =
            new System.Collections.ObjectModel.ReadOnlyDictionary<string, string>(
                new Dictionary<string, string>
                {
                    { Applicant.Phone, Interpreter.Phone },
                    { Applicant.Address, Interpreter.Address }
                });
    }
}
