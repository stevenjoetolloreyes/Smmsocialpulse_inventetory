"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { loginAction } from "@/server/actions";
import { Icon, btnPrimary, inputCls, labelCls } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (typeof e.getModifierState === "function") {
        setCapsOn(e.getModifierState("CapsLock"));
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("keyup", handler);
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await loginAction(username, password);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#12291b] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
            <Icon name="boxes-stacked" />
          </span>
          <h1 className="text-xl font-bold">Inventory Management System</h1>
          <p className="mt-1 text-sm text-white/70">Sign in to continue</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-3xl bg-white p-6 shadow-xl"
          autoComplete="off"
        >
          <label className={labelCls} htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className={inputCls}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
          />

          <label className={`${labelCls} mt-4`} htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              className={`${inputCls} pr-11`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              <Icon name={showPw ? "eye-slash" : "eye"} />
            </button>
          </div>
          {capsOn && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
              <Icon name="triangle-exclamation" /> Caps Lock is on
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className={`${btnPrimary} mt-5 w-full py-2.5`}>
            {busy ? (
              <>
                <Icon name="circle-notch" className="animate-spin" /> Signing in…
              </>
            ) : (
              <>
                <Icon name="right-to-bracket" /> Log in
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-stone-400">
            Forgot your password? Ask your administrator to reset it in
            Settings → User Management.
          </p>
        </form>
      </div>
    </main>
  );
}
