type Dataset = ComponentFramework.PropertyTypes.DataSet;
type Filter = ComponentFramework.PropertyHelper.DataSetApi.FilterExpression;
import { LANGUAGE_CATEGORIES, errorText, guid } from "./history";

// A Choice may reach the dataset as an integer or an integer string. Do not accept
// labels, arrays, Boolean coercion or guessed object wrappers as category codes.
export function categoryCode(value: unknown): number | undefined {
    if (typeof value === "number") return Number.isSafeInteger(value) ? value : undefined;
    if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) return undefined;
    const code = Number(value.trim());
    return Number.isSafeInteger(code) ? code : undefined;
}

function safe(read: () => unknown): string {
    try { return String(read() ?? "Unavailable"); }
    catch (error) { return "Unavailable: " + (error instanceof Error ? error.message : String(error)); }
}

export function valueType(value: unknown): string {
    return value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
}

export function rawText(value: unknown): string {
    try { return JSON.stringify(value) ?? "undefined"; }
    catch { return "[unserializable]"; }
}

export function viewIdentity(dataset: Dataset): string {
    return safe(() => dataset.getTitle()) + " [" + safe(() => dataset.getViewId()) + "]";
}

export function categoryError(id: string, raw: unknown): string {
    const supported = Array.from(LANGUAGE_CATEGORIES, ([code, label]) => label + " (" + code + ")").join(", ");
    return "Language " + id + " returned gsic_languagecategory=" + rawText(raw) +
    " (" + valueType(raw) + "); expected a supported Language Category: " + supported + ".";
}

function filterShape(filter: Filter): unknown {
    return {
        filterOperator: filter.filterOperator,
        conditions: (filter.conditions || []).map(condition => ({
            attributeName: condition.attributeName,
            conditionOperator: condition.conditionOperator,
            // Unrelated filters can contain search text or personal values. Do not collect them.
            value: condition.attributeName === "gsic_languagecategory" ? rawText(condition.value) : "[omitted]"
        })),
        filters: (filter.filters || []).map(filterShape)
    };
}

export interface DatasetDiagnostics {
    boundView: string;
    snapshot: Record<string, unknown>;
}

export function datasetDiagnostics(dataset: Dataset, parent: unknown,
    ownerId: (value: unknown) => string): DatasetDiagnostics {
    let runtimeFilter: unknown;
    try {
        const filter = dataset.filtering?.getFilter();
        runtimeFilter = filter ? filterShape(filter) : "Unavailable";
    } catch (error) { runtimeFilter = safe(() => { throw error; }); }
    return {
        boundView: viewIdentity(dataset),
        snapshot: {
            viewId: safe(() => dataset.getViewId()),
            viewTitle: safe(() => dataset.getTitle()),
            table: safe(() => dataset.getTargetEntityType()),
            interpreterIdInput: typeof parent === "string" ? parent : valueType(parent),
            loading: dataset.loading,
            datasetError: dataset.error,
            datasetErrorMessage: dataset.error ? dataset.errorMessage : undefined,
            columns: dataset.columns.map(column => ({
                name: column.name, alias: column.alias, dataType: column.dataType, hidden: column.isHidden
            })),
            loadedLanguageCount: dataset.sortedRecordIds.length,
            rows: dataset.sortedRecordIds.slice(0, 20).map(key => {
                const record = dataset.records[key];
                let category: unknown;
                try { category = record?.getValue("gsic_languagecategory"); }
                catch (error) { category = safe(() => { throw error; }); }
                return {
                    languageId: safe(() => record.getRecordId()),
                    rawCategory: rawText(category), rawCategoryType: valueType(category),
                    normalizedCategory: categoryCode(category) ?? null,
                    formattedCategory: safe(() => record.getFormattedValue("gsic_languagecategory")),
                    interpreterId: safe(() => ownerId(record.getValue("gsic_interpreter")))
                };
            }),
            runtimeFilter,
            filterNote: "Diagnostic only. The runtime filter is not required to contain the saved view FetchXML predicates."
        }
    };
}

type RetrieveView = (entity: string, options: string, size: number) => Promise<{ entities: Record<string, unknown>[] }>;

export class BoundViewInspector {
    public status: "idle" | "loading" | "loaded" | "error" = "idle";
    public definition?: Record<string, unknown>;
    public error?: string;
    private id?: string;
    private request = 0;

    public setView(id: string): void {
        if (this.id === id) return;
        this.request++;
        this.id = id;
        this.status = "idle";
        this.definition = undefined;
        this.error = undefined;
    }

    public destroy(): void { this.request++; }

    public async inspect(retrieve: RetrieveView, changed: () => void): Promise<void> {
        if (this.status === "loading") return;
        const request = ++this.request;
        this.status = "loading";
        this.error = undefined;
        changed();
        try {
            const id = guid(this.id || "");
            // Resolve by the dataset's actual GUID, never by a duplicate display name.
            let table = "savedquery";
            let key = "savedqueryid";
            let result = await retrieve(table,
                "?$select=" + key + ",name,returnedtypecode,fetchxml&$filter=" + key + " eq " + id, 1);
            if (request !== this.request) return;
            if (!result.entities.length) {
                table = "userquery";
                key = "userqueryid";
                result = await retrieve(table,
                    "?$select=" + key + ",name,returnedtypecode,fetchxml&$filter=" + key + " eq " + id, 1);
                if (request !== this.request) return;
            }
            const view = result.entities[0];
            if (!view) throw new Error("The bound view definition was not found or is not readable. Its runtime GUID remains available above.");
            if (guid(String(view[key])) !== id) throw new Error("The returned view ID differs from the bound dataset view ID.");
            this.definition = { sourceTable: table, viewId: id, name: view.name,
                table: view.returnedtypecode, savedViewFetchXml: view.fetchxml };
            this.status = "loaded";
        } catch (error) {
            if (request !== this.request) return;
            this.error = errorText(error);
            this.status = "error";
        }
        changed();
    }
}
