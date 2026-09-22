# Proposed deployment — not executed

No Dataverse environment was connected to. No assembly, Custom API, step, table metadata, web resource, or app command was registered or modified. No deployment tooling was installed.

## Metadata required before registration

All C# schema placeholders live in `InterpreterCRM.Plugins/DataverseSchema.cs`. Replace used placeholders with **logical names**, not display labels or schema casing, and remove optional mappings that have no compatible column.

| Metadata | Required verification |
| --- | --- |
| Publisher prefix | Used in the new Custom API unique name |
| Applicant and Interpreter tables | Actual logical names |
| Applicant First Name, Last Name | Logical names and text types; initial required input |
| Interpreter First Name, Last Name, Name | Logical names, text types, lengths, and create/write support |
| Applicant Interpreter lookup | Logical name; target must include Interpreter |
| Applicant Archive Application | Logical name; must be Boolean/Two Options |
| Email and Phone, both tables | Logical names and compatible text types/lengths |
| Address on both tables | Corresponding line 1/2/3, city, state/province, postal code, country columns where present; remove nonexistent mappings |
| Applicant Name | Only needed if enabling `CopyApplicantName`; confirm it is a full personal name |
| Court Region and Interpreter Region | Logical names and data types; shared lookup target or verified Choice mapping before enabling copying |
| Applicant concurrency | `IsOptimisticConcurrencyEnabled = true`; Retrieve must return RowVersion |
| Other required Interpreter fields | Confirm whether table rules require more than the proposed name fields |

Primary key column names are not needed in this SDK implementation: it uses `EntityReference.Id` and `Entity.Id`. Application Status/Choice values and Interpreter Language metadata are not needed for the current operation because it does not access them. For later BPF-specific visibility, identify Profile Creation's actual stage ID rather than hard-coding an invented one. For direct HTTP calls, obtain the Applicant entity-set name from metadata; do not guess its pluralization.

## Local tooling inventory (verified 2026-09-22)

| Tool | Finding |
| --- | --- |
| .NET SDK | 10.0.400 active; 10.0.303 also installed; active SDK build verified |
| MSBuild | SDK 18.9.6; Visual Studio executable reports 18.9.1.35102 |
| .NET Framework | Runtime registry version 4.8.09037, release 533325; 4.8 and 4.8.1 targeting packs present; tests run successfully |
| Power Platform CLI | `pac help` executes; version 2.12.2; launcher at `C:\Users\lanx7\AppData\Local\Microsoft\PowerAppsCLI\pac.cmd` |
| Plugin Registration Tool | `pac tool list` reports installed version 9.1.0.200, status `ok`; executable has valid Microsoft Authenticode signature; GUI/environment connection not tested |
| Configuration Migration Tool | PAC reports not installed |
| Package Deployer | PAC reports not installed |
| Solution tooling | `pac solution` and `pac modelbuilder` available in CLI help; no environment operations performed |
| NuGet | `nuget.exe` resolves under the PAC installation; package restore through dotnet build verified |
| Strong Name Tool | Installed; signature verification of the output assembly performed; key creation with `sn.exe -k` failed with Access Denied, so the included local generator was used |
| Global dotnet tools | `dotnet tool list --global` reports none |

PRT path: `C:\Users\lanx7\AppData\Local\Microsoft\PowerPlatform\PRT\9.1.0.200\tools\PluginRegistration.exe` (package version 9.1.0.200; file version 9.0.0.9705). No PRT GUI was launched. The first PAC inventory query was blocked from NuGet by sandbox networking; the subsequent allowed read-only query succeeded. It did not connect to Dataverse.

## Exact proposed Custom API contract

Names containing double underscores are placeholders, not metadata to create literally.

| Setting | Proposed value |
| --- | --- |
| Display Name | Create Interpreter from Applicant |
| Unique Name | `__PUBLISHER_PREFIX___CreateInterpreterFromApplicant` — replace the publisher token; must exactly match `DataverseSchema.CreateInterpreterMessage` |
| Name | CreateInterpreterFromApplicant |
| Description | Creates and links an Interpreter from the bound Applicant and archives the application in one transaction. |
| Binding Type | Entity |
| Bound Entity Logical Name | `__APPLICANT_TABLE__` |
| Is Function | No — Action, invoked with POST |
| Is Private | Yes — internal app API; privacy limits discovery, not authorization |
| Allowed Custom Processing Step Type | None |
| Execution | Synchronous main operation (stage 30), in a Dataverse transaction; this is not a separately registered step mode |
| Plugin Type | `InterpreterCRM.Plugins.CreateInterpreterFromApplicantPlugin` |
| Enabled for Workflow | No |
| Execute Privilege Name | Empty initially; caller table/record privileges apply. Select an existing privilege later if access must be narrowed further. |
| Is Customizable | Keep editable during development; set false when shipping managed API/response components |

