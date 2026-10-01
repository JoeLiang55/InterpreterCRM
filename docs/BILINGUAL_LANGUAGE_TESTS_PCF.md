# Bilingual language tests dataset PCF prototype

## Implemented behavior

Project: `PCF/BilingualLanguageTests/BilingualLanguageTests.pcfproj`.
Control: `GSIC.BilingualLanguageTests` (solution publisher adds its prefix).
Host script: `JavascriptFormValidation/gsic_BilingualLanguageTestsHost.js`.

The component replaces the Bilingual Interpreter Language related-record grid.
Each language row expands into its own Test Results area. **+ New Test Result**
appears at the top of that area for empty, populated, loading, and failed histories.
Creation uses the expanded language's saved ID; it does not require selecting a
Test Result or depend on the number of existing tests. The toolbar Add Test Result
handler remains available as a separate fallback.

The New button raises the documented `newTestResult` PCF custom event. A host form
script acknowledges the request, checks the persisted language belongs to the
current Interpreter, and opens the configured existing Test Result main form using
`Xrm.Navigation.navigateTo` in a create-mode dialog. It passes the language GUID
and persisted display name as lookup defaults. The existing
`GSIC.TestResultForm.onLoad` applies the category-specific sections.

On Save & Close, the host reads the saved result's language lookup and compares it
to the requested language. It reports a mismatch or verification failure visibly
without undoing the saved record. The generic Test Result form still allows lookup
changes if its lookup is editable; the prototype does not add a lookup-locking rule.
The host then calls the PCF completion callback. A saved result triggers a dataset
refresh and fresh queries for expanded histories. Closing without saving does not
refresh. Missing event wiring, missing form configuration, retrieval/navigation
errors, and refresh request failures are shown inside the component.

The component only changes elements inside its supplied PCF container. It does not
inspect or modify the host grid DOM, use `window.Xrm` from PCF, or access private
framework members. The separate registered form script uses the supported Client
API in its normal form event context.

## Confirmed metadata and displayed columns

| Column | Logical name | Handling |
| --- | --- | --- |
| Test Date | `gsic_testdate` | Date only display; newest date first |
| Test Type | `gsic_testtype` | String, not a Choice |
| Test Version | `gsic_testversion` | String; values such as `01` stay intact |
| Sight Translation Score | `gsic_sighttranslationscore` | Existing repository decimal score mapping |
| Consecutive Interpreting Score | `gsic_consecutiveinterpretingscore` | Existing repository decimal score mapping |
| Simultaneous Interpreting Score | `gsic_simultaneousinterpretingscore` | Existing repository decimal score mapping |
| Test Incident | `gsic_testincident` | Boolean displayed as Yes/No |

Test Incident is separate from Incident Details. An Incident Details logical name
has not been confirmed and is not guessed. Test Date format is confirmed; its
Dataverse behavior has not been verified. The prototype uses formatted values when
available and otherwise displays the supplied calendar date without applying a
timezone conversion. Text is rendered as text, including HTML-looking strings.
Zero scores and false incident values are retained.

Each history uses `context.webAPI.retrieveMultipleRecords("gsic_testresult", ...)`
with `$filter=_gsic_interpreterlanguage_value eq <language-guid>` and
`$orderby=gsic_testdate desc`. It also checks every returned record's lookup, so a
page containing another language's test is rejected. Queries run only when a
language is expanded. Test histories and language rows have separate paging;
continuation queries preserve encoded skip tokens.

## Local build and checks

From `PCF/BilingualLanguageTests`:

```powershell
npm ci
npm run build:release
npm test
```

The release build validates the manifest, runs ESLint, produces the optimized PCF
bundle, and runs TypeScript checking. Build artifacts are under
`out/controls/BilingualLanguageTests`; dependencies, generated types, test output,
and bundles are ignored by Git. The source and package lock are available for
packaging into the intended app solution. No environment import or publish has
been performed.

