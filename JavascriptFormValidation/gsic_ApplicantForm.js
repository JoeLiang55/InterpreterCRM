(function (global) {
    "use strict";

    const FIRST_NAME_COLUMN_NAME = "gsic_firstname";
    const LAST_NAME_COLUMN_NAME = "gsic_lastname";
    // Verified Applicant primary-name schema: gsic_ApplicantName
    const APPLICANT_NAME_COLUMN_NAME = "gsic_applicantname";

    const GSIC = global.GSIC = global.GSIC || {};
    const ApplicantForm = GSIC.ApplicantForm = GSIC.ApplicantForm || {};

    function logError(message, error) {
        console.error("[GSIC.ApplicantForm] " + message, error || "");
    }

    function readNamePart(formContext, columnName) {
        const attribute = formContext.getAttribute(columnName);
        if (!attribute || typeof attribute.getValue !== "function") {
            return "";
        }

        const value = attribute.getValue();
        return value == null ? "" : String(value).trim();
    }

    function updateApplicantName(formContext) {
        const applicantName = formContext.getAttribute(APPLICANT_NAME_COLUMN_NAME);
        if (!applicantName || typeof applicantName.setValue !== "function") {
            return;
        }

        const firstName = readNamePart(formContext, FIRST_NAME_COLUMN_NAME);
        const lastName = readNamePart(formContext, LAST_NAME_COLUMN_NAME);
        applicantName.setValue([firstName, lastName].filter(Boolean).join(" "));
    }

    ApplicantForm.onNameChange = function (executionContext) {
        try {
            const formContext = executionContext && executionContext.getFormContext();
            if (formContext && typeof formContext.getAttribute === "function") {
                updateApplicantName(formContext);
            }
        } catch (error) {
            logError("Could not update Applicant Name.", error);
        }
    };

    ApplicantForm.onLoad = function (executionContext) {
        try {
            const formContext = executionContext && executionContext.getFormContext();
            if (!formContext || typeof formContext.getAttribute !== "function") {
                return;
            }

            [FIRST_NAME_COLUMN_NAME, LAST_NAME_COLUMN_NAME].forEach(function (columnName) {
                const attribute = formContext.getAttribute(columnName);
                if (attribute && typeof attribute.addOnChange === "function") {
                    if (typeof attribute.removeOnChange === "function") {
                        attribute.removeOnChange(ApplicantForm.onNameChange);
                    }
                    attribute.addOnChange(ApplicantForm.onNameChange);
                }
            });

            const applicantName = formContext.getAttribute(APPLICANT_NAME_COLUMN_NAME);
            if (applicantName && applicantName.controls && typeof applicantName.controls.forEach === "function") {
                applicantName.controls.forEach(function (control) {
                    if (control && typeof control.setDisabled === "function") {
                        control.setDisabled(true);
                    }
                });
            }

            updateApplicantName(formContext);
        } catch (error) {
            logError("Could not initialize the Applicant form.", error);
        }
    };
})(window);
