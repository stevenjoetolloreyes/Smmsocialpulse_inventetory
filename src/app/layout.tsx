import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inventory Management System",
  description:
    "POS + Inventory Management System for small retail and sari-sari stores, with QR scanning, batch and expiry tracking, and sales reporting.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
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
