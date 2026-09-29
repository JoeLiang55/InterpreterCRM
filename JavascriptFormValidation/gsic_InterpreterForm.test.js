"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const DEPENDENCIES = [
    ["gsic_consenttosharequalification", "gsic_dateconsentprovided"],
    ["gsic_accessibilitycoursecompleted", "gsic_accessibilitytrainingdetails"],
    ["gsic_securityclearance", "gsic_clearancedate"],
    ["gsic_testpreparation", "gsic_testpreparationdate"],
    ["gsic_training", "gsic_trainingdate"],
    ["gsic_retraining", "gsic_retrainingdate"]
];

class FixedDate extends Date {
    constructor(...args) {
        super(...(args.length ? args : [2026, 8, 28, 15, 30]));
    }
}

function attribute(value) {
    return {
        value,
        writes: [],
        handlers: [],
        controls: [],
        getValue() { return this.value; },
        setValue(next) { this.value = next; this.writes.push(next); },
        addOnChange(handler) { this.handlers.push(handler); },
        removeOnChange(handler) { this.handlers = this.handlers.filter(existing => existing !== handler); },
        fireOnChange(executionContext) { this.handlers.forEach(handler => handler(executionContext)); }
    };
}

function setup(options = {}) {
    const fields = {
        gsic_inregistry: attribute(options.inRegistry === undefined ? false : options.inRegistry),
        gsic_registrydateadded: attribute(options.dateAdded === undefined ? null : options.dateAdded)
    };
    const controls = {};
    for (const [controllerName, dependentName] of DEPENDENCIES) {
        fields[controllerName] = attribute(options.values && Object.hasOwn(options.values, controllerName)
            ? options.values[controllerName] : null);
        fields[dependentName] = attribute(options.values && Object.hasOwn(options.values, dependentName)
            ? options.values[dependentName] : null);
        controls[dependentName] = {
            disabled: null,
            writes: [],
            setDisabled(value) { this.disabled = value; this.writes.push(value); }
        };
        fields[dependentName].controls.push(controls[dependentName]);
    }
    const calls = [];
    const errors = [];
    const diagnostics = [];
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
    const executionContext = { getFormContext() { return formContext; } };
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
        console: {
            error(...args) { errors.push(args); },
            log(...args) { diagnostics.push(args); }
        }
    };
    const script = fs.readFileSync(path.join(__dirname, "gsic_InterpreterForm.js"), "utf8");
    vm.runInNewContext(script, sandbox, { filename: "gsic_InterpreterForm.js" });
    return {
        fields, controls, calls, errors, diagnostics, formContext, executionContext, primaryControl,
        onLoad: sandbox.window.GSIC.InterpreterForm.onLoad,
        addToRegistry: sandbox.window.GSIC.InterpreterForm.addToRegistry
    };
}

test("onLoad applies the initial state and registers each controller OnChange once", () => {
    const values = Object.fromEntries(DEPENDENCIES.map(([controller], index) => [controller, index % 2 === 0]));
    const { fields, controls, executionContext, onLoad } = setup({ values });

    onLoad(executionContext);
    onLoad(executionContext);
    DEPENDENCIES.forEach(([controller, dependent], index) => {
        assert.equal(controls[dependent].disabled, index % 2 !== 0, dependent);
        assert.equal(fields[controller].handlers.length, 1, controller);
    });
});

for (const [controller, dependent] of DEPENDENCIES) {
    test(`${controller} enables ${dependent} only when true and preserves its value`, () => {
        const savedValue = dependent === "gsic_accessibilitytrainingdetails" ? "Historical details" : new Date(2025, 1, 3);
        const { fields, controls, executionContext, onLoad } = setup({
            values: { [controller]: false, [dependent]: savedValue }
        });

        onLoad(executionContext);
        assert.equal(controls[dependent].disabled, true);
        assert.equal(fields[dependent].getValue(), savedValue);
        assert.equal(fields[dependent].writes.length, 0);

        fields[controller].setValue(true);
        fields[controller].fireOnChange(executionContext);
        assert.equal(controls[dependent].disabled, false);

        fields[controller].setValue(null);
        fields[controller].fireOnChange(executionContext);
        assert.equal(controls[dependent].disabled, true);

        fields[controller].setValue(undefined);
        fields[controller].fireOnChange(executionContext);
        assert.equal(controls[dependent].disabled, true);
        assert.equal(fields[dependent].getValue(), savedValue);
        assert.equal(fields[dependent].writes.length, 0);
    });
}

test("missing attributes, controls, and execution context do not throw", () => {
    const { fields, executionContext, onLoad } = setup();
    delete fields.gsic_securityclearance;
    delete fields.gsic_trainingdate;
    fields.gsic_accessibilitytrainingdetails.controls = null;
    fields.gsic_dateconsentprovided.controls = [null, {}];
    delete fields.gsic_retraining.addOnChange;

    assert.doesNotThrow(() => onLoad(executionContext));
    assert.doesNotThrow(() => onLoad(null));
    assert.doesNotThrow(() => fields.gsic_consenttosharequalification.fireOnChange(executionContext));
    assert.doesNotThrow(() => fields.gsic_consenttosharequalification.fireOnChange(null));
});

test("PrimaryControl diagnostics expose the received object and relevant runtime shape", async () => {
    const { diagnostics, primaryControl, addToRegistry } = setup();
    await addToRegistry(primaryControl);

    assert.equal(diagnostics.length, 2);
    assert.equal(diagnostics[0][1], primaryControl);
    const snapshot = diagnostics[1][1];
    assert.equal(snapshot.argumentCount, 1);
    assert.equal(snapshot.type, "object");
    assert.equal(snapshot.dataExists, false);
    assert.equal(snapshot.entityExists, false);
    assert.equal(snapshot.getFormContext, "function");
    assert.equal(snapshot.getAttribute, "undefined");
    assert.ok(snapshot.relevantProperties.includes("getFormContext"));
});

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
    const { fields, calls, diagnostics, formContext, addToRegistry } = setup();
    await addToRegistry(formContext);
    assert.equal(fields.gsic_inregistry.getValue(), true);
    assert.deepEqual(calls, ["save", ["refresh", false], ["dialog", "Interpreter added to the Registry."]]);
    const snapshot = diagnostics[1][1];
    assert.equal(snapshot.dataExists, true);
    assert.equal(snapshot.entityExists, true);
    assert.equal(snapshot.getFormContext, "undefined");
    assert.equal(snapshot.getAttribute, "function");
    assert.equal(snapshot.entityGetId, "function");
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

test("missing form context reports a command configuration error", async () => {
    const { calls, addToRegistry } = setup();
    await addToRegistry({});
    assert.deepEqual(calls, [["dialog", "Could not add the Interpreter to the Registry. Interpreter form context is unavailable. Pass PrimaryControl to this command."]]);
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