Tests use the actual PCF class in jsdom and the actual host script with mocked
Dataverse/navigation. They cover the button's location in empty/populated areas,
scoped test queries, displayed metadata types, saved lookup verification, cancel,
errors, paging, stale responses, and expansion through refresh. They simulate
persistence and cannot certify deployed Dataverse forms or browser behavior.

## Test-environment configuration

1. Build/package the PCF into a solution using the intended solution publisher.
   Import it into the test environment. Follow Microsoft's [PCF packaging steps](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/import-custom-controls).
   This repository does not contain the existing solution export, so it cannot
   patch/import that solution's forms or grids automatically.
2. On the **Interpreter main form**, configure the actual Bilingual Interpreter
   Language subgrid as **Only related records** through the Interpreter lookup.
   Do not configure an all-records language view. The parent form must be a saved
   `gsic_interpreter` record.
3. Reuse the published related Bilingual view and verify its GUID, since two views share the name Bilingual View. Its existing filter is **Language Category = Bilingual (472540000)**; do not reapply it for the reported error. Include
   `gsic_languagename`, `gsic_languagecategory`, and `gsic_interpreter` in its dataset
   columns. Other parent columns such as best scores can remain in the view and
   are displayed by the PCF. The category and Interpreter columns are used for
   validation and excluded from the visible parent columns.
