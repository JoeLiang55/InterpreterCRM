# Interpreter Accreditation requirements audit

The implemented core covers most of the client's operational record keeping. The clearest unfinished feature is the Event Daily Registration List for Sign-In Staff. The visual review also identifies smaller profile and registration details that were absent from earlier summaries, and an Event calendar that should be checked against the current app.

## Scope and evidence conventions

Reviewed sources:

- **D1:** `bA docs(1).docx`: 25 rendered pages, 18 embedded screenshots.
- **D2:** `SecondParts (1).docx`: 23 rendered pages, 25 embedded screenshots. The newer supplied copy is byte-identical to the earlier `SecondParts(1).docx`.
- The six separately supplied complaint screenshots from September 27 repeat D2 screenshots 20–25. They do not add a separate workflow.
- The user's client clarifications about read-only profile scores and maximum scores per component are identified separately where relevant.

Every embedded image was extracted and visually inspected at its original resolution. Rendered page layouts and document text were also reviewed. Page references below use this review's rendered pagination; Word pagination can vary by fonts and application. **S01, S02, etc. number screenshots in order within each document**, so the image references remain usable even if pages move.

The implementation status comes from the user's latest list, not an inspection of the live Dataverse solution. “Verify” means a table/form exists but that particular capability was not confirmed. It does not mean the feature is definitely missing. A historical screenshot illustrates data and behaviour; unexplained sample values are not automatically defaults, validation rules or complete choice lists.

- **Confirmed:** explicitly stated, visibly demonstrated, or explicitly listed as data.
- **Ambiguous:** mentioned or visible but its business meaning, rules or scope are incomplete/conflicting.
- **Not actually specified:** no evidence for the proposed functionality, even if related words or navigation labels exist.
- Effort is **remaining work**, assuming existing tables and relationships: Small = focused field/form/view/command adjustment or verification; Medium = a related output, several connected configurations or a bounded workflow; Large = a new subsystem. Completed rows show Small verification rather than an estimate to rebuild them. Unsupported work is not given a misleading implementation estimate.

## Page-by-page and screenshot-by-screenshot inventory

### D1

| Page | Screenshot | Observed material |
|---|---|---|
| 1 | S01 | New Applicant: Save and Continue, Save and Close, Cancel; Date Received; Applicant Reference Number; disabled Copy to Profile; Region; Surname and Given Name marked required; Initial; address/phones/email; preferred contact and appearance options. |
| 1 | S02 | Applicant continuation: multiple language checkboxes, Other Languages, First Nations Language, Comments; contact and appearance options. |
| 2 | S03 | Search Applicant: Applicant Status, Last Name, First Name, Language, City, Home Phone, Email Address, Region; Find Applicants; Search Results. Text confirms opening applications for editing via links. |
| 3 | S04 | Applicant result count and grid: Applicant # as link, Surname, Given Name, City, Court Region, Home Phone, Applied Language(s). Applicant column inventory begins. |
| 4 | None | Applicant column inventory continues, including Email Date Sent, Comments and Reference Number; language choice list begins. |
| 5 | None | Standard language choice values. |
| 6 | None | End of standard language list; Court Region values; contact method values; Other Languages begins. |
| 7 | None | Other Languages choice values. |
| 8 | None | Other Languages choice values. |
| 9 | None | Other Languages choice values. |
| 10 | None | Other Languages choice values. |
| 11 | None | Other Languages choice values. |
| 12 | None | Other Languages choice values. |
| 13 | None | End of Other Languages; First Nation choices; screening narrative and two applicant status choices. |
| 14 | S05 | Screening Completed and enabled Copy to Profile; multiple contact methods, appearance modes and languages selected. Text explicitly describes reference numbering and retaining the common reference across applicant/interpreter. |
| 15 | S06 | Interpreter profile contact details; Applicant Reference Number; disabled Save and Update to Registry; first language grid. |
| 15 | S07 | Bilingual, English and First Nation grids; category-specific scores; Date, Withdraw Date, View Previous Tests. First Nation visibly has three components. |
| 16 | S08 | Add Language opens Profile Language form: Bilingual, Other Language, First Nations Language, Date Received, Supporting Documentation Received, Save, Close. |
| 16 | S09 | Court Information and Notes: Region, Town/City, Address, Comments on File, Notes Appearing on Registry. |
| 17 | S10 | Accessibility Course: Completed checkbox; Accessibility Training Details. |
| 17 | S11 | Other Information: ID Card Expiry Date, Latest Verification, English Proficiency, MAG Contract, Test Preparation/date, Test Completed, Training/date, Re-training/date, Security Clearance, Clearance Approved. |
| 17 | S12 | Attachments empty state and instruction to use Attach File. |
| 17 | S13 | Registered Events: Event Date, Event Type, Language/Type/Version, Confirmation Date, Confirmation Method, Attendance Status; date link. |
| 18 | S14 | Complaints empty state and Add New Complaint. |
| 18 | S15 | Relationship illustration: Profiles, Complaints, EmailAttachments, ProfileLanguages, TestResults, Events, Event Attendees, EventLog. Text explicitly mentions an event log but gives no log details. |
| 19 | S16 | English summary with decimal scores, Unaccredited, Date, Withdraw Date, View; Add Language. |
| 19 | S17 | Previous Test Results expanded; Hide action; Language, Date, Test Type, Test Version, Oral Recall, Consecutive Dialog, Shadowing, Sight Consecutive, Incident. Text states accreditation thresholds and highest-score parent update. |
| 20 | None | Profile schema: Consent to Share Qualification, Date Consent Provided, English proficiency test flag, Self Reported Dialects, ciWashCourt, Clearance Date, court/contact data. |
| 21 | None | Remaining profile schema: Interpreter ID, Reference Number, Security Clearance, Test Date, Test Prep Date, Training Date, contact/name fields. |
| 22 | None | ProfileLanguage schema: status, location, comments, language received date, interpreter/profile links and score fields. |
| 23 | None | Remaining ProfileLanguage fields: component scores, Test Date/Type/Version, Incident/comment, Withdraw Date. Text says English and First Nation are the same. |
| 24 | S18 | Three category grids again: Bilingual three scores; English four; First Nation three. Adjacent text says English and First Nation have the same four columns, creating a contradiction. Test Result schema starts. |
| 25 | None | Test Result schema continues: event/person references, score data, test incident/comment, instance/location/type/version and calculated Test Status. Original note defers Events; D2 later supplies Event requirements. |

