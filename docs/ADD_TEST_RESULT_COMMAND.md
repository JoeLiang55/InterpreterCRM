# Add Test Result from the Interpreter Language grid

## Implementation and configuration status

The implementation is `GSIC.InterpreterLanguageGrid.addTestResult` in
`JavascriptFormValidation/gsic_InterpreterLanguageGrid.js`. It requires exactly one
selected, saved `gsic_interpreterlanguage` record and a verified Test Result main-form
GUID. It opens a new `gsic_testresult` in a main-form dialog with the selected language
lookup populated, then refreshes the originating language grid when the dialog closes
with a saved record reference. Canceling without saving does not refresh. Navigation,
lookup retrieval, and refresh failures display an error; a refresh failure explicitly
states that the result was already saved. Repeated invocation on the same grid is
ignored while a dialog is pending. The existing OnRecordSelect handler is retained.

No child-record query or count is used to enable creation. The action works from a
saved language row even if it has zero Test Results. It rejects child Test Result
selection and does not substitute the Interpreter form's record ID for the language ID.
It captures the selected language before opening the dialog, so selection changes
while the dialog is open cannot change the supplied defaults or the originating grid.

Metadata inspection on 2026-10-01 found only a generated Interpreter entity snapshot
under `.metadata-check/Entities`; no Test Result form export, grid view export,
solution command definition, or form GUID was available. `pac auth list` reported
no authentication profiles. No form GUID has been invented or hardcoded. No app
configuration or Dataverse data was changed.

## Identify the existing main form

1. In the intended environment and app solution, open **Tables > Test Result > Forms**.
   Open the existing **Main** form that contains the Interpreter Language lookup and
   the score sections used by `gsic_TestResultForm.js`.
2. Obtain its actual form GUID from the designer URL's `formId`/`formid` parameter or
   a solution export. Verify its table is `gsic_testresult`, its form type is Main,
   and the form is active and included in the model-driven app. Do not use the table
   GUID, app GUID, quick-create form GUID, or a test fixture GUID.
3. With an existing CLI authentication profile for that environment, candidate forms
   can also be listed with this read-only query:

   ```powershell
   pac env fetch --environment '<intended-environment-url>' --xmlFile tools/TestResultMainForms.fetch.xml
   ```

   This queries active `systemform` rows for `gsic_testresult`, with `type = 2`
   (Main). If several forms are returned, inspect each candidate's libraries,
   OnLoad events, and section names. A form called "Information" or "Main" alone
   is not enough to identify the correct one.
4. Use the verified GUID as the command's third **String** parameter. Repeat this
   verification for each destination environment. The handler refuses a missing or
   malformed GUID instead of falling back to an arbitrary default form.

## Register the existing category logic on that form

1. Include the JavaScript web resource `gsic_TestResultForm.js`, using
   `JavascriptFormValidation/gsic_TestResultForm.js`, in the form libraries.
2. Register **Form On Load > GSIC.TestResultForm.onLoad** exactly once and check
   **Pass execution context as first parameter**. Retain the registration if it
   already exists. The handler registers the lookup OnChange callback itself.
3. Ensure the form contains lookup `gsic_interpreterlanguage` and sections whose
   **internal names** are `Bilingual Scores` and `English / First Nations`.
   The script retrieves `gsic_languagecategory` from the selected language and
   applies the existing visibility rules: Bilingual `472540000`; English
   `472540001`; First Nation `472540002`.
4. Save and publish the form and include it in the intended app. No new category
   logic or score-entry form is needed.

The lookup is a simple, single-table lookup. The command supplies only
`gsic_interpreterlanguage` (GUID) and `gsic_interpreterlanguagename` (display name)
in `navigateTo`'s `data`. It does not send a `gsic_interpreterlanguagetype` parameter.
If the selected reference has no display name, it retrieves `gsic_languagename`.
These are form defaults: the existing form still permits deliberate lookup changes
if its lookup control is editable. This command does not introduce a rule that locks
or rewrites that lookup.

## Register the parent language command

