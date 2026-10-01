# Bilingual language test history: PCF openForm prototype

This workspace has not imported, pushed, published, or attached a control to the working grid. The user subsequently reported importing the verified 0.1.1.0 ZIP; live binding and layers are not yet verified here. The current 0.1.2.0 marker package is prepared locally. Use a separate test form in a nonproduction environment for the configuration steps below.

## Two implementations

| Implementation | Source folder | Creation and refresh |
| --- | --- | --- |
| Requested PCF navigation prototype | `PCF/BilingualLanguageTestsOpenForm` | Calls `context.navigation.openForm` directly, opens the configured Test Result main form in another tab, prepopulates the selected language lookup, and provides explicit Refresh. No host script or custom event. |
| Concurrent implementation, preserved | `PCF/BilingualLanguageTests` | Raises a `newTestResult` PCF event. `JavascriptFormValidation/gsic_BilingualLanguageTestsHost.js` subscribes with the form control's `addEventHandler`, retrieves the language to verify Interpreter ownership, then calls the form script's `Xrm.Navigation.navigateTo` to open a create-mode main-form dialog. It checks a returned saved record's language and signals the component to refresh after a save; cancellation does not trigger refresh. |

The requested control has a distinct manifest identity, `GSIC.Prototype.BilingualLanguageTestsOpenForm`, so it can coexist with `GSIC.BilingualLanguageTests`. Its separate packaging project is `PCF/BilingualLanguageTestsOpenFormSolution`. The concurrent packaging project is `PCF/BilingualLanguageTestsSolution`; the validation/diagnostics fix updates both components without changing their separate navigation implementations or that packaging project. Consult the concurrent implementation's [own guide](BILINGUAL_LANGUAGE_TESTS_PCF.md) for its separate configuration. The host bridge uses form-script Xrm; the requested openForm component contains no Xrm access, custom event bridge, parent-window access, or host DOM manipulation.

## Schema evidence and prerequisites

