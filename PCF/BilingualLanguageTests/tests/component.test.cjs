const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { BilingualLanguageTests } = require('../test-output/index.js');
const { TestHistory, LOOKUP_VALUE, testQuery, cellText, interpreterReferenceId } = require('../test-output/history.js');

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
function record(id, parent = P, category = 472540000, name = 'French') {
    const values = {
        gsic_languagename: name, gsic_languagecategory: category,
        gsic_interpreter: { id: { guid: parent }, name: 'Interpreter', etn: 'gsic_interpreter' }
    };
    return { getRecordId: () => id, getValue: key => values[key],
        getFormattedValue: key => typeof values[key] === 'string' ? values[key] : '' };
}
function setup(records = { [A]: record(A), [B]: record(B, P, 472540000, 'Spanish') }) {
    const dom = new JSDOM('<div id="host"><p id="untouched">Host content</p><div id="pcf"></div></div>');
    const calls = [];
    const opens = [];
    let refreshes = 0;
    let retrieve = () => Promise.resolve({ entities: [] });
    let open = payload => { payload.accept(); payload.complete({ saved: false }); };
    const context = {
        parameters: {
            interpreterId: { raw: P },
            testResultFormId: { raw: Q },
            languages: {
                loading: false, error: false, records, sortedRecordIds: Object.keys(records),
                columns: ['gsic_languagename', 'gsic_languagecategory', 'gsic_interpreter'].map(name => ({ name, displayName: name })),
                getTargetEntityType: () => 'gsic_interpreterlanguage',
                refresh: () => { refreshes++; },
                paging: { hasNextPage: false, hasPreviousPage: false, loadNextPage() {}, loadPreviousPage() {} }
            }
        },
        updatedProperties: [], mode: { isControlDisabled: false },
        webAPI: { retrieveMultipleRecords: (...args) => { calls.push(args); return retrieve(...args); } },
        events: { newTestResult: payload => { opens.push(payload); open(payload); } }
    };
    const component = new BilingualLanguageTests();
    const container = dom.window.document.getElementById('pcf');
    component.init(context, () => {}, {}, container);
    component.updateView(context);
    const buttons = () => [...container.querySelectorAll('button')];
    const click = text => {
        const button = buttons().find(button => button.textContent === text);
        assert.ok(button, 'Missing button: ' + text);
        button.click();
    };
    const toggle = id => container.querySelector(`[data-focus="toggle-${id}"]`).click();
    return { context, component, container, calls, opens, click, toggle, dom,
        retrieve: fn => { retrieve = fn; }, open: fn => { open = fn; }, refreshes: () => refreshes };
}

test('no eager test fetch; expansion queries only the exact language and required columns, newest first', async () => {
    const app = setup();
    assert.equal(app.calls.length, 0);
    app.toggle(A);
    await settle();
    assert.equal(app.calls.length, 1);
    const [entity, query, size] = app.calls[0];
    assert.equal(entity, 'gsic_testresult');
    assert.match(query, new RegExp(`\\$filter=_gsic_interpreterlanguage_value eq ${A}`));
    assert.ok(!query.includes(B));
    assert.match(query, /\$orderby=gsic_testdate desc$/);
    assert.match(query, /\$select=gsic_testdate,gsic_testtype,gsic_testversion,/);
    assert.equal(size, 250);
    app.toggle(A);
    app.component.updateView(app.context);
    assert.equal(app.calls.length, 1);
    app.toggle(B);
    await settle();
    assert.match(app.calls[1][1], new RegExp(B));
});