Use a **classic JavaScript command** on the **Interpreter Language table's SubGrid
command bar**, which is used by the language grids on the Interpreter form. Add the
button through the solution's command/ribbon editing tooling. The repository has
no exported command placement to patch automatically.

1. Create or update JavaScript web resource **gsic_InterpreterLanguageGrid.js** from
   `JavascriptFormValidation/gsic_InterpreterLanguageGrid.js` and publish it.
2. Create button **Add Test Result** on the `gsic_interpreterlanguage` **SubGrid**
   command bar. Assign command ID `gsic.InterpreterLanguage.AddTestResult`.
3. Configure the JavaScript action as follows, preserving parameter order:

   | Setting | Value |
   | --- | --- |
   | Library | `gsic_InterpreterLanguageGrid.js` |
   | Function | `GSIC.InterpreterLanguageGrid.addTestResult` |
   | Parameter 1 | CRM Parameter: `SelectedControl` |
   | Parameter 2 | CRM Parameter: `SelectedControlSelectedItemReferences` |
   | Parameter 3 | String Parameter: the **verified Test Result main-form GUID** |

   Do not pass `PrimaryControl`, execution context, selected child IDs, or an
   Interpreter ID. `SelectedControl` supplies the originating language grid.
4. Add selection-count enable rule **Minimum = 1, Maximum = 1,
   AppliesTo = SelectedEntity**.
5. Add custom enable rule with library **gsic_InterpreterLanguageGrid.js**, function
   **GSIC.InterpreterLanguageGrid.canAddTestResult**, default **false**, and these
   two parameters in order: **SelectedControl**,
   **SelectedControlSelectedItemReferences**. The custom rule rejects a child-grid
   context and disables the command while its dialog is pending. The action also
   validates selection at runtime.
6. Save and publish the command/solution and app. Existing Dataverse Create/Append
   and Append To permissions still apply. No new form OnLoad registration is
   required for the grid command library; loading it as the command library is
   sufficient. Keep any existing grid OnRecordSelect registration.

Equivalent command and enable-rule definitions are below. Merge them into the
existing `CommandDefinitions` and `RuleDefinitions/EnableRules`; bind the button to
the command above. Replace `VERIFIED_TEST_RESULT_MAIN_FORM_GUID` with the metadata
value before publishing. The placeholder intentionally fails runtime validation.

```xml
<CommandDefinition Id="gsic.InterpreterLanguage.AddTestResult">
  <EnableRules>
    <EnableRule Id="gsic.InterpreterLanguage.AddTestResult.OneSelection" />
    <EnableRule Id="gsic.InterpreterLanguage.AddTestResult.ValidContext" />
  </EnableRules>
  <DisplayRules />
  <Actions>
    <JavaScriptFunction Library="$webresource:gsic_InterpreterLanguageGrid.js"
                        FunctionName="GSIC.InterpreterLanguageGrid.addTestResult">
      <CrmParameter Value="SelectedControl" />
      <CrmParameter Value="SelectedControlSelectedItemReferences" />
      <StringParameter Value="VERIFIED_TEST_RESULT_MAIN_FORM_GUID" />
    </JavaScriptFunction>
  </Actions>
</CommandDefinition>

<EnableRule Id="gsic.InterpreterLanguage.AddTestResult.OneSelection">
  <SelectionCountRule AppliesTo="SelectedEntity" Minimum="1" Maximum="1" />
</EnableRule>
<EnableRule Id="gsic.InterpreterLanguage.AddTestResult.ValidContext">
  <CustomRule Library="$webresource:gsic_InterpreterLanguageGrid.js"
              FunctionName="GSIC.InterpreterLanguageGrid.canAddTestResult"
              Default="false">
    <CrmParameter Value="SelectedControl" />
    <CrmParameter Value="SelectedControlSelectedItemReferences" />
  </CustomRule>
</EnableRule>
```

## Save, cancellation, and refresh