Repository instructions and schema were inspected before editing. No `AGENTS.md` was found in this repository or its parent directories. Existing evidence is in `DATAVERSE_SCHEMA.md`, `InterpreterCRM.Plugins/DataverseSchema.cs`, `.metadata-check/Entities/gsic_interpreter.cs`, and `JavascriptFormValidation/gsic_TestResultForm.js`. PAC 2.12.2 reports no local authentication profiles, and no connection string is configured. No live metadata query could be performed. The user supplied authoritative screenshot mappings for the four remaining columns; [schema notes](../DATAVERSE_SCHEMA.md#test-result) record their provenance and limitations.

| Purpose | Logical name / value | Evidence |
| --- | --- | --- |
| Bound language table | `gsic_interpreterlanguage` | Existing schema and form script |
| Language row identity | `record.getRecordId()` | Bound dataset; no primary-key name guessed |
| Language name | `gsic_languagename` | Existing schema |
| Language's parent lookup | `gsic_interpreter` | Existing schema |
| Parent table / primary ID | `gsic_interpreter` / `gsic_interpreterid` | Local generated Interpreter metadata snapshot |
| Category | `gsic_languagecategory` = `472540000` (Bilingual) | Existing schema and category form script |
| Test table / language lookup | `gsic_testresult` / `gsic_interpreterlanguage` | Existing schema and Test Result form script |
| Test Date | `gsic_testdate`, Date only | User-confirmed screenshot |
| Test Type / Test Version | `gsic_testtype` / `gsic_testversion`, strings | User-confirmed screenshot |
| Three bilingual scores | `gsic_sighttranslationscore`, `gsic_consecutiveinterpretingscore`, `gsic_simultaneousinterpretingscore` | Existing schema and decimal score rollup code |
| Test Incident | `gsic_testincident`, Boolean | User-confirmed screenshot; separate from Incident Details |

Before live testing, identify the actual **Test Result main-form GUID**, verify the two existing lookup targets and the Interpreter-to-Interpreter-Language relationship in the target environment, and verify the category value. No relationship schema name or form ID is invented. The Test Result primary ID and entity-set name are not needed by this component. Date behavior, text maximum lengths, defaults, Incident Details metadata, required Test Result fields, field security, and existing server validations remain unverified. Preserve the current Dataverse column definitions.

Prerequisites: Node.js 24 LTS, npm, Microsoft Power Platform CLI, .NET SDK 6+ or Visual Studio MSBuild with .NET build tools, dependency registry access for the first restore, and an existing model-driven app with these tables in a nonproduction Dataverse environment. Import/configuration requires solution customization privileges. Runtime users need read access to Interpreter Language/Test Result and the visible columns, access to the configured Test Result main form, Create/Append on Test Result and Append To on Interpreter Language. Field security and any server rules still apply. Mobile offline and canvas apps are outside this prototype's scope.

## Build and package locally

Run in PowerShell from the repository root with Node/npm and dotnet on PATH:

```powershell
Push-Location .\PCF\BilingualLanguageTestsOpenForm
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
npm run build:release
if ($LASTEXITCODE -ne 0) { throw 'PCF build failed' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'PCF tests failed' }
Pop-Location

node --test .\JavascriptFormValidation\gsic_TestResultForm.test.js
if ($LASTEXITCODE -ne 0) { throw 'Test Result form tests failed' }

dotnet build .\PCF\BilingualLanguageTestsOpenFormSolution\BilingualLanguageTestsOpenFormSolution.cdsproj --configuration Release -p:PcfBuildMode=production
if ($LASTEXITCODE -ne 0) { throw 'Solution packaging failed' }
```

The checked-in `.cdsproj` already references the openForm `.pcfproj` and explicitly sets `SolutionPackageType=Unmanaged`; Release therefore still generates an **unmanaged** prototype wrapper. The solution unique name is `BilingualLanguageTestsOpenFormSolution`, version `0.1.2.0`, publisher unique name `GSICPrototypeOpenForm`, prefix `gsic`. This is a local packaging identity, not a claim about the existing environment's publisher. Confirm its name does not conflict before importing; it adds no Choice options or table definitions. Build artifacts are ignored by Git.

The component output is under `PCF/BilingualLanguageTestsOpenForm/out/controls/BilingualLanguageTestsOpenForm`. The standard build command produces `PCF/BilingualLanguageTestsOpenFormSolution/bin/Release/BilingualLanguageTestsOpenFormSolution.zip`. The marker build is packaged separately as `PCF/BilingualLanguageTestsOpenFormSolution/bin/marker-0.1.2.0-verified/BilingualLanguageTestsOpenFormSolution.zip`, preserving the earlier ZIPs. Use this separately verified marker artifact for version 0.1.2.0. It contains the new code component and its assets, not forms, views, table definitions, plug-ins, the existing grid, or JavaScript web resources. Importing the ZIP alone does not configure a subgrid or register the form script.

The wrapper follows Microsoft's [solution packaging workflow](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/import-custom-controls). To create another wrapper instead of using the checked-in one, create an empty directory, run `pac solution init --publisher-name <verifiedUniquePublisherName> --publisher-prefix gsic`, then from that directory run `pac solution add-reference --path C:\Code\InterpreterCRM\PCF\BilingualLanguageTestsOpenForm`. Set `SolutionPackageType=Unmanaged` in its `.cdsproj` and build with the command above adapted to that project. Do not run `pac pcf push` for this prototype.

## Future import and test-form configuration

These steps have not been executed.

1. Open `make.powerapps.com`, select the intended nonproduction environment, then **Solutions → Import solution → Browse**. Select the unmanaged ZIP above, review its identity/dependencies, and complete the import. If prompted, publish imported customizations. This is a code-component import, not a replacement of any existing form control.
2. In your existing unmanaged app solution, make a separate **Interpreter main form copy** named, for example, `Interpreter - openForm PCF Prototype`. Give it to tester roles and include it in a test app. Retain the existing Interpreter main form and working subgrid. Avoid making the copy the general default form.
3. Reuse the published Interpreter Language Bilingual view, verifying its actual GUID because two views share the name **Bilingual View**. Its existing **Language Category = Bilingual** filter uses value `472540000`; do not reapply it for this error. Include `gsic_languagename`, `gsic_languagecategory`, and `gsic_interpreter`. Optionally include Accreditation Status and the three bilingual best scores already present on the language table, in the desired language-row order. The component renders the view's visible columns except Category and Interpreter, which it uses for validation.
4. Add a new subgrid to the copied Interpreter form with a unique name such as `Prototype_Bilingual_OpenForm`. Select **Only related records**, table **Interpreter Language**, and the existing relationship whose child lookup is `gsic_interpreter` and parent is Interpreter. Select the prototype view. Restrict view switching to this view. Do not use **All records**. Ensure the subgrid and its containing section are visible by default and allow sufficient height. The existing visibility script addresses `Subgrid_new_1`, `_2`, `_3`; the new unique name keeps this prototype out of those visibility rules. Keep Add Language accessible through the existing action elsewhere on the test form.
5. In the subgrid's component/Controls configuration, add **Bilingual Language Tests - openForm Prototype** (`GSIC.Prototype.BilingualLanguageTestsOpenForm`) and select it for **Web**. Bind the `languages` dataset to that subgrid. Configure **Interpreter record ID** (`interpreterId`) by **Bind to a value on a field → Interpreter primary ID (`gsic_interpreterid`)**, not a static GUID and not the child language ID. This follows Microsoft's [documented record ID input pattern](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/faq#how-can-i-access-the-record-id-or-table-name). If the designer does not expose that binding for the subgrid, stop configuration and record that host limitation; do not work around it with parent-window Xrm or DOM access.
6. Configure **Test Result main form ID** (`testResultFormId`) as a static text value containing the verified GUID of the Test Result main form configured in the next section. No default-form fallback is used. Add that form and Test Result table to the test app and ensure tester roles can access them. Do not register `gsic_BilingualLanguageTestsHost.js` or a `newTestResult` event for this component.
7. Save and publish only the copied test form and test app changes needed for this test. Open the copied form explicitly for a **saved** Interpreter. This prototype rejects unsaved parent IDs, another Interpreter's language rows, the wrong dataset table, missing required view columns, and non-Bilingual rows. Current Interpreter scoping comes from the host's related-record dataset and is checked against the configured parent ID; the PCF does not query languages independently.

If the modern designer does not expose the subgrid custom control properties, use the solution's supported classic form editor Controls tab where available. The menu labels vary by designer. A host that cannot bind these required inputs is a missing configuration prerequisite, not a reason to infer metadata or create new columns.

## Test Result form configuration: reuse the existing script

1. Verify the selected existing Test Result main form in the target environment, or make a separate test copy and use that copy's actual GUID. Obtain the GUID from that form's designer URL or its existing `systemform` record; do not use the table ID, a view ID, or an invented GUID.
2. In the app's unmanaged solution, include the existing JavaScript web resource named `gsic_TestResultForm.js` with contents from `JavascriptFormValidation/gsic_TestResultForm.js`. This work does not modify that script. Add it to the selected Test Result form libraries.
3. Register **Form On Load → `GSIC.TestResultForm.onLoad`**, check **Pass execution context as first parameter**, and register it once. The script attaches the lookup OnChange handler itself; do not add duplicate field registrations.
4. Ensure the form includes lookup `gsic_interpreterlanguage`. Confirm the actual **section internal names** match the existing script: `Bilingual Scores` and `English / First Nations`, even if display labels differ. Both are initially available. For Bilingual, the script shows the first section and hides the second; English/First Nation does the reverse. Missing/unknown/loading categories keep both sections available. These section names are existing source assumptions that must be checked against the actual form; no form export was available.
5. Include Test Date, Test Type, Test Version, Test Incident, the three bilingual scores in the Bilingual section, and the existing English/First Nation score fields in their respective section. Keep Test Type and Test Version as text controls and Test Incident as the existing Boolean control; Incident Details is separate and its metadata is outside this change. Include all other existing fields required by that Test Result form/table.
6. Save/publish the selected test form and make it available to tester roles in the test app. Verify opening it directly, then from the PCF button. The form script executes in its supported form context; the PCF does not load that script into its own DOM or reach into the opened form.

## Navigation and refresh limitation

Microsoft's [PCF openForm reference](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/navigation/openform) exposes `context.navigation.openForm(options, parameters)`. The [model-driven openForm behavior](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-navigation/openform) specifies that the success callback runs on Quick Create save, and does not run for an existing or new main form. A main form is required here to reuse the category-specific sections; there is no verified equivalent Quick Create form. The prototype therefore implements **no automatic refresh on navigation completion**, even if a mock resolves the promise with a saved reference. No timers, focus detection, browser messages, or parent-window access are used to infer saving.

The button uses `entityName: "gsic_testresult"`, the configured `formId`, `useQuickCreateForm: false`, `openInNewWindow: true`, and parameters `gsic_interpreterlanguage: <expanded row GUID>` plus `gsic_interpreterlanguagename: <row display name>`. It opens another tab so the original PCF instance retains expansion state. After saving or canceling, return to the Interpreter tab and select **Refresh**. Missing/invalid form ID leaves the New button visible but disabled with a configuration message; it never chooses an unconfigured default form.

Refresh invokes the bound dataset's supported `refresh()` once, waits for its `updateView`, and reloads tests for expanded rows on the returned language page. Expansion choices survive loading, refresh, and language paging. [Dataset refresh resets paging to page 1](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/dataset/refresh); an expanded language on a later page reopens when that page is visited again. Refresh reloads the first test page of each expanded language; it does not preserve the number of previously loaded test pages. Expansion state lasts for the component instance, not a full page reload or component destruction.

Test queries use supported [PCF retrieveMultipleRecords](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/webapi/retrievemultiplerecords), selecting just the seven columns and `_gsic_interpreterlanguage_value`, filtering that lookup to the exact language GUID, and ordering `gsic_testdate desc`. There is no Interpreter-wide test query. Up to 250 tests load per page; **Load more test results** follows the server continuation without decoding its skip token. Tests are fetched only for expanded languages. Ties in Test Date follow server order; no unverified primary ID is invented as a secondary sort. Server formatted values are displayed when provided; otherwise Date Only displays the returned date portion without assuming date behavior, incident displays Yes/No, nulls display a dash, and zero scores/string versions such as `01` are preserved.

## Validation and manual acceptance

The local production build validates the manifest, runs Microsoft's PCF lint rules, compiles TypeScript, and produces the bundle. Twenty-six tests run the actual compiled component in jsdom with mocked PCF dataset/Web API/navigation, including the documented `dataset` update token and layout updates during Refresh. Six tests execute the existing Test Result form script with mocked form APIs. These checks establish local behavior and API call shapes, not live permissions, input binding, saved-record behavior, browser tab handling, or actual form section names.

In the configured test app:

1. Open a saved Interpreter with two Bilingual languages and another Interpreter with a same-named language. Verify only the current Interpreter's Bilingual rows appear. Verify an unsaved Interpreter prompts saving. Misconfigure a view/parent binding temporarily on the test form and verify it fails visibly instead of exposing another parent's rows.
2. In browser network tools, verify no Test Result requests occur before expansion. Expand one language: confirm its query filters `_gsic_interpreterlanguage_value` to exactly that row's GUID, and no request occurs for collapsed languages. Expand the other row and verify independent history. Collapse/re-expand and check the cached history.
3. Verify **+ New Test Result** is above the seven columns for both an empty list and a populated list. Check newest dates first, null scores, zero scores, text versions such as `01`, and Yes/No incidents. Test Incident must not display Incident Details text.
4. Click New from each language. Check the new main form's lookup GUID, category-specific sections, and form access. Save a result, return to the original tab, and click Refresh: the expanded rows stay open and the new result appears only under its saved language. Cancel another creation and verify Refresh shows no added row. If the user changes the language lookup in the form, the saved result belongs to that selected language and must never be displayed under the original row.
5. With slow requests, refresh/collapse and switch parent records; late responses must not overwrite current histories. Check keyboard Enter/Space on the arrows, `aria-expanded`, visible focus, and horizontal scrolling at narrow widths.
6. Test more than one language page and more than 250 Test Results for a language. Confirm Previous/Next language buttons and Load more test results, the date order across test pages, refresh reset to the first page, and reopening by ID on a later language page.
7. Test missing read/create/form privileges, Web API errors, invalid form ID, a blocked new tab, and offline conditions. Error messages must remain visible and retry/Refresh must be available where applicable. Check the existing working grid and unrelated form behavior are still available.

No metadata, plug-in registration, score rollup, accreditation logic, or production-grid replacement is performed by the component or local build.

## Bound-view diagnostics

Control version 0.1.2 displays the actual bound view GUID, dataset columns and raw category types. Its optional **Inspect bound view** action reads that exact view definition. See [the investigation and diagnostic steps](BILINGUAL_VIEW_DIAGNOSTICS.md). Validation does not require saved FetchXML predicates in the runtime filter.

The always-visible identity/version/build marker and read-only form/component/layer investigation are documented in [Identify the code component actually loaded](BILINGUAL_PCF_LOADED_COMPONENT.md). The openForm marker is `OF-20261001-01`; importing this wrapper does not change the separate host-event control or any form binding.
