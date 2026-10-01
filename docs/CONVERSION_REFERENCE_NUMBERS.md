# Matching Applicant and Interpreter reference numbers

## Schema evidence

| Table | Column | Confirmed configuration | Remaining checks |
| --- | --- | --- | --- |
| Applicant (`gsic_applicant`) | `gsic_applicationreferencenumber` | User-confirmed logical name and autonumber preview `26-1000`, `26-1001`, `26-1002`; stored value is text | Maximum length, exact `AutoNumberFormat`, read permissions |
| Interpreter (`gsic_interpreter`) | `gsic_interpreterreferencenumber` | User-confirmed logical name; local generated metadata export exposes a writable `string` property | Maximum length, `IsValidForCreate`, `AutoNumberFormat`, field security and automation that might overwrite it |

The screenshots do not establish the exact autonumber expression or maximum lengths. The local generated Interpreter class establishes its string representation but does not expose `AutoNumberFormat`. No live metadata connection was available during this implementation, and no Dataverse settings were changed.

## Implementation

Both `CreateInterpreterFromApplicantPlugin` (Custom API) and `CreateInterpreterAfterScreeningPlugin` (automatic screening conversion) already call `ApplicantInterpreterConverter.CreateAndLink`. That shared function now retrieves the Applicant reference and supplies it on the new Interpreter Create request. It copies the full stored string exactly, including prefixes, casing, leading zeros and any surrounding whitespace. It never parses, trims, regenerates or increments the reference. For example, `26-1001` becomes `26-1001`, and `APP-000001` remains `APP-000001`.

An absent, null, empty or whitespace-only source fails before any writes with: **Applicant Application Reference Number is required to create an Interpreter profile.** A nontext source also fails schema validation. Existing duplicate checks still run first: an already linked Applicant is rejected by the Custom API and skipped by automatic conversion.

Name, optional text, region, language creation/category mappings, Applicant archive and Interpreter lookup updates remain in place. The conditional Applicant update still uses its retrieved row version with `IfRowVersionMatches`. No new plug-in type, Interpreter Create step, relationship change or existing-record backfill is introduced. Direct Interpreter creation continues through its existing path and configuration.

## Dataverse configuration and deployment

1. In the intended solution, inspect the published metadata for both columns. Confirm Applicant is readable and Interpreter Reference Number is a text/string column valid for Create and writable by conversion callers. Inspect field security profiles where enabled.
2. Compare `MaxLength` values. The Interpreter column must fit all valid Applicant reference strings; if it is shorter, increase its maximum length before deployment. Do not truncate or shorten reference numbers. No length change can be prescribed until the actual values are known.
3. Inspect Interpreter `AutoNumberFormat`. If it is ordinary text, no numbering configuration change is needed. If autonumber is enabled, retain its current configuration to preserve directly created Interpreter behavior, and verify in nonproduction that an explicitly supplied reference persists on Create. Do not remove/reseed autonumber or copy an inferred format expression from the preview. Also inspect flows, business rules and other plug-ins for unconditional replacement of a supplied reference; any such automation must preserve an explicit conversion value while retaining the current behavior for direct creates.
4. Build the signed assembly in Release and run the focused tests. Update the existing registered `InterpreterCRM.Plugins` assembly using `InterpreterCRM.Plugins/bin/Release/net48/InterpreterCRM.Plugins.dll`, preserving assembly identity and existing registrations. Include the updated assembly in the Dataverse solution. Do not deploy test binaries.
5. Keep the Custom API's existing `CreateInterpreterFromApplicantPlugin` binding and `InterpreterId` response. Keep `CreateInterpreterAfterScreeningPlugin` on Applicant Update, synchronous PostOperation (stage 40), filtered on `gsic_applicationstatus`, with pre-image alias `ScreeningStatusPreImage` containing `gsic_applicationstatus`. No reference field needs to be added to that pre-image because the shared converter retrieves it. Keep the BPF/status synchronization and Applicant Interpreter lookup relationship intact.
6. Verify Applicant optimistic concurrency remains enabled, and run the manual checks below in nonproduction before promoting the solution. Existing blank-reference Applicants must receive a valid reference through the established data process before conversion; this change does not repair historical data or update existing Interpreters.

The form JavaScript/subgrid change is separate. This deployment does not update or register a JavaScript web resource.

## Manual conversion checks

1. **Custom API:** Save an unlinked Applicant with a reference containing a prefix and leading zeros (for example, a stored `26-0010`). Invoke the existing conversion command/API. Confirm the new Interpreter reference equals the Applicant value character for character. Confirm name, phone/address, region and all related languages, the Applicant Interpreter lookup and Archive Application behavior. Repeat conversion and verify it does not create another Interpreter or modify the first reference.
2. **Automatic screening:** Use another saved, unlinked Applicant with a populated reference. Transition it from a different status to Screening Completed using the existing BPF/status flow. Confirm one Interpreter is created with the exact reference, with the existing links and language rows. Re-save the same status and verify no duplicate.
3. **Missing source:** In a controlled test record/environment where a missing source can be arranged without changing numbering settings, invoke each conversion path. Verify the clear missing-reference message and no new Interpreter/languages, archive change or lookup update. The synchronous screening transaction should roll back its triggering status change on failure. If an autonumber source cannot be blanked in that environment, retain this as a mock-test case rather than disabling its configuration.
4. **Isolation:** Create an Interpreter directly and verify its existing reference-entry/generation behavior. Check an existing Interpreter remains unchanged. With an already linked Applicant, conversion must not overwrite its Interpreter reference.
5. **Rollback/concurrency:** Force a conversion failure after Interpreter creation in a controlled nonproduction test and verify Dataverse rolls back the entire conversion. Submit competing conversions for one Applicant and verify at most one commits. Mock tests verify the conditional request and error handling; they do not prove database transactions.

## Local checks

```powershell
dotnet build InterpreterCRM.sln --configuration Release --nologo
dotnet test InterpreterCRM.Plugins.Tests/InterpreterCRM.Plugins.Tests.csproj --configuration Release --no-build --no-restore --nologo --filter FullyQualifiedName~ConversionReferenceNumberTests
```

The focused test project covers both entry points, exact string preservation, missing/nontext references, existing field mappings, Applicant and language relationships, already linked Applicants, row-version validation, concurrency failures and screening guards.

Local validation on 2026-10-01: the Release solution build passed with zero warnings/errors; all 26 focused tests passed with zero failures/skips. This machine initially had no .NET SDK, so an official .NET 10.0.100 SDK and NuGet packages were installed under the ignored `.build-tools/` directory and the commands above were run using `.build-tools/dotnet/dotnet.exe`. No form JavaScript files were changed. No Dataverse deployment or manual environment checks were performed.

Microsoft documents that [autonumber columns are text columns with additional functionality](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/autonumber-fields) and describes [their metadata and AutoNumberFormat configuration](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/create-auto-number-attributes). The exact deployed format still requires environment inspection.
