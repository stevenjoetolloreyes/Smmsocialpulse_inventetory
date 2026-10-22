"use client";

import { useMemo, useState } from "react";
import { useStore } from "./store";
import {
  Card, EmptyState, Icon, Modal, SectionTitle,
  btnDanger, btnGhost, btnPrimary, inputCls, labelCls,
} from "./ui";
import { fmtDate, fmtInt } from "@/lib/format";
import { deleteSupplier, saveSupplier } from "@/server/actions";
import type { SupplierDTO } from "@/lib/types";

const PAGE_SIZE = 8;

type FormState = {
  id: number | null;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
};

const blank: FormState = { id: null, name: "", contactPerson: "", email: "", phone: "", address: "" };

export function Suppliers() {
  const { data, run, showToast } = useStore();
  const { suppliers } = data;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "products" | "recent">("name");
  const [page, setPage] = useState(0);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const productCount = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of data.products) {
      if (p.supplierId) map.set(p.supplierId, (map.get(p.supplierId) ?? 0) + 1);
    }
    return map;
  }, [data.products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = suppliers.filter(
      (s) =>
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q),
    );
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "products")
      list.sort((a, b) => (productCount.get(b.id) ?? 0) - (productCount.get(a.id) ?? 0));
    if (sort === "recent") list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [suppliers, query, sort, productCount]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await run(() => saveSupplier(form));
      showToast(form.id ? "Supplier updated." : "Supplier added.");
      setForm(null);
    } catch {
      /* toasted */
    } finally {
      setSaving(false);
    }
  };

  const edit = (s: SupplierDTO) =>
    setForm({
      id: s.id,
      name: s.name,
      contactPerson: s.contactPerson,
      email: s.email,
      phone: s.phone,
      address: s.address,
    });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle
          icon="truck-field"
          title={`Suppliers (${suppliers.length})`}
          right={
            <button className={btnPrimary} onClick={() => setForm({ ...blank })}>
              <Icon name="plus" /> Add Supplier
            </button>
          }
        />
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
              <Icon name="magnifying-glass" />
            </span>
            <input
              className={`${inputCls} pl-9`}
              placeholder="Search name, contact, email or phone"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <select
            className={`${inputCls} w-auto`}
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="Sort suppliers"
          >
            <option value="name">Sort: Name A–Z</option>
            <option value="products">Sort: Most products</option>
            <option value="recent">Sort: Recently added</option>
          </select>
        </div>

        {suppliers.length === 0 ? (
          <EmptyState
            icon="truck-field"
            title="No suppliers yet"
            hint="Add the companies you buy stock from so receivings and products can be linked to them."
            action={
              <button className={btnPrimary} onClick={() => setForm({ ...blank })}>
                <Icon name="plus" /> Add your first supplier
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon="magnifying-glass" title="No suppliers match your search" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((s) => (
                <div key={s.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-stone-100 font-bold text-stone-500">
                      {s.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-stone-800">{s.name}</p>
                      <p className="text-xs text-stone-400">
                        {productCount.get(s.id) ?? 0} product(s) · since {fmtDate(s.createdAt, data.settings)}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-stone-600">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-stone-400">Contact</dt>
                      <dd className="truncate">{s.contactPerson || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-stone-400">Phone</dt>
                      <dd className="truncate">{s.phone || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-stone-400">Email</dt>
                      <dd className="truncate">{s.email || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-stone-400">Address</dt>
                      <dd className="line-clamp-2">{s.address || "—"}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex gap-1.5 border-t border-stone-100 pt-3">
                    <button className={btnGhost} onClick={() => edit(s)}>
                      <Icon name="pen" /> Edit
                    </button>
                    <button
                      className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-red-500 hover:bg-red-50"
                      onClick={async () => {
                        if (!window.confirm(`Delete supplier ${s.name}? Products keep their other data; only the supplier link is cleared by leaving it unassigned.`)) return;
                        await run(() => deleteSupplier(s.id));
                        showToast(`Supplier ${s.name} deleted.`);
                      }}
                    >
                      <Icon name="trash" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-sm text-stone-500">
              <span>
                {fmtInt(filtered.length)} supplier(s) · page {page + 1} of {pageCount}
              </span>
              <div className="flex gap-1.5">
                <button className={btnGhost} disabled={page <= 0} onClick={() => setPage((x) => x - 1)}>
                  <Icon name="chevron-left" />
                </button>
                <button className={btnGhost} disabled={page >= pageCount - 1} onClick={() => setPage((x) => x + 1)}>
                  <Icon name="chevron-right" />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal open={form !== null} onClose={() => setForm(null)} title={form?.id ? "Edit Supplier" : "Add Supplier"} icon="truck-field">
        {form && (
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Supplier name *</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Contact person</label>
                <input className={inputCls} value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Address</label>
              <textarea className={inputCls} rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className={btnPrimary} onClick={() => void submit()} disabled={saving || !form.name.trim()}>
                <Icon name="floppy-disk" /> {saving ? "Saving…" : "Save supplier"}
              </button>
            </div>
            {form.id && (
              <button
                className={`${btnDanger} w-full`}
                onClick={async () => {
                  if (!window.confirm("Delete this supplier?")) return;
                  await run(() => deleteSupplier(form.id!));
                  setForm(null);
                  showToast("Supplier deleted.");
                }}
              >
                <Icon name="trash" /> Delete supplier
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
