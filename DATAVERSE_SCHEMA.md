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

The following Event Attendee form column names were supplied as authoritative for the form script. The Event Attendee table logical name was not supplied.

| Item | Verified value |
| --- | --- |
| Interpreter lookup | `gsic_Interpreter` |
| Interpreter Language lookup | `gsic_InterpreterLanguage` |
| Language Type | `gsic_LanguageType` |

The Interpreter Language lookup targets `gsic_interpreterlanguage`. Its `gsic_Interpreter` lookup links each language to an Interpreter, and its `gsic_LanguageCategory` Choice supplies the Event Attendee Language Type value.
