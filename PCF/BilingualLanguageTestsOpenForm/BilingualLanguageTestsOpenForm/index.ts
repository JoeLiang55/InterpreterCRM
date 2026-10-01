import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { BILINGUAL, LANGUAGE_TABLE, TEST_TABLE, TEST_COLUMNS, TestHistory, cellText, errorText, guid, interpreterReferenceId } from "./history";
import { BoundViewInspector, DatasetDiagnostics, categoryCode, categoryError, datasetDiagnostics } from "./diagnostics";
import { BUILD_INFO } from "./buildInfo";

type Dataset = ComponentFramework.PropertyTypes.DataSet;
type EntityRecord = ComponentFramework.PropertyHelper.DataSetApi.EntityRecord;
interface LanguageRow { id: string; record: EntityRecord; name: string }

export class BilingualLanguageTestsOpenForm implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private context!: ComponentFramework.Context<IInputs>;
    private root!: HTMLDivElement;
    private history = new TestHistory();
    private languages: LanguageRow[] = [];
    private scope?: string;
    private configurationError?: string;
    private diagnostics?: DatasetDiagnostics;
    private viewInspector = new BoundViewInspector();
    private diagnosticsOpen = false;
    private navigationError?: string;
    private refreshPending = false;
    private datasetWasLoading = false;
    private destroyed = false;
    private static instances = 0;
    private instanceId = "gsic-openform-" + ++BilingualLanguageTestsOpenForm.instances;

    public init(context: ComponentFramework.Context<IInputs>, _notify: () => void,
        _state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this.context = context;
        // Only this supplied container and its owned descendants are modified.
        this.root = container.ownerDocument.createElement("div");
        this.root.className = "gsic-language-tests";
        container.appendChild(this.root);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        if (this.destroyed) return;
        this.context = context;
        const dataset = context.parameters.languages;
        this.diagnostics = datasetDiagnostics(dataset, context.parameters.interpreterId.raw, interpreterReferenceId);
        this.viewInspector.setView(String(this.diagnostics.snapshot.viewId));
        const datasetChanged = context.updatedProperties.includes("dataset") || context.updatedProperties.includes("languages");
        const loadCompleted = !dataset.loading && (datasetChanged || this.datasetWasLoading);
        this.datasetWasLoading = dataset.loading;
        try {
            const interpreterId = guid(context.parameters.interpreterId.raw || "");
            if (this.scope !== interpreterId) {
                this.history.clear();
                this.languages = [];
                this.scope = interpreterId;
            }
        } catch {
            this.history.clear();
            this.languages = [];
            this.scope = undefined;
            this.configurationError = "Save the Interpreter and configure its record ID before loading related languages.";
            this.render();
            return;
        }
        if (!dataset.loading) {
            try {
                this.languages = this.readLanguages(dataset);
                this.configurationError = undefined;
            } catch (error) {
                this.languages = [];
                this.configurationError = errorText(error);
            }
            // Refresh invalidates cached tests, never the expansion choices.
            if (loadCompleted) {
                this.history.invalidate();
                this.refreshPending = false;
            }
        }
        this.render();
        if (!dataset.loading && !this.refreshPending && !dataset.error && !this.configurationError) {
            for (const language of this.languages) {
                const entry = this.history.entry(language.id);
                if (entry.expanded && entry.status === "idle") this.loadTests(language.id);
            }
        }
    }

    private readLanguages(dataset: Dataset): LanguageRow[] {
        if (dataset.getTargetEntityType() !== LANGUAGE_TABLE) {
            throw new Error("Bind this component to an Interpreter Language related-record subgrid.");
        }
        const required = ["gsic_languagename", "gsic_languagecategory", "gsic_interpreter"];
        if (required.some(name => !dataset.columns.some(column => column.name === name))) {
            throw new Error("The language view must include Language Name, Language Category and Interpreter.");
        }
        const rows = dataset.sortedRecordIds.map(key => {
            const record = dataset.records[key];
            const id = guid(record.getRecordId());
            const rawCategory = record.getValue("gsic_languagecategory");
            if (categoryCode(rawCategory) !== BILINGUAL) {
                throw new Error(categoryError(dataset, id, rawCategory));
            }
            if (interpreterReferenceId(record.getValue("gsic_interpreter")) !== this.scope) {
                throw new Error("The language view returned a row for a different Interpreter. Configure Only related records.");
            }
            return { id, record, name: record.getFormattedValue("gsic_languagename") || "Interpreter Language" };
        });
        return rows;
    }

    private loadTests(id: string, more = false): void {
        void this.history.load(id,
            (entity, options, size) => this.context.webAPI.retrieveMultipleRecords(entity, options, size),
            () => this.render(), more);
    }

    private refresh(): void {
        if (this.refreshPending || this.context.parameters.languages.loading) return;
        this.history.invalidate();
        this.navigationError = undefined;
        this.refreshPending = true;
        this.render();
        try {
            this.context.parameters.languages.refresh();
        } catch (error) {
            this.refreshPending = false;
            this.navigationError = errorText(error);
            this.render();
        }
    }

    private createTest(language: LanguageRow): void {
        if (this.context.mode.isControlDisabled || this.destroyed || this.refreshPending || this.context.parameters.languages.loading) return;
        try {
            const formId = guid(this.context.parameters.testResultFormId.raw || "");
            this.navigationError = undefined;
            // Main-form openForm does not report save completion. Use explicit Refresh.
            void this.context.navigation.openForm({
                entityName: TEST_TABLE,
                formId,
                useQuickCreateForm: false,
                openInNewWindow: true
            }, {
                gsic_interpreterlanguage: language.id,
                gsic_interpreterlanguagename: language.name
            }).catch((error: unknown) => {
                if (!this.destroyed) {
                    this.navigationError = "Could not open Test Result: " + errorText(error);
                    this.render();
                }
            });
        } catch (error) {
            this.navigationError = "Could not open Test Result: " + errorText(error);
        }
        this.render();
    }

    private element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
        const element = this.root.ownerDocument.createElement(tag);
        if (text !== undefined) element.textContent = text;
        return element;
    }

    private button(text: string, action: () => void, key: string, disabled = false): HTMLButtonElement {
        const button = this.element("button", text);
        button.type = "button";
        button.dataset.focus = key;
        button.disabled = disabled;
        button.addEventListener("click", action);
        return button;
    }

    private message(text: string, error = false): HTMLParagraphElement {
        const message = this.element("p", text);
        message.className = error ? "gsic-error" : "gsic-message";
        message.setAttribute("role", error ? "alert" : "status");
        return message;
    }

    private render(): void {
        if (this.destroyed) return;
        const active = this.root.ownerDocument.activeElement as HTMLElement | null;
        const focusKey = active && this.root.contains(active) ? active.dataset.focus : undefined;
        this.root.replaceChildren();
        const dataset = this.context.parameters.languages;
        const busy = dataset.loading || this.refreshPending;
        const marker = this.element("p", BUILD_INFO.component + " | v" + BUILD_INFO.version + " | build " + BUILD_INFO.build);
        marker.className = "gsic-build-marker";
        this.root.append(marker);
        const toolbar = this.element("div");
        toolbar.className = "gsic-toolbar";
        toolbar.append(this.button("Refresh", () => this.refresh(), "refresh", busy));
        toolbar.append(this.element("span", "After saving a Test Result, return here and select Refresh."));
        this.root.append(toolbar);
        if (this.diagnostics) {
            const details = this.element("details");
            details.className = "gsic-diagnostics";
            details.open = this.diagnosticsOpen || !!this.configurationError || dataset.error;
            details.addEventListener("toggle", () => {
                if (this.root.contains(details)) this.diagnosticsOpen = details.open;
            });
            details.append(this.element("summary", "Bound view: " + this.diagnostics.boundView));
            details.append(this.element("p", "Dataset diagnostics — row values and runtime filter only; the saved view filter is not inferred here."));
            details.append(this.element("pre", JSON.stringify({ ...BUILD_INFO, ...this.diagnostics.snapshot,
                messages: { validation: this.configurationError ?? null, navigation: this.navigationError ?? null }
            }, null, 2)));
            details.append(this.button("Inspect bound view", () => {
                this.diagnosticsOpen = true;
                void this.viewInspector.inspect(
                    (entity, options, size) => this.context.webAPI.retrieveMultipleRecords(entity, options, size),
                    () => this.render());
            }, "inspect-view", this.viewInspector.status === "loading" || dataset.loading));
            if (this.viewInspector.status === "loading") details.append(this.message("Reading the bound view definition…"));
            if (this.viewInspector.error) details.append(this.message(this.viewInspector.error, true));
            if (this.viewInspector.definition) details.append(this.element("pre", JSON.stringify(this.viewInspector.definition, null, 2)));
            this.root.append(details);
        }
        let creationConfigured = true;
        try { guid(this.context.parameters.testResultFormId.raw || ""); }
        catch { creationConfigured = false; }
        if (!creationConfigured) this.root.append(this.message("Test Result creation is not configured on this form.", true));
        if (this.navigationError) this.root.append(this.message(this.navigationError, true));
        if (dataset.error) {
            this.root.append(this.message(dataset.errorMessage || "The language dataset could not be loaded.", true));
            return;
        }
        if (this.configurationError) {
            this.root.append(this.message(this.configurationError, true));
            return;
        }
        if (busy) this.root.append(this.message("Refreshing languages…"));
        if (!this.languages.length && !busy) this.root.append(this.message("No bilingual languages in this related view."));
        const columns = dataset.columns.filter(column => !column.isHidden &&
            column.name !== "gsic_interpreter" && column.name !== "gsic_languagecategory");
        const table = this.element("table");
        table.className = "gsic-languages";
        table.append(this.element("caption", "Bilingual Interpreter Languages"));
        const head = this.element("thead");
        const headings = this.element("tr");
        headings.append(this.element("th", "Tests"));
        for (const column of columns) headings.append(this.element("th", column.displayName));
        for (const cell of Array.from(headings.children)) cell.setAttribute("scope", "col");
        head.append(headings);
        table.append(head);
        const body = this.element("tbody");
        for (const language of this.languages) {
            const entry = this.history.entry(language.id);
            const row = this.element("tr");
            const cell = this.element("td");
            const toggle = this.button(entry.expanded ? "▼" : "▶", () => {
                this.history.toggle(language.id);
                this.render();
                const current = this.history.entry(language.id);
                if (current.expanded && current.status === "idle") this.loadTests(language.id);
            }, "toggle-" + language.id, busy);
            toggle.setAttribute("aria-expanded", String(entry.expanded));
            toggle.setAttribute("aria-label", (entry.expanded ? "Collapse" : "Expand") + " tests for " + language.name);
            toggle.setAttribute("aria-controls", this.instanceId + "-tests-" + language.id);
            cell.append(toggle);
            row.append(cell);
            for (const column of columns) row.append(this.element("td", language.record.getFormattedValue(column.name) || "—"));
            body.append(row);
            if (entry.expanded) {
                const detail = this.element("tr");
                const detailCell = this.element("td");
                detailCell.colSpan = columns.length + 1;
                const region = this.element("section");
                region.id = this.instanceId + "-tests-" + language.id;
                region.className = "gsic-test-region";
                region.setAttribute("aria-label", "Test Results for " + language.name);
                // Always precedes the columns, including empty, loading and failed histories.
                region.append(this.button("+ New Test Result", () => this.createTest(language), "new-" + language.id,
                    busy || !creationConfigured || this.context.mode.isControlDisabled));
                if (entry.status === "loading") region.append(this.message("Loading test results…"));
                if (entry.error) {
                    region.append(this.message(entry.error, true));
                    region.append(this.button("Retry", () => this.loadTests(language.id, !!entry.rows.length && !!entry.nextLink), "retry-" + language.id, busy));
                }
                const tests = this.element("table");
                tests.className = "gsic-tests";
                tests.append(this.element("caption", "Test Results — newest Test Date first"));
                const testHead = this.element("thead");
                const testHeadRow = this.element("tr");
                for (const column of TEST_COLUMNS) {
                    const heading = this.element("th", column.label);
                    heading.scope = "col";
                    if (column.name === "gsic_testdate") heading.setAttribute("aria-sort", "descending");
                    testHeadRow.append(heading);
                }
                testHead.append(testHeadRow);
                tests.append(testHead);
                const testBody = this.element("tbody");
                for (const test of entry.rows) {
                    const testRow = this.element("tr");
                    for (const column of TEST_COLUMNS) testRow.append(this.element("td", cellText(test, column.name)));
                    testBody.append(testRow);
                }
                tests.append(testBody);
                region.append(tests);
                if (entry.status === "loaded" && !entry.rows.length) region.append(this.message("No test results for this language."));
                if (entry.nextLink) region.append(this.button("Load more test results", () => this.loadTests(language.id, true), "more-" + language.id, busy || entry.status === "loading"));
                detailCell.append(region);
                detail.append(detailCell);
                body.append(detail);
            }
        }
        table.append(body);
        const scroll = this.element("div");
        scroll.className = "gsic-table-scroll";
        scroll.append(table);
        this.root.append(scroll);
        const paging = this.element("div");
        paging.className = "gsic-toolbar";
        paging.append(this.button("Previous languages", () => dataset.paging.loadPreviousPage(), "previous", busy || !dataset.paging.hasPreviousPage));
        paging.append(this.button("Next languages", () => dataset.paging.loadNextPage(), "next", busy || !dataset.paging.hasNextPage));
        this.root.append(paging);
        if (focusKey) {
            const match = Array.from(this.root.querySelectorAll<HTMLButtonElement>("button")).find(button => button.dataset.focus === focusKey);
            match?.focus();
        }
    }

    public getOutputs(): IOutputs { return {}; }

    public destroy(): void {
        this.destroyed = true;
        this.history.destroy();
        this.viewInspector.destroy();
        this.root.remove();
    }
}
