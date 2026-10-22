"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import { Card, EmptyState, Icon, SectionTitle, btnGhost, inputCls, labelCls } from "./ui";
import { fmtDateTime } from "@/lib/format";

const PAGE_SIZE = 20;

const ACTION_ICONS: Record<string, string> = {
  Create: "plus",
  Update: "pen",
  Delete: "trash",
  Restore: "rotate-left",
  Sale: "cash-register",
  Return: "rotate-left",
  Restock: "arrow-down",
  "Restock New Batch": "truck-ramp-box",
  "Stock In": "arrow-down",
  "Stock Out": "arrow-up",
  Adjust: "scale-balanced",
  Login: "right-to-bracket",
  Logout: "right-from-bracket",
};

export function HistoryLog() {
  const { data } = useStore();
  const { history, settings } = data;
  const [action, setAction] = useState("All");
  const [entity, setEntity] = useState("All");
  const [actor, setActor] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const actions = useMemo(() => [...new Set(history.map((h) => h.action))].sort(), [history]);
  const entities = useMemo(() => [...new Set(history.map((h) => h.entityType))].sort(), [history]);
  const actors = useMemo(() => [...new Set(history.map((h) => h.actor).filter(Boolean))].sort(), [history]);

  const filtered = useMemo(
    () =>
      history.filter((h) => {
        const day = h.createdAt.slice(0, 10);
        return (
          (action === "All" || h.action === action) &&
          (entity === "All" || h.entityType === entity) &&
          (actor === "All" || h.actor === actor) &&
          (!from || day >= from) &&
          (!to || day <= to) &&
          (!search ||
            `${h.description} ${h.reference}`.toLowerCase().includes(search.trim().toLowerCase()))
        );
      }),
    [history, action, entity, actor, from, to, search],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const resetPage = () => setPage(0);

  return (
    <Card className="p-5">
      <SectionTitle icon="clock-rotate-left" title={`History Log (${history.length})`} />
      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label className={labelCls}>Search</label>
          <input
            className={inputCls}
            placeholder="Description or reference"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>
        <div>
          <label className={labelCls}>Action</label>
          <select className={inputCls} value={action} onChange={(e) => { setAction(e.target.value); resetPage(); }}>
            <option>All</option>
            {actions.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Entity</label>
          <select className={inputCls} value={entity} onChange={(e) => { setEntity(e.target.value); resetPage(); }}>
            <option>All</option>
            {entities.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>From</label>
          <input className={inputCls} type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPage(); }} />
        </div>
        <div>
          <label className={labelCls}>To</label>
          <input className={inputCls} type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPage(); }} />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${actor === "All" ? "bg-[var(--brand)] text-white" : "bg-stone-100 text-stone-600"}`}
          onClick={() => { setActor("All"); resetPage(); }}
        >
          All users
        </button>
        {actors.map((a) => (
          <button
            key={a}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${actor === a ? "bg-[var(--brand)] text-white" : "bg-stone-100 text-stone-600"}`}
            onClick={() => { setActor(a); resetPage(); }}
          >
            {a}
          </button>
        ))}
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon="clock-rotate-left"
          title="No history yet"
          hint="Every create, update, sale, return, restock and login is recorded here automatically."
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon="filter" title="No entries match these filters" />
      ) : (
        <>
          <ul className="divide-y divide-stone-100">
            {pageItems.map((h) => (
              <li key={h.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
                  <Icon name={ACTION_ICONS[h.action] ?? "circle-info"} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-700">
                    <span className="font-bold">{h.action}</span>
                    <span className="text-stone-400"> · {h.entityType}</span>
                    {h.reference ? <span className="text-stone-400"> · {h.reference}</span> : null}
                  </p>
                  <p className="text-sm text-stone-600">{h.description}</p>
                  <p className="text-xs text-stone-400">
                    {fmtDateTime(h.createdAt, settings)} · by {h.actor || "System"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between text-sm text-stone-500">
            <span>
              {filtered.length} entr{filtered.length === 1 ? "y" : "ies"} · page {page + 1} of {pageCount}
            </span>
            <div className="flex gap-1.5">
              <button className={btnGhost} disabled={page <= 0} onClick={() => setPage((x) => x - 1)}>
                <Icon name="chevron-left" /> Newer
              </button>
              <button className={btnGhost} disabled={page >= pageCount - 1} onClick={() => setPage((x) => x + 1)}>
                Older <Icon name="chevron-right" />
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
