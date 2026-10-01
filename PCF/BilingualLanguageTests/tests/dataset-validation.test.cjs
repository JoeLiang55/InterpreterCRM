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

function setup(category, owner = PARENT) {
    if (arguments.length === 0) category = 472540000;
    const dom = new JSDOM('<div id="control"></div>');
    const root = dom.window.document.getElementById('control');
    const calls = [];
    let viewId = VIEW;
    let retrieve = () => Promise.resolve({ entities: [] });
    const row = { getRecordId: () => ID,
        getValue: key => key === 'gsic_languagecategory' ? category : key === 'gsic_interpreter'
            ? { etn: 'gsic_interpreter', id: { guid: owner } } : 'French',
        getFormattedValue: key => key === 'gsic_languagecategory' ? 'Bilingual' : 'French' };
    const dataset = { loading: false, error: false, records: { [ID]: row }, sortedRecordIds: [ID],
        columns: ['gsic_languagename', 'gsic_languagecategory', 'gsic_interpreter'].map(name => ({ name, alias: name, dataType: name === 'gsic_languagecategory' ? 'OptionSet' : 'SingleLine.Text' })),
        getTargetEntityType: () => 'gsic_interpreterlanguage', getTitle: () => 'Bilingual View', getViewId: () => viewId,
        filtering: { getFilter: () => ({ filterOperator: 0, conditions: [], filters: [] }),
            setFilter() { throw new Error('Validation must not rewrite a published view'); } },
        refresh() {}, paging: { hasNextPage: false, hasPreviousPage: false } };
    const context = { parameters: { languages: dataset, interpreterId: { raw: PARENT }, testResultFormId: { raw: OTHER } },
        mode: { isControlDisabled: false }, updatedProperties: [], events: {},
        webAPI: { retrieveMultipleRecords: (...args) => { calls.push(args); return retrieve(...args); } } };
    const control = new Control();
    control.init(context, () => {}, {}, root); control.updateView(context);
    const click = label => [...root.querySelectorAll('button')].find(button => button.textContent === label).click();
    const diagnostic = () => JSON.parse(root.querySelector('details pre').textContent);
    return { control, root, context, dataset, calls, click, diagnostic,
        view: id => { viewId = id; }, retrieve: fn => { retrieve = fn; } };
}

test('visible build marker matches the manifest and survives configuration errors and loading', () => {
    const constructor = BUILD_INFO.component.split('.').at(-1);
    const xml = fs.readFileSync(path.join(__dirname, '..', constructor, 'ControlManifest.Input.xml'), 'utf8');
    const manifest = new JSDOM(xml, { contentType: 'text/xml' }).window.document.querySelector('control');
    assert.equal(manifest.getAttribute('version'), BUILD_INFO.version);
    assert.equal(manifest.getAttribute('namespace') + '.' + manifest.getAttribute('constructor'), BUILD_INFO.component);
    for (const app of [setup(), setup(null)]) {
        const check = () => {
            const marker = app.root.querySelector('.gsic-build-marker');
            assert.equal(marker.closest('details'), null);
            assert.ok(marker.textContent.includes(BUILD_INFO.component));
            assert.ok(marker.textContent.includes('v' + BUILD_INFO.version));
            assert.ok(marker.textContent.includes(BUILD_INFO.build));
            assert.equal(app.diagnostic().build, BUILD_INFO.build);
        };
        check(); app.dataset.loading = true; app.control.updateView(app.context); check();
        app.context.parameters.interpreterId.raw = 'invalid'; app.control.updateView(app.context); check();
        assert.match(app.diagnostic().messages.validation, /Save the Interpreter/);
        app.dataset.error = true; app.dataset.errorMessage = 'Host dataset failure';
        app.control.updateView(app.context); check();
        assert.equal(app.diagnostic().datasetErrorMessage, 'Host dataset failure');
        assert.equal(app.calls.length, 0);
    }
});

test('saved Bilingual view works when the runtime filter has no category predicate', () => {
    const app = setup(); assert.ok(app.root.querySelector('[aria-expanded]'));
    assert.equal(app.calls.length, 0); assert.deepEqual(app.diagnostic().runtimeFilter.conditions, []);
    assert.equal(app.diagnostic().viewId, VIEW);
});

test('the numeric Bilingual string is normalized; exact language test isolation remains', async () => {
    const app = setup('472540000'); assert.ok(app.root.querySelector('[aria-expanded]'));
    assert.equal(app.diagnostic().rows[0].rawCategoryType, 'string');
    assert.equal(app.diagnostic().rows[0].normalizedCategory, 472540000);
    app.root.querySelector('[aria-expanded]').click(); await settle();
    assert.equal(app.calls.length, 1); assert.equal(app.calls[0][0], 'gsic_testresult');
    assert.ok(app.calls[0][1].includes('_gsic_interpreterlanguage_value eq ' + ID));
    assert.ok(!app.calls[0][1].includes(PARENT));
});

test('an unreadable runtime filter is diagnostic-only, not a grid failure', () => {
    const app = setup(); app.dataset.filtering.getFilter = () => { throw new Error('Filter is unavailable'); };
    app.control.updateView(app.context); assert.ok(app.root.querySelector('[aria-expanded]'));
    assert.match(app.diagnostic().runtimeFilter, /Filter is unavailable/);
});

