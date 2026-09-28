(function (global) {
    "use strict";

    const COLUMNS = Object.freeze({
        INTERPRETER: "gsic_interpreter",
        LANGUAGE: "gsic_interpreterlanguage",
        COMPLAINT_NOTIFICATION: "gsic_complaintnotification",
        COMPLAINT_NOTIFICATION_DATE_SENT: "gsic_complaintnotificationdatesent",
        COMPLAINT_NOTIFICATION_TRACKING_NUMBER: "gsic_complaintnotificationtrackingnumber",
        RESPONSE_RECEIVED: "gsic_responsereceived",
        RESPONSE_DATE_RECEIVED: "gsic_responsedatereceived"
    });
    const INTERPRETER_LANGUAGE_TABLE_NAME = "gsic_interpreterlanguage";
    // Verified Interpreter lookup on Interpreter Language in DATAVERSE_SCHEMA.md (git history).
    const INTERPRETER_LANGUAGE_INTERPRETER_COLUMN_NAME = "gsic_interpreter";

    const GSIC = global.GSIC = global.GSIC || {};
    const ComplaintForm = GSIC.ComplaintForm = GSIC.ComplaintForm || {};

    function logError(message, error) {
        console.error("[GSIC.ComplaintForm] " + message, error || "");
    }

    function selectedLookup(attribute) {
        const value = attribute && attribute.getValue();
        return value && value.length ? value[0] : null;
    }

    function normalizedId(lookup) {
        if (!lookup || !lookup.id) {
            return null;
        }

        const id = lookup.id.replace(/[{}]/g, "").toLowerCase();
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : null;
    }

    function setAttributeDisabled(formContext, columnName, disabled) {
        const attribute = formContext.getAttribute(columnName);
        if (attribute && attribute.controls) {
            attribute.controls.forEach(function (control) {
                if (control) {
                    control.setDisabled(disabled);
                }
            });
        }
    }

    function updateLanguageAvailability(formContext) {
        const interpreterId = normalizedId(selectedLookup(formContext.getAttribute(COLUMNS.INTERPRETER)));
        const languageAttribute = formContext.getAttribute(COLUMNS.LANGUAGE);
        if (!languageAttribute) {
            return;
        }

        // A saved Language without an Interpreter cannot remain selectable on this form.
        if (!interpreterId && languageAttribute.getValue()) {
            languageAttribute.setValue(null);
        }
        setAttributeDisabled(formContext, COLUMNS.LANGUAGE, !interpreterId);
    }

    function updateComplaintNotification(formContext) {
        const attribute = formContext.getAttribute(COLUMNS.COMPLAINT_NOTIFICATION);
        const enabled = !!(attribute && attribute.getValue() === true);
        setAttributeDisabled(formContext, COLUMNS.COMPLAINT_NOTIFICATION_DATE_SENT, !enabled);
        setAttributeDisabled(formContext, COLUMNS.COMPLAINT_NOTIFICATION_TRACKING_NUMBER, !enabled);
    }

    function updateInterpreterResponse(formContext) {
        const attribute = formContext.getAttribute(COLUMNS.RESPONSE_RECEIVED);
        const enabled = !!(attribute && attribute.getValue() === true);
        setAttributeDisabled(formContext, COLUMNS.RESPONSE_DATE_RECEIVED, !enabled);
    }

    function registerOnChange(attribute, handler) {
        if (attribute) {
            attribute.removeOnChange(handler);
            attribute.addOnChange(handler);
        }
    }

    ComplaintForm.onLanguagePreSearch = function (executionContext) {
        try {
            const formContext = executionContext.getFormContext();
            const control = executionContext.getEventSource();
            const interpreterId = normalizedId(selectedLookup(formContext.getAttribute(COLUMNS.INTERPRETER)));

            if (!control || !interpreterId) {
                return;
            }

            const filter = "<filter type='and'><condition attribute='" +
                INTERPRETER_LANGUAGE_INTERPRETER_COLUMN_NAME + "' operator='eq' value='" +
                interpreterId + "' /></filter>";
            control.addCustomFilter(filter, INTERPRETER_LANGUAGE_TABLE_NAME);
        } catch (error) {
            logError("Could not filter the Language lookup.", error);
        }
    };

    ComplaintForm.onLoad = function (executionContext) {
        try {
            const formContext = executionContext.getFormContext();
            registerOnChange(formContext.getAttribute(COLUMNS.INTERPRETER), ComplaintForm.onInterpreterChange);
            registerOnChange(formContext.getAttribute(COLUMNS.COMPLAINT_NOTIFICATION), ComplaintForm.onComplaintNotificationChange);
            registerOnChange(formContext.getAttribute(COLUMNS.RESPONSE_RECEIVED), ComplaintForm.onResponseReceivedChange);

            const languageAttribute = formContext.getAttribute(COLUMNS.LANGUAGE);
            if (languageAttribute && languageAttribute.controls) {
                languageAttribute.controls.forEach(function (control) {
                    if (control) {
                        control.removePreSearch(ComplaintForm.onLanguagePreSearch);
                        control.addPreSearch(ComplaintForm.onLanguagePreSearch);
                    }
                });
            }

            updateLanguageAvailability(formContext);
            updateComplaintNotification(formContext);
            updateInterpreterResponse(formContext);
        } catch (error) {
            logError("Could not initialize the Complaint form.", error);
        }
    };

    ComplaintForm.onInterpreterChange = function (executionContext) {
        try {
            const formContext = executionContext.getFormContext();
            const languageAttribute = formContext.getAttribute(COLUMNS.LANGUAGE);
            if (languageAttribute && languageAttribute.getValue()) {
                languageAttribute.setValue(null);
            }
            updateLanguageAvailability(formContext);
        } catch (error) {
            logError("Could not update Language after Interpreter changed.", error);
        }
    };

    ComplaintForm.onComplaintNotificationChange = function (executionContext) {
        try {
            updateComplaintNotification(executionContext.getFormContext());
        } catch (error) {
            logError("Could not update Complaint Notification fields.", error);
        }
    };

    ComplaintForm.onResponseReceivedChange = function (executionContext) {
        try {
            updateInterpreterResponse(executionContext.getFormContext());
        } catch (error) {
            logError("Could not update Response Date Received.", error);
        }
    };
})(window);