### D2

| Page | Screenshot | Observed material |
|---|---|---|
| 1 | S01 | Applicant search form, same eight search criteria as D1. Background navigation includes Registry and Court Interpreter Scheduler. |
| 1 | S02 | Applicant results with reference/name/contact/languages. Narrative asks for functionality like the next example. |
| 2 | S03 | Example result grid: total/range, Rows per page, Page 1 of 15, first/previous/next/last, search box, sortable headers, Export to Excel. Example columns are interpreter-oriented. Text explicitly requests totals, paging, export and header sorting for Applicant search. |
| 2 | S04 | Monthly Events calendar, month navigation, event title/time blocks; text leads into opening an event. |
| 3 | S05 | Event view and Registered Attendees grid with linked Reference # and Delete. |
| 3 | S06 | Event edit form; Actions contains Add New Attendee and Create Sign In Sheet. Title, Event Type, Start and End marked required; Location and Comments. |
| 4 | S07 | Add Event Attendee search by Last Name, First Name, Reference #; event context displayed. |
| 5 | S08 | Search results: Reference # link, Name, Email. |
| 6 | S09 | Selected attendee registration: Language, Language Type, Comments, Test Portions Required, Test Version; OK, Cancel. |
| 6 | S10 | CREE selection with First Nation automatically displayed. Text gives Arabic -> BCIT and CREE -> First Nation examples. |
| 7 | S11 | Saved attendee appears in event grid; examples Attended and Invited. Text describes the Event Attendee bridge between Event and Profile. |
| 8 | S12 | Registered Attendee edit: Title, First Name, Last Name, Attendee Event Language, Language Type, Test Version, Test Portions Required, Comments, Attendance, Confirmation Method, Confirmation Date/time. Event Type and Event Start Time displayed read-only. |
| 9 | S13 | Delete links next to attendee rows. |
| 9 | S14 | Daily Registration List for Sign-In Staff: header Time, Test Location, Proctor; 13 columns listed in the sign-in specification below. |
| 10 | S15 | New Event form; blank attendee grid. Background navigation shows Expired Profiles, Security Screening, Documents Report Links, Search Profiles/Events and Profile languages Search. These labels do not provide those screens' business rules. |
| 11 | S16 | Event Location choice list. Text on previous page explicitly permits choosing six locations instead of implementing every value. |
| 12 | None | Event/Event Attendee schema. Event Type written as Testing and Training. |
| 13 | S17 | Event Attendee list with generated title, IEA testing identifier, IE event reference and common profile reference. Text specifies title and ID generation. |
| 14 | S18 | Event list with IE reference numbers, Start/End, Location and Type. Historical Test Prep rows visible, although written type list is only Testing/Training. Complaint schema begins. |
| 15 | None | Complaint schema: correspondence, transcript/evaluation dates, result-completed date, tracking numbers and Profile lookup. |
| 16 | S19 | Profile Registered Events grid with Confirmed/Attended/Invited examples, Email confirmation method and Test Prep event example. Above it, Add More Attachments. Text includes No Response Received, No Response Required, Date Resolved/Closed and Divorce Act Proceeding. |
| 17 | S20 | Complaint view mode; Edit and Close; identity, incident details and correspondence. |
| 18 | S21 | Profile Complaints grid: Language link, Type, Incident Date, Complaint Result; Add New Complaint. Results shown: Warning Letter, In-person Re-training, Dismissed. |
| 19 | S22 | Complaint edit: Date Received required; incident fields; checked notification enables Date Sent and Tracking #. |
| 20 | S23 | Unchecked Complaint Notification with disabled Date Sent and Tracking #. Text says unchecked/disabled by default and same pattern for rest of form. |
| 21 | S24 | Full lower complaint form: correspondence toggles, Contact By, transcript/recording fields, evaluator dates, Complaint Result and Date Resolved/Closed. Received checkbox appears checked while dates remain greyed, so exact dependency is not fully demonstrated. |
| 22 | S25 | Complaint edit with checked correspondence options and enabled date/tracking fields. |
| 23 | None | Profile connects basic info, languages/history, attendees, complaints, attachments; Event connects attendees. Admin pushes evaluated interpreter with “no complaints” to Registry for court selection and paid work. |

## Requirements gap matrix

### Applicant and search

