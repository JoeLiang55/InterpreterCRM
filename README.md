# InterpreterCRM

Local implementation of an explicit Applicant-to-Interpreter conversion. No Dataverse deployment has been performed. Logical metadata is unknown: the assembly is **not ready to register** until the placeholders and mapping assumptions in `InterpreterCRM.Plugins/DataverseSchema.cs` are resolved.

## Projects

- `InterpreterCRM.Plugins`: signed .NET Framework 4.8 assembly; Microsoft.CrmSdk.CoreAssemblies 9.0.2.60; stateless `IPlugin` implementation with no custom runtime dependencies.
- `InterpreterCRM.Plugins.Tests`: .NET Framework 4.8, xUnit 2.9.3, Moq 4.20.72, Microsoft.NET.Test.Sdk 17.14.1, xunit.runner.visualstudio 2.8.2. Tests execute the real entry point with mocked Dataverse services and context.
- `DataverseSchema`: standalone Complaint metadata setup tool using ServiceClient, with additive rerun checks. See [Complaint schema setup](DataverseSchema/README.md) for configuration, the full schema, and manual Power Apps steps. Building/testing does not connect to Dataverse.

Microsoft's current [framework guidance](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/supported-customizations#support-for-net-framework-versions) supports .NET Framework 4.8 for plug-ins and recommends it for new development. SDK reference assemblies come from NuGet. The installed .NET SDK builds the projects; Windows with .NET Framework runs the tests.

## Build and test

From the repository root:

```powershell
dotnet build InterpreterCRM.sln --configuration Release --nologo
dotnet test InterpreterCRM.sln --configuration Release --no-build --no-restore --nologo --logger 'trx;LogFileName=InterpreterCRM.Tests.trx'
```

The plug-in output is `InterpreterCRM.Plugins/bin/Release/net48/InterpreterCRM.Plugins.dll`. Generated `bin`, `obj`, and `TestResults` directories are ignored by Git.

`InterpreterCRM.Plugins.snk` is a generated development strong-name key, included to make local builds reproducible. It is an assembly identity, not an environment credential or an Authenticode certificate. Decide on the production signing identity before the first registration, then preserve it for updates. `tools/New-SigningKey.ps1` generates a key only when absent and refuses to overwrite one. It uses ephemeral Windows cryptographic storage because `sn.exe -k` returned Access Denied on this machine. Microsoft's [assembly guidance](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/build-and-package) requires signing for individual assembly registration; the SDK assemblies are already provided by Dataverse and are not uploaded with this DLL.

## CI

[GitHub Actions](.github/workflows/ci.yml) runs on every push and pull request. On Windows, it builds both projects in `InterpreterCRM.sln` in Release configuration, runs the existing C# unit tests, checks every JavaScript web resource under `JavascriptFormValidation` with `node --check`, and runs the JavaScript form tests. Any failed check fails CI. There are no npm or PCF projects to build.

The workflow validates code and runs the JavaScript form tests. It does not deploy, authenticate to Dataverse, require Dataverse secrets, or perform Dataverse solution operations.

To run the same checks locally, use Windows with the .NET 10 SDK, .NET Framework 4.8 (or 4.8.1), and Node.js 24. From the repository root in PowerShell, run the two commands in **Build and test** above, followed by:

```powershell
Get-ChildItem -LiteralPath JavascriptFormValidation -Filter *.js -File -Recurse | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Get-ChildItem -LiteralPath JavascriptFormValidation -Filter *.test.js -File -Recurse | ForEach-Object {
    node --test $_.FullName
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

The build restores the projects' existing NuGet dependencies. No npm install is needed, and generated build and test output is already excluded by `.gitignore`.

## Add to Registry command

For Interpreter main-form language grid visibility, registration steps, and manual checks, see [Interpreter language subgrids](docs/INTERPRETER_LANGUAGE_SUBGRIDS.md). After adding a language, fully reload the form; Add Language completion code is not available in this repository.

Add `JavascriptFormValidation/gsic_InterpreterForm.js` as the JavaScript web resource `gsic_InterpreterForm.js`. On the **Interpreter Main Form** command bar, add a JavaScript action with library `gsic_InterpreterForm.js`, function `GSIC.InterpreterForm.addToRegistry`, and one parameter: **CRM Parameter → PrimaryControl**. Do not pass the form execution context or a custom string parameter. No form OnLoad handler or Form Libraries registration is required for this command action.

Include the `gsic_inregistry` (In Registry) and `gsic_registrydateadded` (Registry Date Added) columns on the form so the command can read and set them. They may be hidden. The command requires a saved record, ignores one already marked In Registry, sets today's local Date Only value, saves, refreshes, and shows a dialog. It performs no eligibility checks or Registry removal.

Run `node --test JavascriptFormValidation/gsic_InterpreterForm.test.js` for the command's local mock tests.

## Conversion behavior and assumptions

Both explicit Custom API and automatic screening conversion use the shared converter to copy `gsic_applicationreferencenumber` to `gsic_interpreterreferencenumber` exactly as stored text. A missing or blank reference rejects conversion before writes. See [reference-number deployment and manual checks](docs/CONVERSION_REFERENCE_NUMBERS.md) for the remaining column configuration checks. Directly created Interpreters and existing records are unchanged.

The only entry point is an Applicant-bound Custom API Action, at main-operation stage 30. It must execute synchronously inside a Dataverse transaction. There is no Applicant Update/Status step or automated BPF trigger.

The handler retrieves the bound Applicant using an explicit ColumnSet, rejects an existing Interpreter lookup with the required message, validates data, creates one Interpreter, then links and archives the Applicant with one conditional UpdateRequest. It returns `InterpreterId` only after the update succeeds. Calls use `context.UserId`, preserving caller permissions. Trace entries contain record/correlation IDs and progress, not copied personal field values.

Initial minimum data remains **Applicant Name** (`gsic_ApplicantName`), which is now populated on the Applicant form from First Name (`gsic_firstname`) and Last Name (`gsic_lastname`). The conversion path still reads Applicant Name and writes its trimmed value to the Interpreter Name placeholder; conversion behavior has not been changed. The actual Interpreter name column still needs verification. Optional nonblank email, phone, and address values are copied as text. The mapping list must be checked against real Interpreter metadata, including writable destination fields, string lengths, required fields, and any field-level security.

Court Region is a verified Applicant Choice (`gsic_CourtRegion`) and is copied to Interpreter Region using its verified matching option values. Each selected value from the Applicant's Languages Applied For, Other Languages, and First Nations Languages multi-select Choices now creates one related Interpreter Language, with duplicate names suppressed. The conversion resolves option labels from published metadata, assigns English, First Nation, or Bilingual category, and sets Language Code when a matching choice exists. The separate single-choice Applied Language column is not used. Application Status is never changed.

Archive Application is assumed to be a Boolean/Two Options field. The handler writes true only if it is not already true. The Interpreter lookup is always set to the new record. No BPF stage is checked server-side because its table/stage metadata is unknown; the future button can be shown at Profile Creation. Add a server-side stage rule later only if it becomes an actual authorization/business requirement.

## Duplicate protection and transaction limits

An existing link blocks repeated execution. For overlapping calls, the final update uses the Applicant's retrieved `RowVersion` and `ConcurrencyBehavior.IfRowVersionMatches`. One caller can update that version; a competing caller must fail and roll back its transaction, including its attempted Interpreter creation. Unrelated concurrent Applicant changes can also cause a safe conflict. There is no retry or compensating delete in the plug-in. A recursive invocation of the same Custom API in the parent context chain is rejected.

This requires Applicant optimistic concurrency to be enabled. Missing row version fails before any write. Microsoft documents [optimistic concurrency and its fault codes](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/optimistic-concurrency). Transaction behavior follows the platform's [synchronous transaction model](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/scalable-customization-design/database-transactions).

The tests verify sequential duplicate prevention, conditional update behavior, and that update/concurrency failures throw after the attempted creation without returning success. **Moq does not model database transactions or concurrent Dataverse execution. These tests do not prove rollback.** In an approved nonproduction environment, force an Applicant update failure after Interpreter creation, and submit two simultaneous requests for the same Applicant. Verify no orphan Interpreter remains after failure and at most one Interpreter commits after concurrent calls. Do not clear an established Applicant.Interpreter link as a routine action: duplicate prevention relies on that persisted relationship.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the proposed API contract, local tool inventory, future command button, and steps that require approval.
