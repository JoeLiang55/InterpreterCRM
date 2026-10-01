const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { BilingualLanguageTestsOpenForm } = require('../test-output/index.js');
const { LOOKUP_VALUE, testQuery, cellText } = require('../test-output/history.js');
const A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const P = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const Q = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
}
function record(id, parent = P, category = 472540000) {
    const values = { gsic_languagename: id === A ? 'French' : 'Spanish', gsic_languagecategory: category,
        gsic_interpreter: [{ id: parent, entityType: 'gsic_interpreter' }] };
    return { getRecordId: () => id, getValue: key => values[key],
        getFormattedValue: key => typeof values[key] === 'string' ? values[key] : '' };
}
function setup(records = { [A]: record(A), [B]: record(B) }) {
    const dom = new JSDOM('<p id="host">Host content</p><div id="pcf"></div>');
    const container = dom.window.document.getElementById('pcf');
    const calls = [], opens = [];
    let refreshes = 0;
    let retrieve = () => Promise.resolve({ entities: [] });
    let open = () => Promise.resolve({ savedEntityReference: [] });
    const context = { parameters: {
        interpreterId: { raw: P }, testResultFormId: { raw: Q },
        languages: { loading: false, error: false, records, sortedRecordIds: Object.keys(records),
            columns: ['gsic_languagename', 'gsic_languagecategory', 'gsic_interpreter'].map(name => ({ name, displayName: name })),
            getTargetEntityType: () => 'gsic_interpreterlanguage', refresh: () => { refreshes++; },
            paging: { hasNextPage: false, hasPreviousPage: false, loadNextPage() {}, loadPreviousPage() {} } }
    }, updatedProperties: [], mode: { isControlDisabled: false },
    webAPI: { retrieveMultipleRecords: (...args) => { calls.push(args); return retrieve(...args); } },
    navigation: { openForm: (...args) => { opens.push(args); return open(...args); } } };
    const component = new BilingualLanguageTestsOpenForm();
    component.init(context, () => {}, {}, container);
    component.updateView(context);
    const click = text => {
        const button = [...container.querySelectorAll('button')].find(node => node.textContent === text);
        assert.ok(button, 'Missing button: ' + text); button.click();
    };
    const toggle = id => container.querySelector(`[data-focus="toggle-${id}"]`).click();
    return { context, component, container, dom, calls, opens, click, toggle,
        retrieve: fn => { retrieve = fn; }, open: fn => { open = fn; }, refreshes: () => refreshes };
}

test('test queries are lazy, select confirmed logical columns and filter only the expanded language', async () => {
    const app = setup(); assert.equal(app.calls.length, 0);
    app.toggle(A); await settle();
    assert.equal(app.calls.length, 1);
    assert.equal(app.calls[0][0], 'gsic_testresult');
    assert.match(app.calls[0][1], new RegExp(`\\$filter=${LOOKUP_VALUE} eq ${A}`));
    assert.match(app.calls[0][1], /\$orderby=gsic_testdate desc$/);
    assert.equal(app.calls[0][2], 250);
    assert.ok(!app.calls[0][1].includes(B));
    app.toggle(A); app.component.updateView(app.context); assert.equal(app.calls.length, 1);
    app.toggle(B); await settle(); assert.ok(app.calls[1][1].includes(B));
    assert.throws(() => testQuery('id or 1 eq 1'), /valid ID/);
});

