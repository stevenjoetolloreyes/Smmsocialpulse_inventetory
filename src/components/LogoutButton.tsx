"use client";

import { logoutAction } from "@/server/actions";
import { Icon } from "./ui";

/** Standalone logout button for server-rendered gate screens (suspended store). */
export function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await logoutAction();
        window.location.href = "/login";
      }}
      className="inline-flex items-center gap-2 rounded-full bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700"
    >
      <Icon name="arrow-right-from-bracket" /> Log out
    </button>
  );
}
