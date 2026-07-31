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
        cell: (info) => <span className="block max-w-[520px] truncate text-[12.5px] text-fg">{info.getValue()}</span>,
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
    data: rows,
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
        {globalFilter && (
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
