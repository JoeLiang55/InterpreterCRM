# Complaint schema setup

Standalone .NET Framework 4.8 console tool using `ServiceClient` and the project's `IOrganizationService` SDK pattern. It reuses the Interpreter and Interpreter Language constants from `InterpreterCRM.Plugins/DataverseSchema.cs`. There was no existing standalone connection helper or unpacked solution to reuse. This tool does not deploy the plug-in assembly.

Repository evidence: Interpreter is `gsic_interpreter`; Interpreter Language is `gsic_interpreterlanguage`. The prefix is `gsic_`, and documented schema names such as `gsic_ApplicantName` use PascalCase after the prefix. Existing table schema casing is not recorded in the repo; the tool reads and logs it from the environment. Some older root deployment documentation calls these names placeholders, so runtime metadata checks are mandatory.

## Run

1. Build on Windows with the .NET SDK and .NET Framework 4.8 runtime:

   ```powershell
   dotnet build InterpreterCRM.sln --configuration Release --nologo
   dotnet test InterpreterCRM.sln --configuration Release --no-build --no-restore --nologo
   ```

2. Set `DATAVERSE_CONNECTION_STRING` through your local secret/configuration mechanism to a ServiceClient connection string for the intended environment. Set `DATAVERSE_SOLUTION_UNIQUE_NAME` to the **unique name**, not display name, of the existing unmanaged solution. No environment URL, credentials, or solution name is stored in source. The identity needs permission to read solution/publisher metadata, customize tables, add solution components, and publish. The tool rejects a managed solution or publisher prefix other than `gsic`.

3. Run:

   ```powershell
   & .\DataverseSchema\bin\Release\net48\InterpreterCRM.DataverseSchema.exe
   ```

   `--help` prints configuration guidance without connecting. Exit code 0 means success; 1 means failure. The connection string is never printed. Run one instance at a time.

