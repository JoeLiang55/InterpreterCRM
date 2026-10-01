(function (global) {
    "use strict";

    const GSIC = global.GSIC = global.GSIC || {};
    const InterpreterLanguageGrid = GSIC.InterpreterLanguageGrid = GSIC.InterpreterLanguageGrid || {};

    function logError(message, error) {
        console.error("[GSIC.InterpreterLanguageGrid] " + message, error || "");
    }

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
