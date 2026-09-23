(function (global) {
    "use strict";

    const LOOKUP_COLUMN_NAME = "gsic_interpreterlanguage";
    const INTERPRETER_LANGUAGE_TABLE_NAME = "gsic_interpreterlanguage";
    const LANGUAGE_CATEGORY_COLUMN_NAME = "gsic_languagecategory";

    // These are section internal names from the Test Result Main form, not labels.
    const BILINGUAL_SECTION_NAME = "Bilingual Scores";
    const ENGLISH_FIRST_NATIONS_SECTION_NAME = "English / First Nations";

    // Verified against the Interpreter Language Choice metadata in this environment.
    const LANGUAGE_CATEGORY = Object.freeze({
        BILINGUAL: 472540000,
        ENGLISH: 472540001,
        FIRST_NATION: 472540002
    });

    const requestVersions = new WeakMap();
    const GSIC = global.GSIC = global.GSIC || {};
    const TestResultForm = GSIC.TestResultForm = GSIC.TestResultForm || {};

    function logError(message, error) {
        console.error("[GSIC.TestResultForm] " + message, error || "");
    }

    function findSection(formContext, sectionName) {
        let match = null;

        formContext.ui.tabs.forEach(function (tab) {
            if (!match) {
                match = tab.sections.get(sectionName);
            }
        });

        return match;
    }

    function getSections(formContext) {
        const bilingual = findSection(formContext, BILINGUAL_SECTION_NAME);
        const englishFirstNations = findSection(formContext, ENGLISH_FIRST_NATIONS_SECTION_NAME);

        if (!bilingual || !englishFirstNations) {
            logError("One or both section internal names were not found on this form.", {
                bilingualSection: BILINGUAL_SECTION_NAME,
                englishFirstNationsSection: ENGLISH_FIRST_NATIONS_SECTION_NAME
            });
            return null;
        }

        return { bilingual: bilingual, englishFirstNations: englishFirstNations };
    }

    function setSectionVisibility(sections, showBilingual, showEnglishFirstNations) {
        if (!sections) {
            return;
        }

        try {
            sections.bilingual.setVisible(showBilingual);
            sections.englishFirstNations.setVisible(showEnglishFirstNations);
        } catch (error) {
            logError("Could not update score section visibility.", error);
        }
    }

    function selectedLanguage(lookupAttribute) {
        const value = lookupAttribute.getValue();
        return value && value.length ? value[0] : null;
    }

    function normalizedId(lookup) {
        return lookup && lookup.id ? lookup.id.replace(/[{}]/g, "").toLowerCase() : null;
    }

    function updateSections(formContext) {
        const sections = getSections(formContext);
        const lookupAttribute = formContext.getAttribute(LOOKUP_COLUMN_NAME);

        if (!lookupAttribute) {
            logError("Interpreter Language lookup is not present on the Test Result form.");
            setSectionVisibility(sections, true, true);
            return;
        }

        // Each change invalidates any earlier retrieval, including a lookup being cleared.
        const requestVersion = (requestVersions.get(lookupAttribute) || 0) + 1;
        requestVersions.set(lookupAttribute, requestVersion);

        const lookup = selectedLanguage(lookupAttribute);
        const languageId = normalizedId(lookup);

        // Keep both score groups available while the category is unknown or loading.
        setSectionVisibility(sections, true, true);

        if (!languageId) {
            return;
        }

        if (lookup.entityType && lookup.entityType.toLowerCase() !== INTERPRETER_LANGUAGE_TABLE_NAME) {
            logError("The lookup points to an unexpected table: " + lookup.entityType);
            return;
        }

        function isCurrentRequest() {
            try {
                return requestVersions.get(lookupAttribute) === requestVersion &&
                    normalizedId(selectedLanguage(lookupAttribute)) === languageId;
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

                switch (record[LANGUAGE_CATEGORY_COLUMN_NAME]) {
                    case LANGUAGE_CATEGORY.BILINGUAL:
                        setSectionVisibility(sections, true, false);
                        break;
                    case LANGUAGE_CATEGORY.ENGLISH:
                    case LANGUAGE_CATEGORY.FIRST_NATION:
                        setSectionVisibility(sections, false, true);
                        break;
                    default:
                        if (record[LANGUAGE_CATEGORY_COLUMN_NAME] != null) {
                            console.warn(
                                "[GSIC.TestResultForm] Unknown Language Category value:",
                                record[LANGUAGE_CATEGORY_COLUMN_NAME]
                            );
                        }
                        setSectionVisibility(sections, true, true);
                        break;
                }
            }).catch(function (error) {
                if (isCurrentRequest()) {
                    logError("Could not retrieve the Interpreter Language category.", error);
                    setSectionVisibility(sections, true, true);
                }
            });
        } catch (error) {
            if (isCurrentRequest()) {
                logError("Could not start the Interpreter Language retrieval.", error);
                setSectionVisibility(sections, true, true);
            }
        }
    }

    TestResultForm.onLoad = function (executionContext) {
        try {
            const formContext = executionContext.getFormContext();
            const lookupAttribute = formContext.getAttribute(LOOKUP_COLUMN_NAME);

            if (lookupAttribute) {
                // Repeated form loads should leave exactly one script-registered handler.
                lookupAttribute.removeOnChange(TestResultForm.onInterpreterLanguageChange);
                lookupAttribute.addOnChange(TestResultForm.onInterpreterLanguageChange);
            }

            updateSections(formContext);
        } catch (error) {
            logError("Could not initialize the Test Result form.", error);
        }
    };

    TestResultForm.onInterpreterLanguageChange = function (executionContext) {
        try {
            updateSections(executionContext.getFormContext());
        } catch (error) {
            logError("Could not update the Test Result score sections.", error);
        }
    };
})(window);