4. Add **Bilingual Language Tests (Prototype)** as the subgrid component for Web.
   Configure its properties:

   | Property | Required value |
   | --- | --- |
   | `languages` | The related Bilingual Interpreter Language view above |
   | `interpreterId` | Bind to the current Interpreter's primary ID, logical name `gsic_interpreterid` |
   | `testResultFormId` | Static string containing the verified existing Test Result main-form GUID |

   The [PCF record-ID guidance](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/faq#how-can-i-access-the-record-id-or-table-name)
   describes explicitly binding a record-ID input. Verify the designer exposes
   this binding on the target subgrid. If unavailable there, this is a deployment
   blocker; do not substitute a fixed Interpreter GUID.
5. Obtain the Test Result main-form GUID using the actual designer/export or the
   read-only query `tools/TestResultMainForms.fetch.xml`. The steps are in
   [Add Test Result form identification](ADD_TEST_RESULT_COMMAND.md#identify-the-existing-main-form).
   No form GUID is included in the prototype, and missing/invalid configuration
   disables creation instead of opening the user's default form.
6. On that Test Result Main form, retain/add library `gsic_TestResultForm.js` and
   **Form OnLoad: `GSIC.TestResultForm.onLoad`**, with execution context checked.
   Ensure lookup `gsic_interpreterlanguage` and internal section names
   `Bilingual Scores` and `English / First Nations` exist. The script registers its
   lookup OnChange callback itself. Include this active main form in the app and
   make it available to the intended roles.
7. Publish `gsic_BilingualLanguageTestsHost.js` from the matching repository file
   as a JavaScript web resource. Add it to the **Interpreter main form** libraries.
   Register **Form OnLoad: `GSIC.BilingualLanguageTestsHost.onLoad`**, check **Pass
   execution context as first parameter**, and add one string parameter containing
   the **actual internal subgrid control name** used by the PCF. That name is not
   exported here and must be read from the form designer. Do not use the control's
   display label or guess which `Subgrid_new_*` corresponds to Bilingual.
8. Save/publish the form and app. The host registers `newTestResult` through the
   custom code component's `addEventHandler`; repeated OnLoad calls do not add
   duplicate handlers. The preview custom-event API must exist on this runtime.
   If an expanded New button reports it is not connected, inspect this registration
   and confirm the subgrid code component exposes the event.
9. Keep the toolbar fallback and any existing registrations for it. Existing
   Dataverse Read, Create, Append and Append To access still applies. PCF read-only
   mode disables New. Native lookup editing/creation settings do not enable this
   component's action.

## Expansion and live acceptance

Expansion is owned by this dataset PCF and keyed by language GUID. Refresh clears
cached child results while retaining expanded flags, then reloads expanded
histories. Local tests confirm that two expanded rows stay open after creating a
test for either the empty or populated language. Paging away/back retains choices
within the same instance. Changing the Interpreter or destroying/recreating the
component clears state. Persistence across an entire form reload is not promised.

Live checks are still pending:

| Check | Expected result |
| --- | --- |
| Zero tests | Expand Language A with no tests. New is above the empty test table. The create dialog has A's lookup and the existing Bilingual score sections. Save & Close adds one test under A. |
| Existing tests | Expand Language B with existing tests. New is in B's area. Save & Close adds a test under B while retaining its earlier attempts. |
| Isolation | Inspect the stored language lookup on both new results. It equals the language whose New button was clicked. Other language histories/counts are unchanged. |
| Expansion | Keep A and B expanded during each action. Both remain open after the dataset refresh; child lists show fresh records and parent best scores update if their plug-in is registered. |
| Cancel | Close/discard without saving. No test is created and no completion-triggered refresh occurs. |
| Lookup change | If a user deliberately changes the generic form's lookup, the post-save check reports the different owner and refreshes the data; it does not misreport that result as belonging to the original language. |
| Missing permissions/configuration | No default form or other language is substituted. Errors are visible and New becomes usable again after a failed request. |
| Refresh/paging | Test multiple child pages and language pages. Only expanded histories load, their records are scoped correctly, and refresh retains expansion in the current instance. |

## Remaining blockers and limits

| Item | Current status |
| --- | --- |
| Actual Test Result main-form GUID | Not available in local metadata; must be supplied from the destination environment. |
| Authenticated app/runtime | PAC has no authentication profile; actual create/save/refresh and role behavior have not been exercised. |
| Existing form/view/relationship configuration | Not exported here. Configure the actual related view, record-ID binding, subgrid name, host event, and Test Result form registration. |
| Automatic dialog completion bridge | Implemented using Microsoft's documented **PCF custom events preview**. Target-runtime support on the dataset subgrid must be confirmed. This is a prototype dependency, not a claim of generally available support. |
| Published Test Result metadata | Screenshot confirms date/text/Boolean mappings. Existing repository constants supply table/lookup/scores; destination published metadata, Date Only behavior, and permissions still need checking. |
| Category scope | This prototype displays the Bilingual view and its three score columns. English/First Nation grids need their corresponding column sets before this control is used for them. |
| Solution deployment | Production bundle is built locally; no solution import, form publishing, or Dataverse data changes have been made. |

If the target runtime cannot deliver custom events from a dataset PCF, that blocks
the automatic dialog-and-refresh flow. Report that result before choosing a
different host integration. Do not replace it with host DOM injection, direct PCF
access to `window.Xrm`, or an `openForm` main-form promise assumed to signal Save.

## API evidence

- [PCF custom events and model-driven payload callbacks (preview)](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/events)
- [Custom-event payload tutorial](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/tutorial-define-event#passing-payload-in-events)
- [Custom code component addEventHandler](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/controls/addeventhandler)
- [Create-mode dialog and completion result](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-navigation/navigateto)
- [Dataset refresh API](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/dataset)
- [Dataset lookup EntityReference format](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/entityreference)

## Bound-view diagnostics

Control version 0.1.2 adds actual bound-view identification and row-value diagnostics while preserving the host-event navigation flow. The production build and all 35 local tests pass. See [the investigation and diagnostic steps](BILINGUAL_VIEW_DIAGNOSTICS.md); the saved view filter is not required to appear in the runtime dataset filter.

The visible marker is `GSIC.BilingualLanguageTests | v0.1.2 | build EVT-20261001-01`. This control is separate from the openForm control imported through the openForm wrapper. See [loaded-component and solution-layer investigation](BILINGUAL_PCF_LOADED_COMPONENT.md).
