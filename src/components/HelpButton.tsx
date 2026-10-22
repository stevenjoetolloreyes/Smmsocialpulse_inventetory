"use client";

import { useState } from "react";
import { useStore } from "./store";
import { Icon, Modal, btnGhost, btnPrimary, labelCls } from "./ui";
import { submitFeedbackAction } from "@/server/actions";

const OPTIONS = [
  { type: "issue", label: "Report an issue", icon: "bug" },
  { type: "feature", label: "Suggest a feature", icon: "lightbulb" },
  { type: "feedback", label: "Share feedback", icon: "comment-dots" },
] as const;

/**
 * Floating help button (bottom-right on every app page): opens a small
 * menu, then a form whose message is saved to the feedback table for the
 * platform owner to read in /platform.
 */
export function HelpButton() {
  const { run, showToast } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [formType, setFormType] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!formType) return;
    setSaving(true);
    try {
      await run(() => submitFeedbackAction(formType, message));
      showToast("Thanks — your message was sent to the platform owner.");
      setFormType(null);
      setMessage("");
    } catch {
      /* toasted by run() */
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="no-print fixed bottom-20 right-4 z-50 lg:bottom-6 lg:right-6">
        {menuOpen && (
          <div className="mb-2.5 w-56 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
            <p className="border-b border-stone-100 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-stone-400">
              How can we help?
            </p>
            {OPTIONS.map((o) => (
              <button
                key={o.type}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium text-stone-700 hover:bg-stone-50"
                onClick={() => {
                  setFormType(o.type);
                  setMenuOpen(false);
                }}
              >
                <Icon name={o.icon} className="w-4 text-center text-stone-400" />
                {o.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand)] text-lg text-white shadow-xl transition hover:brightness-110"
          aria-label="Help and feedback"
          title="Help and feedback"
        >
          <Icon name={menuOpen ? "xmark" : "question"} />
        </button>
      </div>

      <Modal
        open={formType !== null}
        onClose={() => setFormType(null)}
        title={OPTIONS.find((o) => o.type === formType)?.label ?? "Feedback"}
        icon={OPTIONS.find((o) => o.type === formType)?.icon ?? "comment-dots"}
      >
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Your message</label>
            <textarea
              className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                formType === "issue"
                  ? "What went wrong? Tell us what you were doing when it happened."
                  : formType === "feature"
                    ? "What would make the system better for your store?"
                    : "Anything you'd like the platform owner to know."
              }
            />
          </div>
          <p className="text-xs text-stone-400">
            Sent to the platform owner together with your store name — they read these in
            the platform console.
          </p>
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setFormType(null)}>
              Cancel
            </button>
            <button
              className={btnPrimary}
              onClick={() => void submit()}
              disabled={saving || !message.trim()}
            >
              <Icon name="paper-plane" /> {saving ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