| ID / Functionality | Source | Exact fields, buttons or behaviour | Already implemented based on your list | Remaining work | Classification | Effort |
|---|---|---|---|---|---|---|
| R01 Applicant creation and editing | D1 pp1–4 S01–04; p14 S05 | Save and Continue, Save and Close, Cancel; Surname/Given Name required; Initial, Date Received, Applicant Reference, Region, Apt, Address, City, Province, Country, Postal Code, Home/Work/Cell phones, Email, Comments. | Applicant form exists. | Verify individual fields, required names and save/open behaviour. A generic Name/Phone does not prove all shown data is covered. | Confirmed | Small |
| R02 Multiple languages, contact methods and appearance modes | D1 p1 S01–02; p14 S05; pp4–13 choice lists | Multiple languages selected; Other Languages and First Nations Language; Home/Work/Mobile/Email checkboxes; In-person/Telephone/Videoconference, plus adjacent video text field. S05 has Home Phone and Email selected together. | Applicant/profile/language features exist; exact multiselect coverage not stated. | Verify users can retain multiple selected values. Compare existing language and region choices to supplied lists. Meaning of adjacent video field is not explained. | Confirmed selection capability; ambiguous video detail | Small |
| R03 Common applicant/profile reference | D1 p14 text; p15 S06; D2 pp13–14 S17–18 | Reference is year plus system sequence, example 26-2628; same reference spans applicant/interpreter. Profile visibly labels it Applicant Reference Number. | Conversion and tables built; carry-forward/format not confirmed in latest list. | Verify reference is retained and displayed after conversion. If still plain 1001+ or an unrelated new profile reference, correct that gap. Do not rebuild conversion. | Confirmed; sequence reset/migration details ambiguous | Small; Medium if existing data requires correction |
| R04 Screening and conversion | D1 pp13–14 S05 | Review documentation; To Be Screened / Screening Completed; Copy to Profile disabled until completed. | BPF and conversion built. | Verify gating against this behaviour only. Exact three-stage BPF labels are your implementation, not supplied client stages. | Confirmed | Small verification |
| R05 Applicant search criteria | D1 p2 S03; D2 p1 S01 | Applicant Status, Last Name, First Name, Language, City, Home Phone, Email Address, Region; Find Applicants. | Applicant table/form alone does not confirm this. | Configure/verify the eight search/filter criteria and opening a matching record. Matching operators and combinations are not specified. | Confirmed capability; matching semantics ambiguous | Small using existing app search/filter controls; Medium for an identical custom panel |
| R06 Applicant result columns | D1 p3 S04; D2 p1 S02 | Applicant # link, Surname, Given Name, City, Court Region, Home Phone, Applied Language(s). | Not separately confirmed. | Configure results with these data and a route to edit the applicant. | Confirmed | Small |
| R07 Result total and paging | D2 p2 S03 and text | “Show total items, has paging, and page 1 to many”; example Showing 1–50 of 716, Rows per page 50, Page 1 of 15, first/previous/next/last. | Not separately confirmed. | Verify count, page navigation and page-size behaviour. Exact recreation of every control is not expressly required; 50 is an example, not a fixed business limit. | Confirmed | Small verification/configuration; Medium if exact custom controls are required |
| R08 Column sorting and Excel export | D2 p2 S03 and text | “Can export to excel, and header can sorts”; Export to Excel and sort arrows. Search box is also visible. | Not separately confirmed. | Verify sorting and useful Excel export under the intended user role. Export all matches versus current page/selection is unspecified. | Confirmed capability; export scope ambiguous | Small |
| R09 Applicant legacy data inventory | D1 pp3–4 | Archive Application Yes/No; Email Date Sent Date/Time. | Not explicitly confirmed. | Check whether these are retained data requirements. No archiving process or automatic email send is described. | Confirmed listed data; workflow ambiguous | Small |

### Interpreter profile and language history

