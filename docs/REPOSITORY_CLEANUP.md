# Repository cleanup audit — 2026-09-30

Scope: local repository organization and generated artifacts only. No changes to Dataverse, plug-in behavior, form logic, or business logic. The staged addition of `JavascriptFormValidation/gsic_InterpreterLanguageGrid.js` predates this cleanup and is preserved.

## Inventory and keep decisions

| Area | Contents | Decision and reference evidence |
| --- | --- | --- |
| Plug-ins | Four entry points: explicit conversion, screening-triggered conversion, BPF/status synchronization, and test score rollup; shared converter and schema constants | Keep all six C# source files. SDK-style plug-in project includes them implicitly; test project references the assembly. |
| Plug-in tests | One xUnit/Moq project with five test source files | Keep all. SDK default compilation includes every test file; solution and CI run the project. |
| JavaScript | Seven web resources and three Node test files in `JavascriptFormValidation/` | Keep all. Form scripts implement current features; CI checks every `.js` and runs every `.test.js`. Each test loads its adjacent production script via `__dirname`. |
| PCF controls | None found; no `.pcfproj`, control manifest, or npm project | No cleanup applicable. |
| Documentation | Root README, deployment guide, verified schema notes, requirements audit, client meeting notes, and Complaint setup README | Keep. Build usage, registration guidance, schema evidence, client requirements, and Complaint provisioning instructions serve distinct purposes. Some historical statements need reconciliation. |
| Deployment/configuration | Solution, three project files, CI workflow, `.gitignore`, signing key and `tools/New-SigningKey.ps1` | Keep. Projects reference one another; signing key is explicitly used by the plug-in project. The documented key utility refuses to overwrite an existing assembly identity. |
| Schema setup | `DataverseSchema/Program.cs` and `CreateComplaintSchema.cs` | Keep. Console project builds these; Complaint schema tests reference the project. |
| Generated build output | Three projects' `bin/` and `obj/`, plus test `TestResults/` | Remove old copies, then regenerate current Release output during validation. All were untracked and already ignored. |
| Miscellaneous | Empty `req/`; two tracked generated C# files under `.metadata-check/` | Remove empty `req/`; retain metadata snapshots for manual review. |

No inventory or SLA code/test suite, duplicate backup files, or clearly obsolete test source was found.

## Test review

| Retained file | Active behavior covered |
| --- | --- |
| `CreateInterpreterFromApplicantPluginTests.cs` | Explicit conversion, field copying, multiple language selections/categories, duplicate suppression, concurrency requests and failures |
| `CreateInterpreterAfterScreeningPluginTests.cs` | Screening transition conversion and guards against unrelated/repeated updates; a distinct entry point, not a duplicate of explicit conversion tests |
| `SyncApplicantStatusFromBpfStagePluginTests.cs` | BPF stage/status synchronization and pre-image validation |
| `RollupTestResultScoresPluginTests.cs` | Multiple attempts, score maxima, deletion/reparenting, category-specific thresholds and accreditation |
| `CreateComplaintSchemaTests.cs` | Schema creation, reruns, partial failure recovery, and incompatible metadata checks |
| `gsic_InterpreterForm.test.js` | Form dependencies, Registry command, save/refresh errors and repeated clicks |
| `gsic_EventAttendeeForm.test.js` | Confirmation fields, lookup filtering and language type synchronization |
| `gsic_ComplaintForm.test.js` | Interpreter/language filtering and correspondence controls |

The C# tests use Microsoft.NET.Test.Sdk and xUnit through `InterpreterCRM.sln`. JavaScript tests use Node's built-in test runner; `.github/workflows/ci.yml` discovers all three files. No meaningful test coverage was removed.

## Cleanup plan shown before removal

| Proposed deletion | Why removable / references checked | Risk |
| --- | --- | --- |
| `DataverseSchema/bin/` | Generated console binaries/dependencies. Documentation names its build output; no project consumes a prebuilt copy. Rebuilt from source. | Low |
| `DataverseSchema/obj/` | Generated restore/build intermediates; no source, registration, or test input reference. | Low |
| `InterpreterCRM.Plugins/bin/` | Generated assemblies, including obsolete `net462` output. Current project targets `net48`; deployment DLL is rebuilt. | Low |
| `InterpreterCRM.Plugins/obj/` | Generated intermediates, including obsolete target output; no checked-in dependency. | Low |
| `InterpreterCRM.Plugins.Tests/bin/` | Generated test binaries and dependencies; test sources reside outside this directory. | Low |
| `InterpreterCRM.Plugins.Tests/obj/` | Generated test build/restore intermediates. | Low |
| `InterpreterCRM.Plugins.Tests/TestResults/` | One historical TRX report produced by the documented test command/CI; not an input to any test. | Low |
| `req/` | Empty, untracked, and no path references in project, solution, CI, or documentation. | Low |

All listed low-risk directories were removed after the plan was shown. The seven generated-output trees contained 594 files (approximately 45.8 MiB). No source files were deleted or moved. Paths were resolved inside the workspace and checked for tracked files and reparse points before deletion.

`.gitignore` retains the existing build-output rules and adds TRX, coverage, and ad hoc metadata-export rules. The two already tracked metadata snapshots remain tracked; the ignore rule only prevents new scratch exports from becoming clutter.

## Move/rename and manual review

No moves or renames were applied. Existing project paths, adjacent JS test fixtures, documentation links, and deployment paths are retained.

- **Medium risk:** `.metadata-check/Entities/gsic_interpreter.cs` and `.metadata-check/EntityOptionSetEnum.cs` are generated, tracked snapshots outside every project compilation root. No explicit imports or source references were found. They may preserve useful historical schema evidence, so they remain until their retention purpose is settled.
- **Medium risk:** README and deployment notes still contain older claims about unverified schema, environment access, conversion entry points, and deployment status. These conflict with newer source/schema notes. Reconcile against actual registration state before consolidating or removing guidance; historical wording does not establish that a plug-in is obsolete.
- Requirements audit and client notes are distinct source evidence. The audit refers to original Word documents that are not present here; retain the audit and notes.
- Keep the signing key and its utility. Removing/changing assembly identity could affect deployment updates even though the key is generated.

## Validation

- `dotnet build InterpreterCRM.sln --configuration Release --nologo`: passed for all three projects, zero warnings/errors. The first attempt hit sandbox network restrictions during NuGet restore; rerunning with approved network access restored the existing dependencies and completed successfully.
- `dotnet test InterpreterCRM.sln --configuration Release --no-build --no-restore --nologo --logger 'trx;LogFileName=InterpreterCRM.Tests.trx'`: 91 passed, zero failed/skipped.
- Node's test runner over all three `*.test.js` files: 40 passed, zero failed/skipped.
- `node --check` on all ten JavaScript files (seven web resources and three tests): passed.
- `git diff --check` and `git diff --cached --check`: passed. The existing staged grid-script addition is preserved.

Release build/test output was regenerated under ignored directories, including a fresh TRX report. Old Debug and `net462` artifacts were not regenerated. No tracked source or test file was removed, and no deployment was performed.
