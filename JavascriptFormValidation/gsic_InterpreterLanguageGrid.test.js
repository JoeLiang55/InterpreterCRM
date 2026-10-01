"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const commandSource = fs.readFileSync(path.join(__dirname, "gsic_InterpreterLanguageGrid.js"), "utf8");
const formSource = fs.readFileSync(path.join(__dirname, "gsic_TestResultForm.js"), "utf8");
// Fixture GUIDs only; FORM_ID is not a discovered or deployable form ID.
const FORM_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const LANGUAGE_A = "11111111-1111-1111-1111-111111111111";
const LANGUAGE_B = "22222222-2222-2222-2222-222222222222";
const NEW_RESULT = "33333333-3333-3333-3333-333333333333";

function reference(id = LANGUAGE_A, name = "French", type = "gsic_interpreterlanguage") {
    return { Id: "{" + id + "}", TypeName: type, Name: name };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function harness(options = {}) {
    const completion = deferred();
    const navigation = [];
    const retrievals = [];
    const alerts = [];
    const errors = [];
    const logs = [];
    let refreshes = 0;
    let ribbonRefreshes = 0;
    const grid = {
        getEntityName: () => options.gridEntity || "gsic_interpreterlanguage",
        refresh: () => {
            refreshes++;
            if (options.refreshError) { throw options.refreshError; }
        },
        refreshRibbon: () => { ribbonRefreshes++; }
    };
    const Xrm = {
        Navigation: {
            navigateTo: (page, dialog) => {
                navigation.push({ page, dialog });
                if (options.navigationError) { return Promise.reject(options.navigationError); }
                return completion.promise;
            },
            openAlertDialog: async (value) => { alerts.push(value); },
            openErrorDialog: async (value) => { errors.push(value); }
        },
        WebApi: {
            retrieveRecord: async (table, id, query) => {
                retrievals.push({ table, id, query });
                if (options.retrievalError) { throw options.retrievalError; }
                return { gsic_languagename: "French", gsic_languagecategory: options.category || 472540000 };
            }
        }
    };
    const window = { Xrm };
    const sandbox = vm.createContext({ window, Xrm, console: {
        error: (...args) => { logs.push(args); }, warn: (...args) => { logs.push(args); }
    } });
    vm.runInContext(commandSource, sandbox);
    vm.runInContext(formSource, sandbox);
    return {
        command: window.GSIC.InterpreterLanguageGrid,
        form: window.GSIC.TestResultForm,
        grid, completion, navigation, retrievals, alerts, errors, logs,
        get refreshes() { return refreshes; },
        get ribbonRefreshes() { return ribbonRefreshes; }
    };
}

function savedResult() {
    return { savedEntityReference: [{ id: NEW_RESULT, entityType: "gsic_testresult", name: "New attempt" }] };
}

for (const scenario of [
    { label: "language with zero tests", id: LANGUAGE_A, name: "French", existing: 0,
        category: 472540000, bilingual: true },
    { label: "language with existing tests", id: LANGUAGE_B, name: "English", existing: 2,
        category: 472540001, bilingual: false },
    { label: "First Nation language", id: LANGUAGE_A, name: "Cree", existing: 1,
        category: 472540002, bilingual: false }
]) {
    test("simulated form save: " + scenario.label + " belongs only to the selected language", async () => {
        const h = harness({ category: scenario.category });
        const otherLanguage = scenario.id === LANGUAGE_A ? LANGUAGE_B : LANGUAGE_A;
        const records = Array.from({ length: scenario.existing }, () => ({ languageId: scenario.id }));
        records.push({ languageId: otherLanguage });
        const beforeOther = records.filter(row => row.languageId === otherLanguage).length;
        const refs = [reference(scenario.id, scenario.name)];
        const operation = h.command.addTestResult(h.grid, refs, "{" + FORM_ID + "}");
        const { page, dialog } = h.navigation[0];
        assert.equal(page.entityName, "gsic_testresult");
        assert.equal(page.pageType, "entityrecord");
        assert.equal(page.formId, FORM_ID);
        assert.equal(Object.hasOwn(page, "entityId"), false);
        assert.equal(dialog.target, 2);
        assert.deepEqual(Object.keys(page.data).sort(), ["gsic_interpreterlanguage", "gsic_interpreterlanguagename"]);
        assert.equal(page.data.gsic_interpreterlanguage, scenario.id);
        assert.equal(page.data.gsic_interpreterlanguagename, scenario.name);
        assert.equal(h.refreshes, 0);

        // Load the actual existing form handler with the command's lookup defaults.
        // Persistence below is simulated; this does not exercise a Dataverse save.
        const visibility = {};
        const handlers = new Set();
        const lookup = {
            getValue: () => [{ id: page.data.gsic_interpreterlanguage,
                name: page.data.gsic_interpreterlanguagename, entityType: "gsic_interpreterlanguage" }],
            addOnChange: handler => handlers.add(handler),
            removeOnChange: handler => handlers.delete(handler)
        };
        const formContext = {
            getAttribute: name => name === "gsic_interpreterlanguage" ? lookup : null,
            ui: { tabs: { forEach: action => action({ sections: { get: name => ({
                setVisible: visible => { visibility[name] = visible; }
            }) } }) } }
        };
        h.form.onLoad({ getFormContext: () => formContext });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(handlers.size, 1);
        assert.equal(visibility["Bilingual Scores"], scenario.bilingual);
        assert.equal(visibility["English / First Nations"], !scenario.bilingual);
        assert.equal(h.retrievals[0].id, scenario.id);
        assert.equal(h.retrievals[0].query, "?$select=gsic_languagecategory");

        // Changing the originating selection while the dialog is open must not change defaults.
        refs[0] = reference(otherLanguage, "Other language");
        records.push({ id: NEW_RESULT, languageId: lookup.getValue()[0].id });
        h.completion.resolve(savedResult());
        await operation;
        assert.equal(records.filter(row => row.languageId === scenario.id).length, scenario.existing + 1);
        assert.equal(records.filter(row => row.languageId === otherLanguage).length, beforeOther);
        assert.equal(records.find(row => row.id === NEW_RESULT).languageId, scenario.id);
        assert.equal(h.refreshes, 1);
        assert.equal(h.errors.length, 0);
        assert.equal(h.command.canAddTestResult(h.grid, [reference()]), true);
    });
}

for (const [label, references] of [
    ["no selection", []],
    ["multiple selection", [reference(), reference(LANGUAGE_B)]],
    ["missing selection parameter", undefined],
    ["invalid ID", [{ Id: "unsaved", TypeName: "gsic_interpreterlanguage" }]],
    ["missing entity type", [{ Id: LANGUAGE_A }]],
    ["selected child Test Result", [reference(NEW_RESULT, "Attempt", "gsic_testresult")]]
]) {
    test("rejects " + label + " in both enable rule and action", async () => {
        const h = harness();
        assert.equal(h.command.canAddTestResult(h.grid, references), false);
        await h.command.addTestResult(h.grid, references, FORM_ID);
        assert.equal(h.alerts[0].text, "Select exactly one Interpreter Language record.");
        assert.equal(h.navigation.length, 0);
        assert.equal(h.refreshes, 0);
    });
}

test("rejects a child grid or missing originating control", async () => {
    const h = harness({ gridEntity: "gsic_testresult" });
    for (const control of [h.grid, undefined, {}]) {
        assert.equal(h.command.canAddTestResult(control, [reference()]), false);
        await h.command.addTestResult(control, [reference()], FORM_ID);
    }
    assert.equal(h.navigation.length, 0);
    assert.equal(h.alerts.length, 3);
});

test("requires a valid configured form ID without opening a default form", async () => {
    const h = harness();
    for (const formId of [undefined, "", "<verified-main-form-guid>"]) {
        await h.command.addTestResult(h.grid, [reference()], formId);
    }
    assert.equal(h.navigation.length, 0);
    assert.equal(h.alerts.length, 3);
});

for (const result of [undefined, null, {}, { savedEntityReference: [] }]) {
    test("cancellation does not refresh: " + JSON.stringify(result), async () => {
        const h = harness();
        const operation = h.command.addTestResult(h.grid, [reference()], FORM_ID);
        h.completion.resolve(result);
        await operation;
        assert.equal(h.refreshes, 0);
        assert.equal(h.alerts.length, 0);
        assert.equal(h.errors.length, 0);
        assert.equal(h.command.canAddTestResult(h.grid, [reference()]), true);
    });
}

test("ignores repeated invocation while dialog is pending and restores command availability", async () => {
    const h = harness();
    const operation = h.command.addTestResult(h.grid, [reference()], FORM_ID);
    assert.equal(h.command.canAddTestResult(h.grid, [reference()]), false);
    await h.command.addTestResult(h.grid, [reference()], FORM_ID);
    assert.equal(h.navigation.length, 1);
    h.completion.resolve(savedResult());
    await operation;
    assert.equal(h.refreshes, 1);
    assert.equal(h.ribbonRefreshes, 2);
    assert.equal(h.command.canAddTestResult(h.grid, [reference()]), true);
});

test("retrieves missing language display name and supports navigation reference shape", async () => {
    const h = harness();
    const operation = h.command.addTestResult(h.grid,
        [{ id: LANGUAGE_A, entityType: "gsic_interpreterlanguage" }], FORM_ID);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.retrievals[0].query, "?$select=gsic_languagename");
    assert.equal(h.navigation[0].page.data.gsic_interpreterlanguagename, "French");
    h.completion.resolve(savedResult());
    await operation;
    assert.equal(h.refreshes, 1);
});