test('New button precedes ordered columns in both empty and populated histories; text, date and Boolean rendering', async () => {
    const app = setup();
    app.retrieve((_entity, query) => Promise.resolve({ entities: query.includes(A) ? [] : [{
        [LOOKUP_VALUE]: B, gsic_testdate: '2026-10-01T00:00:00Z', gsic_testtype: '<img src=x onerror=alert(1)>',
        gsic_testversion: '01', gsic_sighttranslationscore: 0, gsic_testincident: false
    }] }));
    app.toggle(A);
    app.toggle(B);
    await settle();
    const regions = [...app.container.querySelectorAll('section')];
    assert.equal(regions.length, 2);
    for (const region of regions) {
        assert.equal(region.firstElementChild.textContent, '+ New Test Result');
        assert.deepEqual([...region.querySelectorAll('th')].map(node => node.textContent), [
            'Test Date', 'Test Type', 'Test Version', 'Sight Translation Score',
            'Consecutive Interpreting Score', 'Simultaneous Interpreting Score', 'Test Incident'
        ]);
        assert.equal(region.querySelector('th').getAttribute('aria-sort'), 'descending');
    }
    assert.match(regions[0].textContent, /No test results/);
    assert.deepEqual([...regions[1].querySelectorAll('tbody td')].map(node => node.textContent), [
        '2026-10-01', '<img src=x onerror=alert(1)>', '01', '0', '—', '—', 'No'
    ]);
    assert.equal(app.container.querySelector('img'), null);
    assert.equal(cellText({ gsic_testincident: true }, 'gsic_testincident'), 'Yes');
    assert.equal(cellText({ gsic_testincident: null }, 'gsic_testincident'), '—');
});

function attachHost(app, stored = [], withExecutionContext = false) {
    const close = deferred();
    const navigation = [];
    const reads = [];
    let subscriptions = 0;
    let handler;
    const control = { addEventHandler: (event, callback) => {
        assert.equal(event, 'newTestResult'); subscriptions++; handler = callback;
    } };
    const formContext = {
        getControl: name => name === 'fixture_grid' ? control : null,
        data: { entity: { getEntityName: () => 'gsic_interpreter',
            getId: () => app.context.parameters.interpreterId.raw } }
    };
    const Xrm = {
        WebApi: { retrieveRecord: async (entity, id, query) => {
            reads.push({ entity, id, query });
            if (entity === 'gsic_interpreterlanguage') {
                const row = app.context.parameters.languages.records[id];
                return { gsic_languagename: row.getValue('gsic_languagename'),
                    _gsic_interpreter_value: interpreterReferenceId(row.getValue('gsic_interpreter')) };
            }
            const row = stored.find(row => row.id === id);
            return { _gsic_interpreterlanguage_value: row[LOOKUP_VALUE] };
        } },
        Navigation: { navigateTo: (page, options) => { navigation.push({ page, options }); return close.promise; } }
    };
    const window = { Xrm };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,
        '../../../JavascriptFormValidation/gsic_BilingualLanguageTestsHost.js'), 'utf8'),
    { window, console: { error() {} } });
    window.GSIC.BilingualLanguageTestsHost.onLoad({ getFormContext: () => formContext }, 'fixture_grid');
    window.GSIC.BilingualLanguageTestsHost.onLoad({ getFormContext: () => formContext }, 'fixture_grid');
    assert.equal(subscriptions, 1);
    app.open(payload => withExecutionContext ? handler({ getFormContext: () => formContext }, payload) : handler(payload));
    return { close, navigation, reads };
}

