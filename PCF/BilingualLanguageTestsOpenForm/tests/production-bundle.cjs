const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const output = process.env.PCF_TEST_BUNDLE_DIR || path.join(__dirname, '../out/controls/BilingualLanguageTestsOpenForm');
const bundle = fs.readFileSync(path.join(output, 'bundle.js'), 'utf8');
let Control;
const framework = { registerControl: (name, constructor) => {
    assert.equal(name, 'GSIC.Prototype.BilingualLanguageTestsOpenForm');
    Control = constructor;
} };
const sandbox = { window: { ComponentFramework: framework }, ComponentFramework: framework };
vm.runInNewContext(bundle, sandbox);
assert.ok(Control, 'Production bundle must register the expected control');
const ID = 'a582aa0b-d2bd-f111-aaad-000d3a5c3e0a';
const PARENT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const FORM = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const settle = () => new Promise(resolve => setImmediate(resolve));

test('production manifest and bundle identify the shared 0.1.5 control', () => {
    const xml = fs.readFileSync(path.join(output, 'ControlManifest.xml'), 'utf8');
    const manifest = new JSDOM(xml, { contentType: 'text/xml' }).window.document.querySelector('control');
    assert.equal(manifest.getAttribute('version'), require('../package.json').version);
    assert.equal(manifest.getAttribute('version'), '0.1.5');
    assert.equal(manifest.getAttribute('constructor'), 'BilingualLanguageTestsOpenForm');
    assert.ok(!bundle.includes('expected Bilingual (472540000).'), 'Old Bilingual-only error must not be shipped');
});

for (const [code, label] of [[472540000, 'Bilingual'], [472540001, 'English'], [472540002, 'First Nation']]) {
    for (const category of [code, String(code)]) {
        test('production bundle: ' + label + ' accepts ' + JSON.stringify(category) + ' and preserves create/Refresh', async () => {
            const dom = new JSDOM('<div id="pcf"></div>');
            const root = dom.window.document.getElementById('pcf');
            const values = { gsic_languagename: label, gsic_languagecategory: category,
                gsic_interpreter: [{ id: PARENT, entityType: 'gsic_interpreter' }] };
            const calls = [], opens = [];
            let refreshes = 0, testType = 'Before save';
            const dataset = { loading: false, error: false, sortedRecordIds: [ID],
                records: { [ID]: { getRecordId: () => ID, getValue: key => values[key],
                    getFormattedValue: key => key === 'gsic_languagename' ? values[key] : '' } },
                columns: Object.keys(values).map(name => ({ name, displayName: name })),
                getTargetEntityType: () => 'gsic_interpreterlanguage',
                getViewId() { throw new Error('View GUID must not be required'); },
                refresh() { refreshes++; }, paging: { hasNextPage: false, hasPreviousPage: false } };
            const context = { parameters: { languages: dataset, interpreterId: { raw: PARENT }, testResultFormId: { raw: FORM } },
                updatedProperties: [], mode: { isControlDisabled: false },
                webAPI: { retrieveMultipleRecords: (...args) => { calls.push(args); return Promise.resolve({ entities: [
                    { _gsic_interpreterlanguage_value: ID, gsic_testtype: testType }
                ] }); } },
                navigation: { openForm: (...args) => { opens.push(args); return Promise.resolve({ savedEntityReference: [] }); } } };
            const control = new Control(); control.init(context, () => {}, {}, root); control.updateView(context);
            assert.equal(root.querySelector('[role="alert"]'), null);
            assert.equal(root.querySelector('.gsic-languages caption').textContent, label + ' Interpreter Languages');
            root.querySelector('[aria-expanded]').click(); await settle();
            root.querySelector('[data-focus="new-' + ID + '"]').click(); await settle();
            assert.equal(opens.length, 1);
            assert.equal(JSON.stringify(opens[0]), JSON.stringify([
                { entityName: 'gsic_testresult', formId: FORM, useQuickCreateForm: false, openInNewWindow: true },
                { gsic_interpreterlanguage: ID, gsic_interpreterlanguagename: label }
            ]));
            assert.equal(refreshes, 0);
            root.querySelector('[data-focus="refresh"]').click(); assert.equal(refreshes, 1);
            dataset.loading = true; control.updateView(context);
            testType = 'After save'; values.gsic_languagename = 'Refreshed language';
            dataset.loading = false; context.updatedProperties = ['dataset']; control.updateView(context); await settle();
            assert.equal(calls.length, 2);
            assert.ok(calls.every(call => call[0] === 'gsic_testresult' && call[1].includes('_gsic_interpreterlanguage_value eq ' + ID)));
            assert.match(root.textContent, /After save/); assert.match(root.textContent, /Refreshed language/);
            assert.ok(!root.textContent.includes('Before save'));
            assert.equal(root.querySelector('[aria-expanded]').getAttribute('aria-expanded'), 'true');
            for (const text of ['expected Bilingual', 'Inspect bound view', 'Bound view:', 'After saving', '0.1.5']) {
                assert.ok(!root.textContent.includes(text));
            }
            control.destroy(); dom.window.close();
        });
    }
}
