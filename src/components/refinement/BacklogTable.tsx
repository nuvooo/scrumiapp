"use client";

import { useMemo, useState } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import type { JiraSearchResult } from "@/lib/jira/jiraClient";

const columnHelper = createColumnHelper<JiraSearchResult>();

type FacetKey = "issueType" | "status" | "parent" | "label" | "component";

const FACETS: { key: FacetKey; label: string; all: string }[] = [
  { key: "issueType", label: "Typ", all: "Alle Typen" },
  { key: "status", label: "Status", all: "Alle Status" },
  { key: "parent", label: "Epic", all: "Alle Epics" },
  { key: "label", label: "Label", all: "Alle Labels" },
  { key: "component", label: "Komponente", all: "Alle Komponenten" },
];

/** Sentinel für „ohne Epic/Label/Komponente". */
const NONE = "__none__";

/** Werte eines Tickets für eine Filter-Facette (leer = „ohne"). */
function facetValues(r: JiraSearchResult, key: FacetKey): string[] {
  switch (key) {
    case "issueType":
      return [r.issueType];
    case "status":
      return [r.status];
    case "parent":
      return r.parent ? [r.parent] : [];
    case "label":
      return r.labels ?? [];
    case "component":
      return r.components ?? [];
  }
}

/** Filtert Tickets nach den gewählten Facetten (UND-verknüpft, "" = alle). */
export function filterBacklog(rows: JiraSearchResult[], filters: Partial<Record<FacetKey, string>>): JiraSearchResult[] {
  return rows.filter((r) =>
    FACETS.every(({ key }) => {
      const want = filters[key];
      if (!want) return true;
      const values = facetValues(r, key);
      return want === NONE ? values.length === 0 : values.includes(want);
    }),
  );
}

/** Griff-Punkte: signalisieren, dass die Zeile per Drag & Drop verschiebbar ist. */
export function DragHandle() {
  return (
    <span title="Zum Verschieben ziehen" className="cursor-grab text-faint">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="6" r="1.7" />
        <circle cx="15" cy="6" r="1.7" />
        <circle cx="9" cy="12" r="1.7" />
        <circle cx="15" cy="12" r="1.7" />
        <circle cx="9" cy="18" r="1.7" />
        <circle cx="15" cy="18" r="1.7" />
      </svg>
    </span>
  );
}

/**
 * Backlog als sortier- und filterbares Datagrid (TanStack Table) mit
 * Mehrfachauswahl: Checkboxen markieren, dann alle auf einmal hinzufügen.
 * Standard-Reihenfolge ist der Jira-Rank; Klick auf einen Spaltenkopf sortiert um.
 */
