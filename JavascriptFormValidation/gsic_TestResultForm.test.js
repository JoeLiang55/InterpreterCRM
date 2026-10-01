"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "gsic_TestResultForm.js"), "utf8");
const A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const settle = () => new Promise(resolve => setImmediate(resolve));

function setup(category) {
    const visibility = { "Bilingual Scores": true, "English / First Nations": true };
    const handlers = new Set();
    let lookup = [{ id: "{" + A + "}", entityType: "gsic_interpreterlanguage" }];
    let retrieve = () => Promise.resolve({ gsic_languagecategory: category });
    const calls = [];
    const attribute = {
        getValue: () => lookup,
        addOnChange: handler => handlers.add(handler),
        removeOnChange: handler => handlers.delete(handler)
    };
    const form = {
        getAttribute: name => name === "gsic_interpreterlanguage" ? attribute : null,
        ui: { tabs: { forEach: callback => callback({ sections: { get: name => ({
            setVisible: value => { visibility[name] = value; }
        }) } }) } }
    };
    const context = { getFormContext: () => form };
    const sandbox = {
        console: { error() {}, warn() {} },
        Xrm: { WebApi: { retrieveRecord: (...args) => { calls.push(args); return retrieve(...args); } } }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(source, sandbox);
    const script = sandbox.GSIC.TestResultForm;
    return { context, script, visibility, calls, handlers,
        select: value => { lookup = value; }, retrieve: fn => { retrieve = fn; } };
}

test("prepopulated bilingual lookup shows only the bilingual score section", async () => {
    const app = setup(472540000);
    app.script.onLoad(app.context);
    await settle();
    assert.deepEqual(app.calls[0], ["gsic_interpreterlanguage", A, "?$select=gsic_languagecategory"]);
    assert.deepEqual(app.visibility, { "Bilingual Scores": true, "English / First Nations": false });
});

for (const category of [472540001, 472540002]) {
    test("category " + category + " shows the English / First Nations score section", async () => {
        const app = setup(category);
        app.script.onLoad(app.context);
        await settle();
        assert.deepEqual(app.visibility, { "Bilingual Scores": false, "English / First Nations": true });
    });
}

test("repeated form loads register one handler; clearing the lookup ignores a pending response", async () => {
    const app = setup(472540000);
    let resolve;
    app.retrieve(() => new Promise(done => { resolve = done; }));
    app.script.onLoad(app.context);
    app.script.onLoad(app.context);
    assert.equal(app.handlers.size, 1);
    app.select(null);
    app.script.onInterpreterLanguageChange(app.context);
    resolve({ gsic_languagecategory: 472540000 });
    await settle();
    assert.deepEqual(app.visibility, { "Bilingual Scores": true, "English / First Nations": true });
});

test("an older language retrieval cannot override the current language category", async () => {
    const app = setup(472540000);
    let resolve;
    app.retrieve(() => new Promise(done => { resolve = done; }));
    app.script.onLoad(app.context);
    app.select([{ id: B, entityType: "gsic_interpreterlanguage" }]);
    app.retrieve(() => Promise.resolve({ gsic_languagecategory: 472540001 }));
    app.script.onInterpreterLanguageChange(app.context);
    await settle();
    resolve({ gsic_languagecategory: 472540000 });
    await settle();
    assert.deepEqual(app.visibility, { "Bilingual Scores": false, "English / First Nations": true });
});

test("unknown categories and retrieval failures keep both score sections available", async () => {
    const app = setup(123);
    app.script.onLoad(app.context);
    await settle();
    assert.deepEqual(app.visibility, { "Bilingual Scores": true, "English / First Nations": true });
    app.retrieve(() => Promise.reject(new Error("Denied")));
    app.script.onInterpreterLanguageChange(app.context);
    await settle();
    assert.deepEqual(app.visibility, { "Bilingual Scores": true, "English / First Nations": true });
});
