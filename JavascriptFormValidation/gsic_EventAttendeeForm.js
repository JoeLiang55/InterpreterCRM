(function (global) {
    "use strict";

    const INTERPRETER_PROFILE_COLUMN_NAME = "gsic_interpreterprofile";
    const INTERPRETER_LANGUAGE_COLUMN_NAME = "gsic_interpreterlanguage";
    const LANGUAGE_TYPE_COLUMN_NAME = "gsic_languagetype";
    const INTERPRETER_LANGUAGE_TABLE_NAME = "gsic_interpreterlanguage";
    // FetchXML uses the lookup's logical name, not its capitalized schema name.
    const INTERPRETER_LANGUAGE_INTERPRETER_COLUMN_NAME = "gsic_interpreter";
    const LANGUAGE_CATEGORY_COLUMN_NAME = "gsic_languagecategory";
    const CONFIRMED_COLUMN_NAME = "gsic_confirmed";
    const CONFIRMATION_METHOD_COLUMN_NAME = "gsic_confirmationmethod";
    const CONFIRMATION_DATE_COLUMN_NAME = "gsic_confirmationdate";

    const requestVersions = new WeakMap();
    const GSIC = global.GSIC = global.GSIC || {};
    const EventAttendeeForm = GSIC.EventAttendeeForm = GSIC.EventAttendeeForm || {};

    function logError(message, error) {
        console.error("[GSIC.EventAttendeeForm] " + message, error || "");
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

    function setLanguageType(formContext, value) {
        const attribute = formContext.getAttribute(LANGUAGE_TYPE_COLUMN_NAME);
        if (!attribute) {
            logError("Language Type is not present on the Event Attendee form.");
            return;
        }

        if (attribute.getValue() !== value) {
            attribute.setValue(value);
        }
    }

    function updateLanguageLookupAvailability(formContext) {
        const languageAttribute = formContext.getAttribute(INTERPRETER_LANGUAGE_COLUMN_NAME);
        if (!languageAttribute) {
            return;
        }

        const hasInterpreter = !!normalizedId(selectedLookup(formContext.getAttribute(INTERPRETER_PROFILE_COLUMN_NAME)));
        languageAttribute.controls.forEach(function (control) {
            control.setDisabled(!hasInterpreter);
        });
    }

    function setAttributeDisabled(formContext, columnName, disabled) {
        const attribute = formContext.getAttribute(columnName);
        if (attribute && attribute.controls && typeof attribute.controls.forEach === "function") {
            attribute.controls.forEach(function (control) {
                if (control && typeof control.setDisabled === "function") {
                    control.setDisabled(disabled);
                }
            });
        }
    }

    function updateConfirmationAvailability(formContext) {
        const confirmedAttribute = formContext.getAttribute(CONFIRMED_COLUMN_NAME);
        const enabled = !!(confirmedAttribute && confirmedAttribute.getValue() === true);
        setAttributeDisabled(formContext, CONFIRMATION_METHOD_COLUMN_NAME, !enabled);
        setAttributeDisabled(formContext, CONFIRMATION_DATE_COLUMN_NAME, !enabled);
    }

    function refreshLanguageType(formContext, clearBeforeRetrieval) {
        const languageAttribute = formContext.getAttribute(INTERPRETER_LANGUAGE_COLUMN_NAME);
        if (!languageAttribute) {
            logError("Interpreter Language is not present on the Event Attendee form.");
            return;
        }

        // A changed or cleared lookup invalidates every earlier request, including a request for the same record.
        const requestVersion = (requestVersions.get(languageAttribute) || 0) + 1;
        requestVersions.set(languageAttribute, requestVersion);

        const language = selectedLookup(languageAttribute);
        const languageId = normalizedId(language);
        if (!languageId) {
            setLanguageType(formContext, null);
            return;
        }

        if (clearBeforeRetrieval) {
            setLanguageType(formContext, null);
        }

        if (language.entityType && language.entityType.toLowerCase() !== INTERPRETER_LANGUAGE_TABLE_NAME) {
            logError("The Interpreter Language lookup points to an unexpected table: " + language.entityType);
            return;
        }

        const interpreterId = normalizedId(selectedLookup(formContext.getAttribute(INTERPRETER_PROFILE_COLUMN_NAME)));
        function isCurrentRequest() {
            try {
                return requestVersions.get(languageAttribute) === requestVersion &&
                    normalizedId(selectedLookup(languageAttribute)) === languageId &&
                    normalizedId(selectedLookup(formContext.getAttribute(INTERPRETER_PROFILE_COLUMN_NAME))) === interpreterId;
            } catch (error) {
                // The user may have navigated away before the request finished.
                return false;
            }
        }

        try {
            Xrm.WebApi.retrieveRecord(
                INTERPRETER_LANGUAGE_TABLE_NAME,
                languageId,
                "?$select=" + LANGUAGE_CATEGORY_COLUMN_NAME
            ).then(function (record) {
                if (!isCurrentRequest()) {
                    return;
                }

                const category = record[LANGUAGE_CATEGORY_COLUMN_NAME];
                if (category == null || typeof category === "number") {
                    setLanguageType(formContext, category == null ? null : category);
                } else {
                    logError("Interpreter Language returned an invalid Language Category.", category);
                }
            }).catch(function (error) {
                if (isCurrentRequest()) {
                    logError("Could not retrieve the Interpreter Language category.", error);
                }
            });
        } catch (error) {
            if (isCurrentRequest()) {
                logError("Could not start the Interpreter Language retrieval.", error);
            }
        }
    }

    EventAttendeeForm.onInterpreterLanguagePreSearch = function (executionContext) {
        try {
            const formContext = executionContext.getFormContext();
            const control = executionContext.getEventSource();
            const interpreter = selectedLookup(formContext.getAttribute(INTERPRETER_PROFILE_COLUMN_NAME));
            const interpreterId = normalizedId(interpreter);

            // The lookup is disabled without an Interpreter. Do not add a no-match filter:
            // Dataverse combines custom filters with AND, so it can exclude later selections.
            if (!interpreterId) {
                control.setDisabled(true);
                console.debug("[GSIC.EventAttendeeForm] Interpreter Language filter skipped: no valid Interpreter ID.", {
                    selectedInterpreterId: interpreter && interpreter.id
                });
                return;
            }

            const filter = "<filter type='and'><condition attribute='" +
                INTERPRETER_LANGUAGE_INTERPRETER_COLUMN_NAME + "' operator='eq' value='" +
                interpreterId + "' /></filter>";

            console.debug("[GSIC.EventAttendeeForm] Interpreter Language lookup filter", {
                interpreterId: interpreterId,
                filterXml: filter,
                entityLogicalName: INTERPRETER_LANGUAGE_TABLE_NAME
            });
            control.addCustomFilter(filter, INTERPRETER_LANGUAGE_TABLE_NAME);
        } catch (error) {
            logError("Could not filter the Interpreter Language lookup.", error);
        }
    };

    EventAttendeeForm.onLoad = function (executionContext) {
        try {
            const formContext = executionContext.getFormContext();
            const interpreterAttribute = formContext.getAttribute(INTERPRETER_PROFILE_COLUMN_NAME);
            const languageAttribute = formContext.getAttribute(INTERPRETER_LANGUAGE_COLUMN_NAME);
            const languageTypeAttribute = formContext.getAttribute(LANGUAGE_TYPE_COLUMN_NAME);

            if (interpreterAttribute) {
                interpreterAttribute.removeOnChange(EventAttendeeForm.onInterpreterChange);
                interpreterAttribute.addOnChange(EventAttendeeForm.onInterpreterChange);
            } else {
                logError("Interpreter is not present on the Event Attendee form.");
            }

            if (languageAttribute) {
                languageAttribute.removeOnChange(EventAttendeeForm.onInterpreterLanguageChange);
                languageAttribute.addOnChange(EventAttendeeForm.onInterpreterLanguageChange);
                languageAttribute.controls.forEach(function (control) {
                    control.removePreSearch(EventAttendeeForm.onInterpreterLanguagePreSearch);
                    control.addPreSearch(EventAttendeeForm.onInterpreterLanguagePreSearch);
                });
                updateLanguageLookupAvailability(formContext);
            } else {
                logError("Interpreter Language is not present on the Event Attendee form.");
            }

            if (languageTypeAttribute) {
                languageTypeAttribute.controls.forEach(function (control) {
                    control.setDisabled(true);
                });
            } else {
                logError("Language Type is not present on the Event Attendee form.");
            }

            // Refresh a saved selection without running the destructive Interpreter OnChange path.
            if (languageAttribute) {
                refreshLanguageType(formContext, false);
            }

            const confirmedAttribute = formContext.getAttribute(CONFIRMED_COLUMN_NAME);
            if (confirmedAttribute) {
                confirmedAttribute.removeOnChange(EventAttendeeForm.onConfirmedChange);
                confirmedAttribute.addOnChange(EventAttendeeForm.onConfirmedChange);
            }
            updateConfirmationAvailability(formContext);
        } catch (error) {
            logError("Could not initialize the Event Attendee form.", error);
        }
    };

    EventAttendeeForm.onInterpreterChange = function (executionContext) {
        try {
            const formContext = executionContext.getFormContext();
            const languageAttribute = formContext.getAttribute(INTERPRETER_LANGUAGE_COLUMN_NAME);

            if (languageAttribute) {
                requestVersions.set(languageAttribute, (requestVersions.get(languageAttribute) || 0) + 1);
                languageAttribute.setValue(null);
            } else {
                logError("Interpreter Language is not present on the Event Attendee form.");
            }

            setLanguageType(formContext, null);
            updateLanguageLookupAvailability(formContext);
        } catch (error) {
            logError("Could not update Interpreter Language after Interpreter changed.", error);
        }
    };

    EventAttendeeForm.onInterpreterLanguageChange = function (executionContext) {
        try {
            refreshLanguageType(executionContext.getFormContext(), true);
        } catch (error) {
            logError("Could not update Language Type after Interpreter Language changed.", error);
        }
    };

    EventAttendeeForm.onConfirmedChange = function (executionContext) {
        try {
            updateConfirmationAvailability(executionContext.getFormContext());
        } catch (error) {
            logError("Could not update confirmation controls after Confirmed changed.", error);
        }
    };
})(window);
