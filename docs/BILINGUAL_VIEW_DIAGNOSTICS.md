# Bilingual dataset validation and bound-view diagnostics

## What raised the repeated error

Both component implementations previously raised this message in `readLanguages`:

```typescript
if (record.getValue("gsic_languagecategory") !== 472540000) {
    throw new Error("Configure the related language view with Language Category = Bilingual (472540000).");
}
```

This compares each loaded language row's raw category with a JavaScript number. Neither implementation inspected `dataset.filtering.getFilter()` or the saved view's FetchXML to make this decision. The error therefore did not establish that a published view lacked its Bilingual filter. A raw string `"472540000"` would fail this strict comparison despite representing the same category. Missing values or an actual different category would also fail. The deployed raw value and actual bound view could not be observed from this unauthenticated local workspace, so the live cause is not yet proven.

Version 0.1.1 accepts integer numbers and integer strings representing the confirmed category. It rejects missing values, other categories, display labels, Boolean values, arrays and guessed object wrappers. A rejection now reports the language GUID, raw category, JavaScript type, and actual bound view title/GUID. It identifies the failure as row validation instead of asking for the view filter to be configured again.

There is no requirement for a saved view predicate to appear in the runtime filter. The runtime filter is diagnostic only; an empty or unreadable runtime filter does not invalidate otherwise valid rows. The component never calls `setFilter` or modifies a saved view.

## Identify which of the two Bilingual View records is bound

The component shows **Bound view: Bilingual View [actual GUID]** using the supported dataset [`getViewId()`](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/dataset/getviewid) and [`getTitle()`](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/dataset/gettitle) methods. The title alone cannot distinguish duplicate names. The GUID is read from the current runtime dataset rather than inferred from a designer default or a name search.

1. On the separately configured test form running version 0.1.1, expand the **Bound view** diagnostic panel. It opens automatically for configuration/dataset errors.
2. Record `component`, `version`, `viewId`, `viewTitle`, `table`, `interpreterIdInput`, and `columns`. For the offending row, inspect `languageId`, `rawCategory`, `rawCategoryType`, `normalizedCategory`, `formattedCategory`, and `interpreterId`. At most 20 loaded rows are included; any category rejection names the offending row even if it is outside this sample.
3. Select **Inspect bound view**. This makes an optional, read-only PCF Web API request for that exact GUID in `savedquery`. If no system view is returned, it checks `userquery` for the same GUID. It displays `sourceTable`, `viewId`, `name`, `table`, and `savedViewFetchXml`. It never selects the first record named Bilingual View.
4. Compare this GUID with the two view records and inspect this definition's category condition and selected attributes. Reuse the already published Bilingual filter; this investigation does not require applying it again. A personal/system view distinction or another bound GUID is now visible independently of their shared label.

View inspection requires read access to the relevant view record. A privilege error is shown in the panel and does not block valid language rows. The runtime GUID remains available if FetchXML cannot be read. Changing the bound view invalidates any pending definition response. No view query runs automatically, and inspecting a view does not fetch Test Results. Diagnostic text stays inside the component; it is not sent to telemetry or logged. Unrelated runtime filter values are omitted, although explicitly inspected saved FetchXML is displayed in full and may contain filter values.

## Isolation retained

- Languages still come exclusively from the bound Interpreter Language dataset. Required column and table validation remains in place.
- Every loaded row must be Bilingual and its Interpreter lookup must resolve to the exact GUID supplied by the bound parent-ID input. The openForm component now also accepts the documented PCF `EntityReference` lookup shape, with `etn` and `id.guid`, while retaining table and GUID checks.
- Each history query is deferred until expansion and filters `_gsic_interpreterlanguage_value` to that exact language GUID. Returned test records are also checked against it. View diagnostics cannot relax these checks.
- Navigation remains separate: `PCF/BilingualLanguageTests` uses the host custom-event/dialog bridge; `PCF/BilingualLanguageTestsOpenForm` uses `context.navigation.openForm` and explicit Refresh. Expansion behavior and their distinct identities remain intact.

## Local verification and remaining live evidence

Both production builds passed manifest validation, PCF lint, bundling and TypeScript checking. The openForm suite passed 25 tests; the custom-event implementation passed 34 tests, including its host-script checks. New cases exercise empty/unreadable runtime filters, integer strings, invalid categories, mismatched Interpreter ownership, duplicate view names with different GUIDs, exact-GUID system/personal view reads, view privilege errors, pending request invalidation and diagnostic redaction. Existing tests cover lazy language-isolated histories and expansion through refresh.

The separate openForm unmanaged wrapper is version 0.1.1.0. No deployment, import, publish, production-grid replacement or Dataverse metadata change has been performed. The actual live bound GUID, raw category causing the reported error, parent input value, and view definition remain to be observed in the target runtime; no authenticated environment or form/view export was available locally.

API references: [dataset runtime filter](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/filtering/getfilter), [row getValue](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/entityrecord/getvalue), [PCF EntityReference](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/reference/entityreference), [system view record](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/savedquery?view=dataverse-latest), [personal view record](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/userquery?view=dataverse-latest).

## Follow-up: the old message after import

The user reported importing the verified 0.1.1.0 wrapper and still seeing the old message. Direct inspection confirms that text is absent from its bundle. Version 0.1.2 adds an always-visible identity/version/build marker and error-source diagnostics; it makes no further validation changes. See [package evidence and component/layer investigation](BILINGUAL_PCF_LOADED_COMPONENT.md). The current wrapper is 0.1.2.0; local suites pass 26 openForm and 35 host-event tests.
