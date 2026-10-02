// Logical names come from repository schema evidence and the confirmed Test Result screenshot.
export const LANGUAGE_TABLE = "gsic_interpreterlanguage";
export const TEST_TABLE = "gsic_testresult";
export const BILINGUAL = 472540000;
export const LANGUAGE_CATEGORIES = new Map<number, string>([
    [BILINGUAL, "Bilingual"],
    [472540001, "English"],
    [472540002, "First Nation"]
]);
export const LOOKUP_VALUE = "_gsic_interpreterlanguage_value";
export const TEST_COLUMNS = [
    { name: "gsic_testdate", label: "Test Date" },
    { name: "gsic_testtype", label: "Test Type" },
    { name: "gsic_testversion", label: "Test Version" },
    { name: "gsic_sighttranslationscore", label: "Sight Translation Score" },
    { name: "gsic_consecutiveinterpretingscore", label: "Consecutive Interpreting Score" },
    { name: "gsic_simultaneousinterpretingscore", label: "Simultaneous Interpreting Score" },
    { name: "gsic_testincident", label: "Test Incident" }
] as const;

export type TestRow = Record<string, unknown>;
export interface TestPage { entities: TestRow[]; nextLink?: string }
export type RetrieveTests = (entity: string, options: string, size: number) => Promise<TestPage>;
export interface HistoryEntry {
    expanded: boolean;
    status: "idle" | "loading" | "loaded" | "error";
    rows: TestRow[];
    nextLink?: string;
    error?: string;
    request: number;
}

export function guid(value: string): string {
    const id = value.replace(/[{}]/g, "").trim().toLowerCase();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
        throw new Error("A saved record with a valid ID is required.");
    }
    return id;
}

export function interpreterReferenceId(value: unknown): string {
    const references = Array.isArray(value) ? value : [value];
    if (references.length !== 1 || !references[0] || typeof references[0] !== "object") {
        throw new Error("Every language must belong to a saved Interpreter.");
    }
    const reference = references[0] as { etn?: string; entityType?: string; id?: string | { guid?: string } };
    if ((reference.etn || reference.entityType) !== "gsic_interpreter") {
        throw new Error("Every language must belong to a saved Interpreter.");
    }
    const id = typeof reference.id === "string" ? reference.id : reference.id?.guid;
    return guid(id || "");
}

export function testQuery(languageId: string): string {
    return "?$select=" + [...TEST_COLUMNS.map(column => column.name), LOOKUP_VALUE].join(",") +
        "&$filter=" + LOOKUP_VALUE + " eq " + guid(languageId) + "&$orderby=gsic_testdate desc";
}

export function continuationQuery(nextLink: string): string {
    // PCF takes query options, not an absolute URL. Keep the encoded skip token unchanged.
    const question = nextLink.indexOf("?");
    if (question < 0) throw new Error("Dataverse returned an invalid continuation link.");
    return nextLink.slice(question);
}

export function cellText(row: TestRow, name: string): string {
    const value = row[name];
    if (value === null || value === undefined) return "—";
    const formatted = row[name + "@OData.Community.Display.V1.FormattedValue"];
    if (typeof formatted === "string") return formatted;
    if (name === "gsic_testincident") return value === true ? "Yes" : value === false ? "No" : "—";
    // Do not apply a timezone conversion: Date Only format is known, behavior is not.
    if (name === "gsic_testdate" && typeof value === "string") return value.slice(0, 10);
    return String(value); // Includes string versions such as "01" and zero scores.
}

export function errorText(error: unknown): string {
    if (error && typeof error === "object" && "message" in error) return String(error.message);
    return "The request failed. Please try again.";
}

export class TestHistory {
    private entries = new Map<string, HistoryEntry>();
    private disposed = false;

    public entry(id: string): HistoryEntry {
        id = guid(id);
        let entry = this.entries.get(id);
        if (!entry) {
            entry = { expanded: false, status: "idle", rows: [], request: 0 };
            this.entries.set(id, entry);
        }
        return entry;
    }

    public toggle(id: string): void {
        const entry = this.entry(id);
        entry.expanded = !entry.expanded;
        if (!entry.expanded && entry.status === "loading") {
            entry.request++;
            entry.status = entry.rows.length ? "loaded" : "idle";
        }
    }

    public invalidate(): void {
        // Expansion is keyed by language ID and survives refresh, loading and paging.
        for (const entry of this.entries.values()) {
            entry.request++;
            entry.status = "idle";
            entry.rows = [];
            entry.nextLink = undefined;
            entry.error = undefined;
        }
    }

    public clear(): void {
        this.invalidate();
        this.entries.clear();
    }

    public destroy(): void {
        this.disposed = true;
        this.clear();
    }

    public async load(id: string, retrieve: RetrieveTests, changed: () => void, more = false): Promise<void> {
        id = guid(id);
        const entry = this.entry(id);
        if (this.disposed || !entry.expanded || entry.status === "loading") return;
        if (more && !entry.nextLink) return;
        const request = ++entry.request;
        entry.status = "loading";
        entry.error = undefined;
        changed();
        try {
            const options = more ? continuationQuery(entry.nextLink!) : testQuery(id);
            const page = await retrieve(TEST_TABLE, options, 250);
            if (this.disposed || request !== entry.request || !entry.expanded) return;
            // The server filter is authoritative; fail closed if a returned page violates it.
            if (page.entities.some(row => typeof row[LOOKUP_VALUE] !== "string" || guid(row[LOOKUP_VALUE] as string) !== id)) {
                throw new Error("Dataverse returned a test for a different Interpreter Language.");
            }
            entry.rows = more ? entry.rows.concat(page.entities) : page.entities;
            entry.nextLink = page.nextLink;
            entry.status = "loaded";
        } catch (error) {
            if (this.disposed || request !== entry.request || !entry.expanded) return;
            entry.error = errorText(error);
            entry.status = "error";
        }
        changed();
    }
}