| ID / Functionality | Source | Exact fields, buttons or behaviour | Already implemented based on your list | Remaining work | Classification | Effort |
|---|---|---|---|---|---|---|
| R10 Profile basic information | D1 p15 S06; pp20–21 | Applicant reference, Date Received, Surname, Given Name, Initial, Apt/address, Home/Work/Mobile, Email, preferred contact and appearance modes. | Profile/contact information built. | Verify exact data coverage and reference continuity; no redesign requested. | Confirmed | Small verification |
| R11 Court information and separate registry notes | D1 p16 S09 | Court Region, Town/City, Address; separate Comments on File and Notes Appearing on Registry. | Contact profile and Registry built; court-specific fields and separate notes not confirmed. | Add missing court data and distinct registry notes. Display registry notes in the intended Registry experience. Personal address should not silently substitute for court address. | Confirmed | Small |
| R12 Accessibility course tracking | D1 p17 S10 | Accessibility Course Completed checkbox and Accessibility Training Details multiline text. | Not listed as implemented. | Add completion/details recording if absent. No course delivery, certificate generation or recurrence rule is stated. | Confirmed | Small |
| R13 Profile training/testing milestones | D1 p17 S11; p21 schema | Test Preparation plus date; Test Completed; Training plus date; Re-training plus date; Test Date/Test Prep Date/Training Date in schema. | Events/Test Results built, but profile milestone recording not confirmed. | Add/verify displayed flags/dates. Whether events automatically update them is not specified. | Confirmed recording; automation ambiguous | Small for manual recording |
| R14 English proficiency and MAG contract | D1 p17 S11; p20 schema | English Proficiency; MAG Contract checkbox; ciEnglishProfTest Yes/No. | Not explicitly confirmed. | Record/display missing values. Exact meaning of English Proficiency versus English proficiency test flag needs clarification if treated as separate fields. No contract-signing integration is described. | Confirmed data; exact mapping ambiguous | Small |
| R15 ID card expiry and latest verification | D1 p17 S11 | ID Card Expiry Date and Latest Verification dates. | Not listed as implemented. | Add dates if absent. Their presence does not define accreditation expiry, auto-deactivation, reminders or a five-year renewal rule. | Confirmed dates; automated effects ambiguous | Small |
| R16 Consent to share qualification | D1 p20 schema | ciConsentToShareQualification Yes/No; ciDateConsentProvided Date/Time. | Not explicitly confirmed. | Add/verify the two values. No consent collection, signature, revocation or Registry gating rule is stated. | Confirmed data | Small |
| R17 Security clearance recording | D1 p17 S11; p20–21 schema | Security Clearance checkbox; Clearance Approved showing YES; ciClearanceDate Date/Time. | Not explicitly confirmed. | Add/verify data recording. Distinction between clearance requested/received/approved is incomplete; no automatic approval or background-check integration is stated. | Confirmed data; state meanings ambiguous | Small |
| R18 Additional profile schema details | D1 pp20–21 | Self Reported Dialects, ciWashCourt, Interpreter ID, Applicant Status. | Exact coverage not confirmed. | Retain intelligible requested data where absent. Ask what ciWashCourt means; do not invent a “watch court” workflow or an Interpreter ID numbering format. | Confirmed inventory; some semantics ambiguous | Small once defined |
| R19 Language grouping and add/edit | D1 pp14–16 S07–08; p24 S18 | Separate Bilingual, English and First Nation sections; Add Language; language selection and Save/Close. | Interpreter Languages built; prior screenshots showed the three grids. | Verify new-language entry still works and existing language details remain accessible alongside history. | Confirmed | Small verification |
| R20 Language receipt/supporting documentation | D1 p16 S08; p22 schema | Date Received; Supporting Documentation Received checkbox on Profile Language. | Not listed as implemented. | Add these to language entry/edit if absent. No document approval workflow is specified. | Confirmed | Small |
| R21 Language Date and Withdraw Date | D1 p15 S07; p19 S16–17; p23 schema | Date and Withdraw Date columns; ciTest Date and Withdraw Date in schema. | Scores built; these columns not confirmed. | Add/verify date recording and visibility. Which Date represents a mixed maximum-score summary is undefined; withdrawal consequences also undefined. | Confirmed data; date selection/effects ambiguous | Small for recording |
| R22 Previous test history | D1 p19 S16–17 | View/Hide Previous Tests; Language, Date, Test Type, Test Version, category scores, Incident; language link to record. | Test Results/history built. | Verify dates/type/version/incident and category-appropriate score columns. Your row-open history is a functional implementation; inline expand/collapse is the legacy presentation. | Confirmed | Small verification |
| R23 Highest component scores and read-only summary | D1 p19 text; subsequent client clarifications in conversation | “always keep the higested number ... not by the time”; later clarified maximum for each component and summary read-only. | Rollups built. | No new build indicated; verify read-only summary and maximum-per-component behaviour. Original document alone did not resolve whole-attempt versus per-component aggregation. | Confirmed with client clarification | Small verification |
| R24 Accreditation calculation | D1 p19 text/S16–17 | >=70 accredited; >=50 to 70 conditional; any <50 unaccredited. Screenshot has 45.21 and Unaccredited. | Calculation built. | No rebuild. Verify exact 70 boundary, incomplete/no-test records and required components; zero-score examples elsewhere have blank accreditation, so blank handling cannot be inferred safely. | Confirmed thresholds; incomplete-result rules ambiguous | Small verification |
| R25 Category component mapping | D1 p15 S07; pp23–24 text/S18 | Bilingual: Sight Translation, Consecutive Interpreting, Simultaneous Interpreting. English: Oral Recall, Consecutive Dialog, Shadowing, Sight Consecutive. First Nation screenshots omit Shadowing, but text says same four as English. | Category scores built. | Preserve the discrepancy as a client question before changing First Nation calculation. Reading/Writing/Oral labels are not supported as substitutes for these components. | Confirmed Bilingual/English; ambiguous First Nation | Small after clarification |
| R26 Test metadata and traceability | D1 p19 S17; pp24–25 schema | Test Date, Type, Version, Incident/comment, Test Location, Test Instance, Event Reference No, Interpreter ID/reference and language. | Test Results built; exact metadata/event link coverage not confirmed. | Verify metadata. Event reference is explicitly listed, but automatic Test Result creation from Event Attendee is not described. | Confirmed data; event automation ambiguous | Small for fields; Medium for an agreed relationship change |
| R27 Overall Score and calculated fields | D1 pp22,24–25 | Overall Score; calculated Date and Test Status; also ProfileLanguage Test Status. | Not confirmed separately. | Ask for formulas/meanings if required. Do not calculate an average or whole-test best score without evidence. | Ambiguous | Small–Medium after rules are defined |
| R28 Profile attachments | D1 p17 S12; D2 p16 S19; p23 | Attachments; Attach File; Add More Attachments; profile association. | Implemented with Notes/Timeline. | Verify users can add/open the correct profile's files. Dedicated legacy table is not evidence of a required separate Dataverse document subsystem. Email ingestion is not specified. | Confirmed, functionally covered | Small verification |

### Events and registration

