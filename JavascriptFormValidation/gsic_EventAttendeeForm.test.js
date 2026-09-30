"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const interpreterId = "{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}";
const languageId = "{99999999-8888-7777-6666-555555555555}";
const language = [{ id: languageId, entityType: "gsic_interpreterlanguage" }];

function attribute(value) {
    const handlers = new Set();
    const control = {
        disabled: false,
        filters: [],
        preSearch: new Set(),
        setDisabled(disabled) { this.disabled = disabled; },
        addPreSearch(handler) { this.preSearch.add(handler); },
        removePreSearch(handler) { this.preSearch.delete(handler); },
        addCustomFilter(filter, entity) { this.filters.push({ filter, entity }); }
    };
    return {
        value,
        setValueCalls: 0,
        controls: { forEach(callback) { callback(control); } },
        control,
        handlers,
        getValue() { return this.value; },
        setValue(next) { this.value = next; this.setValueCalls++; },
        addOnChange(handler) { handlers.add(handler); },
        removeOnChange(handler) { handlers.delete(handler); }
    };
}

function setup(options = {}) {
    const fields = {
        gsic_interpreterprofile: attribute(options.interpreter === undefined ? [{ id: interpreterId }] : options.interpreter),
        gsic_interpreterlanguage: attribute(options.language === undefined ? language : options.language),
        gsic_languagetype: attribute(options.languageType === undefined ? null : options.languageType),
        gsic_confirmed: attribute(options.confirmed === undefined ? false : options.confirmed),
        gsic_confirmationmethod: attribute("email"),
        gsic_confirmationdate: attribute("2026-09-29")
    };
    for (const name of options.missing || []) {
        delete fields[name];
    }

    const formContext = { getAttribute(name) { return fields[name] || null; } };
    const context = { getFormContext() { return formContext; } };
    const retrieveCalls = [];
    const sandbox = {
        window: {},
        console: { error() {}, debug() {} },
        Xrm: { WebApi: { retrieveRecord(table, id, query) {
            retrieveCalls.push({ table, id, query });
            return Promise.resolve({ gsic_languagecategory: 472540000 });
        } } }
    };
    const script = fs.readFileSync(path.join(__dirname, "gsic_EventAttendeeForm.js"), "utf8");
    vm.runInNewContext(script, sandbox, { filename: "gsic_EventAttendeeForm.js" });
    const form = sandbox.window.GSIC.EventAttendeeForm;

    function change(name, value) {
        fields[name].setValue(value);
        for (const handler of fields[name].handlers) {
            handler(context);
        }
    }

    function search() {
        const control = fields.gsic_interpreterlanguage.control;
        control.filters.length = 0;
        for (const handler of control.preSearch) {
            handler({ ...context, getEventSource() { return control; } });
        }
        return control.filters;
    }

    return { fields, form, context, change, search, retrieveCalls };
}

test("Confirmed true enables Confirmation Method", () => {
    const { fields, form, context } = setup({ confirmed: true });
    form.onConfirmedChange(context);
    assert.equal(fields.gsic_confirmationmethod.control.disabled, false);
});

test("Confirmed true enables Confirmation Date", () => {
    const { fields, form, context } = setup({ confirmed: true });
    form.onConfirmedChange(context);
    assert.equal(fields.gsic_confirmationdate.control.disabled, false);
});

test("Confirmed false disables both confirmation controls", () => {
    const { fields, form, context } = setup();
    form.onConfirmedChange(context);
    assert.equal(fields.gsic_confirmationmethod.control.disabled, true);
    assert.equal(fields.gsic_confirmationdate.control.disabled, true);
});

test("Confirmed null disables both confirmation controls", () => {
    const { fields, form, context } = setup({ confirmed: null });
    form.onConfirmedChange(context);
    assert.equal(fields.gsic_confirmationmethod.control.disabled, true);
    assert.equal(fields.gsic_confirmationdate.control.disabled, true);
});

test("Confirmed undefined disables both confirmation controls", () => {
    const { fields, form, context } = setup();
    fields.gsic_confirmed.setValue(undefined);
    form.onConfirmedChange(context);
    assert.equal(fields.gsic_confirmationmethod.control.disabled, true);
    assert.equal(fields.gsic_confirmationdate.control.disabled, true);
});

test("disabling Confirmation Method preserves its value", () => {
    const { fields, form, context } = setup();
    form.onConfirmedChange(context);
    assert.equal(fields.gsic_confirmationmethod.getValue(), "email");
    assert.equal(fields.gsic_confirmationmethod.setValueCalls, 0);
});

