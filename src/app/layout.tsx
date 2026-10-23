import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LOGO_SRC } from "@/lib/logo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventory Management System",
  description:
    "POS + Inventory Management System for small retail and sari-sari stores, with QR scanning, batch and expiry tracking, and sales reporting.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply the saved appearance before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var m=localStorage.getItem('ims_theme_mode');var d=m==='dark'||((m===null||m==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
        <link rel="icon" href={LOGO_SRC} type="image/jpeg" />
        {/* Font Awesome Free Solid 6.5.2 — the owner's supplied icon pack. */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
