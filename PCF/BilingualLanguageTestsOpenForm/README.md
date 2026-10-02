# Interpreter Language Tests — shared PCF openForm control

Local dataset component `GSIC.Prototype.BilingualLanguageTestsOpenForm`, separate from the concurrent host-event component in `../BilingualLanguageTests`.

Version 0.1.5 reuses the proven 0.1.3 control for Bilingual, English and First Nation subgrids. The component identity and inputs are preserved. See [reuse findings and grid configuration](../../docs/INTERPRETER_LANGUAGE_TESTS_SHARED_PCF.md). Run `npm run test:bundle` after the production build to test the actual shipped JavaScript against all three numeric/string categories.

Use `npm ci`, `npm run build:release`, then `npm test`. For exact solution packaging, future import, related view/input binding, Test Result script registration, schema prerequisites, and manual checks, see [the configuration guide](../../docs/BILINGUAL_LANGUAGE_TESTS_OPENFORM_PCF.md).

Creation uses PCF `context.navigation.openForm` with the selected Interpreter Language lookup. After saving in the opened main-form tab, return and use Refresh. No deployment or grid replacement is part of this prototype.
