(function (global) {
    "use strict";

    // Verified Interpreter logical names (see DATAVERSE_SCHEMA.md).
    const IN_REGISTRY_COLUMN_NAME = "gsic_inregistry";
    const REGISTRY_DATE_ADDED_COLUMN_NAME = "gsic_registrydateadded";
    const pendingForms = new WeakSet();

    const GSIC = global.GSIC = global.GSIC || {};
    const InterpreterForm = GSIC.InterpreterForm = GSIC.InterpreterForm || {};

    function logError(message, error) {
        console.error("[GSIC.InterpreterForm] " + message, error || "");
    }

    async function showMessage(message) {
        try {
            await global.Xrm.Navigation.openAlertDialog({ text: message });
        } catch (error) {
            logError("Could not show the Registry message.", error);
        }
    }

    InterpreterForm.addToRegistry = async function (primaryControl) {
        let formContext;
        let inRegistry;
        let dateAdded;
        let previousInRegistry;
        let previousDateAdded;
        let changed = false;
        let saved = false;
        let ownsPending = false;

        try {
            formContext = primaryControl;
            if ((!formContext || typeof formContext.getAttribute !== "function" || !formContext.data) &&
                primaryControl && typeof primaryControl.getFormContext === "function") {
                formContext = primaryControl.getFormContext();
            }
            if (!formContext || !formContext.data || !formContext.data.entity ||
                typeof formContext.data.entity.getId !== "function" ||
                !formContext.data.entity.getId() ||
                (formContext.ui && formContext.ui.getFormType && formContext.ui.getFormType() === 1)) {
                await showMessage("Save this Interpreter record before adding it to the Registry.");
                return;
            }

            if (pendingForms.has(formContext)) {
                return;
            }
            pendingForms.add(formContext);
            ownsPending = true;

            inRegistry = formContext.getAttribute(IN_REGISTRY_COLUMN_NAME);
            dateAdded = formContext.getAttribute(REGISTRY_DATE_ADDED_COLUMN_NAME);
            if (!inRegistry || !dateAdded) {
                throw new Error("In Registry and Registry Date Added must be included on the Interpreter form.");
            }
            if (inRegistry.getValue() === true) {
                await showMessage("This Interpreter is already in the Registry.");
                return;
            }

            previousInRegistry = inRegistry.getValue();
            previousDateAdded = dateAdded.getValue();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            changed = true;
            inRegistry.setValue(true);
            dateAdded.setValue(today);

            await formContext.data.save();
            saved = true;
            await formContext.data.refresh(false);
            await showMessage("Interpreter added to the Registry.");
        } catch (error) {
            if (changed && !saved) {
                try {
                    inRegistry.setValue(previousInRegistry);
                    dateAdded.setValue(previousDateAdded);
                } catch (restoreError) {
                    logError("Could not restore the unsaved Registry values.", restoreError);
                }
            }
            logError("Could not add the Interpreter to the Registry.", error);
            const detail = error && error.message ? " " + error.message : "";
            await showMessage(saved
                ? "The Interpreter was saved in the Registry, but the form could not refresh." + detail
                : "Could not add the Interpreter to the Registry." + detail);
        } finally {
            if (ownsPending) {
                pendingForms.delete(formContext);
            }
        }
    };
})(window);
