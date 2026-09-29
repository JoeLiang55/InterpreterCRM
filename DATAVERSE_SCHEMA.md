# Verified Dataverse schema

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

The following Event Attendee columns were manually verified. The Event Attendee table logical name was not supplied.

| Item | Verified value |
| --- | --- |
| Interpreter Profile lookup to `gsic_interpreter` | `gsic_InterpreterProfile` |
| Old/incorrect Interpreter lookup to Interpreter Language (do not use in the form script) | `gsic_Interpreter` |
| Interpreter Language lookup | `gsic_InterpreterLanguage` |
| Language Type | `gsic_LanguageType` |

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