export function BacklogTable({
  rows,
  addedKeys,
  onAdd,
  onAddMany,
}: {
  rows: JiraSearchResult[];
  addedKeys: Set<string>;
  onAdd: (result: JiraSearchResult) => void;
  onAddMany: (results: JiraSearchResult[]) => void | Promise<void>;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [filters, setFilters] = useState<Partial<Record<FacetKey, string>>>({});
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Auswahlwerte je Facette aus den geladenen Tickets; „ohne …" nur, wenn es solche Tickets gibt.
  const facetOptions = useMemo(() => {
    const result = {} as Record<FacetKey, { values: string[]; hasNone: boolean }>;
    for (const { key } of FACETS) {
      const values = new Set<string>();
      let hasNone = false;
      for (const r of rows) {
        const v = facetValues(r, key);
        if (v.length === 0) hasNone = true;
        v.forEach((x) => values.add(x));
      }
      result[key] = { values: [...values].sort((a, b) => a.localeCompare(b, "de")), hasNone };
    }
    return result;
  }, [rows]);
  const filteredRows = useMemo(() => filterBacklog(rows, filters), [rows, filters]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [adding, setAdding] = useState(false);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "drag",
        header: "",
        cell: ({ row }) => (addedKeys.has(row.original.jiraKey) ? null : <DragHandle />),
      }),
      columnHelper.display({
        id: "select",
        header: ({ table }) => {
          // Kopf-Checkbox wählt alle (gefilterten) noch wählbaren Zeilen.
          const selectable = table.getFilteredRowModel().rows.filter((r) => r.getCanSelect());
          const allSelected = selectable.length > 0 && selectable.every((r) => r.getIsSelected());
          return (
            <input
              type="checkbox"
              aria-label="Alle auswählen"
              checked={allSelected}
              onChange={() => {
                const next: RowSelectionState = {};
                if (!allSelected) selectable.forEach((r) => (next[r.id] = true));
                table.setRowSelection(next);
              }}
              className="h-4 w-4 accent-[#6e8ff6]"
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`${row.original.jiraKey} auswählen`}
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 accent-[#6e8ff6] disabled:opacity-40"
          />
        ),
      }),
      columnHelper.accessor("jiraKey", {
        header: "Key",
        cell: (info) => (
          <span className="flex items-center gap-1">
            <span className="font-mono text-[11.5px] text-link">{info.getValue()}</span>
            <a
              href={info.row.original.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${info.getValue()} in Jira öffnen`}
              title="In Jira öffnen"
              className="flex-none rounded-md p-1 text-faint hover:bg-chip hover:text-link"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </span>
        ),
      }),
      columnHelper.accessor("issueType", {
        header: "Typ",
        cell: (info) => (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => (
          <span className="rounded-full border border-edge px-1.5 py-px font-mono text-[10px] text-mid">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("summary", {
        header: "Titel",
        cell: (info) => (
          <span className="block max-w-[520px]">
            <span className="block truncate text-[12.5px] text-fg">{info.getValue()}</span>
            {info.row.original.parent && (
              <span className="block truncate font-mono text-[10.5px] text-faint">↳ {info.row.original.parent}</span>
            )}
          </span>
        ),
      }),
      columnHelper.display({
        id: "aktion",
        header: "",
        cell: ({ row }) => (
          <button
            type="button"
            aria-label={`${row.original.jiraKey} hinzufügen`}
            onClick={() => onAdd(row.original)}
            disabled={addedKeys.has(row.original.jiraKey)}
            className="btn-secondary whitespace-nowrap px-3 py-1 disabled:opacity-40"
          >
            {addedKeys.has(row.original.jiraKey) ? "drin" : "+ Hinzufügen"}
          </button>
        ),
      }),
    ],
    [addedKeys, onAdd],
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, globalFilter, rowSelection },
    getRowId: (r) => r.jiraKey,
    enableRowSelection: (row) => !addedKeys.has(row.original.jiraKey),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const visible = table.getRowModel().rows;
  const selected = table.getSelectedRowModel().rows.map((r) => r.original);

  const addSelected = async () => {
    if (selected.length === 0 || adding) return;
    setAdding(true);
    await onAddMany(selected);
    setAdding(false);
    setRowSelection({});
  };

  return (
    <div data-testid="backlog-grid" className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Backlog filtern"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filtern (Key, Titel, Typ, Status)…"
          className="input-field max-w-[320px]"
        />
        {FACETS.map(({ key, label, all }) => {
          const opts = facetOptions[key];
          // Facetten ohne Auswahl (z. B. keine Labels im Backlog) blenden wir aus.
          if (opts.values.length === 0 || (opts.values.length === 1 && !opts.hasNone)) return null;
          return (
            <select
              key={key}
              aria-label={`Nach ${label} filtern`}
              value={filters[key] ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
              className={`input-field w-auto max-w-[200px] py-[7px] text-[12.5px] ${filters[key] ? "border-accent text-fg" : "text-mid"}`}
            >
              <option value="">{all}</option>
              {opts.values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
              {opts.hasNone && <option value={NONE}>ohne {label}</option>}
            </select>
          );
        })}
        {activeFilterCount > 0 && (
          <button type="button" onClick={() => setFilters({})} className="text-[12px] text-link hover:text-linkhi">
            Filter zurücksetzen
          </button>
        )}
        {(globalFilter || activeFilterCount > 0) && (
          <span className="text-[12px] text-dim">
            {visible.length} von {rows.length} Tickets
          </span>
        )}
        {selected.length > 0 && (
          <button
            type="button"
            onClick={addSelected}
            disabled={adding}
            className="btn-primary ml-auto px-4 py-2 disabled:opacity-50"
          >
            {adding ? "Fügt hinzu…" : `${selected.length} ausgewählte hinzufügen`}
          </button>
        )}
      </div>
      <div className="mt-3 max-h-[480px] overflow-auto rounded-[10px] border border-edge">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-field">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-line">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2">
                    {header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="mono-label flex items-center gap-1"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-[9px]">
                          {{ asc: "▲", desc: "▼" }[header.column.getIsSorted() as string] ?? ""}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                draggable={!addedKeys.has(row.original.jiraKey)}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-backlog-ticket", JSON.stringify(row.original));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className={`border-b border-row last:border-b-0 ${addedKeys.has(row.original.jiraKey) ? "" : "cursor-grab"}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-1.5 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-muted">
                  Kein Ticket passt zum Filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