test('reject missing, unknown and mislabeled categories with raw value, type, language ID and view ID', () => {
    for (const raw of [null, undefined, 472540001, '472540002', 'Bilingual', true, [472540000], { value: 472540000 }]) {
        const app = setup(raw); assert.equal(app.root.querySelector('[aria-expanded]'), null);
        assert.match(app.root.textContent, /expected Bilingual/);
        assert.ok(app.root.textContent.includes(ID)); assert.ok(app.root.textContent.includes(VIEW));
        assert.ok(app.root.textContent.includes('rawCategoryType')); assert.equal(app.calls.length, 0);
    }
    assert.equal(categoryCode(' 472540000 '), 472540000);
    assert.equal(categoryCode('472540000.0'), undefined);
    assert.equal(categoryCode('0x1c2a0000'), undefined);
});

test('string categories and documented lookup objects still enforce exact Interpreter ownership', () => {
    const app = setup('472540000', OTHER); assert.equal(app.root.querySelector('[aria-expanded]'), null);
    assert.match(app.root.textContent, /different Interpreter/); assert.equal(app.calls.length, 0);
    assert.equal(app.diagnostic().rows[0].interpreterId, OTHER);
});

test('a different ID identifies the actual bound view despite the same Bilingual View display name', () => {
    const app = setup(); assert.ok(app.root.querySelector('summary').textContent.includes(VIEW));
    app.view(DUPLICATE); app.control.updateView(app.context);
    assert.ok(app.root.querySelector('summary').textContent.includes(DUPLICATE));
    assert.equal(app.diagnostic().viewTitle, 'Bilingual View'); assert.equal(app.diagnostic().viewId, DUPLICATE);
});

test('Inspect bound view retrieves its exact GUID and FetchXML on demand; never selects by name', async () => {
    const app = setup(); app.view(DUPLICATE); app.control.updateView(app.context);
    const fetch = '<fetch><entity name="gsic_interpreterlanguage"><filter><condition attribute="gsic_languagecategory" operator="eq" value="472540000"/></filter></entity></fetch>';
    app.retrieve((entity, query) => {
        assert.equal(entity, 'savedquery'); assert.ok(query.includes('savedqueryid eq ' + DUPLICATE));
        assert.ok(!query.includes("name eq"));
        return Promise.resolve({ entities: [{ savedqueryid: DUPLICATE, name: 'Bilingual View', returnedtypecode: 'gsic_interpreterlanguage', fetchxml: fetch }] });
    });
    assert.equal(app.calls.length, 0); app.click('Inspect bound view'); await settle();
    assert.equal(app.calls.length, 1); assert.equal(app.root.querySelector('details').open, true);
    const inspected = JSON.parse([...app.root.querySelectorAll('details pre')].at(-1).textContent);
    assert.equal(inspected.viewId, DUPLICATE); assert.equal(inspected.sourceTable, 'savedquery');
    assert.equal(inspected.savedViewFetchXml, fetch); assert.ok(app.root.querySelector('[aria-expanded]'));
});

test('a personal view is resolved only after an empty system-view result', async () => {
    const app = setup(); app.retrieve(entity => Promise.resolve({ entities: entity === 'savedquery' ? [] : [{
        userqueryid: VIEW, name: 'Bilingual View', returnedtypecode: 'gsic_interpreterlanguage', fetchxml: '<fetch />'
    }] }));
    app.click('Inspect bound view'); await settle(); assert.deepEqual(app.calls.map(call => call[0]), ['savedquery', 'userquery']);
    assert.match(app.root.textContent, /"sourceTable": "userquery"/);
});

test('view-definition privilege failure stays in diagnostics and does not block language expansion', async () => {
    const app = setup(); app.retrieve(() => Promise.reject({ message: 'No view privilege' }));
    app.click('Inspect bound view'); await settle(); assert.match(app.root.textContent, /No view privilege/);
    assert.ok(app.root.querySelector('[aria-expanded]')); assert.equal(app.calls.length, 1);
});

test('changing views invalidates a pending definition lookup', async () => {
    const app = setup(); let resolve;
    app.retrieve(() => new Promise(done => { resolve = done; })); app.click('Inspect bound view');
    app.view(DUPLICATE); app.control.updateView(app.context);
    resolve({ entities: [{ savedqueryid: VIEW, name: 'Old definition', fetchxml: '<fetch />' }] }); await settle();
    assert.ok(!app.root.textContent.includes('Old definition')); assert.equal(app.diagnostic().viewId, DUPLICATE);
});

test('unrelated runtime filter values are omitted from diagnostics', () => {
    const app = setup(); app.dataset.filtering.getFilter = () => ({ filterOperator: 0, conditions: [{
        attributeName: 'gsic_languagename', conditionOperator: 0, value: 'Private search text'
    }], filters: [] }); app.control.updateView(app.context);
    assert.ok(!app.root.textContent.includes('Private search text'));
    assert.ok(app.root.querySelector('[aria-expanded]'));
});