Entity binding supplies the required `Target` EntityReference automatically; **do not create a duplicate Target request parameter**. No additional request parameters are needed. Create one Custom API Response Property: Unique Name and Name `InterpreterId`, Display Name `Interpreter ID`, Type **Guid**, Logical Entity Name empty. The handler sets this output only on success.

The API is intended for this app, so private is appropriate. An explicit client request can still invoke it. If metadata discovery is needed during development, temporarily use Is Private = No and revert for managed release. Details are based on Microsoft's [Custom API guide](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/custom-api) and [Custom API metadata reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/custom-api-tables).

## PRT registration versus Custom API metadata

After approval, PRT would register the signed `InterpreterCRM.Plugins.dll` and discover its public IPlugin type, with **Sandbox isolation** and **Database storage**. Upload only the plug-in DLL, not test or SDK assemblies. No SDK message processing step or image is registered for Applicant Update, Application Status, or for the Custom API main operation.

The Custom API is a solution metadata component. Create its record with the contract above and assign Plugin Type to the registered type. Create its Guid response property. Modern PRT includes a Custom API editor that can create these metadata records, or they can be created through Power Apps/solution tooling. This is distinct from registering an SDK message processing step. Include both the assembly and API components in the application's Dataverse solution.

## Future model-driven app command

Create an Applicant main-form JavaScript command named **Create Interpreter**, passing `PrimaryControl`. Save pending edits before invoking the API so the server sees the current Applicant. Disable the command while it is in flight; require a saved row and an empty Interpreter lookup. Show it at Profile Creation if desired, using verified BPF metadata. Client visibility does not replace server validation or permissions.

The web resource will construct a request for `Xrm.WebApi.online.execute` using the verified API unique name, with `operationType: 0` (Action), `boundParameter: "entity"`, and a bound entity parameter of `typeName: "mscrm." + applicantLogicalName`, `structuralProperty: 5`. Its entity value contains the saved Applicant ID and logical name. These numeric values belong to the documented Client API, not business Choice fields. Read the Guid `InterpreterId` response, refresh the Applicant form/command state, and optionally open that Interpreter record. Display the server's error message and re-enable the command on failure; do not automatically retry a failed or ambiguous response.

Equivalent HTTP shape (metavariables below must be resolved from verified metadata):

```http
POST /api/data/v9.2/{ApplicantEntitySetName}({ApplicantId})/Microsoft.Dynamics.CRM.{CustomApiUniqueName}
Content-Type: application/json

{}
```

No button or web resource has been created yet. The invocation design follows [Xrm.WebApi.online.execute](https://learn.microsoft.com/en-us/power-apps/developer/model-driven-apps/clientapi/reference/xrm-webapi/online/execute).

## Proposed approval-gated deployment sequence

1. Obtain the schema export/names; resolve mappings, field types, lengths, required data, and publisher prefix. Verify Applicant concurrency and decide the signing identity.
2. Rebuild and rerun tests after schema changes. Review the final API contract and select an approved nonproduction environment.
3. Only after explicit deployment approval, connect with PRT, register the assembly/type, and create the API/response metadata in the intended solution.
4. Give staff the appropriate Applicant read/write and Interpreter create/read privileges, relationship Append/Append To rights, and any required field permissions. The handler does not elevate privileges.
5. Exercise success, validation, existing-link, permission, rollback, and simultaneous-request cases. Confirm the API context is transactional; the plug-in rejects a nontransactional context before writes. Ensure synchronous downstream plug-ins preserve the intended relationship and rollback behavior.
6. Create and test the command web resource/button; refresh and open the returned Interpreter. Package and promote the reviewed solution through the normal release process.

Current status: local build and tests complete; awaiting verified schema and explicit authorization before any environment work.