| ID / Functionality | Source | Exact fields, buttons or behaviour | Already implemented based on your list | Remaining work | Classification | Effort |
|---|---|---|---|---|---|---|
| R29 Event creation/editing | D2 p3 S05–06; p10 S15; pp10–12 | Required Title, Event Type, Start Time, End Time; Location; Comments; Save/Cancel; written types Testing/Training; six locations sufficient. | Events built. | Verify required fields and editing. No recurrence, resource allocation or booking conflict rules stated. | Confirmed | Small verification |
| R30 Events calendar | D2 p2 S04 and “When click open” | Monthly calendar; month navigation; title and time blocks; clicking an event opens its form. | Events built, calendar not confirmed. | Add/verify calendar display and opening events. This is a testing/training Event calendar. | Confirmed screenshot behaviour | Medium |
| R31 Add attendees from an Event | D2 pp3–7 S06–11 | Add New Attendee; event context; search Last Name/First Name/Reference #; results Reference #, Name, Email; select person; save into Registered Attendees. | Event Attendees and lookups built. | Verify search by reference and names, and creation from an Event carries the Event link. A lookup can satisfy person selection without copying the old multi-panel UI. | Confirmed | Small verification/configuration |
| R32 Language selection/type auto-population | D2 p6 S09–10; p8 text | Select Language; Language Type automatically follows; Arabic -> BCIT, CREE -> First Nation; type read-only. | Interpreter/Language filtering built. | Verify derived type is read-only. BCIT/English Only labels versus your Bilingual/English labels may need display mapping, not new categories. | Confirmed | Small verification |
| R33 Registration test portions and version | D2 p6 S09; p8 S12; p9 S14 | Test Portions Required, Test Version and Attendee Comments; portions appear as Whole Test Or Section(s) on sign-in output. | Event Attendee table built; these details not confirmed. | Add/verify fields and expose them on registration/edit and sign-in output. No rule automatically chooses portions or test version. | Confirmed data; defaults/choices ambiguous | Small |
| R34 Attendance and confirmation tracking | D2 p8 S12; p16 S19 | Attendance, Confirmation Method, Confirmation Date/time; examples Invited, Confirmed, Attended and Email. | Table exists, fields/updates not separately confirmed. | Add/verify manual recording and display in both related grids. These examples do not establish the full choice set or automatic transitions. | Confirmed tracking; full choices ambiguous | Small |
| R35 Attendee context read-only | D2 p8 S12 and text | Event Type and Event Start Time shown read-only; Language Type also explicitly read-only. Other attendee fields editable. | Not separately confirmed. | Verify event context and derived type cannot be independently changed through the attendee form. | Confirmed | Small |
| R36 Remove accidental attendees | D2 pp8–9 S13 | Explicit instruction to delete an accidentally added user via Delete next to registration. | Table exists; delete capability not separately confirmed. | Verify registration deletion works without deleting the Interpreter or Event. | Confirmed | Small |
| R37 Two directions of registration history | D1 p17 S13; D2 p3 S05, p7 S11, p16 S19, p23 | Event -> Registered Attendees; Profile -> Registered Events. Exact columns listed below. | Event Attendees built; profile event subgrid not explicitly in latest list. | Add/verify both related lists and open-record links. | Confirmed | Small |
| R38 Generated attendee title and testing ID | D2 p13 S17/text; p9 S14 | Auto title based on common reference and name; IEA- testing ID, examples IEA-03579 and IEA-03580. Text says Firstname, lastname; screenshot displays RIZAL, JOSE. | Not explicitly confirmed. | Add/verify automatic title and unique testing identifier. Name ordering conflicts; initial seed/rollover unspecified. | Confirmed generation; exact title ordering ambiguous | Small |
| R39 Generated Event reference | D2 p14 S18/text | Automatic IE- reference, example IE-00102; registrations store related Event reference. | Events built; numbering not explicitly confirmed. | Add/verify generated reference. Concurrency-safe autonumbering is a recommended implementation, not a client-specified algorithm. | Confirmed | Small |
| R40 Daily Registration List for Sign-In Staff | D2 p3 S06; p4 text; p9 S14/text | Create Sign In Sheet command opens header and 13-column registration list for the selected Event; full specification below. | Explicitly unfinished. | Build the output/command using linked attendees. A report or generated document is a design option; a new website is not requested. | Confirmed | Medium |
| R41 Test Prep as Event Type | D2 p14 S18; p16 S19 versus p12 text | Test Prep is visible in Event and Registered Events examples; written Event Type list contains only Testing/Training. | Testing/Training built. | Ask whether Test Prep must be included in current scope. Do not silently omit the evidence or assume an entire new training workflow. | Ambiguous conflict | Small once confirmed |
| R42 EventLog | D1 p18 S15 and text | EventLog table shown; narrative says each event has its own event log. | Not listed as implemented. | Ask what is logged, by whom, when, and what users need to see. Cannot equate this automatically with generic auditing. | Ambiguous | Cannot size reliably; Small–Medium if simple log |

### Complaints, Registry and excluded scope

