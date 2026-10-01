# Identify the code component actually loaded

## Verified 0.1.1.0 package evidence

The exact ZIP reported as imported was inspected directly:
`PCF/BilingualLanguageTestsOpenFormSolution/bin/verification-20261001-1853/BilingualLanguageTestsOpenFormSolution.zip`.
Its SHA256 is `38A77A41F3C5D60AD1C55295D3A1B74216D7092B691CCEDB51392AFFD7F1113D`.

| Item | Verified value |
| --- | --- |
| Solution unique name | `BilingualLanguageTestsOpenFormSolution` |
| Solution version / type | `0.1.1.0` / unmanaged |
| Root component schema name | `gsic_GSIC.Prototype.BilingualLanguageTestsOpenForm` |
| Manifest namespace / constructor | `GSIC.Prototype` / `BilingualLanguageTestsOpenForm` |
| Component manifest version | `0.1.1` |
| Bundle entry | `Controls/gsic_GSIC.Prototype.BilingualLanguageTestsOpenForm/bundle.js` |
| Bundle SHA256 | `F38837D37CB7D47FDC3C4F50396434FF11CD63B41FB4D681FF7B9052BEA9CCD9` |
| Old full message and `Configure the related language view` prefix | Both absent from the bundle |
| Replacement row-validation message | Present |

The ZIP contains one code component and its resources. It includes no Interpreter form, subgrid binding, app, or view. Importing it cannot switch a subgrid that is bound to the separate `GSIC.BilingualLanguageTests` control. A different namespace/constructor or publisher prefix is a different component identity, regardless of similar display names.

The old message cannot originate from the local row-validation code in this verified bundle. An older/different loaded control is one possible explanation. The component also renders `dataset.errorMessage` received from its host, so externally supplied errors must be distinguished before assigning a cause. The actual deployed binding, active layers and downloaded assets remain unverified without live environment evidence.

## New visible marker

Version 0.1.2 displays a marker above the toolbar and outside the collapsible diagnostics, including during loading and errors:

| Implementation | Marker |
| --- | --- |
| PCF openForm | `GSIC.Prototype.BilingualLanguageTestsOpenForm | v0.1.2 | build OF-20261001-01` |
| Host-event dialog | `GSIC.BilingualLanguageTests | v0.1.2 | build EVT-20261001-01` |

The marker identifies the executing JavaScript, not the solution-list version or a detected solution layer. Build metadata also appears in the diagnostic JSON alongside `messages.validation`, `messages.navigation`, `datasetError`, and `datasetErrorMessage`, so the source of a visible error can be checked. No private host members, parent-window Xrm, or host DOM are accessed.

The openForm wrapper is now 0.1.2.0 and still contains only the openForm component. The host-event marker is built locally but is not included in this wrapper. Validation and navigation behavior are unchanged from 0.1.1. The component manifest version was bumped as required by Microsoft's [update guidance](https://learn.microsoft.com/en-us/power-apps/developer/component-framework/issues-and-workarounds#component-changes-arent-reflected-after-the-updated-solution-import).

## Read-only live investigation, in order

1. Confirm the environment, app and **actual open Interpreter form**, including its form GUID and the internal subgrid name. Role-based form selection can open a different form than the one inspected in the designer.
2. Inspect that form's subgrid **Controls/components** configuration without editing it. Record the component selected for **Web**, its namespace/constructor and publisher-prefixed schema name if available. Compare with the exact identity above. Record the bound view GUID separately; the view and the code component are independent selections. Do not change or reapply the Bilingual view filter.
3. In **Solutions**, open `BilingualLanguageTestsOpenFormSolution` and confirm import history, environment, version, and the **code component object's Name**. A solution-list version alone does not establish which control the form loads. If needed, inspect an exported destination solution's `Controls/.../ControlManifest.xml` and the Interpreter form binding to compare them with the verified package.
4. Select that exact code component, then **Advanced > See solution layers** where available. Record the top active layer, component properties/version shown, owning solution/publisher, and modification time. Repeat for the **Interpreter form**: its effective control binding can differ from a lower layer's configuration. Microsoft documents that the active layer determines effective behavior; all unmanaged customizations share one unmanaged layer, so unmanaged solution names are not independent stacked layers. See [solution layer inspection](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/solution-layers). Inspect layers without removing active customizations or deleting controls.
5. After the separately authorized marker package is installed on the test configuration, record the visible marker. If missing, keep investigating binding/layers/assets. Do not change validation. If the openForm marker is present with the old message, compare `messages.validation` with `datasetErrorMessage` to establish its source.
6. Only after identity and active definitions match, reload the test app in a fresh browser session with network caching disabled in browser developer tools. Inspect the downloaded component JavaScript for `OF-20261001-01` and the old error prefix. Record its URL and response/cache information; do not assume a resource URL contains the version. This distinguishes stale client assets from an effective server definition or a different control. No scripts need to be injected into the app.

| Observation | Next evidence to collect |
| --- | --- |
| Web control is `GSIC.BilingualLanguageTests` | Its own deployed manifest and layers; the openForm wrapper does not update it. |
| OpenForm identity, effective version older than expected | Component import history and active layer properties. |
| Component current, form binding differs | Effective Interpreter form and its layers; confirm actual form GUID. |
| Effective component/form correct, marker absent | Fresh downloaded asset and browser cache response. |
| Expected marker visible, old message matches `datasetErrorMessage` | Host dataset error origin; row validation is a separate diagnostic field. |

The local marker changes do not deploy, publish, replace the working grid, change saved filters, or remove layers. Any binding correction should be reviewed against the actual live evidence and applied only to the separate test form.
