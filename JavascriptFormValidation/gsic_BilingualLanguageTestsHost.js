(function (global) {
    "use strict";

    const GSIC = global.GSIC = global.GSIC || {};
    const Host = GSIC.BilingualLanguageTestsHost = GSIC.BilingualLanguageTestsHost || {};
    const registeredControls = new WeakSet();
    const pendingControls = new WeakSet();

    function guid(value) {
        const id = typeof value === "string" ? value.replace(/[{}]/g, "").trim().toLowerCase() : "";
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
            throw new Error("A saved record ID and verified Test Result main-form ID are required.");
        }
        return id;
    }

    async function openTestResult(formContext, control, payload) {
        if (!payload || typeof payload.accept !== "function" || typeof payload.complete !== "function") {
            console.error("[GSIC.BilingualLanguageTestsHost] Invalid New Test Result event payload.");
            return;
        }
        // Acknowledge synchronously so an unregistered event cannot leave the PCF waiting forever.
        payload.accept();
        if (pendingControls.has(control)) {
            payload.complete({ saved: false, error: "A Test Result dialog is already open." });
            return;
        }
        pendingControls.add(control);
        let saved = false;
        let outcome;
        try {
            if (formContext.data.entity.getEntityName() !== "gsic_interpreter") {
                throw new Error("New Test Result must be opened from an Interpreter form.");
            }
            const interpreterId = guid(formContext.data.entity.getId());
            const languageId = guid(payload.languageId);
            const formId = guid(payload.formId);
            // Check persisted ownership and use the persisted display name for lookup defaults.
            const language = await global.Xrm.WebApi.retrieveRecord("gsic_interpreterlanguage", languageId,
                "?$select=gsic_languagename,_gsic_interpreter_value");
            if (guid(language._gsic_interpreter_value) !== interpreterId) {
                throw new Error("The selected language belongs to a different Interpreter.");
            }
            if (typeof language.gsic_languagename !== "string" || !language.gsic_languagename.trim()) {
                throw new Error("The selected Interpreter Language has no display name.");
            }
            // Do not use a form context that has moved to another Interpreter during retrieval.
            if (guid(formContext.data.entity.getId()) !== interpreterId) {
                throw new Error("The Interpreter changed. Open New Test Result from the current language list.");
            }
            const result = await global.Xrm.Navigation.navigateTo({
                pageType: "entityrecord",
                entityName: "gsic_testresult",
                formId: formId,
                data: {
                    gsic_interpreterlanguage: languageId,
                    gsic_interpreterlanguagename: language.gsic_languagename
                }
            }, {
                target: 2, position: 1, title: "New Test Result",
                width: { value: 80, unit: "%" }, height: { value: 80, unit: "%" }
            });
            saved = Boolean(result && Array.isArray(result.savedEntityReference) && result.savedEntityReference.length);
            if (saved) {
                const created = result.savedEntityReference[0];
                if (created.entityType !== "gsic_testresult") {
                    throw new Error("The dialog returned an unexpected saved record type.");
                }
                const stored = await global.Xrm.WebApi.retrieveRecord("gsic_testresult", guid(created.id),
                    "?$select=_gsic_interpreterlanguage_value");
                if (guid(stored._gsic_interpreterlanguage_value) !== languageId) {
                    throw new Error("The saved Test Result belongs to a different language. Review its Interpreter Language lookup.");
                }
            }
            outcome = { saved: saved };
        } catch (error) {
            console.error("[GSIC.BilingualLanguageTestsHost] New Test Result failed.", error);
            const detail = error && error.message ? error.message : "The request failed.";
            outcome = { saved: saved, error: (saved
                ? "The Test Result was saved, but its language could not be confirmed. "
                : "Could not open New Test Result. ") + detail };
        } finally {
            pendingControls.delete(control);
        }
        payload.complete(outcome);
    }

    // Register on the Interpreter form OnLoad with execution context and the actual subgrid name.
    Host.onLoad = function (executionContext, controlName) {
        try {
            const formContext = executionContext.getFormContext();
            const control = typeof controlName === "string" && formContext.getControl(controlName);
            if (!control || typeof control.addEventHandler !== "function") {
                throw new Error("Configure the dataset PCF control name and a host supporting PCF custom events.");
            }
            if (registeredControls.has(control)) return;
            control.addEventHandler("newTestResult", function (eventContextOrPayload, payload) {
                // The payload examples pass it directly; hosts may prepend execution context.
                void openTestResult(formContext, control, payload || eventContextOrPayload);
            });
            registeredControls.add(control);
        } catch (error) {
            console.error("[GSIC.BilingualLanguageTestsHost] Could not register New Test Result.", error);
        }
    };
})(window);