for (const selected of [A, B]) {
    test(`PCF button and real host bridge: create for ${selected === A ? 'empty' : 'populated'} language; refresh preserves expansion`, async () => {
        const app = setup();
        const stored = [{ id: Q, [LOOKUP_VALUE]: B, gsic_testtype: 'Earlier attempt' }];
        app.retrieve((_entity, query) => Promise.resolve({ entities: stored.filter(row =>
            query.includes(`eq ${row[LOOKUP_VALUE]}&`)) }));
        const host = attachHost(app, stored, selected === B);
        app.toggle(A); app.toggle(B);
        await settle();
        const regions = () => [...app.container.querySelectorAll('section')];
        assert.match(regions()[0].textContent, /No test results/);
        app.container.querySelector(`[data-focus="new-${selected}"]`).click();
        await settle();
        assert.equal(host.navigation.length, 1);
        const { page, options } = host.navigation[0];
        assert.equal(page.formId, Q);
        assert.equal(page.entityName, 'gsic_testresult');
        assert.equal(Object.hasOwn(page, 'entityId'), false);
        assert.equal(page.data.gsic_interpreterlanguage, selected);
        assert.equal(page.data.gsic_interpreterlanguagename, selected === A ? 'French' : 'Spanish');
        assert.equal(options.target, 2);
        assert.equal(app.refreshes(), 0);
        assert.ok(app.container.querySelector(`[data-focus="new-${selected}"]`).disabled);
        const createdId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
        stored.push({ id: createdId, [LOOKUP_VALUE]: page.data.gsic_interpreterlanguage, gsic_testtype: 'New attempt' });
        host.close.resolve({ savedEntityReference: [{ id: createdId, entityType: 'gsic_testresult' }] });
        await settle();
        assert.equal(app.refreshes(), 1);
        assert.equal(host.reads.at(-1).query, '?$select=_gsic_interpreterlanguage_value');
        app.context.parameters.languages.loading = true;
        app.component.updateView(app.context);
        app.context.parameters.languages.loading = false;
        app.context.updatedProperties = ['languages'];
        app.component.updateView(app.context);
        await settle();
        assert.equal(app.container.querySelectorAll('[aria-expanded="true"]').length, 2);
        assert.ok(regions()[selected === A ? 0 : 1].textContent.includes('New attempt'));
        assert.ok(!regions()[selected === A ? 1 : 0].textContent.includes('New attempt'));
        assert.equal(app.calls.length, 4);
    });
}

test('canceling the main-form dialog refreshes neither dataset nor histories', async () => {
    const app = setup();
    const host = attachHost(app);
    app.toggle(A);
    await settle();
    app.click('+ New Test Result');
    await settle();
    host.close.resolve(undefined);
    await settle();
    assert.equal(app.refreshes(), 0);
    assert.equal(app.calls.length, 1);
    assert.equal(app.container.querySelector('[data-focus="new-' + A + '"]').disabled, false);
});

test('explicit refresh preserves expansions across loading and completion; collapsed languages are never queried', async () => {
    const app = setup();
    app.toggle(A);
    await settle();
    app.click('Refresh');
    app.click('Refresh');
    assert.equal(app.refreshes(), 1);
    app.context.parameters.languages.loading = true;
    app.context.updatedProperties = ['languages'];
    app.component.updateView(app.context);
    assert.equal(app.calls.length, 1);
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + A);
    app.context.parameters.languages.loading = false;
    app.component.updateView(app.context);
    await settle();
    assert.equal(app.calls.length, 2);
    assert.ok(app.calls.every(call => !call[1].includes(B)));
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + A);
});

test('host refresh and language paging retain expansion by ID', async () => {
    const app = setup();
    app.toggle(A);
    await settle();
    app.context.parameters.languages.sortedRecordIds = [B];
    app.context.updatedProperties = ['languages'];
    app.component.updateView(app.context);
    assert.equal(app.calls.length, 1);
    app.context.parameters.languages.sortedRecordIds = [A, B];
    app.component.updateView(app.context);
    await settle();
    assert.equal(app.calls.length, 2);
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + A);
});

test('stale response after refresh cannot overwrite newly loaded test history', async () => {
    const app = setup();
    const old = deferred();
    app.retrieve(() => old.promise);
    app.toggle(A);
    app.click('Refresh');
    app.retrieve(() => Promise.resolve({ entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'New' }] }));
    app.context.updatedProperties = ['languages'];
    app.component.updateView(app.context);
    await settle();
    old.resolve({ entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'Old' }] });
    await settle();
    assert.match(app.container.textContent, /New/);
    assert.ok(!app.container.textContent.includes('Old'));
});