| ID / Functionality | Source | Exact fields, buttons or behaviour | Already implemented based on your list | Remaining work | Classification | Effort |
|---|---|---|---|---|---|---|
| R43 Complaint create/view/edit and profile list | D2 pp17–19 S20–22; p22 S25; D1 p18 S14 | Add New Complaint, language link, view/Edit/Save/Cancel/Close; list Language, Type, Incident Date, Complaint Result. Core fields in detailed inventory below. Date Received required. | Built, including filtering and profile subgrid. | Verify the list opens the complaint rather than only its language, and exact fields are present. | Confirmed | Small verification |
| R44 Correspondence/transcript tracking and enabled fields | D2 pp19–22 S22–25 and pp15–16 schema | Notification/date/tracking, response/date, result notification, No Response Required, Contact By, transcript ordered/received, sent-to-evaluator/evaluation-received dates. Unchecked disables associated fields. | Built. | Verify coverage; do not rebuild sections. Exact interplay of Received/Ordered and No Response Required/Contact By remains unclear. | Confirmed general behaviour; some dependencies ambiguous | Small verification |
| R45 Complaint result and closure | D2 p18 S21; p21 S24; pp14–16 schema | Complaint Result, Date Resolved/Closed; examples Warning Letter, In-person Re-training, Dismissed. Schema additionally lists No Response Received and Complaint Result Date Completed. | Complaint form built; exact coverage not confirmed. | Verify result/closure recording and those two easily missed schema fields. Whether completed date differs from closed date is unclear. No automatic suspension or retraining enrolment specified. | Confirmed data; lifecycle effects/complete choices ambiguous | Small |
| R46 Basic Registry publication | D1 p15 S06; D2 p23 | Save and Update to Registry button; admin can push interpreter into Registry; court staff can select interpreter. | In Registry, date, view and Add to Registry command built. | Verify registered people appear and users see current published information. “Update” may simply mean showing current data; a separate synchronization integration is not established. | Confirmed basic capability; destination/update semantics ambiguous | Small verification |
| R47 Registry eligibility | D2 p23 | Evaluated testing scores and “no complaints” before admin publication. | Explicitly unfinished. | Define evaluated, acceptable accreditation/category coverage and meaning of no complaints, including dismissed/closed complaints. Also clarify consequences of later complaints/score changes. | Ambiguous | Medium after clarification |
| R48 Admin and court-user access | D2 p23 | Admin performs Registry push; court person selects interpreter. | Command/view exist; permissions not confirmed. | Verify intended users can perform these actions. Full role matrix, field access and department boundaries are not supplied. Admin-only enforcement is a recommended interpretation to confirm, not a complete client security specification. | Confirmed actors; permissions ambiguous | Small–Medium after clarification |
| R49 Example interpreter result columns | D2 p2 S03 | Last Name, First Name, Language, Region, Interpreter's Information, Accreditation Status, Modes of Appearance, Closest Court City, Notes. | Registry view built; exact columns unknown. | The screenshot is used as an Applicant grid example. Ask whether these columns also define Registry output; do not replace Applicant result columns with them automatically. | Ambiguous target scope | Small–Medium |
| R50 Expired Profiles and other navigation-only areas | D2 p10 S15, background navigation | Expired Profiles, Search Profiles, Profile languages Search, Security Screening, Documents Report Links, BugTracker. | Not confirmed. | Ask which screens are in scope and request their behaviour. Existence of a menu label is not a specification for a complete feature. | Ambiguous | Not estimable from labels |
| R51 Court bookings/assignments | D2 S01/S04/S15 navigation and p23 narrative | Court Interpreter Scheduler link; court selection mentioned. No booking form, fields, schedule rules or assignment workflow shown. | Not built. | Do not build a booking/assignment subsystem from this evidence. | Not actually specified as an implementable feature | No supported estimate; a new subsystem would be Large |
| R52 Payment functionality | D2 p23 | “they get paid” describes business context only. | Not built. | No invoices, fees, timesheets, payment approvals or integrations to implement. | Not actually specified | No supported estimate |
| R53 Renewal/expiry workflow | D1 p17 S11 and D2 p10 S15 | ID Card Expiry Date and Expired Profiles label exist; no expiry period, renewal steps, reminders, automatic status changes or eligibility effects. | Not built. | Implement the confirmed date recording under R15; ask before any workflow. Do not infer five-year validity from sample dates. | Not actually specified as a workflow; expired-view semantics ambiguous | No supported workflow estimate |
| R54 Automated outbound notifications | D1 p4 Email Date Sent; D2 complaint dates/checkboxes; p16 Email confirmation example | Evidence establishes tracking that correspondence happened. No send button, template, recipient, trigger or delivery rule. | Tracking built; automatic sending not built. | No automatic email/SMS/reminder build supported. | Not actually specified | No supported estimate |
| R55 Additional integrations, BPFs and analytics | Both documents | Existing SharePoint screens, legacy references and schema fields; one detailed sign-in output and Excel export. | Core BPF built. | No external clearance service, LMS, payroll, e-signature, general Power BI dashboard, manual accreditation approval BPF or portal specified. | Not actually specified | No supported estimate |

## Exact supplementary specifications

### Sign-in output

**Evidence:** D2 p9 S14, title “Daily Registration List for Sign-In Staff.” Launch action: Create Sign In Sheet (D2 p3 S06).

Header: **Time**, **Test Location**, **Proctor**. In the example Time displays the event date, while each row's Test Time displays date and time. Proctor is blank.

| Visible column | Evidence or data source | What is and is not established |
|---|---|---|
| Test Time | Example includes July 22, 2026, 12:00 a.m. | Display date/time. Different per-attendee time slots are not specified. |
| Testing ID | IEA-03579, IEA-03580 | Generated attendee testing identifier. |
| Candidate Name | RIZAL, JOSE; TEST, TEST | Candidate name, surname-first in example. |
| Reference Number | 26-2668; 24-2649 | Common applicant/profile reference. |
| Language | SPANISH; CREE | Registration language. |
| Test Type | BCIT; First Nation | Registration language/test category. |
| Test Version | 1 | Version field. Full allowed values and default are not established. |
| Whole Test Or Section(s) | Blank for one row; text for another | Corresponds to Test Portions Required. No rules for automatically choosing sections. |
| Lang. Verified | Blank | Output column confirmed; electronic storage/control not established. |
| Current MAG Interpreter (First test, or retesting as CA) | Blank | Preserve label; do not assume a Boolean or infer from In Registry without clarification. |
| New Applicant: Photo ID Verified | Blank | Output column confirmed; electronic verification process not established. |
| Candidate's Signature | Blank | Signature space confirmed; e-signature capture not established. |
| CIC Given | Blank | Column confirmed; acronym/meaning/data source not defined. |

**Recommended minimal design:** generate an Event-specific list using existing Event/Attendee/Profile/Language data, preserving blank staff-completion columns. This is an implementation recommendation, not proof that paper completion is mandatory. Confirm electronic capture only if the client expects those blank columns to be saved back into Dataverse. Printing/PDF is a reasonable delivery option, but the document explicitly demonstrates opening the list, not a separate PDF export contract.

