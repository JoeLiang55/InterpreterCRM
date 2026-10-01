(function (global) {
    "use strict";

    const GSIC = global.GSIC = global.GSIC || {};
    const InterpreterLanguageGrid = GSIC.InterpreterLanguageGrid = GSIC.InterpreterLanguageGrid || {};
    const LANGUAGE_TABLE = "gsic_interpreterlanguage";
    const TEST_RESULT_TABLE = "gsic_testresult";
    const pendingGrids = new WeakSet();

    function normalizedId(value) {
        if (typeof value !== "string") {
            return null;
        }
        const id = value.replace(/[{}]/g, "").trim();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
            ? id.toLowerCase() : null;
    }

    function selectedLanguage(references) {
        if (!Array.isArray(references) || references.length !== 1 || !references[0]) {
            return null;
        }
        const reference = references[0];
        // Classic command references use Id/TypeName/Name. Navigation uses id/entityType/name.
        const entityType = reference.TypeName || reference.entityType;
        const id = normalizedId(reference.Id || reference.id);
        if (!id || typeof entityType !== "string" || entityType.toLowerCase() !== LANGUAGE_TABLE) {
            return null;
        }
        return { id: id, name: reference.Name || reference.name };
    }

    function isLanguageGrid(control) {
        return control && typeof control.getEntityName === "function" &&
            control.getEntityName() === LANGUAGE_TABLE && typeof control.refresh === "function";
    }

    function logError(message, error) {
        console.error("[GSIC.InterpreterLanguageGrid] " + message, error || "");
    }

    async function showMessage(message, error) {
        try {
            if (error) {
                await global.Xrm.Navigation.openErrorDialog({
                    message: message,
                    details: error.message || String(error)
                });
            } else {
                await global.Xrm.Navigation.openAlertDialog({ text: message });
            }
        } catch (dialogError) {
            logError(message, dialogError);
        }
    }

    function refreshCommandState(control) {
        try {
            if (typeof control.refreshRibbon === "function") {
                control.refreshRibbon();
            }
        } catch (error) {
            logError("Could not refresh the Add Test Result command state.", error);
        }
    }

    InterpreterLanguageGrid.canAddTestResult = function (selectedControl, selectedItemReferences) {
        try {
            return Boolean(isLanguageGrid(selectedControl) && selectedLanguage(selectedItemReferences) &&
                !pendingGrids.has(selectedControl));
        } catch (error) {
            return false;
        }
    };

    // Command arguments, in order: SelectedControl, SelectedControlSelectedItemReferences,
    // and a StringParameter containing the verified Test Result main-form GUID.
    InterpreterLanguageGrid.addTestResult = async function (
        selectedControl, selectedItemReferences, testResultFormId
    ) {
        let ownsPending = false;
        let saved = false;
        try {
            if (!isLanguageGrid(selectedControl)) {
                await showMessage("Run Add Test Result from an Interpreter Language grid.");
                return;
            }
            const language = selectedLanguage(selectedItemReferences);
            if (!language) {
                await showMessage("Select exactly one Interpreter Language record.");
                return;
            }
            if (pendingGrids.has(selectedControl)) {
                return;
            }
            const formId = normalizedId(testResultFormId);
            if (!formId) {
                await showMessage("Configure Add Test Result with the verified Test Result main-form ID.");
                return;
            }
            if (!global.Xrm || !global.Xrm.Navigation ||
                typeof global.Xrm.Navigation.navigateTo !== "function") {
                throw new Error("Xrm.Navigation.navigateTo is unavailable.");
            }

            pendingGrids.add(selectedControl);
            ownsPending = true;
            refreshCommandState(selectedControl);

            let languageName = language.name;
            if (typeof languageName !== "string" || !languageName.trim()) {
                const record = await global.Xrm.WebApi.retrieveRecord(
                    LANGUAGE_TABLE, language.id, "?$select=gsic_languagename"
                );
                languageName = record.gsic_languagename;
                if (typeof languageName !== "string" || !languageName.trim()) {
                    throw new Error("The selected Interpreter Language has no display name.");
                }
            }

            const result = await global.Xrm.Navigation.navigateTo(
                {
                    pageType: "entityrecord",
                    entityName: TEST_RESULT_TABLE,
                    formId: formId,
                    // Omitting entityId opens an unsaved Test Result in create mode.
                    data: {
                        gsic_interpreterlanguage: language.id,
                        gsic_interpreterlanguagename: languageName
                    }
                },
                {
                    target: 2,
                    position: 1,
                    width: { value: 80, unit: "%" },
                    height: { value: 80, unit: "%" },
                    title: "Add Test Result"
                }
            );

            // Closing without saving has no created record reference.
            if (!result || !Array.isArray(result.savedEntityReference) ||
                result.savedEntityReference.length === 0) {
                return;
            }
            saved = true;
            // Refresh the originating control, even if selection changed while the dialog was open.
            // The platform owns nested-row expansion; there is no documented expansion restore API.
            await selectedControl.refresh();
        } catch (error) {
            const message = saved
                ? "The Test Result was saved, but the language grid could not refresh. Refresh the grid manually."
                : "Could not open Add Test Result.";
            logError(message, error);
            await showMessage(message, error);
        } finally {
            if (ownsPending) {
                pendingGrids.delete(selectedControl);
                refreshCommandState(selectedControl);
            }
        }
    };

    InterpreterLanguageGrid.onRecordSelect = async function (executionContext) {
        try {
            if (!executionContext || typeof executionContext.getEventSource !== "function") {
                return;
            }

            // OnRecordSelect supplies the selected row's entity as its event source.
            const selectedEntity = executionContext.getEventSource();
            if (!selectedEntity || typeof selectedEntity.getEntityName !== "function" ||
                typeof selectedEntity.getId !== "function") {
                return;
            }

            const entityName = selectedEntity.getEntityName();
            const rawId = selectedEntity.getId();
            if (typeof entityName !== "string" || !entityName.trim() || typeof rawId !== "string") {
                return;
            }

            const entityId = rawId.replace(/[{}]/g, "").trim();
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) {
                return;
            }

            if (!global.Xrm || !global.Xrm.Navigation ||
                typeof global.Xrm.Navigation.navigateTo !== "function") {
                logError("Xrm.Navigation.navigateTo is unavailable.");
                return;
            }

            await global.Xrm.Navigation.navigateTo(
                {
                    pageType: "entityrecord",
                    entityName: entityName.trim(),
                    entityId: entityId
                },
                {
                    target: 2,
                    position: 1,
                    width: { value: 80, unit: "%" },
                    height: { value: 80, unit: "%" }
                }
            );
        } catch (error) {
            logError("Could not open the Interpreter Language dialog.", error);
        }
    };
})(window);
