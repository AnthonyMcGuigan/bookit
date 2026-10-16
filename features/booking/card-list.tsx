"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cx } from "@/components/ui";
import { toast } from "@/components/toaster";
import { reorderSegmentsAction } from "./actions";

export interface CardItem {
  id: string;
  kindLabel: string;
  title: string;
  participants: string;
  duration: number;
  badges: Array<{ label: string; tone: "gold" | "rivalry" | "neutral" | "danger" }>;
  warnings: number;
}

const TONES = { gold: "bg-gold-soft text-gold", rivalry: "bg-rivalry-soft text-rivalry", neutral: "bg-surface-2 text-muted", danger: "bg-danger-soft text-danger" };

export function CardList({ universeId, showId, items: initial, editable }: { universeId: string; showId: string; items: CardItem[]; editable: boolean }) {
  const [items, setItems] = useState(initial);
  const [synced, setSynced] = useState(initial);
  const [pending, startTransition] = useTransition();
  // Re-sync when the server sends a new card (after add/delete).
  if (initial !== synced) {
    setSynced(initial);
    setItems(initial);
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function commit(next: CardItem[]) {
    const previous = items;
    setItems(next);
    startTransition(async () => {
      const result = await reorderSegmentsAction(universeId, showId, next.map((i) => i.id));
      if (result.error) {
        setItems(previous);
        toast(result.error, "danger");
      }
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    commit(arrayMove(items, from, to));
  }

  const total = items.reduce((t, i) => t + i.duration, 0);
  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy} disabled={!editable}>
          <ol className={cx("divide-y divide-border", pending && "opacity-70")} aria-label="Running order" aria-busy={pending} data-testid="card-list">
            {items.map((item, index) => (
              <Row
                key={item.id}
                item={item}
                index={index}
                last={index === items.length - 1}
                editable={editable}
                href={`/u/${universeId}/booking/${showId}/segment/${item.id}`}
                onMove={(dir) => commit(arrayMove(items, index, index + dir))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {items.length > 0 && <p className="border-t border-border px-4 py-2 text-xs text-muted">Total runtime {total} min{editable ? " · drag rows or use the arrows to reorder" : ""}</p>}
    </div>
  );
}

function Row({ item, index, last, editable, href, onMove }: { item: CardItem; index: number; last: boolean; editable: boolean; href: string; onMove: (dir: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !editable });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cx("flex items-center gap-2 bg-surface px-2 py-2.5 sm:px-3", isDragging && "relative z-10 shadow-lg")}>
      {editable && (
        <button type="button" className="flex h-10 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted" aria-label={`Drag to reorder ${item.title}`} {...attributes} {...listeners}>
          <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden><path d="M7 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM7 11.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM7 19a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" /></svg>
        </button>
      )}
      <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted">{index + 1}</span>
      <Link href={href} className="min-w-0 flex-1 rounded-lg px-1 py-0.5 hover:bg-surface-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{item.kindLabel}</span>
          {last && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold uppercase text-accent-contrast">Main event</span>}
          {item.badges.map((b) => <span key={b.label} className={cx("rounded-full px-1.5 text-[10px] font-semibold uppercase", TONES[b.tone])}>{b.label}</span>)}
          {item.warnings > 0 && <span className="rounded-full bg-danger-soft px-1.5 text-[10px] font-semibold text-danger">{item.warnings} warning{item.warnings > 1 ? "s" : ""}</span>}
        </span>
        <span className="block truncate text-sm font-medium">{item.participants || "No participants yet"}</span>
        {item.title && <span className="block truncate text-xs text-muted">{item.title}</span>}
      </Link>
      <span className="shrink-0 text-xs tabular-nums text-muted">{item.duration}m</span>
      {editable && (
        <span className="flex shrink-0 flex-col">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="h-6 w-8 rounded text-muted hover:bg-surface-2 disabled:opacity-30" aria-label={`Move ${item.participants || item.kindLabel} up`}>▲</button>
          <button type="button" disabled={last} onClick={() => onMove(1)} className="h-6 w-8 rounded text-muted hover:bg-surface-2 disabled:opacity-30" aria-label={`Move ${item.participants || item.kindLabel} down`}>▼</button>
        </span>
      )}
    </li>
  );
}
