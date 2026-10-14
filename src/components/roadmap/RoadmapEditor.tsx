"use client";

import "./roadmap.css";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGoalAction, addJiraItemAction, createBlockAction, createLabelAction, createLaneAction,
  createMilestoneAction, deleteBlockAction, deleteItemAction, deleteLabelAction, deleteLaneAction,
  deleteMilestoneAction, deleteRoadmapAction, moveBlockAction, moveItemAction, moveLaneAction,
  refreshStatusesAction, renameLaneAction, renameRoadmapAction, setItemLabelsAction, shiftBlockAction,
  updateBlockAction, updateBlockSpanAction, updateGoalAction, updateLabelAction, updateMilestoneAction,
} from "@/app/(app)/roadmap/actions";
import { addDays, dayDiff, dayFromNumber, dayKey, dayNumber, formatDay, type Zoom } from "@/lib/view/roadmapDays";
import {
  INBOX_ID, buildTree, inboxBlock, isAncestor, leaves, pathOf, typeAt,
  type BlockInput, type TreeBlock, type TreeItem,
} from "@/lib/view/roadmapTree";
import { NEW_BLOCK_DAYS, addTarget, type AddKind } from "@/lib/view/roadmapLayout";
import { RoadmapBoard } from "./RoadmapBoard";
import { RoadmapItemDrawer } from "./RoadmapItemDrawer";
import { RoadmapBlockDrawer } from "./RoadmapBlockDrawer";
import { RoadmapGoalDialog } from "./RoadmapGoalDialog";
import { RoadmapBlockDialog, type BlockOption } from "./RoadmapBlockDialog";
import { RoadmapLanesDialog } from "./RoadmapLanesDialog";
import { RoadmapSidePanel, type SidePanelIssue } from "./RoadmapSidePanel";
import { RoadmapConfirmDialog } from "./RoadmapConfirmDialog";
import { RoadmapLabelsDialog } from "./RoadmapLabelsDialog";
import { RoadmapMilestoneDialog } from "./RoadmapMilestoneDialog";
import { RoadmapMenu, type MenuEntry } from "./RoadmapMenu";
import { useIsRoadmapModerator } from "./useRoadmapRole";
import type { BlockView, LaneView, MilestoneView, Placement, RoadmapItemView, RoadmapView } from "./types";

export type { RoadmapView } from "./types";

/** Eingeklappte Blöcke pro Roadmap im localStorage — neue Blöcke sind damit standardmäßig offen. */
const closedKey = (roadmapId: string) => `roadmap-closed:${roadmapId}`;

