"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SessionUser } from "@/lib/auth";
import type { StoreData } from "@/lib/types";
import { fetchStoreData, logoutAction } from "@/server/actions";
import { unwrapActionResult } from "@/lib/actionResult";
import type { ActionErrorResult } from "@/lib/actionResult";

export type ViewKey =
  | "dashboard"
  | "pos"
  | "inventory"
  | "scan"
  | "receiving"
  | "bulk"
  | "status"
  | "suppliers"
  | "sales-report"
  | "inventory-report"
  | "history"
  | "labels"
  | "settings"
  | "subscription"
  | "notifications";

export type PrintJob =
  | { kind: "receipt"; saleId: number }
  | { kind: "labels"; productIds: number[] }
  | null;

type StoreCtx = {
  user: SessionUser;
  data: StoreData;
  refresh: () => Promise<void>;
  busy: boolean;
  run: <T,>(fn: () => Promise<T | ActionErrorResult>) => Promise<T>;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  selectedProductId: number | null;
  openProduct: (id: number | null) => void;
  printJob: PrintJob;
  setPrintJob: (j: PrintJob) => void;
  printSale: (saleId: number) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  logout: () => Promise<void>;
};

const Ctx = createContext<StoreCtx | null>(null);

export function useStore(): StoreCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside <StoreProvider>");
  return v;
}

export function StoreProvider({
  user,
  initialData,
  children,
}: {
  user: SessionUser;
  initialData: StoreData;
  children: ReactNode;
}) {
  const [data, setData] = useState<StoreData>(initialData);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [printJob, setPrintJob] = useState<PrintJob>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const fresh = unwrapActionResult(await fetchStoreData());
    setData(fresh);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  /** Runs a server action, refreshes the snapshot, surfaces errors as a toast. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T | ActionErrorResult>): Promise<T> => {
      setBusy(true);
      try {
        const result = unwrapActionResult(await fn());
        await refresh();
        return result;
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Something went wrong.");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  const openProduct = useCallback((id: number | null) => {
    setSelectedProductId(id);
    setView("inventory");
  }, []);

  const printSale = useCallback((saleId: number) => {
    setPrintJob({ kind: "receipt", saleId });
    setTimeout(() => window.print(), 250);
  }, []);

  const logout = useCallback(async () => {
    unwrapActionResult(await logoutAction());
    window.location.href = "/login";
  }, []);

  const value = useMemo<StoreCtx>(
    () => ({
      user,
      data,
      refresh,
      busy,
      run,
      view,
      setView,
      selectedProductId,
      openProduct,
      printJob,
      setPrintJob,
      printSale,
      toast,
      showToast,
      logout,
    }),
    [
      user, data, refresh, busy, run, view, selectedProductId, openProduct,
      printJob, printSale, toast, showToast, logout,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