test('test continuation is lazy and preserves the encoded skip token', async () => {
    const app = setup();
    app.retrieve((_entity, query) => Promise.resolve(query.includes('$skiptoken') ? {
        entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'Second page' }]
    } : {
        entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'First page' }],
        nextLink: 'https://example.invalid/api/data/v9.2/tests?$select=gsic_testtype&$skiptoken=%253Ccookie%253E'
    }));
    app.toggle(A);
    await settle();
    assert.equal(app.calls.length, 1);
    app.click('Load more test results');
    await settle();
    assert.equal(app.calls[1][1], '?$select=gsic_testtype&$skiptoken=%253Ccookie%253E');
    assert.match(app.container.textContent, /First page/);
    assert.match(app.container.textContent, /Second page/);
});

test('a mismatched result fails closed and offers retry without losing New', async () => {
    const app = setup();
    app.retrieve(() => Promise.resolve({ entities: [{ [LOOKUP_VALUE]: B, gsic_testtype: 'Must not display' }] }));
    app.toggle(A);
    await settle();
    assert.ok(!app.container.textContent.includes('Must not display'));
    assert.match(app.container.textContent, /different Interpreter Language/);
    app.retrieve(() => Promise.resolve({ entities: [] }));
    app.click('Retry');
    await settle();
    assert.match(app.container.textContent, /No test results/);
    assert.ok(app.container.textContent.includes('+ New Test Result'));
});

test('collapse and destroy invalidate pending requests; destroy removes only owned DOM', async () => {
    const app = setup();
    const pending = deferred();
    app.retrieve(() => pending.promise);
    app.toggle(A);
    app.toggle(A);
    pending.resolve({ entities: [{ [LOOKUP_VALUE]: A, gsic_testtype: 'Late' }] });
    await settle();
    assert.equal(app.container.querySelector('section'), null);
    app.component.destroy();
    assert.equal(app.container.children.length, 0);
    assert.equal(app.dom.window.document.getElementById('untouched').textContent, 'Host content');
});

test('view configuration fails closed for wrong category, missing columns or multiple Interpreters', () => {
    const english = setup({ [A]: record(A, P, 472540001) });
    assert.match(english.container.textContent, /Language Category = Bilingual/);
    assert.equal(english.calls.length, 0);
    const mixed = setup({ [A]: record(A), [B]: record(B, Q) });
    assert.match(mixed.container.textContent, /different Interpreter/);
    const missing = setup();
    missing.context.parameters.languages.columns.pop();
    missing.component.updateView(missing.context);
    assert.match(missing.container.textContent, /must include/);
});

test('changing Interpreter scope clears cached history and expansion', async () => {
    const app = setup();
    app.toggle(A);
    await settle();
    app.context.parameters.languages.records = { [B]: record(B, Q) };
    app.context.parameters.interpreterId.raw = Q;
    app.context.parameters.languages.sortedRecordIds = [B];
    app.context.updatedProperties = ['languages'];
    app.component.updateView(app.context);
    assert.equal(app.container.querySelector('section'), null);
    assert.equal(app.calls.length, 1);
});

test('navigation errors are displayed and invalid form IDs are rejected before opening', async () => {
    const app = setup();
    app.toggle(A);
    await settle();
    app.open(payload => { payload.accept(); payload.complete({ saved: false, error: 'Access denied' }); });
    app.click('+ New Test Result');
    await settle();
    assert.match(app.container.textContent, /Access denied/);
    app.context.parameters.testResultFormId.raw = 'invalid';
    app.click('+ New Test Result');
    assert.equal(app.opens.length, 1);
    assert.match(app.container.textContent, /valid ID/);
});

test('missing host listener and unavailable custom events fail visibly without hanging', async () => {
    const app = setup();
    app.toggle(A); await settle();
    app.open(() => {});
    app.click('+ New Test Result');
    assert.match(app.container.textContent, /not connected/);
    assert.equal(app.container.querySelector('[data-focus="new-' + A + '"]').disabled, false);
    app.context.events = undefined;
    app.click('+ New Test Result');
    assert.match(app.container.textContent, /not configured/);
});

test('missing configured form ID disables creation instead of opening a default form', async () => {
    const app = setup();
    app.context.parameters.testResultFormId.raw = null;
    app.component.updateView(app.context);
    app.toggle(A); await settle();
    assert.equal(app.container.querySelector('[data-focus="new-' + A + '"]').disabled, true);
    app.click('+ New Test Result');
    assert.equal(app.opens.length, 0);
});