function readClosed(roadmapId: string): Set<string> {
  try {
    const raw = localStorage.getItem(closedKey(roadmapId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeClosed(roadmapId: string, closed: Set<string>) {
  try {
    localStorage.setItem(closedKey(roadmapId), JSON.stringify([...closed]));
  } catch {
    /* localStorage nicht verfügbar */
  }
}

/** Blöcke als eingerückte Auswahlliste (Baumreihenfolge). */
function blockOptions(blocks: BlockView[], excludeSubtreeOf: string | null = null): BlockOption[] {
  const byParent = new Map<string | null, BlockView[]>();
  for (const b of blocks) {
    const list = byParent.get(b.parentId) ?? [];
    list.push(b);
    byParent.set(b.parentId, list);
  }
  const out: BlockOption[] = [];
  const rec = (parentId: string | null, depth: number, disabled: boolean) => {
    const list = (byParent.get(parentId) ?? []).sort((a, b) => a.position - b.position);
    for (const b of list) {
      const dis = disabled || b.id === excludeSubtreeOf;
      out.push({ id: b.id, label: `${"  ".repeat(depth)}${depth > 0 ? "└ " : ""}${b.name}`, disabled: dis });
      rec(b.id, depth + 1, dis);
    }
  };
  rec(null, 0, false);
  return out;
}

/* ---------- Icons der Werkzeugleiste (aus der Vorlage) ---------- */
const svg = (d: React.ReactNode, size = 15) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);
const I = {
  caret: <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true"><path d="M1.5 3 L4.5 6 L7.5 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  projekt: <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.2 L13 4.3 L7 7.4 L1 4.3 Z" /><path d="M1.6 7.3 L7 10.1 L12.4 7.3" /><path d="M1.6 10.2 L7 13 L12.4 10.2" /></svg>,
  teilprojekt: <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.2 3.4 h4.2 l1.3 1.7 H12.8 v7.5 H1.2 Z" /></svg>,
  bereich: <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.4 2.6 h11.2 v3.4 H1.4 Z" /><path d="M1.4 8 h7.6 v3.4 H1.4 Z" /></svg>,
  ticket: <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1.3 3.6 h11.4 v6.8 H1.3 Z" /><path d="M9.2 3.6 v6.8" strokeDasharray="1.6 1.6" /></svg>,
  ziel: <svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.2" /><circle cx="7" cy="7" r="2" /></svg>,
  ms: <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1.4 L12.6 7 L7 12.6 L1.4 7 Z" /></svg>,
  collapse: svg(<><path d="M3 7.5 L7 3.5 L11 7.5" /><path d="M3 11.5 L7 7.5 L11 11.5" /></>),
  expand: svg(<><path d="M3 2.5 L7 6.5 L11 2.5" /><path d="M3 6.5 L7 10.5 L11 6.5" /></>),
  deps: svg(<><path d="M1.5 3.5 h3.5 a1.5 1.5 0 0 1 1.5 1.5 v4 a1.5 1.5 0 0 0 1.5 1.5 h2.5" /><path d="M9.5 8.5 L12.5 10.5 L9.5 12.5" /></>),
  search: <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="6" cy="6" r="4.2" /><path d="M9.2 9.2 L12.5 12.5" strokeLinecap="round" /></svg>,
  manage: (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M1 3.5h12M1 7h12M1 10.5h12" />
      <circle cx="4.5" cy="3.5" r="1.6" fill="var(--surface)" /><circle cx="9.5" cy="7" r="1.6" fill="var(--surface)" /><circle cx="5.5" cy="10.5" r="1.6" fill="var(--surface)" />
    </svg>
  ),
  how: <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>,
};

interface UndoEntry {
  label: string;
  undo: () => void;
}

export function RoadmapEditor({
  roadmap,
  sprintIssues,
  teamId,
}: {
  roadmap: RoadmapView;
  sprintIssues: SidePanelIssue[];
  teamId: string;
}) {
  const router = useRouter();
  const isModerator = useIsRoadmapModerator();
  const [items, setItems] = useState(roadmap.items);
  const [blocks, setBlocks] = useState(roadmap.blocks);
  const [error, setError] = useState<string | null>(null);
  const [statusStale, setStatusStale] = useState(false);
  const [zoom, setZoom] = useState<Zoom>("m");
  const [present, setPresent] = useState(false);
  const [showDeps, setShowDeps] = useState(true);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [blockDialog, setBlockDialog] = useState<{ block: BlockView | null; parentId: string | null } | null>(null);
  const [blockToDelete, setBlockToDelete] = useState<BlockView | null>(null);
  const [lanesDialogOpen, setLanesDialogOpen] = useState(false);
  const [laneToDelete, setLaneToDelete] = useState<{ lane: LaneView; count: number } | null>(null);
  const [confirmRoadmapDelete, setConfirmRoadmapDelete] = useState(false);
  const [labelsDialogOpen, setLabelsDialogOpen] = useState(false);
  const [milestoneDialog, setMilestoneDialog] = useState<{ milestone: MilestoneView | null } | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  /** Kontext für „Hinzufügen“: zuletzt angeklickter oder auf-/zugeklappter Block. */
  const [ctxId, setCtxId] = useState<string | null>(null);
  const [todayRequest, setTodayRequest] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const undoStack = useRef<UndoEntry[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server-Refresh (revalidatePath) liefert neue Props → lokalen State resyncen.
  const [syncedItems, setSyncedItems] = useState(roadmap.items);
  if (syncedItems !== roadmap.items) {
    setSyncedItems(roadmap.items);
    setItems(roadmap.items);
  }
  const [syncedBlocks, setSyncedBlocks] = useState(roadmap.blocks);
  if (syncedBlocks !== roadmap.blocks) {
    setSyncedBlocks(roadmap.blocks);
    setBlocks(roadmap.blocks);
  }

  // Klappzustand aus dem localStorage (nach dem Mount — kein Hydration-Mismatch).
  useEffect(() => {
    setClosed(readClosed(roadmap.id));
  }, [roadmap.id]);

  const today = dayKey(new Date());
  const todayNum = dayNumber(today);
  const fallback = useMemo(() => ({ start: todayNum, end: todayNum + NEW_BLOCK_DAYS - 1 }), [todayNum]);

  // ---------- Baum ----------
  const tree = useMemo(() => {
    const blockInputs: BlockInput[] = blocks.map((b) => ({
      id: b.id, parentId: b.parentId, name: b.name, hue: b.hue, position: b.position,
      span: b.startDate && b.endDate ? { start: dayNumber(b.startDate), end: dayNumber(b.endDate) } : null,
    }));
    const treeItems: TreeItem[] = items.map((i) => ({
      id: i.id, blockId: i.blockId, laneId: i.laneId, start: dayNumber(i.startDate), end: dayNumber(i.endDate),
      statusCategory: i.statusCategory, storyPoints: i.storyPoints, position: i.position, jiraKey: i.jiraKey, title: i.title,
    }));
    return buildTree(blockInputs, treeItems);
  }, [blocks, items]);
  const allBlockIds = useMemo(() => [...blocks.map((b) => b.id), INBOX_ID], [blocks]);
  const open = useMemo(() => new Set(allBlockIds.filter((id) => !closed.has(id))), [allBlockIds, closed]);
  const blockById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const ctxBlock: TreeBlock | null = ctxId ? tree.byId.get(ctxId) ?? null : null;
  const selectedBlock: TreeBlock | null =
    selectedBlockId === INBOX_ID ? inboxBlock(tree.orphans) : selectedBlockId ? tree.byId.get(selectedBlockId) ?? null : null;
  const selectedItem = selectedItemId === null ? null : items.find((i) => i.id === selectedItemId) ?? null;

  const containedKeys = useMemo(
    () => new Set(items.filter((i) => i.jiraKey !== null).map((i) => i.jiraKey as string)),
    [items],
  );
  const options = useMemo(() => blockOptions(blocks), [blocks]);
  const itemCountByLane = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.laneId, (m.get(i.laneId) ?? 0) + 1);
    return m;
  }, [items]);
  const facts = useMemo(
    () => ({
      tickets: items.length,
      done: items.filter((i) => i.statusCategory === "done").length,
      sp: items.reduce((s, i) => s + i.storyPoints, 0),
      blocks: blocks.length,
    }),
    [items, blocks.length],
  );

  // ---------- Status-Refresh beim Öffnen ----------
  useEffect(() => {
    let cancelled = false;
    refreshStatusesAction(roadmap.id).then((result) => {
      if (cancelled) return;
      if (!result.ok || !result.data) {
        setStatusStale(true);
        return;
      }
      const byKey = new Map(result.data.map((s) => [s.jiraKey, s]));
      setItems((prev) =>
        prev.map((i) => {
          const s = i.jiraKey === null ? undefined : byKey.get(i.jiraKey);
          return s
            ? { ...i, statusCategory: s.statusCategory, statusLabel: s.statusLabel, storyPoints: s.storyPoints, assignee: s.assignee, blockedBy: s.blockedBy }
            : i;
        }),
      );
    }).catch(() => {
      if (!cancelled) setStatusStale(true);
    });
    return () => {
      cancelled = true;
    };
  }, [roadmap.id]);

  // ---------- Toast, Undo ----------
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  const pushUndo = (entry: UndoEntry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > 50) undoStack.current.shift();
  };

  // ---------- Aktionen mit Fehleranzeige ----------
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, rollback?: () => void) =>
    startTransition(async () => {
      setError(null);
      try {
        const result = await fn();
        if (!result.ok) {
          rollback?.();
          setError(result.error ?? "Aktion fehlgeschlagen.");
        }
      } catch {
        rollback?.();
        setError("Aktion fehlgeschlagen — Server nicht erreichbar.");
      }
    });

  const persistClosed = (next: Set<string>) => {
    setClosed(next);
    writeClosed(roadmap.id, next);
  };
  const toggle = (blockId: string) => {
    const next = new Set(closed);
    if (next.has(blockId)) next.delete(blockId);
    else next.add(blockId);
    persistClosed(next);
    if (blockId !== INBOX_ID) setCtxId(blockId);
  };
  const collapseAll = () => persistClosed(new Set(allBlockIds));
  const expandAll = () => persistClosed(new Set());

  /** Zielblock samt Vorfahren aufklappen, damit ein verschobenes Objekt sichtbar bleibt. */
  const ensureOpen = (blockId: string | null) => {
    if (!blockId) return;
    const next = new Set(closed);
    let cur = blockById.get(blockId);
    while (cur) {
      next.delete(cur.id);
      cur = cur.parentId ? blockById.get(cur.parentId) : undefined;
    }
    if (next.size !== closed.size) persistClosed(next);
  };

  const nameOfItem = (i: RoadmapItemView) => i.jiraKey ?? i.title;

  const moveItem = (itemId: string, placement: Placement, undoable = true) => {
    const before = items.find((i) => i.id === itemId);
    if (!before) return;
    if (placement.blockId !== before.blockId) {
      ensureOpen(placement.blockId);
      const target = placement.blockId ? blockById.get(placement.blockId) : null;
      showToast(`${nameOfItem(before)} nach „${target?.name ?? "Eingangskorb"}“ verschoben`);
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, laneId: placement.laneId, blockId: placement.blockId, startDate: placement.startDate, endDate: placement.endDate }
          : i,
      ),
    );
    if (undoable) {
      pushUndo({
        label: `${nameOfItem(before)} zurück`,
        undo: () => moveItem(itemId, { laneId: before.laneId, blockId: before.blockId, startDate: before.startDate, endDate: before.endDate }, false),
      });
    }
    run(
      () => moveItemAction(itemId, placement),
      () => setItems((prev) => prev.map((i) => (i.id === itemId ? before : i))),
    );
  };

  /** Teilbaum-IDs eines Blocks (inkl. ihm selbst). */
  const subtreeIds = (blockId: string): Set<string> => {
    const ids = new Set<string>();
    const rec = (b: TreeBlock) => {
      ids.add(b.id);
      b.children.forEach(rec);
    };
    const root = tree.byId.get(blockId);
    if (root) rec(root);
    return ids;
  };

  const shiftBlock = (blockId: string, deltaDays: number, undoable = true) => {
    if (!deltaDays) return;
    const node = tree.byId.get(blockId);
    if (!node) return;
    const ids = subtreeIds(blockId);
    const itemIds = new Set(leaves(node).map((t) => t.id));
    const beforeItems = items;
    const beforeBlocks = blocks;
    setItems((prev) =>
      prev.map((i) =>
        itemIds.has(i.id) ? { ...i, startDate: addDays(i.startDate, deltaDays), endDate: addDays(i.endDate, deltaDays) } : i,
      ),
    );
    setBlocks((prev) =>
      prev.map((b) =>
        ids.has(b.id) && b.startDate && b.endDate
          ? { ...b, startDate: addDays(b.startDate, deltaDays), endDate: addDays(b.endDate, deltaDays) }
          : b,
      ),
    );
    if (undoable) pushUndo({ label: `„${node.name}“ zurück`, undo: () => shiftBlock(blockId, -deltaDays, false) });
    run(
      () => shiftBlockAction(blockId, deltaDays),
      () => {
        setItems(beforeItems);
        setBlocks(beforeBlocks);
      },
    );
  };

  const moveBlock = (blockId: string, targetId: string | null, undoable = true) => {
    const node = tree.byId.get(blockId);
    const before = blockById.get(blockId);
    if (!node || !before) return;
    const target = targetId ? tree.byId.get(targetId) ?? null : null;
    if (target && (target === node || isAncestor(node, target))) return;
    ensureOpen(targetId);
    const siblings = blocks.filter((b) => b.parentId === targetId && b.id !== blockId);
    const position = siblings.reduce((m, b) => Math.max(m, b.position), -1) + 1;
    const beforeBlocks = blocks;
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, parentId: targetId, position } : b)));
    showToast(`${node.name} nach „${target?.name ?? "oberste Ebene"}“ verschoben`);
    if (undoable) pushUndo({ label: `„${node.name}“ zurück`, undo: () => moveBlock(blockId, before.parentId, false) });
    run(() => moveBlockAction(blockId, targetId, "into"), () => setBlocks(beforeBlocks));
  };

  const resizeBlock = (blockId: string, startDate: string, endDate: string, undoable = true) => {
    const before = blockById.get(blockId);
    if (!before) return;
    const beforeBlocks = blocks;
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, startDate, endDate } : b)));
    if (undoable && before.startDate && before.endDate) {
      const s = before.startDate;
      const e = before.endDate;
      pushUndo({ label: `„${before.name}“ zurück`, undo: () => resizeBlock(blockId, s, e, false) });
    }
    run(() => updateBlockSpanAction(blockId, startDate, endDate), () => setBlocks(beforeBlocks));
  };

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) {
      showToast("Nichts rückgängig zu machen");
      return;
    }
    entry.undo();
    showToast(`Rückgängig: ${entry.label}`);
  }, [showToast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isModerator || present) return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isModerator, present, undo]);

  const addIssue = (issue: SidePanelIssue, blockId: string | null, startDate: string, endDate: string) => {
    const firstLane = roadmap.lanes[0];
    if (!firstLane) {
      setError("Kein Stream vorhanden — zuerst unter „Verwalten › Spuren“ einen anlegen.");
      return;
    }
    ensureOpen(blockId);
    const target = blockId ? blockById.get(blockId) : null;
    showToast(target ? `Ticket in „${target.name}“ eingefügt` : "Ticket in den Eingangskorb gelegt");
    run(() =>
      addJiraItemAction(
        roadmap.id,
        firstLane.id,
        blockId,
        {
          jiraKey: issue.jiraKey, title: issue.summary, issueType: issue.issueType, statusCategory: issue.statusCategory,
          statusLabel: issue.statusLabel, storyPoints: issue.storyPoints, assignee: issue.assignee,
        },
        startDate,
        endDate,
      ),
    );
  };

  // ---------- Auswahl ----------
  const selectItem = (itemId: string) => {
    setSelectedBlockId(null);
    setSelectedItemId(itemId);
    const item = items.find((i) => i.id === itemId);
    if (item?.blockId) setCtxId(item.blockId);
  };
  const selectBlock = (blockId: string) => {
    setSelectedItemId(null);
    setSelectedBlockId((prev) => (prev === blockId ? null : blockId));
    if (blockId !== INBOX_ID) setCtxId(blockId);
  };
  const closeDrawers = () => {
    setSelectedItemId(null);
    setSelectedBlockId(null);
  };

  // ---------- Präsentation ----------
  const togglePresent = useCallback(() => {
    setPresent((prev) => {
      const next = !prev;
      if (next) {
        setSelectedItemId(null);
        setSelectedBlockId(null);
        setPanelOpen(false);
        setQuery("");
        try {
          document.documentElement.requestFullscreen?.();
        } catch {
          /* kein Vollbild möglich */
        }
      } else {
        try {
          if (document.fullscreenElement) document.exitFullscreen?.();
        } catch {
          /* bereits verlassen */
        }
      }
      return next;
    });
  }, []);
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") togglePresent();
    };
    // Verlässt der Nutzer das Vollbild über den Browser, endet auch die Präsentation.
    const onFs = () => {
      if (!document.fullscreenElement) setPresent(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [present, togglePresent]);

  // ---------- Hinzufügen ----------
  const targetFor = (kind: AddKind) => addTarget(kind, ctxBlock, tree.roots);
  const hintFor = (kind: AddKind) => {
    const t = targetFor(kind);
    return t ? `in „${t.name}“` : "auf oberster Ebene";
  };
  const newSpan = { start: today, end: dayFromNumber(todayNum + NEW_BLOCK_DAYS - 1) };
  const openBlockDialog = (kind: AddKind) => setBlockDialog({ block: null, parentId: targetFor(kind)?.id ?? null });
  const ticketTarget = targetFor("ticket");

  const addEntries: MenuEntry[] = [
    { key: "projekt", icon: I.projekt, label: "Projekt", hint: "auf oberster Ebene", onSelect: () => openBlockDialog("projekt") },
    { key: "teilprojekt", icon: I.teilprojekt, label: "Teilprojekt", hint: hintFor("teilprojekt"), disabled: !targetFor("teilprojekt"), onSelect: () => openBlockDialog("teilprojekt") },
    { key: "bereich", icon: I.bereich, label: "Bereich", hint: hintFor("bereich"), disabled: !targetFor("bereich"), onSelect: () => openBlockDialog("bereich") },
    { key: "sep1", separator: true },
    { key: "ticket", icon: I.ticket, label: "Ticket aus Jira …", hint: ticketTarget ? `in „${ticketTarget.name}“` : "in den Eingangskorb", onSelect: () => setPanelOpen(true) },
    { key: "ziel", icon: I.ziel, label: "Ziel", hint: "eigener Eintrag ohne Jira-Ticket", onSelect: () => setGoalDialogOpen(true) },
    { key: "ms", icon: I.ms, label: "Meilenstein", hint: "über alle Blöcke sichtbar", onSelect: () => setMilestoneDialog({ milestone: null }) },
  ];
  const manageEntries: MenuEntry[] = [
    { key: "tickets", label: "Tickets aus Jira", onSelect: () => setPanelOpen(true) },
    { key: "lanes", label: "Spuren", onSelect: () => setLanesDialogOpen(true) },
    { key: "labels", label: "Labels", onSelect: () => setLabelsDialogOpen(true) },
    { key: "sep1", separator: true },
    { key: "hint", content: "Öffnet jeweils eine Seitenleiste – selten gebraucht, deshalb nicht in der Leiste." },
    { key: "sep2", separator: true },
    { key: "delete", label: "Roadmap löschen", danger: true, onSelect: () => setConfirmRoadmapDelete(true) },
  ];
  const zoomButtons: { key: Zoom; label: string }[] = [
    { key: "q", label: "Quartal" },
    { key: "m", label: "Monat" },
    { key: "w", label: "Woche" },
  ];
  const currentDay = today;

  // ---------- Render ----------
  return (
    <div className="rm" data-present={present ? "1" : "0"} data-full-width>
      <div className="rm-pagehead">
        <div className="min-w-0">
          <div className="rm-eyebrow">Roadmap · Stand {formatDay(today)}</div>
          <h1>
            {isModerator ? (
              <input
                type="text"
                className="rm-title"
                defaultValue={roadmap.name}
                aria-label="Roadmap-Name"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== roadmap.name) run(() => renameRoadmapAction(roadmap.id, e.target.value));
                }}
              />
            ) : (
              roadmap.name
            )}
          </h1>
          <p>
            Projekte liegen als Blöcke auf der Zeitachse. Jeder Block lässt sich aufklappen, darin liegen Teilprojekte, Bereiche und Tickets.
            {statusStale && <> <span className="rm-note warn" title="Jira nicht erreichbar — angezeigte Status können veraltet sein">Status evtl. veraltet.</span></>}
            {!isModerator && <> <span className="rm-note" title="Zum Bearbeiten die Moderator-Rolle im Profil (unten links) aktivieren">Nur-Lese-Ansicht.</span></>}
          </p>
        </div>
        <div className="rm-facts">
          <div className="rm-fact"><b>{facts.tickets}</b><span>Tickets</span></div>
          <div className="rm-fact"><b>{facts.done}</b><span>Erledigt</span></div>
          <div className="rm-fact"><b>{facts.sp}</b><span>Story Points</span></div>
          <div className="rm-fact"><b>{facts.blocks}</b><span>Blöcke</span></div>
        </div>
      </div>

      {error && <div className="rm-error">{error}</div>}

      <div className="rm-toolbar">
        {isModerator && (
          <>
            <RoadmapMenu
              className="hidepres"
              triggerClassName="rm-btn primary"
              trigger={<><span className="plus">+</span> Hinzufügen {I.caret}</>}
              entries={addEntries}
              menuClassName="wide"
            />
            <div className="rm-tsep hidepres" />
          </>
        )}
        <div className="rm-seg" role="group" aria-label="Zeitraster">
          {zoomButtons.map((z) => (
            <button key={z.key} type="button" aria-pressed={zoom === z.key} onClick={() => setZoom(z.key)}>
              {z.label}
            </button>
          ))}
        </div>
        <button type="button" className="rm-btn" onClick={() => setTodayRequest((n) => n + 1)}>
          Heute
        </button>
        <div className="rm-tsep hidepres" />
        <button type="button" className="rm-ibtn hidepres" title="Alles einklappen" aria-label="Alles einklappen" onClick={collapseAll}>
          {I.collapse}
        </button>
        <button type="button" className="rm-ibtn hidepres" title="Alles ausklappen" aria-label="Alles ausklappen" onClick={expandAll}>
          {I.expand}
        </button>
        <button
          type="button"
          className="rm-ibtn hidepres"
          aria-pressed={showDeps}
          title="Abhängigkeiten anzeigen"
          aria-label="Abhängigkeiten anzeigen"
          onClick={() => setShowDeps((v) => !v)}
        >
          {I.deps}
        </button>
        <div className="rm-srch hidepres">
          {I.search}
          <input
            type="search"
            placeholder="Suchen"
            aria-label="Blöcke und Tickets suchen"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQuery("");
            }}
          />
        </div>
        <div className="rm-spacer" />
        {isModerator && (
          <RoadmapMenu
            className="hidepres"
            triggerClassName="rm-ibtn"
            ariaLabel="Verwalten"
            title="Verwalten"
            trigger={I.manage}
            entries={manageEntries}
            align="right"
          />
        )}
        <button type="button" className="rm-btn" aria-pressed={present} onClick={togglePresent}>
          {present ? "Präsentation verlassen" : "Präsentation"}
        </button>
      </div>

      <RoadmapBoard
        roadmap={roadmap}
        tree={tree}
        items={items}
        zoom={zoom}
        present={present}
        showDeps={showDeps}
        open={open}
        query={query}
        selectedId={selectedItemId ?? selectedBlockId}
        todayRequest={todayRequest}
        isModerator={isModerator && !present}
        today={today}
        onToggle={toggle}
        onSelectBlock={selectBlock}
        onSelectItem={selectItem}
        onMoveItem={(id, placement) => moveItem(id, placement)}
        onShiftBlock={(id, delta) => shiftBlock(id, delta)}
        onMoveBlock={(id, targetId) => moveBlock(id, targetId)}
        onResizeBlock={(id, s, e) => resizeBlock(id, s, e)}
        onDropIssue={addIssue}
        onEditMilestone={(m) => setMilestoneDialog({ milestone: m })}
      />

      <div className="rm-legendbar">
        <span className="lg"><i style={{ background: "var(--open)" }} />Offen</span>
        <span className="lg"><i style={{ background: "var(--wip)" }} />In Bearbeitung</span>
        <span className="lg"><i style={{ background: "var(--ok)" }} />Ausgeführt</span>
        <span className="lg"><i style={{ background: "var(--accent)", borderRadius: 2, width: 4, height: 12 }} />Endtermin überschritten</span>
        <span className="lgsep" />
        <details className="rm-how">
          <summary>Bedienung {I.how}</summary>
          <span>
            Freie Fläche ziehen = Karte bewegen (auch mit Leertaste oder mittlerer Maustaste) · Block an der Kopfzeile ziehen = Termin ·
            auf einen anderen Block ziehen = umhängen · Klick = Details · Umschalt beim Ziehen = Wochenraster · Strg+Z = rückgängig
          </span>
        </details>
      </div>

      {toast && <div className="rm-toast" role="status">{toast}</div>}

      {isModerator && panelOpen && (
        <RoadmapSidePanel
          sprintIssues={sprintIssues}
          containedKeys={containedKeys}
          onClose={() => setPanelOpen(false)}
          onAdd={(issue) => {
            // Sprint-Zeitraum aus Jira als Vorbelegung, sonst ab heute zwei Wochen.
            const fromSprint = issue.sprintStart && issue.sprintEnd && dayDiff(issue.sprintStart, issue.sprintEnd) >= 0;
            const start = fromSprint ? (issue.sprintStart as string) : currentDay;
            const end = fromSprint ? (issue.sprintEnd as string) : addDays(currentDay, 13);
            addIssue(issue, ticketTarget?.id ?? null, start, end);
          }}
        />
      )}

      {selectedItem && !present && (
        <RoadmapItemDrawer
          key={selectedItem.id}
          item={selectedItem}
          lanes={roadmap.lanes}
          blockOptions={options}
          blockPath={pathOf(selectedItem.blockId ? tree.byId.get(selectedItem.blockId) ?? null : null) || "Eingangskorb"}
          labels={roadmap.labels}
          pending={pending}
          error={error}
          readOnly={!isModerator}
          onClose={closeDrawers}
          onDelete={() => {
            const gone: RoadmapItemView = selectedItem;
            setSelectedItemId(null);
            setItems((prev) => prev.filter((i) => i.id !== gone.id));
            showToast(`Ticket ${nameOfItem(gone)} aus der Roadmap entfernt`);
            run(
              () => deleteItemAction(gone.id),
              () => setItems((prev) => [...prev, gone]),
            );
          }}
          onSavePlacement={(placement) => moveItem(selectedItem.id, placement)}
          onSaveGoal={(title, description, statusCategory, storyPoints) =>
            run(() => updateGoalAction(selectedItem.id, title, description, statusCategory, storyPoints))
          }
          onSaveLabels={(labelIds) => {
            setItems((prev) => prev.map((i) => (i.id === selectedItem.id ? { ...i, labelIds } : i)));
            run(() => setItemLabelsAction(selectedItem.id, labelIds));
          }}
        />
      )}

      {selectedBlock && !selectedItem && !present && (
        <RoadmapBlockDrawer
          key={selectedBlock.id}
          block={selectedBlock}
          fallback={fallback}
          readOnly={!isModerator}
          onClose={closeDrawers}
          onEdit={() => {
            const b = blockById.get(selectedBlock.id);
            if (b) setBlockDialog({ block: b, parentId: b.parentId });
          }}
          onDelete={() => {
            const b = blockById.get(selectedBlock.id);
            if (b) setBlockToDelete(b);
          }}
        />
      )}

      {goalDialogOpen && (
        <RoadmapGoalDialog
          lanes={roadmap.lanes}
          blockOptions={options}
          defaultDate={currentDay}
          pending={pending}
          error={error}
          onClose={() => setGoalDialogOpen(false)}
          onCreate={(laneId, blockId, title, description, start, end, storyPoints) => {
            setGoalDialogOpen(false);
            ensureOpen(blockId);
            run(() => addGoalAction(roadmap.id, laneId, blockId, title, description, start, end, storyPoints));
          }}
        />
      )}

      {blockDialog && (
        <RoadmapBlockDialog
          block={blockDialog.block}
          parentOptions={options}
          defaultParentId={blockDialog.parentId}
          pending={pending}
          error={error}
          onClose={() => setBlockDialog(null)}
          onCreate={(name, parentId, hue) => {
            setBlockDialog(null);
            ensureOpen(parentId);
            const type = typeAt(parentId ? (tree.byId.get(parentId)?.depth ?? 0) + 1 : 0).one;
            const parent = parentId ? blockById.get(parentId) : null;
            showToast(parent ? `${type} in „${parent.name}“ angelegt` : `${type} auf oberster Ebene angelegt`);
            run(() => createBlockAction(roadmap.id, name, parentId, hue, newSpan.start, newSpan.end));
          }}
          onUpdate={(name, hue) => {
            const block = blockDialog.block;
            setBlockDialog(null);
            if (!block) return;
            setBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, name, hue } : b)));
            run(() => updateBlockAction(block.id, name, hue));
          }}
          onDelete={() => {
            const block = blockDialog.block;
            setBlockDialog(null);
            if (block) setBlockToDelete(block);
          }}
        />
      )}

      {blockToDelete && (
        <RoadmapConfirmDialog
          title="Block löschen"
          message={`Block „${blockToDelete.name}“ samt Unterblöcken löschen? Die Tickets bleiben erhalten und landen im Eingangskorb.`}
          confirmLabel="Löschen"
          pending={pending}
          onClose={() => setBlockToDelete(null)}
          onConfirm={() => {
            const id = blockToDelete.id;
            setBlockToDelete(null);
            if (selectedBlockId === id) setSelectedBlockId(null);
            if (ctxId === id) setCtxId(null);
            run(() => deleteBlockAction(id));
          }}
        />
      )}

      {lanesDialogOpen && (
        <RoadmapLanesDialog
          lanes={roadmap.lanes}
          itemCountByLane={itemCountByLane}
          pending={pending}
          onClose={() => setLanesDialogOpen(false)}
          onCreate={(name) => run(() => createLaneAction(roadmap.id, name))}
          onRename={(id, name) => run(() => renameLaneAction(id, name))}
          onMove={(id, direction) => run(() => moveLaneAction(id, direction))}
          onDelete={(lane, count) => setLaneToDelete({ lane, count })}
        />
      )}

      {laneToDelete && (
        <RoadmapConfirmDialog
          title="Spur löschen"
          message={
            laneToDelete.count > 0
              ? `Spur „${laneToDelete.lane.name}“ mit ${laneToDelete.count} ${laneToDelete.count === 1 ? "Ticket" : "Tickets"} löschen? Die Tickets werden mitgelöscht.`
              : `Spur „${laneToDelete.lane.name}“ löschen?`
          }
          confirmLabel="Löschen"
          pending={pending}
          onClose={() => setLaneToDelete(null)}
          onConfirm={() => {
            const id = laneToDelete.lane.id;
            setLaneToDelete(null);
            run(() => deleteLaneAction(id));
          }}
        />
      )}

      {confirmRoadmapDelete && (
        <RoadmapConfirmDialog
          title="Roadmap löschen"
          message={`Roadmap „${roadmap.name}“ mit allen Blöcken, Spuren und Einträgen wirklich löschen?`}
          confirmLabel="Löschen"
          pending={pending}
          onClose={() => setConfirmRoadmapDelete(false)}
          onConfirm={() =>
            startTransition(async () => {
              setError(null);
              const result = await deleteRoadmapAction(roadmap.id).catch(() => ({ ok: false, error: "Löschen fehlgeschlagen — Server nicht erreichbar." }));
              if (result.ok) router.push(`/roadmap?team=${teamId}`);
              else {
                setConfirmRoadmapDelete(false);
                setError(result.error ?? "Löschen fehlgeschlagen.");
              }
            })
          }
        />
      )}

      {labelsDialogOpen && (
        <RoadmapLabelsDialog
          labels={roadmap.labels}
          pending={pending}
          onClose={() => setLabelsDialogOpen(false)}
          onCreate={(name, color) => run(() => createLabelAction(roadmap.id, name, color))}
          onUpdate={(id, name, color) => run(() => updateLabelAction(id, name, color))}
          onDelete={(id) => run(() => deleteLabelAction(id))}
        />
      )}

      {milestoneDialog && (
        <RoadmapMilestoneDialog
          milestone={milestoneDialog.milestone}
          defaultDate={addDays(currentDay, 28)}
          pending={pending}
          error={error}
          onClose={() => setMilestoneDialog(null)}
          onSubmit={(title, date, color) => {
            const existing = milestoneDialog.milestone;
            setMilestoneDialog(null);
            run(() =>
              existing ? updateMilestoneAction(existing.id, title, date, color) : createMilestoneAction(roadmap.id, title, date, color),
            );
          }}
          onDelete={() => {
            const existing = milestoneDialog.milestone;
            setMilestoneDialog(null);
            if (existing) run(() => deleteMilestoneAction(existing.id));
          }}
        />
      )}
    </div>
  );
}
