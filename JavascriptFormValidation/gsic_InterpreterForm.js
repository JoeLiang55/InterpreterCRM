(function (global) {
    "use strict";

    // Verified Interpreter logical names (see DATAVERSE_SCHEMA.md).
    const IN_REGISTRY_COLUMN_NAME = "gsic_inregistry";
    const REGISTRY_DATE_ADDED_COLUMN_NAME = "gsic_registrydateadded";
    const DEPENDENCIES = Object.freeze([
        ["gsic_consenttosharequalification", "gsic_dateconsentprovided"],
        ["gsic_accessibilitycoursecompleted", "gsic_accessibilitytrainingdetails"],
        ["gsic_securityclearance", "gsic_clearancedate"],
        ["gsic_testpreparation", "gsic_testpreparationdate"],
        ["gsic_training", "gsic_trainingdate"],
        ["gsic_retraining", "gsic_retrainingdate"]
    ]);
    const pendingForms = new WeakSet();
    // The form export is not in this repository: do not infer categories or sections.
    const LANGUAGE_SUBGRID_NAMES = Object.freeze([
        "Subgrid_new_1", "Subgrid_new_2", "Subgrid_new_3"
    ]);
    const languageGridHandlers = new WeakMap();

    const GSIC = global.GSIC = global.GSIC || {};
    const InterpreterForm = GSIC.InterpreterForm = GSIC.InterpreterForm || {};

    function logError(message, error) {
        console.error("[GSIC.InterpreterForm] " + message, error || "");
    }

    function updateDependentControl(formContext, controllerName, dependentName) {
        const controller = formContext.getAttribute(controllerName);
        const dependent = formContext.getAttribute(dependentName);
        if (!dependent || !dependent.controls || typeof dependent.controls.forEach !== "function") {
            return;
        }

        const disabled = !controller || typeof controller.getValue !== "function" || controller.getValue() !== true;
        dependent.controls.forEach(function (control) {
            if (control && typeof control.setDisabled === "function") {
                control.setDisabled(disabled);
            }
        });
    }

    function updateDependentControls(formContext) {
        DEPENDENCIES.forEach(function (pair) {
            updateDependentControl(formContext, pair[0], pair[1]);
        });
    }

    function onControllerChange(executionContext) {
        try {
            const formContext = executionContext && executionContext.getFormContext();
            if (formContext && typeof formContext.getAttribute === "function") {
                updateDependentControls(formContext);
            }
        } catch (error) {
            logError("Could not update Interpreter qualification fields.", error);
        }
    }

    function updateLanguageGridVisibility(control) {
        try {
            const grid = control.getGrid();
            if (!grid || typeof grid.getTotalRecordCount !== "function") {
                return;
            }
            const count = grid.getTotalRecordCount();
            // Null, undefined, negative loading sentinels and errors are not empty grids.
            if (typeof count === "number" && Number.isFinite(count) && count >= 0) {
                control.setVisible(count > 0);
            }
        } catch (error) {
            logError("Could not read the loaded language subgrid count.", error);
        }
    }

    function refreshLanguageSubgrids(formContext) {
        if (!formContext || typeof formContext.getControl !== "function") {
            return;
        }
        LANGUAGE_SUBGRID_NAMES.forEach(function (name) {
            try {
                const control = formContext.getControl(name);
                if (!control || typeof control.addOnLoad !== "function" ||
                    typeof control.getGrid !== "function" || typeof control.setVisible !== "function" ||
                    typeof control.refresh !== "function") {
                    return;
                }
                if (!languageGridHandlers.has(control)) {
                    const handler = function () { updateLanguageGridVisibility(control); };
                    control.addOnLoad(handler);
                    languageGridHandlers.set(control, handler);
                }
                // Hidden grids may defer loading. Reveal before requesting fresh data;
                // only the subsequent grid OnLoad may decide that a grid is empty.
                control.setVisible(true);
                control.refresh();
            } catch (error) {
                logError("Could not refresh language subgrid " + name + ".", error);
            }
        });
    }

    InterpreterForm.onLoad = function (executionContext) {
        try {
            const formContext = executionContext && executionContext.getFormContext();
            if (!formContext || typeof formContext.getAttribute !== "function") {
                return;
            }

            DEPENDENCIES.forEach(function (pair) {
                const controller = formContext.getAttribute(pair[0]);
                if (controller && typeof controller.addOnChange === "function") {
                    if (typeof controller.removeOnChange === "function") {
                        controller.removeOnChange(onControllerChange);
                    }
                    controller.addOnChange(onControllerChange);
                }
            });
            updateDependentControls(formContext);
            refreshLanguageSubgrids(formContext);
        } catch (error) {
            logError("Could not initialize Interpreter qualification fields.", error);
        }
    };

    // Temporary: remove after the command bar's runtime PrimaryControl shape is confirmed.
    function logPrimaryControlDiagnostics(primaryControl, argumentCount) {
        try {
            const type = typeof primaryControl;
            const isObject = primaryControl !== null && (type === "object" || type === "function");
            const relevantProperties = new Set();
            let current = isObject ? primaryControl : null;
            while (current && current !== Object.prototype) {
                for (const name of Object.getOwnPropertyNames(current)) {
                    if (/data|entity|form|attribute|context|control|id|save|refresh|ui/i.test(name)) {
                        relevantProperties.add(name);
                    }
                }
                current = Object.getPrototypeOf(current);
            }

            const data = isObject ? primaryControl.data : undefined;
            const entity = data && data.entity;
            console.log("[GSIC.InterpreterForm] PrimaryControl received (expand in DevTools):", primaryControl);
            console.log("[GSIC.InterpreterForm] PrimaryControl snapshot:", {
                argumentCount,
                type,
                relevantProperties: Array.from(relevantProperties).sort(),
                dataExists: data != null,
                entityExists: entity != null,
                getFormContext: isObject ? typeof primaryControl.getFormContext : "undefined",
                getAttribute: isObject ? typeof primaryControl.getAttribute : "undefined",
                entityGetId: entity ? typeof entity.getId : "undefined",
                dataSave: data ? typeof data.save : "undefined",
                dataRefresh: data ? typeof data.refresh : "undefined"
            });
        } catch (error) {
            logError("Could not inspect the PrimaryControl argument.", error);
        }
    }

    async function showMessage(message) {
        try {
            await global.Xrm.Navigation.openAlertDialog({ text: message });
        } catch (error) {
            logError("Could not show the Registry message.", error);
        }
    }

    InterpreterForm.addToRegistry = async function (primaryControl) {
        logPrimaryControlDiagnostics(primaryControl, arguments.length);
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
            if (!formContext || typeof formContext.getAttribute !== "function" || !formContext.data ||
                !formContext.data.entity || typeof formContext.data.entity.getId !== "function") {
                throw new Error("Interpreter form context is unavailable. Pass PrimaryControl to this command.");
            }
            const recordId = formContext.data.entity.getId();
            if (!recordId ||
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
