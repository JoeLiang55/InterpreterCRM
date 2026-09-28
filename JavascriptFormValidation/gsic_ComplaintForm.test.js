"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const interpreterId = "{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}";
const otherInterpreterId = "{11111111-2222-3333-4444-555555555555}";
const language = [{ id: "{99999999-8888-7777-6666-555555555555}", entityType: "gsic_interpreterlanguage" }];

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
        controls: { forEach(callback) { callback(control); } },
        control,
        handlers,
        getValue() { return this.value; },
        setValue(next) { this.value = next; },
        addOnChange(handler) { handlers.add(handler); },
        removeOnChange(handler) { handlers.delete(handler); }
    };
}

function setup(values = {}) {
    const fields = {
        gsic_interpreter: attribute(values.interpreter === undefined ? [{ id: interpreterId }] : values.interpreter),
        gsic_interpreterlanguage: attribute(values.language === undefined ? language : values.language),
        gsic_complaintnotification: attribute(values.notification === undefined ? false : values.notification),
        gsic_complaintnotificationdatesent: attribute("2026-09-01"),
        gsic_complaintnotificationtrackingnumber: attribute("TRACK-1"),
        gsic_responsereceived: attribute(values.response === undefined ? false : values.response),
        gsic_responsedatereceived: attribute("2026-09-02")
    };
    const formContext = { getAttribute(name) { return fields[name] || null; } };
    const context = { getFormContext() { return formContext; } };
    const script = fs.readFileSync(path.join(__dirname, "gsic_ComplaintForm.js"), "utf8");
    const sandbox = { window: {}, console };
    vm.runInNewContext(script, sandbox, { filename: "gsic_ComplaintForm.js" });
    const form = sandbox.window.GSIC.ComplaintForm;
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
    return { fields, form, context, change, search };
}

test("OnLoad registers one lookup filter and sets dependent control states", () => {
    const { fields, form, context, search } = setup();
    form.onLoad(context);
    assert.equal(fields.gsic_interpreterlanguage.control.disabled, false);
    assert.equal(fields.gsic_complaintnotificationdatesent.control.disabled, true);
    assert.equal(fields.gsic_complaintnotificationtrackingnumber.control.disabled, true);
    assert.equal(fields.gsic_responsedatereceived.control.disabled, true);
    assert.deepEqual(search(), [{
        filter: "<filter type='and'><condition attribute='gsic_interpreter' operator='eq' value='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' /></filter>",
        entity: "gsic_interpreterlanguage"
    }]);
    assert.deepEqual(fields.gsic_interpreterlanguage.getValue(), language);
});

test("checkbox changes enable and disable controls without clearing correspondence history", () => {
    const { fields, form, context, change } = setup({ notification: true, response: true });
    form.onLoad(context);
    assert.equal(fields.gsic_complaintnotificationdatesent.control.disabled, false);
    assert.equal(fields.gsic_complaintnotificationtrackingnumber.control.disabled, false);
    assert.equal(fields.gsic_responsedatereceived.control.disabled, false);
    change("gsic_complaintnotification", false);
    change("gsic_responsereceived", false);
    assert.equal(fields.gsic_complaintnotificationdatesent.control.disabled, true);
    assert.equal(fields.gsic_complaintnotificationtrackingnumber.control.disabled, true);
    assert.equal(fields.gsic_responsedatereceived.control.disabled, true);
    assert.equal(fields.gsic_complaintnotificationdatesent.getValue(), "2026-09-01");
    assert.equal(fields.gsic_complaintnotificationtrackingnumber.getValue(), "TRACK-1");
    assert.equal(fields.gsic_responsedatereceived.getValue(), "2026-09-02");
    change("gsic_complaintnotification", true);
    change("gsic_responsereceived", true);
    assert.equal(fields.gsic_complaintnotificationdatesent.control.disabled, false);
    assert.equal(fields.gsic_responsedatereceived.control.disabled, false);
});

test("Interpreter change clears Language and filters by the current GUID", () => {
    const { fields, form, context, change, search } = setup();
    form.onLoad(context);
    change("gsic_interpreter", [{ id: otherInterpreterId }]);
    assert.equal(fields.gsic_interpreterlanguage.getValue(), null);
    assert.equal(fields.gsic_interpreterlanguage.control.disabled, false);
    assert.match(search()[0].filter, /value='11111111-2222-3333-4444-555555555555'/);
});

test("empty Interpreter removes stale Language and prevents lookup selection", () => {
    const initial = setup({ interpreter: null });
    initial.form.onLoad(initial.context);
    assert.equal(initial.fields.gsic_interpreterlanguage.getValue(), null);
    assert.equal(initial.fields.gsic_interpreterlanguage.control.disabled, true);
    assert.equal(initial.search().length, 0);

    const changed = setup();
    changed.form.onLoad(changed.context);
    changed.change("gsic_interpreter", null);
    assert.equal(changed.fields.gsic_interpreterlanguage.getValue(), null);
    assert.equal(changed.fields.gsic_interpreterlanguage.control.disabled, true);
    assert.equal(changed.search().length, 0);
});

test("repeated OnLoad does not duplicate PreSearch or OnChange handlers", () => {
    const { fields, form, context, search } = setup();
    form.onLoad(context);
    form.onLoad(context);
    assert.equal(fields.gsic_interpreterlanguage.control.preSearch.size, 1);
    assert.equal(fields.gsic_interpreter.handlers.size, 1);
    assert.equal(fields.gsic_complaintnotification.handlers.size, 1);
    assert.equal(fields.gsic_responsereceived.handlers.size, 1);
    assert.equal(search().length, 1);
});

test("missing attributes and controls do not throw", () => {
    const { fields, form, context } = setup();
    delete fields.gsic_interpreterlanguage;
    delete fields.gsic_complaintnotificationdatesent;
    fields.gsic_responsedatereceived.controls = null;
    assert.doesNotThrow(() => form.onLoad(context));
    assert.doesNotThrow(() => form.onInterpreterChange(context));
    assert.doesNotThrow(() => form.onComplaintNotificationChange(context));
    assert.doesNotThrow(() => form.onResponseReceivedChange(context));
});
