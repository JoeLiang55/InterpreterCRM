"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

class FixedDate extends Date {
    constructor(...args) {
        super(...(args.length ? args : [2026, 8, 28, 15, 30]));
    }
}

function attribute(value) {
    return {
        value,
        writes: [],
        getValue() { return this.value; },
        setValue(next) { this.value = next; this.writes.push(next); }
    };
}

function setup(options = {}) {
    const fields = {
        gsic_inregistry: attribute(options.inRegistry === undefined ? false : options.inRegistry),
        gsic_registrydateadded: attribute(options.dateAdded === undefined ? null : options.dateAdded)
    };
    const calls = [];
    const errors = [];
    const formContext = {
        getAttribute(name) { return fields[name] || null; },
        ui: { getFormType() { return options.formType === undefined ? 2 : options.formType; } },
        data: {
            entity: { getId() { return options.id === undefined ? "{AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE}" : options.id; } },
            save() {
                calls.push("save");
                return options.save ? options.save() : Promise.resolve();
            },
            refresh(save) {
                calls.push(["refresh", save]);
                return options.refresh ? options.refresh(save) : Promise.resolve();
            }
        }
    };
    const primaryControl = {
        getFormContext() {
            calls.push("getFormContext");
            return formContext;
        }
    };
    const sandbox = {
        window: {
            Xrm: { Navigation: { openAlertDialog({ text }) { calls.push(["dialog", text]); return Promise.resolve(); } } }
        },
        Date: FixedDate,
        console: { error(...args) { errors.push(args); } }
    };
    const script = fs.readFileSync(path.join(__dirname, "gsic_InterpreterForm.js"), "utf8");
    vm.runInNewContext(script, sandbox, { filename: "gsic_InterpreterForm.js" });
    return { fields, calls, errors, formContext, primaryControl, addToRegistry: sandbox.window.GSIC.InterpreterForm.addToRegistry };
}

test("saved Interpreter through PrimaryControl is added with today's local Date Only value, then saved and refreshed", async () => {
    const { fields, calls, primaryControl, addToRegistry } = setup();
    await addToRegistry(primaryControl);

    assert.equal(fields.gsic_inregistry.getValue(), true);
    const date = fields.gsic_registrydateadded.getValue();
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 8);
    assert.equal(date.getDate(), 28);
    assert.equal(date.getHours(), 0);
    assert.equal(date.getMinutes(), 0);
    assert.deepEqual(calls, ["getFormContext", "save", ["refresh", false], ["dialog", "Interpreter added to the Registry."]]);
});

test("PrimaryControl supplied as the form context also adds a saved Interpreter", async () => {
    const { fields, calls, formContext, addToRegistry } = setup();
    await addToRegistry(formContext);
    assert.equal(fields.gsic_inregistry.getValue(), true);
    assert.deepEqual(calls, ["save", ["refresh", false], ["dialog", "Interpreter added to the Registry."]]);
});

test("unsaved Interpreter through PrimaryControl shows a message without changing or saving anything", async () => {
    const { fields, calls, primaryControl, addToRegistry } = setup({ id: "" });
    await addToRegistry(primaryControl);
    assert.equal(fields.gsic_inregistry.getValue(), false);
    assert.equal(fields.gsic_registrydateadded.getValue(), null);
    assert.deepEqual(calls, ["getFormContext", ["dialog", "Save this Interpreter record before adding it to the Registry."]]);
});

test("create form is treated as unsaved even if it exposes an ID", async () => {
    const { calls, formContext, addToRegistry } = setup({ formType: 1 });
    await addToRegistry(formContext);
    assert.deepEqual(calls, [["dialog", "Save this Interpreter record before adding it to the Registry."]]);
});

test("already registered Interpreter through PrimaryControl does nothing", async () => {
    const existingDate = new Date(2025, 3, 2);
    const { fields, calls, primaryControl, addToRegistry } = setup({ inRegistry: true, dateAdded: existingDate });
    await addToRegistry(primaryControl);
    assert.equal(fields.gsic_registrydateadded.getValue(), existingDate);
    assert.deepEqual(calls, ["getFormContext", ["dialog", "This Interpreter is already in the Registry."]]);
});

test("save failure restores Registry values and reports the error", async () => {
    const existingDate = new Date(2025, 3, 2);
    const { fields, calls, errors, formContext, addToRegistry } = setup({
        dateAdded: existingDate,
        save() { return Promise.reject(new Error("Permission denied")); }
    });
    await addToRegistry(formContext);
    assert.equal(fields.gsic_inregistry.getValue(), false);
    assert.equal(fields.gsic_registrydateadded.getValue(), existingDate);
    assert.deepEqual(calls, ["save", ["dialog", "Could not add the Interpreter to the Registry. Permission denied"]]);
    assert.equal(errors.length, 1);
});

test("refresh failure reports that save succeeded and keeps Registry values", async () => {
    const { fields, calls, formContext, addToRegistry } = setup({
        refresh() { return Promise.reject(new Error("Refresh unavailable")); }
    });
    await addToRegistry(formContext);
    assert.equal(fields.gsic_inregistry.getValue(), true);
    assert.deepEqual(calls, ["save", ["refresh", false],
        ["dialog", "The Interpreter was saved in the Registry, but the form could not refresh. Refresh unavailable"]]);
});

test("missing Registry field reports configuration error without saving", async () => {
    const { fields, calls, formContext, addToRegistry } = setup();
    delete fields.gsic_registrydateadded;
    await addToRegistry(formContext);
    assert.deepEqual(calls, [["dialog", "Could not add the Interpreter to the Registry. In Registry and Registry Date Added must be included on the Interpreter form."]]);
});

test("a second click while save is pending does not start another save", async () => {
    let completeSave;
    const savePending = new Promise(resolve => { completeSave = resolve; });
    const { calls, formContext, addToRegistry } = setup({ save() { return savePending; } });
    const first = addToRegistry(formContext);
    await addToRegistry(formContext);
    assert.deepEqual(calls, ["save"]);
    completeSave();
    await first;
    assert.deepEqual(calls, ["save", ["refresh", false], ["dialog", "Interpreter added to the Registry."]]);
});