test('New precedes the seven ordered columns for empty and populated lists; values are safely rendered', async () => {
    const app = setup();
    app.retrieve((_entity, query) => Promise.resolve({ entities: query.includes(A) ? [] : [{
        [LOOKUP_VALUE]: B, gsic_testdate: '2026-10-01T00:00:00Z', gsic_testtype: '<img src=x>',
        gsic_testversion: '01', gsic_sighttranslationscore: 0, gsic_testincident: false
    }] }));
    app.toggle(A); app.toggle(B); await settle();
    const regions = [...app.container.querySelectorAll('section')];
    for (const region of regions) {
        assert.equal(region.firstElementChild.textContent, '+ New Test Result');
        assert.deepEqual([...region.querySelectorAll('th')].map(node => node.textContent), ['Test Date', 'Test Type', 'Test Version',
            'Sight Translation Score', 'Consecutive Interpreting Score', 'Simultaneous Interpreting Score', 'Test Incident']);
        assert.equal(region.querySelector('th').getAttribute('aria-sort'), 'descending');
    }
    assert.match(regions[0].textContent, /No test results/);
    assert.deepEqual([...regions[1].querySelectorAll('tbody td')].map(node => node.textContent), ['2026-10-01', '<img src=x>', '01', '0', '—', '—', 'No']);
    assert.equal(app.container.querySelector('img'), null);
    assert.equal(cellText({ gsic_testincident: true }, 'gsic_testincident'), 'Yes');
    assert.equal(cellText({ gsic_testincident: null }, 'gsic_testincident'), '—');
});

test('PCF openForm gets the configured main form and exact lookup; even a saved response does not refresh', async () => {
    const app = setup(); const completion = deferred(); app.open(() => completion.promise);
    app.toggle(B); await settle(); app.click('+ New Test Result');
    assert.deepEqual(app.opens[0], [{ entityName: 'gsic_testresult', formId: Q, useQuickCreateForm: false, openInNewWindow: true },
        { gsic_interpreterlanguage: B, gsic_interpreterlanguagename: 'Spanish' }]);
    completion.resolve({ savedEntityReference: [{ entityType: 'gsic_testresult', id: A }] }); await settle();
    assert.equal(app.refreshes(), 0); assert.equal(app.calls.length, 1);
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + B);
});

test('explicit Refresh retains expansion through loading, avoids parallel refresh, and queries no collapsed row', async () => {
    const app = setup(); app.toggle(A); await settle(); app.click('Refresh'); app.click('Refresh');
    assert.equal(app.refreshes(), 1);
    app.context.parameters.languages.loading = true; app.context.updatedProperties = ['languages'];
    app.component.updateView(app.context); assert.equal(app.calls.length, 1);
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + A);
    app.context.parameters.languages.loading = false; app.component.updateView(app.context); await settle();
    assert.equal(app.calls.length, 2); assert.ok(app.calls.every(call => !call[1].includes(B)));
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + A);
});

test('host dataset refresh and paging preserve expansion by language ID', async () => {
    const app = setup(); app.toggle(A); await settle();
    app.context.parameters.languages.sortedRecordIds = [B]; app.context.updatedProperties = ['languages'];
    app.component.updateView(app.context); assert.equal(app.calls.length, 1);
    app.context.parameters.languages.sortedRecordIds = [A, B]; app.component.updateView(app.context); await settle();
    assert.equal(app.calls.length, 2);
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + A);
});

test('documented dataset update token reloads open histories; a layout update does not complete pending Refresh', async () => {
    const app = setup(); app.toggle(A); await settle();
    app.context.updatedProperties = ['dataset']; app.component.updateView(app.context); await settle();
    assert.equal(app.calls.length, 2);
    app.click('Refresh'); app.context.updatedProperties = ['layout']; app.component.updateView(app.context); await settle();
    assert.equal(app.calls.length, 2);
    assert.equal([...app.container.querySelectorAll('button')].find(button => button.textContent === 'Refresh').disabled, true);
    app.context.updatedProperties = ['dataset']; app.component.updateView(app.context); await settle();
    assert.equal(app.calls.length, 3);
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + A);
});

test('a response issued before refresh cannot overwrite new history', async () => {
    const app = setup(); const old = deferred(); app.retrieve(() => old.promise); app.toggle(A); app.click('Refresh');
    app.retrieve(() => Promise.resolve({ entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'Fresh' }] }));
    app.context.updatedProperties = ['languages']; app.component.updateView(app.context); await settle();
    old.resolve({ entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'Stale' }] }); await settle();
    assert.match(app.container.textContent, /Fresh/); assert.ok(!app.container.textContent.includes('Stale'));
});

