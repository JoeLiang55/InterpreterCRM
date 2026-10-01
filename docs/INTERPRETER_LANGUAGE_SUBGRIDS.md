# Interpreter language subgrid visibility

## Findings and scope

The existing Interpreter main-form handler is `GSIC.InterpreterForm.onLoad` in `JavascriptFormValidation/gsic_InterpreterForm.js`. It registers qualification-field OnChange handlers and updates dependent controls. Those behaviors remain in place.

`DATAVERSE_SCHEMA.md`, `InterpreterCRM.Plugins/DataverseSchema.cs`, and `gsic_InterpreterLanguageForm.js` confirm Language Category values: Bilingual `472540000`, English `472540001`, First Nation `472540002`. No main-form XML/JSON export, grid view definitions, or Add Language command/completion implementation is present in this repository. The correspondence between those categories and `Subgrid_new_1`, `Subgrid_new_2`, `Subgrid_new_3` is unconfirmed. Each grid therefore uses its own view's loaded total count; no category-to-grid mapping is invented. Confirm each grid's related-record relationship and category view filter in the designer.

The section strings `Bilingual Best Scores` and `English / First Nation Best Scores` belong to the Interpreter Language child form, not the Interpreter main form. No main-form category section names or contents are confirmed. This change hides only the three subgrid controls. It does not hide sections or tabs, so unrelated controls remain accessible. Keep Add Language on the main form command bar or a separate visible control outside these grids; a grid's own New button becomes inaccessible when that grid is hidden.

## Form designer registration

1. Update/publish the existing `gsic_InterpreterForm.js` JavaScript web resource from `JavascriptFormValidation/gsic_InterpreterForm.js`.
2. Include that resource in the Interpreter main form's libraries. Register `GSIC.InterpreterForm.onLoad` on Form On Load **once**, with **Pass execution context as first parameter** checked. If already registered, retain that registration and any other existing handlers.
3. Keep the three named subgrids visible by default and their containing sections/tabs available. The script registers grid OnLoad handlers itself; no extra grid event registration is needed. Publish the form.
4. Verify Add Language is accessible even with all three grids hidden. If it currently exists only in a grid toolbar, expose the existing action on the main form command bar or a separate visible control.

The implementation waits for subgrid OnLoad before reading `getGrid().getTotalRecordCount()`. Numeric zero hides a grid; a positive count shows it. Missing grids/counts, negative loading sentinels, nonnumeric values and read errors do not classify a grid as empty. On form load, it registers handlers before requesting a grid refresh, so even grids that loaded earlier get checked after a completed load. It reveals the grids before that refresh so hidden controls can load, then applies visibility after loading. A WeakMap prevents duplicate grid subscriptions across repeated form loads.

## Add Language limitation

The Add Language implementation is absent from the repository. No completion integration, public refresh hook, or new Add Language command is introduced. After adding and saving a language, fully reload the Interpreter form to reveal the populated grid. Automatic visibility updates occur when a grid fires OnLoad, but the unavailable Add Language flow cannot be assumed to refresh hidden grids. A parent data refresh alone is not guaranteed to reload hidden grids.

Deletion through a subgrid is handled on its next OnLoad. If another delete action does not refresh the grid, fully reload the Interpreter form to update visibility.

## Manual checks

Use a saved Interpreter and test each grid by its actual category view, once the designer mapping is confirmed.

1. **Empty categories:** With no related languages, open the main form. After loading, all three grids hide. Sections and unrelated fields remain visible; Add Language remains accessible. Also expand any initially collapsed tab containing a grid and verify its visibility after loading.
2. **Populated categories:** Create records in one category, then in all categories. Reopen the form. Each populated grid appears and each empty grid hides. Confirm records for another Interpreter do not affect these counts. Preserve qualification-field enable/disable behavior.
3. **Add first language:** Start with all grids empty/hidden. Use the existing Add Language action, save and close, then fully reload the Interpreter form. The relevant grid appears with the new record visible; the other empty grids hide after loading. Repeat for each category. Canceling creation leaves empty grids hidden after reloading.
4. **Delete last language:** Delete the sole record in each populated grid. After the grid refresh finishes, that grid hides and Add Language remains accessible. When deleting one of several records, the grid stays visible. If a custom deletion action does not refresh the grid, fully reload the form.
5. **Loading/failure and repeat loads:** Under slow network conditions, verify grids are not hidden based on an unavailable count. Repeated form OnLoad calls must not accumulate grid event callbacks. Grids can briefly appear while loading; their final visibility reflects loaded data.

## Local verification and Client API references

Run `node --check JavascriptFormValidation/gsic_InterpreterForm.js` and `node --test JavascriptFormValidation/gsic_InterpreterForm.test.js`. Mock tests cover delayed loading, independent grid counts, unavailable counts, repeated registrations, qualification behavior, reloading after adding the first language, deletion and missing/failing controls. These tests do not replace the manual Dataverse checks above.

Supported APIs: [subgrid addOnLoad](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/grids/gridcontrol/addonload), [getTotalRecordCount](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/grids/grid/gettotalrecordcount), [GridControl visibility and refresh](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/grids/gridcontrol).