test('saved lookup mismatch remains visible and still refreshes saved data', async () => {
    const app = setup();
    const stored = [{ id: Q, [LOOKUP_VALUE]: B }];
    const host = attachHost(app, stored);
    app.toggle(A); await settle();
    app.click('+ New Test Result'); await settle();
    host.close.resolve({ savedEntityReference: [{ id: Q, entityType: 'gsic_testresult' }] });
    await settle();
    assert.equal(app.refreshes(), 1);
    assert.match(app.container.textContent, /saved/);
    assert.match(app.container.textContent, /different language/);
});

test('host rejects a language reparented to another Interpreter before opening', async () => {
    const app = setup();
    const host = attachHost(app);
    app.toggle(A); await settle();
    app.context.parameters.languages.records[A] = record(A, Q);
    app.click('+ New Test Result'); await settle();
    assert.equal(host.navigation.length, 0);
    assert.match(app.container.textContent, /different Interpreter/);
    assert.equal(app.refreshes(), 0);
});

test('host navigation rejection is shown inline and enables retry', async () => {
    const app = setup();
    const host = attachHost(app);
    app.toggle(A); await settle();
    app.click('+ New Test Result'); await settle();
    host.close.reject(new Error('The main form is unavailable')); await settle();
    assert.match(app.container.textContent, /main form is unavailable/);
    assert.equal(app.refreshes(), 0);
    assert.equal(app.container.querySelector('[data-focus="new-' + A + '"]').disabled, false);
});

test('destroyed PCF does not refresh when its outstanding dialog later closes', async () => {
    const app = setup();
    const stored = [{ id: Q, [LOOKUP_VALUE]: A }];
    const host = attachHost(app, stored);
    app.toggle(A); await settle();
    app.click('+ New Test Result'); await settle();
    app.component.destroy();
    host.close.resolve({ savedEntityReference: [{ id: Q, entityType: 'gsic_testresult' }] });
    await settle();
    assert.equal(app.refreshes(), 0);
    assert.equal(app.container.children.length, 0);
});

test('dataset refresh failure after saving is shown without closing the expanded region', async () => {
    const app = setup();
    const stored = [{ id: Q, [LOOKUP_VALUE]: A }];
    const host = attachHost(app, stored);
    app.toggle(A); await settle();
    app.context.parameters.languages.refresh = () => { throw new Error('Refresh failed'); };
    app.click('+ New Test Result'); await settle();
    host.close.resolve({ savedEntityReference: [{ id: Q, entityType: 'gsic_testresult' }] });
    await settle();
    assert.match(app.container.textContent, /Refresh failed/);
    assert.equal(app.container.querySelector('[aria-expanded="true"]').dataset.focus, 'toggle-' + A);
});

test('query rejects invalid language IDs and history destroy ignores pending completion', async () => {
    assert.throws(() => testQuery('id or 1 eq 1'), /valid ID/);
    const history = new TestHistory();
    const pending = deferred();
    let renders = 0;
    history.toggle(A);
    const load = history.load(A, () => pending.promise, () => { renders++; });
    history.destroy();
    pending.resolve({ entities: [] });
    await load;
    assert.equal(renders, 1);
});

test('dataset Interpreter lookup accepts documented EntityReference and LookupValue shapes', () => {
    assert.equal(interpreterReferenceId({ etn: 'gsic_interpreter', id: { guid: P } }), P);
    assert.equal(interpreterReferenceId([{ etn: 'gsic_interpreter', id: { guid: P } }]), P);
    assert.equal(interpreterReferenceId([{ entityType: 'gsic_interpreter', id: P }]), P);
    for (const value of [null, [], { etn: 'gsic_testresult', id: { guid: P } },
        [{ entityType: 'gsic_interpreter', id: P }, { entityType: 'gsic_interpreter', id: Q }]]) {
        assert.throws(() => interpreterReferenceId(value), /saved Interpreter/);
    }
});
