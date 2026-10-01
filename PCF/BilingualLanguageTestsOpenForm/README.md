# Bilingual Language Tests — PCF openForm prototype

Local dataset component `GSIC.Prototype.BilingualLanguageTestsOpenForm`, separate from the concurrent host-event component in `../BilingualLanguageTests`.

Use `npm ci`, `npm run build:release`, then `npm test`. For exact solution packaging, future import, related view/input binding, Test Result script registration, schema prerequisites, and manual checks, see [the configuration guide](../../docs/BILINGUAL_LANGUAGE_TESTS_OPENFORM_PCF.md).

Creation uses PCF `context.navigation.openForm` with the selected Interpreter Language lookup. After saving in the opened main-form tab, return and use Refresh. No deployment or grid replacement is part of this prototype.
