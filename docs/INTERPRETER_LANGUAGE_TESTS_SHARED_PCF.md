# Shared Interpreter Language Test History PCF

## Inspection and reuse decision

The user confirmed `PCF/BilingualLanguageTestsOpenForm` version 0.1.3 works for Bilingual. Inspection before edits established that the same control can support all three categories. Version 0.1.5 retains the namespace, constructor, dataset and required inputs, so existing bindings use the same component identity. No separate controls are needed.

| Area | Proven 0.1.3 assumptions | Shared 0.1.5 behavior |
| --- | --- | --- |
| Category validation | Rejects every row except Bilingual `472540000`; accepts integers and integer strings | Accepts Bilingual `472540000`, English `472540001`, First Nation `472540002`; malformed and unknown categories still fail validation |
| View identity | No runtime dependency on a view name or GUID | Unchanged; no view lookup or GUID allowlist |
| Language filtering | Uses bound dataset records in `sortedRecordIds`; does not query languages or rewrite filters | Unchanged; each subgrid/view supplies category and parent filtering |
| Table and columns | Requires `gsic_interpreterlanguage`, Language Name, Language Category, Interpreter | Unchanged; all categories share this table and these columns |
| Ownership | Validates each row's `gsic_interpreter` lookup against configured Interpreter ID | Unchanged; a wrong parent fails validation before history loads |
| History query | Queries `gsic_testresult` by exact `_gsic_interpreterlanguage_value`; newest Test Date first | Unchanged; selected language ID works across categories |
| Creation | Uses configured Test Result main form, selected language ID/name | Unchanged; no category, Interpreter ID or view ID is passed as a creation parameter |
| Navigation | `context.navigation.openForm`, main form, new window | Unchanged; no automatic refresh on promise completion |
| Refresh | Refreshes bound dataset, invalidates histories, reloads expanded rows after dataset completion | Unchanged; refreshed language values and Test Results display with expansions retained |
| Labels | Bilingual caption and empty message | Caption reflects the category of loaded rows; empty or mixed views use generic Interpreter Language wording |
| Diagnostics | Helpers exist but normal UI does not render diagnostics | Unchanged; no control/version/build marker, view identity, save instructions or inspect action |

The existing seven Test History columns are preserved, including the three Bilingual score columns. This change does not introduce English/First Nation history score columns or guess their schema. The existing Test Result form script already switches the score sections using the selected language category; its tests cover all three categories. History is opened using the existing expand action. The proven component does not have a separate existing-Test-Result or Interpreter-Language record navigation action, and this change preserves that behavior.

## Configure the same control on each grid

Use component `GSIC.Prototype.BilingualLanguageTestsOpenForm` (designer display name **Interpreter Language Tests - openForm**) for all three Interpreter Language subgrids. The source folder/constructor retains its existing name for binding compatibility.

| Subgrid | Category predicate in its saved view |
| --- | --- |
| Bilingual Interpreter Language | `gsic_languagecategory = 472540000` |
| English Interpreter Language | `gsic_languagecategory = 472540001` |
| First Nation Interpreter Language | `gsic_languagecategory = 472540002` |

For each grid, use **Only related records** for the current Interpreter, bind `languages` to that grid's dataset, bind `interpreterId` to the current Interpreter primary ID, and configure `testResultFormId` with the verified Test Result main-form GUID already used by the working Bilingual grid. Include `gsic_languagename`, `gsic_languagecategory`, and `gsic_interpreter` in each view; other visible columns come from that view. Category and Interpreter columns remain hidden by the component. Restrict selectable views to the intended category where category separation is required. The PCF intentionally displays all valid records supplied by a mixed-category view.

No view GUID configuration is needed. Saved-view predicates need not appear in the runtime dataset filter. Keep the existing Test Result form library and `GSIC.TestResultForm.onLoad` registration so the selected language determines the score section. Existing detailed form requirements are in [the openForm configuration guide](BILINGUAL_LANGUAGE_TESTS_OPENFORM_PCF.md).

After saving a Test Result in the opened main form, use **Refresh** in the original grid. Refresh waits for the bound dataset update and reloads expanded histories. The main-form navigation promise is not treated as a save signal.

## Local validation and live acceptance

Run from `PCF/BilingualLanguageTestsOpenForm`:

```powershell
npm run build:release
npx tsc --noEmit
npm test
npm run test:bundle
```

The PCF suite includes all preexisting navigation, paging, refresh, asynchronous request, safety and diagnostics checks. Added regressions exercise each category's numeric/string records, exact history query and creation parameters, refreshed language values/history, ownership and disabled creation, plus mixed/empty bound datasets and category changes supplied by the host. Existing Test Result form and Interpreter Language grid suites remain applicable.

Version 0.1.5 validation on 2026-10-01: production PCF build (including manifest validation and ESLint), standalone TypeScript validation, and unmanaged solution packaging passed. All 35 openForm source tests, seven production bundle tests, 35 separate host-event PCF tests, 27 form/grid script tests, and 26 .NET plug-in tests passed. The .NET SDK is available at `.build-tools/dotnet/dotnet.exe`; set `DOTNET_CLI_HOME` to `.build-tools/dotnet-home` and `NUGET_PACKAGES` to `.build-tools/packages` when using it. No plug-in code changed.

## Reported First Nation string error and verified package

The reported row `a582aa0b-d2bd-f111-aaad-000d3a5c3e0a` with `gsic_languagecategory="472540002"` is now an explicit regression, with equivalent numeric/string tests for all three categories. Tests also confirm required columns, dataset table and Interpreter ownership remain mandatory.

Inspection found no Bilingual-only guard in the local 0.1.4 openForm source or its generated production bundle. The exact old error sentence `expected Bilingual (472540000).` was found in the staged 0.1.3 openForm bundle under `bin/staging-0.1.3.0`. The separate host-event control also retains its own Bilingual-specific validation and is a different component. This supports a stale/different artifact explanation for the live error; the target environment's active solution layer or control binding has not been inspected here.

Version 0.1.5 derives the supported-category error text from the same category list used for runtime validation, removing a separately maintained category message. Production bundle regressions execute the real PCF registration and exercise history, creation and Refresh using the exact reported record ID. No navigation or Refresh code was changed.

Import artifact: `PCF/BilingualLanguageTestsOpenFormSolution/bin/BilingualLanguageTestsOpenFormSolution-0.1.5.0.zip`, solution version `0.1.5.0`, control version `0.1.5`. The earlier ZIPs are preserved. Use this artifact rather than an older Release/marker ZIP. It contains the code component and assets, not form/view changes. After import/publish, ensure each grid uses `GSIC.Prototype.BilingualLanguageTestsOpenForm` from the updated solution layer. No diagnostics were added to the normal UI.

Package verification: the extracted ZIP's control manifest is `0.1.5`, solution manifest is `0.1.5.0`, and its bundle SHA256 matches the production build (`341D6BDEB6A112D375EF8BB70E483FE0BA95F6E2D7E6480B5C672A1AC4570FC2`). All seven production regressions also passed against the extracted ZIP by setting `PCF_TEST_BUNDLE_DIR` to its control asset directory before `npm run test:bundle`.

Live acceptance: attach this same version to each category's grid, confirm only the current Interpreter's intended rows appear, expand a row, create a Test Result, verify its language lookup and score section, save, return and Refresh. Confirm updated dataset values/history and retained expansion. Repeat for all three categories and check that the normal UI contains no diagnostics.

Local changes/builds do not import, publish, or modify model-driven forms/views. Live grid attachment and Dataverse save behavior require the target environment.