test("reports lookup retrieval failure without opening a dialog", async () => {
    const h = harness({ retrievalError: new Error("Language is unavailable") });
    await h.command.addTestResult(h.grid, [reference(LANGUAGE_A, "")], FORM_ID);
    assert.equal(h.navigation.length, 0);
    assert.equal(h.errors[0].details, "Language is unavailable");
    assert.equal(h.refreshes, 0);
    assert.equal(h.command.canAddTestResult(h.grid, [reference()]), true);
});

test("reports navigation failure and allows retry", async () => {
    const h = harness({ navigationError: new Error("Form is unavailable") });
    await h.command.addTestResult(h.grid, [reference()], FORM_ID);
    assert.equal(h.errors[0].message, "Could not open Add Test Result.");
    assert.equal(h.errors[0].details, "Form is unavailable");
    assert.equal(h.refreshes, 0);
    assert.equal(h.command.canAddTestResult(h.grid, [reference()]), true);
});

test("reports refresh failure as a saved record without retrying creation", async () => {
    const h = harness({ refreshError: new Error("Refresh failed") });
    const operation = h.command.addTestResult(h.grid, [reference()], FORM_ID);
    h.completion.resolve(savedResult());
    await operation;
    assert.match(h.errors[0].message, /^The Test Result was saved/);
    assert.equal(h.errors[0].details, "Refresh failed");
    assert.equal(h.navigation.length, 1);
    assert.equal(h.refreshes, 1);
    assert.equal(h.command.canAddTestResult(h.grid, [reference()]), true);
});

test("existing OnRecordSelect still opens a saved language in a dialog", async () => {
    const h = harness();
    h.completion.resolve();
    await h.command.onRecordSelect({ getEventSource: () => ({
        getEntityName: () => "gsic_interpreterlanguage", getId: () => "{" + LANGUAGE_A + "}"
    }) });
    assert.equal(h.navigation[0].page.entityId, LANGUAGE_A);
    assert.equal(h.navigation[0].dialog.target, 2);
    assert.equal(h.refreshes, 0);
});
