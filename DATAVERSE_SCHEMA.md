# Verified Dataverse schema

## Applicant name fields

The Applicant primary-name schema name is recorded as `gsic_ApplicantName` in the verified conversion metadata and deployment notes; its logical name used by Dataverse APIs and form JavaScript is `gsic_applicantname`. The split-name fields requested for addition are:

| Display name | Schema name | Logical name | Type |
| --- | --- | --- | --- |
| First Name | `gsic_firstname` | `gsic_firstname` | Single line of text |
| Last Name | `gsic_lastname` | `gsic_lastname` | Single line of text |

`Applicant Name` remains the primary-name column. The Applicant form web resource in `JavascriptFormValidation/gsic_ApplicantForm.js` combines the trimmed nonblank name parts into that column on either field's change and disables its form controls. This repository does not contain the Applicant form or Active Applicants view definition, so those app components still need to be updated in the Dataverse solution as described in `DEPLOYMENT.md`.

## Interpreter Language

The following values were manually verified on the `gsic_interpreterlanguage` table's Columns page in Dataverse. The names and casing below are authoritative.

| Item | Verified value |
| --- | --- |
| Table logical name | `gsic_interpreterlanguage` |
| Primary ID | `gsic_InterpreterLanguageId` |
| Primary Name | `gsic_LanguageName` |
| Interpreter lookup | `gsic_Interpreter` |
| Language Category | `gsic_LanguageCategory` |
| Language Code | `gsic_LanguageCode` |
| Accreditation Status | `gsic_AccreditationStatus` |

## Event Attendee form

The Event Attendee table logical name is `gsic_eventattendee`. The existing lookup names below were manually verified. The confirmation and testing columns below were checked against live CustomerService Trial Dataverse metadata on 2026-09-29 using the Power Platform CLI model builder and attribute metadata.

| Item | Verified value |
| --- | --- |
| Interpreter Profile lookup to `gsic_interpreter` | `gsic_InterpreterProfile` |
| Old/incorrect Interpreter lookup to Interpreter Language (do not use in the form script) | `gsic_Interpreter` |
| Interpreter Language lookup | `gsic_InterpreterLanguage` |
| Language Type | `gsic_LanguageType` |

| Display name | Logical name | Dataverse type |
| --- | --- | --- |
| Confirmed | `gsic_confirmed` | Yes/No (Boolean) |
| Attended | `gsic_attended` | Yes/No (Boolean) |
| Comments | `gsic_comments` | Text (string) |
| Test Portions Required | `gsic_testportionsrequired` | Multiple lines of text (Memo) |
| Test Version | `gsic_testversion` | Single line of text (String) |
| Confirmation Method | `gsic_confirmationmethod` | Choice (Picklist) |
| Confirmation Date | `gsic_confirmationdate` | Date and time (DateTime; display format not verified) |

The Interpreter Language lookup targets `gsic_interpreterlanguage`. Its `gsic_Interpreter` lookup links each language to an Interpreter, and its `gsic_LanguageCategory` Choice supplies the Event Attendee Language Type value.

## Interpreter Registry fields

The Interpreter Registry fields were verified on the `gsic_interpreter` table.

| Item | Verified logical name | Type |
| --- | --- | --- |
| In Registry | `gsic_inregistry` | Yes/No |
| Registry Date Added | `gsic_registrydateadded` | Date Only |

## Interpreter qualification and clearance fields

The columns below are on `gsic_interpreter`. Their exact logical names were checked against live Dataverse table metadata in the CustomerService Trial environment. The types are from the Interpreter Columns screen and are consistent with the generated metadata's Boolean, DateTime, and string properties. Dataverse schema names shown in Power Apps use PascalCase after `gsic_`; the logical names used by form scripts are lowercase.

| Display name | Logical name | Dataverse type |
| --- | --- | --- |
| Accessibility Course Completed | `gsic_accessibilitycoursecompleted` | Yes/No |
| Accessibility Training Details | `gsic_accessibilitytrainingdetails` | Multiple lines of text |
| Clearance Date | `gsic_clearancedate` | Date only |
| Comments on File | `gsic_commentsonfile` | Multiple lines of text |
| Consent to Share Qualification | `gsic_consenttosharequalification` | Yes/No |
| Date Consent Provided | `gsic_dateconsentprovided` | Date only |
| English Proficiency Test | `gsic_englishproficiencytest` | Yes/No |
| ID Card Expiry Date | `gsic_idcardexpirydate` | Date only |
| Latest Verification | `gsic_latestverification` | Date only |
| MAG Contract | `gsic_magcontract` | Yes/No |
| Notes Appearing on Registry | `gsic_notesappearingonregistry` | Multiple lines of text |
| Re-training | `gsic_retraining` | Yes/No |
| Re-training Date | `gsic_retrainingdate` | Date only |
| Security Clearance | `gsic_securityclearance` | Yes/No |
| Self Reported Dialects | `gsic_selfreporteddialects` | Single line of text |
| Test Completed | `gsic_testcompleted` | Yes/No |
| Test Preparation | `gsic_testpreparation` | Yes/No |
| Test Preparation Date | `gsic_testpreparationdate` | Date only |
| Training | `gsic_training` | Yes/No |
| Training Date | `gsic_trainingdate` | Date only |
