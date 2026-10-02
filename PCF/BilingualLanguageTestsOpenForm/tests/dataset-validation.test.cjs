const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const componentExports = require('../test-output/index.js');
const Control = componentExports.BilingualLanguageTestsOpenForm || componentExports.BilingualLanguageTests;
const { categoryCode } = require('../test-output/diagnostics.js');
const { BUILD_INFO } = require('../test-output/buildInfo.js');
const fs = require('node:fs');
const path = require('node:path');
const ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PARENT = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const VIEW = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const DUPLICATE = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup(category, owner = PARENT, id = ID) {
    if (arguments.length === 0) category = 472540000;
    const dom = new JSDOM('<div id="control"></div>');
    const root = dom.window.document.getElementById('control');
    const calls = [];
    let viewId = VIEW;
    const row = { getRecordId: () => id,
        getValue: key => key === 'gsic_languagecategory' ? category : key === 'gsic_interpreter'
            ? { etn: 'gsic_interpreter', id: { guid: owner } } : 'French',
        getFormattedValue: key => key === 'gsic_languagecategory' ? 'Bilingual' : 'French' };
    const dataset = { loading: false, error: false, records: { [id]: row }, sortedRecordIds: [id],
        columns: ['gsic_languagename', 'gsic_languagecategory', 'gsic_interpreter'].map(name => ({ name, alias: name, dataType: name === 'gsic_languagecategory' ? 'OptionSet' : 'SingleLine.Text' })),
        getTargetEntityType: () => 'gsic_interpreterlanguage', getTitle: () => 'Bilingual View', getViewId: () => viewId,
        filtering: { getFilter: () => ({ filterOperator: 0, conditions: [], filters: [] }),
            setFilter() { throw new Error('Validation must not rewrite a published view'); } },
        refresh() {}, paging: { hasNextPage: false, hasPreviousPage: false } };
    const context = { parameters: { languages: dataset, interpreterId: { raw: PARENT }, testResultFormId: { raw: OTHER } },
        mode: { isControlDisabled: false }, updatedProperties: [], events: {},
        webAPI: { retrieveMultipleRecords: (...args) => { calls.push(args); return Promise.resolve({ entities: [] }); } } };
    const control = new Control();
    control.init(context, () => {}, {}, root); control.updateView(context);
    return { control, root, context, dataset, calls, view: id => { viewId = id; } };
}

test('normal UI hides build and view diagnostics while retaining Refresh and matching version metadata', () => {
    const constructor = BUILD_INFO.component.split('.').at(-1);
    const xml = fs.readFileSync(path.join(__dirname, '..', constructor, 'ControlManifest.Input.xml'), 'utf8');
    const manifest = new JSDOM(xml, { contentType: 'text/xml' }).window.document.querySelector('control');
    assert.equal(manifest.getAttribute('version'), BUILD_INFO.version);
    assert.equal(require('../package.json').version, BUILD_INFO.version);
    assert.equal(manifest.getAttribute('namespace') + '.' + manifest.getAttribute('constructor'), BUILD_INFO.component);
    const hiddenText = [BUILD_INFO.component, BUILD_INFO.build, 'Bound view:', 'Bilingual View', VIEW,
        'After saving a Test Result, return here and select Refresh.', 'Inspect bound view'];
    for (const app of [setup(), setup(472540001), setup('472540002'), setup(null)]) {
        const check = () => {
            assert.ok([...app.root.querySelectorAll('button')].some(button => button.textContent === 'Refresh'));
            assert.equal(app.root.querySelector('.gsic-build-marker'), null);
            assert.equal(app.root.querySelector('details'), null);
            assert.equal(app.root.querySelector('[data-focus="inspect-view"]'), null);
            for (const text of hiddenText) assert.ok(!app.root.textContent.includes(text), 'Unexpected UI text: ' + text);
        };
        check(); app.dataset.loading = true; app.control.updateView(app.context); check();
        app.context.parameters.interpreterId.raw = 'invalid'; app.control.updateView(app.context); check();
        assert.match(app.root.textContent, /Save the Interpreter/);
        app.dataset.error = true; app.dataset.errorMessage = 'Host dataset failure';
        app.control.updateView(app.context); check();
        assert.equal(app.calls.length, 0);
    }
});

test('saved Bilingual view works when the runtime filter has no category predicate', () => {
    const app = setup(); assert.ok(app.root.querySelector('[aria-expanded]'));
    assert.equal(app.calls.length, 0); assert.equal(app.root.querySelector('details'), null);
});

test('the numeric Bilingual string is normalized; exact language test isolation remains', async () => {
    const app = setup('472540000'); assert.ok(app.root.querySelector('[aria-expanded]'));
    app.root.querySelector('[aria-expanded]').click(); await settle();
    assert.equal(app.calls.length, 1); assert.equal(app.calls[0][0], 'gsic_testresult');
    assert.ok(app.calls[0][1].includes('_gsic_interpreterlanguage_value eq ' + ID));
    assert.ok(!app.calls[0][1].includes(PARENT));
});