SDK references: [ServiceClient connection strings](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/xrm-tooling/use-connection-strings-xrm-tooling-connect), [CreateEntityRequest](https://learn.microsoft.com/en-us/dotnet/api/microsoft.xrm.sdk.messages.createentityrequest?view=dataverse-sdk-latest).

## Schema created

Table schema name: **`gsic_Complaint`**; logical name: **`gsic_complaint`**; display names: **Complaint / Complaints**. Uses user/team ownership. Reference Number is the primary name column, entered manually. Dataverse supplies its normal system columns, including ID, ownership, state/status, and audit timestamps. Activities and notes are not enabled by this tool.

All 28 requested business columns are below. Their logical names are the lowercase form of the schema names. Text length is 200; Incident Summary length is 10,000. These are initial storage sizes, not validated business limits. Dates have both **Date Only format and Date Only behavior**, avoiding time zone conversion. Only Date Received is Business Required (`ApplicationRequired`); the others are optional. Business Required is Dataverse application metadata, not custom server validation. Yes/No columns use Yes = 1, No = 0, with the standard default No.

| Display name | Schema name | Type |
| --- | --- | --- |
| Reference Number | `gsic_ReferenceNumber` | Text, primary name, no autonumber |
| Interpreter | `gsic_Interpreter` | Lookup to `gsic_interpreter` |
| Language | `gsic_InterpreterLanguage` | Lookup to `gsic_interpreterlanguage` |
| Date Received | `gsic_DateReceived` | Date Only, required |
| Type | `gsic_Type` | Text; Complaint Type values unresolved |
| Court Location | `gsic_CourtLocation` | Text |
| Incident Date | `gsic_IncidentDate` | Date Only |
| Court Level | `gsic_CourtLevel` | Text; no confirmed project choice |
| Divorce Act Proceeding | `gsic_DivorceActProceeding` | Yes/No |
| Incident Summary | `gsic_IncidentSummary` | Multiline text |
| Complaint Notification | `gsic_ComplaintNotification` | Yes/No |
| Complaint Notification Date Sent | `gsic_ComplaintNotificationDateSent` | Date Only |
| Complaint Notification Tracking Number | `gsic_ComplaintNotificationTrackingNumber` | Text |
| Response Received | `gsic_ResponseReceived` | Yes/No |
| Response Date Received | `gsic_ResponseDateReceived` | Date Only |
| Result Notification | `gsic_ResultNotification` | Yes/No |
| No Response Required | `gsic_NoResponseRequired` | Yes/No |
| Result Notification Date Sent | `gsic_ResultNotificationDateSent` | Date Only |
| Result Notification Tracking Number | `gsic_ResultNotificationTrackingNumber` | Text |
| Contact By | `gsic_ContactBy` | Text; no confirmed project choice |
| Ordered | `gsic_Ordered` | Yes/No |
| Ordered Date Sent | `gsic_OrderedDateSent` | Date Only |
| Received | `gsic_Received` | Yes/No |
| Received Date | `gsic_ReceivedDate` | Date Only |
| Date Sent to Evaluator | `gsic_DateSentToEvaluator` | Date Only |
| Date Evaluation Received | `gsic_DateEvaluationReceived` | Date Only |
| Complaint Result | `gsic_ComplaintResult` | Local Choice |
| Date Resolved / Closed | `gsic_DateResolvedClosed` | Date Only |

Complaint Result starts with **Warning Letter**, **In-person Re-training**, and **Dismissed**, in that order. These are initial values only; **the client may provide additional values later**. New option integers use the target publisher's `customizationoptionvalueprefix * 10000`, plus 0, 1, and 2. With prefix 47254, this is 472540000–472540002. Existing options with matching English labels retain their current integers. Additional client options are preserved. Labels are English (LCID 1033); translations are not supplied.

N:1 relationships from Complaint:

| Relationship schema name | Complaint lookup | Target |
| --- | --- | --- |
| `gsic_Interpreter_Complaints` | `gsic_interpreter` | `gsic_interpreter` |
| `gsic_InterpreterLanguage_Complaints` | `gsic_interpreterlanguage` | `gsic_interpreterlanguage` |

Both relationships are non-parental. Parent deletion clears the optional lookup (`RemoveLink`); assign, merge, reparent, share, and unshare do not cascade. No related menu item is added. Existing valid relationships on these lookups are reused even if their schema names differ; their settings are preserved.

## Reruns and failures

The tool retrieves unpublished table, attribute, and relationship metadata before creating components. It verifies both target tables and checks existing Complaint components before any writes. Read failures abort; they are never interpreted as missing metadata. Existing incompatible types, date behavior, required levels, primary name, lookup targets, insufficient text capacity, or choice value collisions cause `Failed` and require review. Nothing is updated, deleted, relabeled, or automatically converted. An existing global Complaint Result choice also requires review; the tool will not modify shared choices.

Missing components are created in the selected solution. Missing initial local choice options are inserted after collision checks. `Created` / `Already Exists` / `Failed` messages identify each component. Metadata operations are not an atomic transaction: completed additions remain after a later failure, and reruns resume missing work. A concurrent customization can cause a create conflict; retrieve/review and rerun rather than overwriting it.

Complaint is added to the selected solution if absent. Existing solution membership is preserved. At the end the tool publishes only Complaint, Interpreter, and Interpreter Language because relationships affect both ends. This also publishes any other pending customizations on those three tables. Even an otherwise unchanged rerun republishes, allowing recovery from a prior publish failure. No other existing table metadata is changed by the tool.

## Manual Power Apps work after running

- Verify Complaint, its columns, and both relationships are present in the intended unmanaged solution. If Complaint previously existed there as a shell or with selected assets, explicitly include the required existing assets for export.
- Add Complaint to the model-driven app; configure its forms and views, including the requested section layout. Add related subgrids if desired.
- Give the intended security roles appropriate Complaint privileges and lookup Append/Append To permissions; verify access to Interpreter and Interpreter Language.
- Add `JavascriptFormValidation/gsic_ComplaintForm.js` to the solution as a JavaScript web resource named `gsic_ComplaintForm.js`. On the Complaint main form, add it to Form Libraries and register **Form On Load** with function `GSIC.ComplaintForm.onLoad` and **Pass execution context as first parameter**. Save and publish the form. The script registers Interpreter, Complaint Notification, and Response Received OnChange handlers and the Language lookup PreSearch handler itself; no separate manual field-event registration is needed. Include Interpreter, Language, Complaint Notification, Complaint Notification Date Sent, Complaint Notification Tracking Number, Response Received, and Response Date Received on the form. The Language lookup uses the verified `gsic_interpreter` column on Interpreter Language; it is disabled when no Interpreter is selected. Changing Interpreter clears Language. Disabling notification/response fields preserves their saved values. Run `node --test JavascriptFormValidation/gsic_ComplaintForm.test.js` for local mock tests.
- Confirm Complaint Type values with the client before planning a future choice migration. Also confirm whether Court Level and Contact By should become choices, and whether Complaint Result needs additional values.
- Publish the app/form changes and test create/edit, required Date Received, date display, both lookups, and permissions in the intended environment.

No automatic reference numbers, emails, Registry eligibility, payments, closure, accreditation changes, additional correspondence rules, form XML, or subgrids are implemented. The Complaint form JavaScript only filters Language by Interpreter and enables/disables the confirmed notification and response fields. Tests use mocked form and SDK metadata responses; they do not prove live Dataverse permissions or server acceptance. No environment deployment is performed by a build or test.