### Exact related-list columns

| List | Columns shown | Source |
|---|---|---|
| Applicant results | Applicant #, Surname, Given Name, City, Court Region, Home Phone, Applied Language(s) | D1 p3 S04; D2 p1 S02 |
| Event Registered Attendees | Reference #, Name, Language/Type/Version, Confirmation Date, Confirmation Method, Attendance Status; Delete action | D2 pp3,7 S05–06/S11 |
| Profile Registered Events | Event Date, Event Type, Language/Type/Version, Confirmation Date, Confirmation Method, Attendance Status | D1 p17 S13; D2 p16 S19 |
| Profile Complaints | Language, Type, Incident Date, Complaint Result | D2 p18 S21 |
| Bilingual profile language | Language, Accreditation, Date, Sight Translation, Consecutive Interpreting, Simultaneous Interpreting, Withdraw Date, Previous Tests | D1 p15 S07; p24 S18 |
| English profile language | Language, Accreditation, Date, Oral Recall, Consecutive Dialog, Shadowing, Sight Consecutive, Withdraw Date, Previous Tests | D1 p15 S07; p19 S16; p24 S18 |
| First Nation profile language | Language, Accreditation, Date, Oral Recall, Consecutive Dialog, Sight Consecutive, Withdraw Date, Previous Tests | D1 p15 S07; p24 S18; conflicts with adjacent prose |
| Previous Tests example | Language, Date, Test Type, Test Version, Oral Recall, Consecutive Dialog, Shadowing, Sight Consecutive, Incident | D1 p19 S17; category-specific display stated on p24 |

### Complaint field completeness

Your existing Complaint feature should be compared with this inventory, not rebuilt:

- Identity/incident: Reference Number, Language, Date Received (required), Type, Court Location, Incident Date, Court Level, Is incident from a Divorce Act Proceeding, Incident Summary.
- Complaint Notification checkbox, Date Sent, Tracking #.
- Interpreter Response Received checkbox, Date Received.
- Complaint Result Notification checkbox, No Response Required checkbox, Date Sent, Tracking #, Contact By.
- Transcript and Recording Ordered checkbox, Date Sent.
- Transcript and Recording Received checkbox, Date Received, Date Sent to Evaluator, Date Evaluation Received.
- Complaint Result, Date Resolved/Closed.
- Text-only additional columns: `ciNoResponseReceived` and `ciComplaintResultDateCompleted`. Their relationship to the displayed response/closure fields is not explained.
- Reference Number in the complaint example matches the same person's applicant/profile reference. No separate Complaint reference numbering formula is given.

Unchecked fields retain displayed sample values in S23/S24. Therefore disabling fields is demonstrated; clearing their stored values is not a stated requirement. Do not add destructive clearing rules solely from the screenshots.

### Choice and identity discrepancies

- First Nation Shadowing: explicit conflict between prose and two screenshots.
- Event Type: written Testing/Training versus visible Test Prep records.
- Attendee generated title: prose says Firstname, lastname; screenshot uses surname, given name.
- Court Region: written list has CENTRAL EAST, CENTRAL WEST, EAST, NORTH EAST, NORTH WEST, TORONTO, WEST; screenshot additionally shows OUT OF PROVINCE. If the implementation still uses only E/W/Central/Outside ON, it does not match the supplied granularity. Verify current values rather than assuming the older implementation remains unchanged.
- Applicant/profile reference continuity is explicit. A separately generated Interpreter Reference Number with an independent numbering format is not explicitly requested, although Interpreter ID exists in the legacy schema.
- Language lists contain historical/duplicate or unusual entries. They are client-supplied reference data, but cleanup/renaming decisions should not be silently treated as new requirements.
- A blank accreditation for sample zero scores does not define whether zero means untested, missing, or an actual failed score.
- Additional schema fields are evidence of existing data, not evidence that every duplicated SharePoint lookup projection must become a separate physical Dataverse column. Keeping relationships and displaying related data is a recommended design approach.

## Direct answers to the requested verification list

| Item | Finding |
|---|---|
| Consent to Share Qualification | Confirmed Yes/No data, D1 p20. No workflow supplied. |
| Date Consent Provided | Confirmed Date/Time data, D1 p20. No auto-date rule supplied. |
| Security Clearance | Confirmed checkbox/Yes-No, D1 p17 S11 and p21. |
| Clearance Date | Confirmed Date/Time in D1 p20; no expiry period. |
| Applicant search | Confirmed eight criteria and opening results, D1 p2 S03/D2 p1 S01. |
| Totals | Confirmed total result count, D1 p3 S04/D2 p2 S03 and text. Not a monetary total. |
| Paging | Confirmed, including visible page controls, D2 p2 S03. |
| Column sorting | Confirmed by arrows and text, D2 p2. |
| Excel export | Confirmed button and text, D2 p2. Export scope not specified. |
| Event Daily Sign-In Sheet | Confirmed action and detailed output, D2 pp3–4/p9 S06/S14. |
| Profile attachments | Confirmed; your Notes/Timeline implementation covers the basic function. |
| Registry | Confirmed admin publication/court selection; current basic implementation covers it. |
| Registry eligibility | Intent confirmed; “evaluated” and “no complaints” not sufficiently defined. |
| Court bookings/assignments | Scheduler navigation and business context only; no implementable booking specification. |
| Payment functionality | Not specified; “get paid” is context. |
| Renewal/expiry | ID Card Expiry Date confirmed; automated renewal/expiry workflow not specified. |
| Notifications | Correspondence tracking confirmed; automated sending not specified. |

