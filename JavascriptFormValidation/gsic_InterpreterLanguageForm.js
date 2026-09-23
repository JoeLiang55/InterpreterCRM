(function (global) {
    "use strict";

    const LANGUAGE_CATEGORY_COLUMN_NAME = "gsic_languagecategory";
    const BILINGUAL_SECTION_NAME = "Bilingual Best Scores";
    const ENGLISH_FIRST_NATION_SECTION_NAME = "English / First Nation Best Scores";

    const LANGUAGE_CATEGORY = Object.freeze({
        BILINGUAL: 472540000,
        ENGLISH: 472540001,
        FIRST_NATION: 472540002
    });

    const GSIC = global.GSIC = global.GSIC || {};
    const InterpreterLanguageForm = GSIC.InterpreterLanguageForm = GSIC.InterpreterLanguageForm || {};

    function logError(message, error) {
        console.error("[GSIC.InterpreterLanguageForm] " + message, error || "");
    }

    function findSection(formContext, sectionName) {
        let match = null;

        formContext.ui.tabs.forEach(function (tab) {
            if (match) {
                return;
            }

            match = tab.sections.get(sectionName);
            if (!match) {
                tab.sections.forEach(function (section) {
                    if (!match && section.getLabel() === sectionName) {
                        match = section;
                    }
                });
            }
        });

        return match;
    }

    function getSections(formContext) {
        const bilingual = findSection(formContext, BILINGUAL_SECTION_NAME);
        const englishFirstNation = findSection(formContext, ENGLISH_FIRST_NATION_SECTION_NAME);

        if (!bilingual || !englishFirstNation) {
            logError("One or both Best Score sections were not found on this form.", {
                bilingualSection: BILINGUAL_SECTION_NAME,
                englishFirstNationSection: ENGLISH_FIRST_NATION_SECTION_NAME
            });
            return null;
        }

        return { bilingual: bilingual, englishFirstNation: englishFirstNation };
    }

    function updateSections(formContext) {
        const sections = getSections(formContext);
        const categoryAttribute = formContext.getAttribute(LANGUAGE_CATEGORY_COLUMN_NAME);

        if (!categoryAttribute) {
            logError("Language Category is not present on the Interpreter Language form.");
            if (sections) {
                sections.bilingual.setVisible(true);
                sections.englishFirstNation.setVisible(true);
            }
            return;
        }

        if (!sections) {
            return;
        }

        switch (categoryAttribute.getValue()) {
            case LANGUAGE_CATEGORY.BILINGUAL:
                sections.bilingual.setVisible(true);
                sections.englishFirstNation.setVisible(false);
                break;
            case LANGUAGE_CATEGORY.ENGLISH:
            case LANGUAGE_CATEGORY.FIRST_NATION:
                sections.bilingual.setVisible(false);
                sections.englishFirstNation.setVisible(true);
                break;
            default:
                sections.bilingual.setVisible(true);
                sections.englishFirstNation.setVisible(true);
                break;
        }
    }

    InterpreterLanguageForm.onLoad = function (executionContext) {
        try {
            const formContext = executionContext.getFormContext();
            const categoryAttribute = formContext.getAttribute(LANGUAGE_CATEGORY_COLUMN_NAME);

            if (categoryAttribute) {
                // Repeated form loads should leave exactly one script-registered handler.
                categoryAttribute.removeOnChange(InterpreterLanguageForm.onLanguageCategoryChange);
                categoryAttribute.addOnChange(InterpreterLanguageForm.onLanguageCategoryChange);
            }

            updateSections(formContext);
        } catch (error) {
            logError("Could not initialize the Interpreter Language form.", error);
        }
    };

    InterpreterLanguageForm.onLanguageCategoryChange = function (executionContext) {
        try {
            updateSections(executionContext.getFormContext());
        } catch (error) {
            logError("Could not update the Best Score sections.", error);
        }
    };
})(window);