test('an unreadable runtime filter is diagnostic-only, not a grid failure', () => {
    const app = setup(); app.dataset.filtering.getFilter = () => { throw new Error('Filter is unavailable'); };
    app.control.updateView(app.context); assert.ok(app.root.querySelector('[aria-expanded]'));
    assert.ok(!app.root.textContent.includes('Filter is unavailable'));
    assert.equal(app.root.querySelector('details'), null);
});

test('reject missing, unknown and mislabeled categories without exposing bound view identity', () => {
    for (const raw of [null, undefined, 472540003, '472540004', 'Bilingual', true, [472540000], { value: 472540000 }]) {
        const app = setup(raw); assert.equal(app.root.querySelector('[aria-expanded]'), null);
        assert.match(app.root.textContent, /expected a supported Language Category/);
        assert.ok(app.root.textContent.includes(ID)); assert.ok(app.root.textContent.includes('gsic_languagecategory='));
        assert.ok(!app.root.textContent.includes(VIEW)); assert.ok(!app.root.textContent.includes('Bilingual View'));
        assert.equal(app.calls.length, 0);
    }
    assert.equal(categoryCode(' 472540000 '), 472540000);
    assert.equal(categoryCode('472540000.0'), undefined);
    assert.equal(categoryCode('0x1c2a0000'), undefined);
});

for (const [code, label] of [[472540000, 'Bilingual'], [472540001, 'English'], [472540002, 'First Nation']]) {
    for (const raw of [code, String(code)]) {
        test(label + ' runtime category ' + JSON.stringify(raw) + ' accepts the reported language record', async () => {
            const id = 'a582aa0b-d2bd-f111-aaad-000d3a5c3e0a';
            const app = setup(raw, PARENT, id);
            assert.equal(app.root.querySelector('[role="alert"]'), null);
            assert.equal(app.root.querySelector('.gsic-languages caption').textContent, label + ' Interpreter Languages');
            assert.ok(!app.root.textContent.includes('expected Bilingual (472540000).'));
            app.root.querySelector('[aria-expanded]').click(); await settle();
            assert.equal(app.calls.length, 1);
            assert.ok(app.calls[0][1].includes('_gsic_interpreterlanguage_value eq ' + id));
            // Every required column and the Interpreter relationship remain mandatory.
            for (const missing of ['gsic_languagename', 'gsic_languagecategory', 'gsic_interpreter']) {
                const invalid = setup(raw, PARENT, id);
                invalid.dataset.columns = invalid.dataset.columns.filter(column => column.name !== missing);
                invalid.control.updateView(invalid.context);
                assert.match(invalid.root.textContent, /must include/);
                assert.equal(invalid.root.querySelector('[aria-expanded]'), null);
                invalid.control.destroy();
            }
            const wrongOwner = setup(raw, OTHER, id);
            assert.match(wrongOwner.root.textContent, /different Interpreter/);
            assert.equal(wrongOwner.root.querySelector('[aria-expanded]'), null);
            const wrongTable = setup(raw, PARENT, id);
            wrongTable.dataset.getTargetEntityType = () => 'gsic_testresult';
            wrongTable.control.updateView(wrongTable.context);
            assert.match(wrongTable.root.textContent, /Interpreter Language related-record subgrid/);
            wrongTable.control.destroy(); wrongOwner.control.destroy(); app.control.destroy();
        });
    }
}

test('string categories and documented lookup objects still enforce exact Interpreter ownership', () => {
    const app = setup('472540000', OTHER); assert.equal(app.root.querySelector('[aria-expanded]'), null);
    assert.match(app.root.textContent, /different Interpreter/); assert.equal(app.calls.length, 0);
});

test('bound view identity remains absent from normal UI when host view changes', () => {
    const app = setup(); app.view(DUPLICATE); app.control.updateView(app.context);
    assert.ok(app.root.querySelector('[aria-expanded]'));
    assert.ok(!app.root.textContent.includes(VIEW)); assert.ok(!app.root.textContent.includes(DUPLICATE));
    assert.ok(!app.root.textContent.includes('Bilingual View'));
});

test('unrelated runtime filter values are not exposed in normal UI', () => {
    const app = setup(); app.dataset.filtering.getFilter = () => ({ filterOperator: 0, conditions: [{
        attributeName: 'gsic_languagename', conditionOperator: 0, value: 'Private search text'
    }], filters: [] }); app.control.updateView(app.context);
    assert.ok(!app.root.textContent.includes('Private search text'));
    assert.ok(app.root.querySelector('[aria-expanded]')); assert.equal(app.root.querySelector('details'), null);
});