The main-form dialog is opened with `target: 2` and no `entityId`. The `navigateTo`
promise resolves on dialog closure. A nonempty `savedEntityReference` triggers one
`SelectedControl.refresh()` call. This covers **Save & Close**, and Save followed
by closing the dialog. Closing and discarding an unsaved record causes no refresh.
An error while saving is handled by the existing form/platform; the command remains
pending until the dialog closes. A navigation error releases the command for retry.

The refresh reloads language rows, including any server-updated score columns.
The current nested-grid implementation controls whether child rows are reloaded
in place or collapse and load again on expansion. The handler does not reload the
Interpreter form, refresh unrelated grids, or manipulate the DOM.

**Expanded-row preservation is unverified in the live app.** The documented
GridControl API does not expose nested-row expansion capture/restore. The command
makes no promise to preserve it. If the platform collapses the row on refresh, users
must expand it again; confirm that the new Test Result appears after doing so. A
successful call to `refresh()` requests a refresh; its documented return value does
not provide a completion/error promise for subsequent grid data loading.

## Verification results and live acceptance checks

Run the focused checks from the repository root:

```powershell
node --check JavascriptFormValidation/gsic_InterpreterLanguageGrid.js
node --test JavascriptFormValidation/gsic_InterpreterLanguageGrid.test.js
```

Local tests load the real command and existing Test Result form scripts. They cover
lookup defaults for languages with zero and existing tests, category-specific
sections, exact selection validation, child-grid rejection, missing form ID,
cancellation, repeated clicks, selection changes while a dialog is open, name
retrieval, and navigation/refresh errors. The zero/existing-tests cases simulate
form persistence and check that only the selected language gains a record. They
do **not** verify actual Dataverse creation, deployed form wiring, or expansion.

Verification completed locally on 2026-10-01: JavaScript syntax check passed and
all 21 focused tests passed, including Bilingual, English, and First Nation form
visibility. Live creation and expanded-row preservation remain unverified because
the CLI has no authenticated environment and the command/form configuration is absent.

Complete these checks after registration in the intended test environment:

| Check | Steps and expected result | Live status |
| --- | --- | --- |
| First test | Select saved Language A with zero tests; invoke Add Test Result. Check correct main form, A's lookup, and category-specific score sections. Save & Close. A gains exactly one test. | Pending |
| Another test | Select Language B with existing tests; expand its Test Results first, invoke the command, verify B's lookup, then Save & Close. B gains exactly one test and its earlier tests remain. | Pending |
| Relationship isolation | Record A/B IDs and test counts before each action. Inspect each new Test Result's stored `gsic_interpreterlanguage` lookup; it must equal only the selected language's ID. Other language counts must remain unchanged. | Pending |
| Grid refresh | Confirm the originating language grid refreshes without a form reload, score rollups update if registered, and the saved test appears under the selected language. Re-expand if collapsed. | Pending |
| Expansion | Record whether the expanded row stays open after Save & Close. If open, confirm the child list is fresh; if collapsed, re-expand and confirm the new record is present. | Unverified |
| Cancel | Open the command and close/discard without saving. Test counts do not change and no command-triggered grid refresh occurs. | Pending |
| Selection | With zero or two selected languages the command is unavailable. Selecting a child Test Result must not invoke this action. | Pending |
| Categories | Repeat on Bilingual, English, and First Nation languages; the existing form shows the correct score sections. | Pending |

For an independent relationship check, retrieve each newly saved Test Result through
Web API with `$select=_gsic_interpreterlanguage_value` and compare that value to the
selected language GUID. Creating a result directly through Web API would not verify
this command or its form flow and is not a substitute for the checks above.

## Supported API references

- [Command grid context and selected references](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/pass-data-page-parameter-ribbon-actions)
- [Selection-count and custom enable rules](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/define-ribbon-enable-rules)
- [Create-mode main-form dialog and savedEntityReference](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-navigation/navigateto)
- [Simple lookup defaults](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/set-field-values-using-parameters-passed-form)
- [Grid refresh](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/grids/gridcontrol/refresh)
- [SystemForm metadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/systemform)
- [Read-only CLI FetchXML query](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/env#pac-env-fetch)