test("disabling Confirmation Date preserves its value", () => {
    const { fields, form, context } = setup();
    form.onConfirmedChange(context);
    assert.equal(fields.gsic_confirmationdate.getValue(), "2026-09-29");
    assert.equal(fields.gsic_confirmationdate.setValueCalls, 0);
});

test("onLoad applies the initial confirmation state", () => {
    const { fields, form, context } = setup({ confirmed: null });
    form.onLoad(context);
    assert.equal(fields.gsic_confirmationmethod.control.disabled, true);
    assert.equal(fields.gsic_confirmationdate.control.disabled, true);
});

test("onLoad enables saved confirmation controls when Confirmed is true", () => {
    const { fields, form, context } = setup({ confirmed: true });
    fields.gsic_confirmationmethod.control.disabled = true;
    fields.gsic_confirmationdate.control.disabled = true;
    form.onLoad(context);
    assert.equal(fields.gsic_confirmationmethod.control.disabled, false);
    assert.equal(fields.gsic_confirmationdate.control.disabled, false);
});

test("onLoad registers Confirmed OnChange once, even if called twice", () => {
    const { fields, form, context } = setup();
    form.onLoad(context);
    form.onLoad(context);
    assert.equal(fields.gsic_confirmed.handlers.size, 1);
    assert.equal([...fields.gsic_confirmed.handlers][0], form.onConfirmedChange);
});

test("changing Confirmed immediately updates both controls", () => {
    const { fields, form, context, change } = setup();
    form.onLoad(context);
    change("gsic_confirmed", true);
    assert.equal(fields.gsic_confirmationmethod.control.disabled, false);
    assert.equal(fields.gsic_confirmationdate.control.disabled, false);
    change("gsic_confirmed", false);
    assert.equal(fields.gsic_confirmationmethod.control.disabled, true);
    assert.equal(fields.gsic_confirmationdate.control.disabled, true);
});

test("missing Confirmed attribute does not throw and disables dependents", () => {
    const { fields, form, context } = setup({ missing: ["gsic_confirmed"] });
    assert.doesNotThrow(() => form.onLoad(context));
    assert.doesNotThrow(() => form.onConfirmedChange(context));
    assert.equal(fields.gsic_confirmationmethod.control.disabled, true);
    assert.equal(fields.gsic_confirmationdate.control.disabled, true);
});

test("missing dependent controls or attributes do not throw", () => {
    const { fields, form, context } = setup({ confirmed: true });
    delete fields.gsic_confirmationmethod.controls;
    delete fields.gsic_confirmationdate;
    assert.doesNotThrow(() => form.onLoad(context));
    assert.doesNotThrow(() => form.onConfirmedChange(context));
});

test("onLoad retains Interpreter Profile to Interpreter Language filtering", () => {
    const { fields, form, context, search, change } = setup();
    form.onLoad(context);
    assert.equal(fields.gsic_interpreterprofile.handlers.size, 1);
    assert.equal(fields.gsic_interpreterlanguage.control.preSearch.size, 1);
    assert.equal(fields.gsic_interpreterlanguage.control.disabled, false);
    assert.deepEqual(search(), [{
        filter: "<filter type='and'><condition attribute='gsic_interpreter' operator='eq' value='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' /></filter>",
        entity: "gsic_interpreterlanguage"
    }]);
    change("gsic_interpreterprofile", null);
    assert.equal(fields.gsic_interpreterlanguage.getValue(), null);
    assert.equal(fields.gsic_interpreterlanguage.control.disabled, true);
    assert.equal(fields.gsic_languagetype.getValue(), null);
});

test("onLoad and Language OnChange retain Language Type synchronization", async () => {
    const { fields, form, context, change, retrieveCalls } = setup();
    form.onLoad(context);
    await Promise.resolve();
    assert.equal(fields.gsic_languagetype.getValue(), 472540000);
    assert.equal(fields.gsic_languagetype.control.disabled, true);
    assert.equal(fields.gsic_interpreterlanguage.handlers.size, 1);
    assert.deepEqual(retrieveCalls[0], {
        table: "gsic_interpreterlanguage",
        id: "99999999-8888-7777-6666-555555555555",
        query: "?$select=gsic_languagecategory"
    });
    change("gsic_interpreterlanguage", null);
    assert.equal(fields.gsic_languagetype.getValue(), null);
    change("gsic_interpreterlanguage", language);
    await Promise.resolve();
    assert.equal(fields.gsic_languagetype.getValue(), 472540000);
});