## Requirements missed in earlier summaries

These are **not confirmed absent from your solution** unless you said so; they are missing from the implementation list or were missed in earlier analysis:

1. Accessibility Course Completed and Accessibility Training Details — D1 p17 S10.
2. Supporting Documentation Received and Date Received at language level — D1 p16 S08.
3. Separate Notes Appearing on Registry, plus Court Town/City and Address — D1 p16 S09.
4. ID Card Expiry Date, Latest Verification, MAG Contract, Clearance Approved and training/retraining milestones — D1 p17 S11.
5. Event calendar with navigation/open-record behaviour — D2 p2 S04.
6. Attendee Test Portions Required, Test Version, Attendance and Confirmation details — D2 pp6,8 S09/S12.
7. Generated Event and Attendee reference identifiers, and generated attendee title — D2 pp13–14 S17–18.
8. Profile Registered Events grid, with its exact columns — D2 p16 S19.
9. EventLog is explicitly mentioned but its behaviour is missing — D1 p18 S15/text.
10. Test Prep as an additional Event Type is visible but conflicts with the written list — D2 p14 S18/p16 S19.
11. Applicant reference format and continuity across conversion are explicit — D1 p14. Earlier uncertainty about whether it carries over was incorrect.
12. Small schema-only fields such as No Response Received and Complaint Result Date Completed warrant a mapping check — D2 pp15–16.

## Prioritized implementation list

### A. Small confirmed features we can implement immediately

Implement only those absent from the current solution, in this order:

1. Complete the profile's confirmed recording fields: consent/date, clearance/date, Accessibility Course completion/details, ID Card Expiry Date, Latest Verification, MAG Contract, milestone flags/dates, court information and separate registry notes. Leave unexplained automation out.
2. Complete language entry with Supporting Documentation Received and Date Received. Preserve a usable create/edit form as well as test-history access.
3. Complete registration data needed by the sign-in list: Test Portions Required, Test Version, Attendee Comments, Attendance, Confirmation Method and Date. Existing values/labels are evidence, not necessarily the complete choice catalog.
4. Add/verify Profile Registered Events and Event Registered Attendees grids with the exact listed columns; verify accidental-registration deletion and read-only Event Type/Start/derived Language Type.
5. Verify Applicant/profile shared reference; Event IE- reference; Attendee IEA- testing ID and generated title. Resolve title ordering before finalizing its displayed format.
6. Verify Applicant search/result columns, sorting, totals, paging and Excel export using the existing app before commissioning custom UI.
7. Check Complaint result/closure and the two schema-only fields; retain implemented checkbox behaviour and do not clear values without a requirement.

### B. Medium confirmed features

1. **Event Daily Registration List for Sign-In Staff:** the strongest remaining functional deliverable. Reproduce the specified header and 13 columns from D2 p9 S14 using the selected Event's registrations.
2. **Event calendar:** month navigation, event time/title display and opening the Event form, if absent.
3. **Applicant search/result experience:** only if the configured app cannot satisfy the explicit search, count, paging, sorting and export needs. The confirmed requirement is the capability; an identical standalone website is not established.

### C. Large confirmed features

**None established as remaining work by these materials.** No evidence justifies a new booking, payment, learning-management, clearance-integration or renewal subsystem. A demand for exact legacy-screen recreation could increase effort, but that is not established here.

### D. Blocked/ambiguous — ask client

Prioritize these questions:

1. Registry: what exact test/accreditation state qualifies, and does “no complaints” mean none ever, none open, or none with a disqualifying result? Is publication for the whole interpreter or specific languages? What happens after later changes?
2. First Nation: are three components required as shown, or four including Shadowing as the prose says?
3. Sign-in list: are Proctor, Lang. Verified, MAG/retest classification, Photo ID Verified, Signature and CIC Given completed on paper, or must Dataverse store them? What does CIC mean? Is the list selected-Event only or a combined daily list?
4. Event Type: include Test Prep alongside Testing and Training? Confirm full Attendance, Confirmation Method and Test Version choices.
5. Date semantics: what does the language summary Date represent when maxima come from several attempts? What should Withdraw Date do? How are incomplete/no-test scores treated?
6. Profile milestones: manual records or automatically derived from events/results? Distinguish Security Clearance from Clearance Approved; define Latest Verification and ciWashCourt.
7. Registry update/access: same data/view or separate external destination? Which staff may publish/edit/view? Does the example interpreter result grid define Registry columns too?
8. EventLog: contents, trigger, editing and display requirements. Expired Profiles/Security Screening/report navigation: actual screen requirements if in scope.
9. Complaint edge rules: does No Response Required disable Contact By? What enables transcript received/evaluation dates? Is Result Date Completed distinct from Date Resolved/Closed?
10. Numbering/formulas: sequence migration/reset rules, generated name order, Overall Score and calculated Date/Test Status definitions.

### E. Not supported by client evidence — do not build

- Court Booking or Assignment subsystem from the scheduler navigation label alone.
- Payment processing, rates, invoicing, timesheets or payroll integration.
- Automatic renewal, accreditation expiry, suspension or reminder workflows.
- Automatic emails/SMS merely because notification checkboxes or date-sent fields exist.
- E-signature capture merely because the sign-in list includes a signature column.
- Automatic course enrolment, LMS, course delivery or certificates.
- Background-check service integration or a clearance approval BPF.
- A separate manual accreditation approval BPF, appeals workflow, or a new score formula.
- Automatic Complaint Result -> retraining event creation or Registry removal.
- Power BI dashboards or unspecified reports beyond the concrete sign-in list and Excel export.
- A complete custom website merely to reproduce the source SharePoint appearance.