test('additional test pages load only on request and preserve the encoded continuation', async () => {
    const app = setup(); app.retrieve((_entity, query) => Promise.resolve(query.includes('$skiptoken')
        ? { entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'Second page' }] }
        : { entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'First page' }], nextLink: 'https://example.invalid/tests?$select=gsic_testtype&$skiptoken=%253Ccookie%253E' }));
    app.toggle(A); await settle(); assert.equal(app.calls.length, 1);
    app.click('Load more test results'); await settle();
    assert.equal(app.calls[1][1], '?$select=gsic_testtype&$skiptoken=%253Ccookie%253E');
    assert.match(app.container.textContent, /First page/); assert.match(app.container.textContent, /Second page/);
});

test('wrong-language test responses fail closed, retain New and offer Retry', async () => {
    const app = setup(); app.retrieve(() => Promise.resolve({ entities: [{ [LOOKUP_VALUE]: B, gsic_testtype: 'Must not display' }] }));
    app.toggle(A); await settle(); assert.match(app.container.textContent, /different Interpreter Language/);
    assert.ok(!app.container.textContent.includes('Must not display'));
    app.retrieve(() => Promise.resolve({ entities: [] })); app.click('Retry'); await settle();
    assert.match(app.container.textContent, /No test results/); assert.match(app.container.textContent, /\+ New Test Result/);
});

test('collapse and destroy ignore pending completions and preserve host DOM', async () => {
    const app = setup(); const pending = deferred(); app.retrieve(() => pending.promise);
    app.toggle(A); app.toggle(A); pending.resolve({ entities: [{ [LOOKUP_VALUE]: A }] }); await settle();
    assert.equal(app.container.querySelector('section'), null);
    const another = deferred(); app.retrieve(() => another.promise); app.toggle(A); app.component.destroy();
    another.resolve({ entities: [] }); await settle(); assert.equal(app.container.children.length, 0);
    assert.equal(app.dom.window.document.getElementById('host').textContent, 'Host content');
});

test('wrong parent/category, missing view columns and unsaved parent never display language data', () => {
    const other = setup({ [A]: record(A, Q) }); assert.match(other.container.textContent, /different Interpreter/);
    const english = setup({ [A]: record(A, P, 472540001) }); assert.match(english.container.textContent, /expected Bilingual/);
    const missing = setup(); missing.context.parameters.languages.columns.pop(); missing.component.updateView(missing.context);
    assert.match(missing.container.textContent, /must include/);
    const unsaved = setup(); unsaved.context.parameters.interpreterId.raw = null; unsaved.component.updateView(unsaved.context);
    assert.match(unsaved.container.textContent, /Save the Interpreter/); assert.equal(unsaved.calls.length, 0);
});

test('switching Interpreter clears expanded histories, including through an empty dataset', async () => {
    const app = setup(); app.toggle(A); await settle(); app.context.parameters.interpreterId.raw = Q;
    app.context.parameters.languages.sortedRecordIds = []; app.component.updateView(app.context);
    app.context.parameters.languages.records = { [B]: record(B, Q) }; app.context.parameters.languages.sortedRecordIds = [B];
    app.component.updateView(app.context); assert.equal(app.container.querySelector('section'), null); assert.equal(app.calls.length, 1);
});

test('navigation errors display; missing or invalid main form IDs disable creation', async () => {
    const app = setup(); app.toggle(A); await settle(); app.open(() => Promise.reject({ message: 'Access denied' }));
    app.click('+ New Test Result'); await settle(); assert.match(app.container.textContent, /Access denied/);
    app.context.parameters.testResultFormId.raw = 'invalid'; app.component.updateView(app.context);
    assert.equal(app.container.querySelector(`[data-focus="new-${A}"]`).disabled, true);
    app.click('+ New Test Result'); assert.equal(app.opens.length, 1);
    assert.match(app.container.textContent, /creation is not configured/);
});

test('malformed continuations and network errors show recoverable errors', async () => {
    const app = setup(); app.retrieve(() => Promise.resolve({ entities: [], nextLink: 'invalid' }));
    app.toggle(A); await settle(); app.click('Load more test results'); await settle();
    assert.match(app.container.textContent, /invalid continuation/);
    app.retrieve(() => Promise.reject({ message: 'Network error' })); app.click('Retry'); await settle();
    assert.match(app.container.textContent, /Network error/);
});
