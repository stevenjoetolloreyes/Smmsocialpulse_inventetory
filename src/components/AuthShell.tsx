"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "./ui";

/* ------------------------------------------------------------------ */
/*  Background v2 (Steven, Oct 23): like the BentaHub screenshot he  */
/*  sent — phone in the middle at the bottom, MANY snacks & drinks  */
/*  around it. Original SVG artwork only (no copied assets/logo):   */
/*  hanging sachets + candy jars on the left, bottled drinks + cans */
/*  + soda on wooden shelves on the right, floating product cards   */
/*  around a phone mockup at the bottom centre.                     */
/* ------------------------------------------------------------------ */

function ShelfIllustration() {
  const shelf = (x: number, y: number, w: number, k: string) => (
    <g key={k}>
      <rect x={x} y={y} width={w} height="12" rx="6" fill="#c49a6c" />
      <rect x={x} y={y + 12} width={w} height="10" fill="#a97c50" opacity="0.55" />
    </g>
  );
  // Drink bottle (soda / juice)
  const bottle = (x: number, y: number, body: string, cap: string, k: string) => (
    <g key={k}>
      <rect x={x + 13} y={y} width="12" height="11" rx="2" fill={cap} />
      <path d={`M ${x + 13} ${y + 11} h 12 l 7 13 v 48 a 9 9 0 0 1 -9 9 h -8 a 9 9 0 0 1 -9 -9 v -48 z`} fill={body} />
      <rect x={x + 7} y={y + 42} width="24" height="17" rx="3" fill="#ffffff" opacity="0.65" />
      <rect x={x + 10} y={y + 18} width="5" height="52" rx="2.5" fill="#ffffff" opacity="0.35" />
    </g>
  );
  // Dark cola bottle
  const cola = (x: number, y: number, k: string) => (
    <g key={k}>
      <rect x={x + 12} y={y} width="11" height="10" rx="2" fill="#b91c1c" />
      <path d={`M ${x + 12} ${y + 10} h 11 l 6 12 v 10 c -5 5 -5 10 0 15 v 28 a 9 9 0 0 1 -9 9 h -5 a 9 9 0 0 1 -9 -9 v -28 c 5 -5 5 -10 0 -15 v -10 z`} fill="#3f2723" />
      <rect x={x + 6} y={y + 44} width="23" height="15" rx="3" fill="#dc2626" opacity="0.9" />
    </g>
  );
  const can = (x: number, y: number, body: string, band: string, k: string) => (
    <g key={k}>
      <rect x={x} y={y} width="36" height="62" rx="6" fill={body} />
      <rect x={x} y={y} width="36" height="9" rx="4" fill="#d6d3d1" />
      <rect x={x} y={y + 26} width="36" height="16" fill={band} opacity="0.85" />
      <rect x={x + 5} y={y + 12} width="5" height="44" rx="2.5" fill="#ffffff" opacity="0.35" />
    </g>
  );
  // Snack / chips packet
  const packet = (x: number, y: number, body: string, band: string, k: string, s = 1) => (
    <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="0" width="44" height="56" rx="6" fill={body} />
      <rect x="0" y="0" width="44" height="9" rx="4" fill="#00000022" />
      <rect x="0" y="47" width="44" height="9" rx="4" fill="#00000022" />
      <ellipse cx="22" cy="28" rx="13" ry="10" fill={band} opacity="0.9" />
      <circle cx="18" cy="25" r="3" fill="#ffffff" opacity="0.6" />
    </g>
  );
  // Hanging sachet strip (one column of small packets)
  const sachetStrip = (x: number, y: number, colors: string[], k: string) => (
    <g key={k}>
      <line x1={x + 17} y1={y - 14} x2={x + 17} y2={y} stroke="#78716c" strokeWidth="2" opacity="0.5" />
      {colors.map((c, i) => (
        <g key={`${k}-${i}`}>
          <rect x={x} y={y + i * 38} width="34" height="36" rx="4" fill={c} />
          <rect x={x} y={y + i * 38} width="34" height="7" fill="#00000022" />
          <rect x={x + 6} y={y + i * 38 + 14} width="22" height="10" rx="3" fill="#ffffff" opacity="0.55" />
        </g>
      ))}
    </g>
  );
  // Big glass candy jar — colourful dots inside
  const candyJar = (x: number, y: number, k: string) => {
    const dots: Array<[number, number, string]> = [
      [16, 62, "#ef4444"], [32, 54, "#f59e0b"], [48, 64, "#22c55e"], [24, 76, "#3b82f6"],
      [42, 80, "#a855f7"], [58, 74, "#ec4899"], [18, 44, "#f59e0b"], [38, 40, "#ef4444"],
      [56, 46, "#22c55e"], [28, 60, "#ec4899"], [50, 56, "#3b82f6"], [64, 62, "#f59e0b"],
    ];
    return (
      <g key={k}>
        <rect x={x + 6} y={y} width="64" height="13" rx="6" fill="#94a3b8" />
        <rect x={x + 2} y={y + 11} width="72" height="84" rx="16" fill="#e0f2fe" opacity="0.55" />
        <rect x={x + 2} y={y + 11} width="72" height="84" rx="16" fill="none" stroke="#bae6fd" strokeWidth="2" opacity="0.8" />
        {dots.map(([cx, cy, c], i) => (
          <circle key={i} cx={x + cx} cy={y + cy} r="6" fill={c} opacity="0.9" />
        ))}
        <rect x={x + 10} y={y + 20} width="8" height="58" rx="4" fill="#ffffff" opacity="0.5" />
      </g>
    );
  };
  const jar = (x: number, y: number, body: string, lid: string, k: string) => (
    <g key={k}>
      <rect x={x} y={y} width="48" height="12" rx="4" fill={lid} />
      <rect x={x + 3} y={y + 10} width="42" height="60" rx="10" fill={body} opacity="0.92" />
      <circle cx={x + 16} cy={y + 34} r="4" fill="#ffffff" opacity="0.55" />
      <circle cx={x + 29} cy={y + 47} r="4" fill="#ffffff" opacity="0.4" />
    </g>
  );
  // Floating product card (white rounded tile + product inside)
  const floatCard = (x: number, y: number, k: string, inner: ReactNode) => (
    <g key={k}>
      <rect x={x} y={y} width="118" height="112" rx="24" fill="#ffffff" opacity="0.96" />
      <rect x={x} y={y} width="118" height="112" rx="24" fill="none" stroke="#00000010" strokeWidth="2" />
      {inner}
    </g>
  );

  return (
    <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* ===== LEFT: hanging sachets (top) ===== */}
      <rect x="6" y="252" width="212" height="8" rx="4" fill="#a97c50" opacity="0.7" />
      {sachetStrip(14, 268, ["#facc15", "#fb923c", "#f87171"], "hang-1")}
      {sachetStrip(56, 268, ["#4ade80", "#facc15", "#fb923c"], "hang-2")}
      {sachetStrip(98, 268, ["#f87171", "#4ade80", "#60a5fa"], "hang-3")}
      {sachetStrip(140, 268, ["#fb923c", "#a78bfa", "#facc15"], "hang-4")}
      {sachetStrip(182, 268, ["#60a5fa", "#f87171", "#4ade80"], "hang-5")}

      {/* ===== LEFT: snack packets shelf ===== */}
      {packet(238, 292, "#f97316", "#fde68a", "lp-1")}
      {packet(288, 292, "#dc2626", "#fecaca", "lp-2")}
      {packet(238, 354, "#7c3aed", "#ddd6fe", "lp-3")}
      {packet(288, 354, "#059669", "#a7f3d0", "lp-4")}
      {shelf(228, 416, 118, "ls-1")}

      {/* ===== LEFT: candy jars on wooden counter ===== */}
      {candyJar(-6, 520, "jar-1")}
      {candyJar(78, 512, "jar-2")}
      {jar(168, 540, "#f87171", "#b91c1c", "jar-3")}
      {jar(224, 540, "#fbbf24", "#d97706", "jar-4")}
      {shelf(-10, 618, 330, "ls-2")}
      <rect x="-10" y="630" width="330" height="86" fill="#b08968" opacity="0.5" />
      <line x1="70" y1="630" x2="70" y2="716" stroke="#8d6e63" strokeWidth="3" opacity="0.5" />
      <line x1="170" y1="630" x2="170" y2="716" stroke="#8d6e63" strokeWidth="3" opacity="0.5" />
      <line x1="262" y1="630" x2="262" y2="716" stroke="#8d6e63" strokeWidth="3" opacity="0.5" />

      {/* ===== RIGHT: drinks — bottles top shelf ===== */}
      {bottle(1102, 252, "#38bdf8", "#0369a1", "rb-1")}
      {bottle(1148, 244, "#facc15", "#ca8a04", "rb-2")}
      {bottle(1194, 244, "#fb923c", "#ea580c", "rb-3")}
      {bottle(1240, 252, "#f87171", "#b91c1c", "rb-4")}
      <rect x="1290" y="258" width="52" height="76" rx="6" fill="#ef4444" opacity="0.9" />
      <rect x="1298" y="282" width="36" height="20" rx="3" fill="#ffffff" opacity="0.6" />
      {bottle(1352, 252, "#4ade80", "#15803d", "rb-5")}
      {shelf(1092, 340, 348, "rs-1")}

      {/* ===== RIGHT: canned goods ===== */}
      {can(1104, 356, "#22c55e", "#ffffff", "rc-1")}
      {can(1148, 356, "#f97316", "#3b82f6", "rc-2")}
      {can(1192, 356, "#e5e7eb", "#dc2626", "rc-3")}
      {can(1236, 356, "#dc2626", "#ffffff", "rc-4")}
      {can(1280, 356, "#facc15", "#dc2626", "rc-5")}
      {can(1324, 356, "#38bdf8", "#ffffff", "rc-6")}
      {can(1368, 356, "#a78bfa", "#ffffff", "rc-7")}
      {shelf(1092, 424, 348, "rs-2")}

      {/* ===== RIGHT: soda bottles + jar, wooden cabinet ===== */}
      {cola(1112, 440, "rcola-1")}
      {cola(1154, 440, "rcola-2")}
      {bottle(1202, 438, "#f97316", "#9a3412", "rb-6")}
      {jar(1252, 452, "#ef4444", "#991b1b", "rjar-1")}
      {jar(1310, 452, "#f59e0b", "#b45309", "rjar-2")}
      {packet(1372, 452, "#dc2626", "#fecaca", "rp-1", 0.95)}
      {shelf(1092, 528, 348, "rs-3")}
      <rect x="1092" y="540" width="348" height="112" fill="#b08968" opacity="0.55" />
      <line x1="1178" y1="540" x2="1178" y2="652" stroke="#8d6e63" strokeWidth="3" opacity="0.5" />
      <line x1="1264" y1="540" x2="1264" y2="652" stroke="#8d6e63" strokeWidth="3" opacity="0.5" />
      <line x1="1350" y1="540" x2="1350" y2="652" stroke="#8d6e63" strokeWidth="3" opacity="0.5" />

      {/* ===== BOTTOM CENTRE: phone mockup (generic store app) ===== */}
      <g>
        <rect x="618" y="692" width="204" height="236" rx="30" fill="#1c1917" />
        <rect x="626" y="700" width="188" height="220" rx="23" fill="#f0fdf4" />
        <rect x="626" y="700" width="188" height="52" rx="23" fill="#16a34a" />
        <rect x="642" y="714" width="86" height="10" rx="5" fill="#ffffff" opacity="0.95" />
        <rect x="642" y="730" width="56" height="8" rx="4" fill="#ffffff" opacity="0.6" />
        <rect x="770" y="712" width="28" height="28" rx="9" fill="#ffffff" opacity="0.3" />
        <rect x="642" y="766" width="76" height="46" rx="10" fill="#ffffff" stroke="#e7e5e4" />
        <rect x="652" y="776" width="40" height="8" rx="4" fill="#16a34a" opacity="0.7" />
        <rect x="652" y="790" width="52" height="8" rx="4" fill="#d6d3d1" />
        <rect x="726" y="766" width="76" height="46" rx="10" fill="#ffffff" stroke="#e7e5e4" />
        <rect x="736" y="776" width="40" height="8" rx="4" fill="#f59e0b" opacity="0.8" />
        <rect x="736" y="790" width="52" height="8" rx="4" fill="#d6d3d1" />
        <rect x="642" y="824" width="160" height="14" rx="7" fill="#e7e5e4" />
        <rect x="642" y="846" width="160" height="14" rx="7" fill="#e7e5e4" />
        <rect x="642" y="868" width="104" height="14" rx="7" fill="#bbf7d0" />
        <rect x="690" y="704" width="60" height="6" rx="3" fill="#00000033" />
      </g>

      {/* ===== BOTTOM: floating product cards around the phone ===== */}
      {floatCard(176, 786, "fc-1", packet(214, 812, "#f97316", "#ffedd5", "fc-p1", 1.05))}
      {floatCard(408, 756, "fc-2", packet(446, 782, "#7c3aed", "#ede9fe", "fc-p2", 1.05))}
      {floatCard(916, 756, "fc-3", bottle(958, 778, "#fb923c", "#9a3412", "fc-b1"))}
      {floatCard(1148, 796, "fc-4", bottle(1192, 820, "#38bdf8", "#0369a1", "fc-b2"))}
      {floatCard(40, 742, "fc-5", packet(78, 768, "#facc15", "#fef9c3", "fc-p3", 1.05))}
      {floatCard(1284, 716, "fc-6", packet(1322, 742, "#22c55e", "#dcfce7", "fc-p4", 1.05))}

      {/* soft bokeh circles like the reference */}
      <circle cx="170" cy="205" r="58" fill="#ffffff" opacity="0.35" />
      <circle cx="1305" cy="690" r="42" fill="#ffffff" opacity="0.4" />
      <circle cx="215" cy="742" r="48" fill="#ffffff" opacity="0.3" />
      <circle cx="90" cy="90" r="30" fill="#ffffff" opacity="0.3" />
      <circle cx="1360" cy="120" r="36" fill="#ffffff" opacity="0.3" />
    </svg>
  );
}

/* Portrait/mobile version: same store scene composed for a narrow
   screen, so snacks & drinks still peek around the card on phones
   (the wide 1440 viewBox would be centre-cropped to empty space). */
function MobileIllustration() {
  const dots: Array<[number, number, string]> = [
    [14, 58, "#ef4444"], [30, 50, "#f59e0b"], [44, 60, "#22c55e"], [20, 72, "#3b82f6"], [38, 76, "#a855f7"],
  ];
  return (
    <svg className="h-full w-full" viewBox="0 0 450 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {/* left edge: hanging sachets */}
      <rect x="-6" y="176" width="96" height="7" rx="3.5" fill="#a97c50" opacity="0.7" />
      {[0, 1, 2].map((col) =>
        ["#facc15", "#fb923c", "#f87171"].map((c, row) => (
          <g key={`mh-${col}-${row}`}>
            <rect x={-2 + col * 30} y={190 + row * 34} width="27" height="32" rx="4" fill={c} />
            <rect x={3 + col * 30} y={202 + row * 34} width="17" height="8" rx="3" fill="#ffffff" opacity="0.55" />
          </g>
        )),
      )}
      {/* left edge: candy jar mid-height */}
      <g>
        <rect x="-18" y="452" width="62" height="12" rx="6" fill="#94a3b8" />
        <rect x="-22" y="462" width="70" height="80" rx="15" fill="#e0f2fe" opacity="0.55" />
        {dots.map(([cx, cy, c], i) => (
          <circle key={i} cx={cx - 16} cy={cy + 448} r="5.5" fill={c} opacity="0.9" />
        ))}
        <rect x="-22" y="544" width="86" height="10" rx="5" fill="#c49a6c" />
      </g>
      {/* left edge: snack packet lower */}
      <rect x="-14" y="640" width="46" height="58" rx="7" fill="#f97316" />
      <ellipse cx="9" cy="669" rx="13" ry="10" fill="#ffedd5" opacity="0.9" />

      {/* right edge: drink bottles on a shelf */}
      {[
        [368, "#38bdf8"], [396, "#facc15"], [424, "#fb923c"],
      ].map(([x, c]) => (
        <g key={`mb-${x}`}>
          <rect x={Number(x) + 10} y={188} width="10" height="9" rx="2" fill="#78716c" />
          <path d={`M ${Number(x) + 10} 197 h 10 l 6 11 v 40 a 8 8 0 0 1 -8 8 h -7 a 8 8 0 0 1 -8 -8 v -40 z`} fill={String(c)} />
          <rect x={Number(x) + 5} y={222} width="20" height="14" rx="3" fill="#ffffff" opacity="0.6" />
        </g>
      ))}
      <rect x="360" y="258" width="96" height="10" rx="5" fill="#c49a6c" />
      {/* right edge: cans */}
      {[364, 398, 432].map((x, i) => (
        <g key={`mc-${x}`}>
          <rect x={x} y={282} width="30" height="52" rx="5" fill={["#22c55e", "#dc2626", "#38bdf8"][i]} />
          <rect x={x} y={282} width="30" height="8" rx="4" fill="#d6d3d1" />
          <rect x={x} y={304} width="30" height="13" fill="#ffffff" opacity="0.55" />
        </g>
      ))}
      <rect x="360" y="338" width="96" height="10" rx="5" fill="#c49a6c" />
      {/* right edge: cola bottles lower */}
      {[372, 410].map((x) => (
        <g key={`mcola-${x}`}>
          <rect x={x + 9} y={452} width="10" height="9" rx="2" fill="#b91c1c" />
          <path d={`M ${x + 9} 461 h 10 l 5 11 v 38 a 8 8 0 0 1 -8 8 h -4 a 8 8 0 0 1 -8 -8 v -38 z`} fill="#3f2723" />
          <rect x={x + 4} y={486} width="20" height="13" rx="3" fill="#dc2626" opacity="0.9" />
        </g>
      ))}
      <rect x="360" y="520" width="96" height="10" rx="5" fill="#c49a6c" />
      <rect x="392" y="636" width="46" height="58" rx="7" fill="#dc2626" />
      <ellipse cx="415" cy="665" rx="13" ry="10" fill="#fecaca" opacity="0.9" />

      {/* bottom centre: phone + floating cards (peek below the card) */}
      <g>
        <rect x="155" y="782" width="140" height="150" rx="22" fill="#1c1917" />
        <rect x="161" y="788" width="128" height="138" rx="17" fill="#f0fdf4" />
        <rect x="161" y="788" width="128" height="36" rx="17" fill="#16a34a" />
        <rect x="173" y="800" width="58" height="8" rx="4" fill="#ffffff" opacity="0.95" />
        <rect x="173" y="814" width="38" height="6" rx="3" fill="#ffffff" opacity="0.6" />
        <rect x="173" y="836" width="48" height="30" rx="7" fill="#ffffff" stroke="#e7e5e4" />
        <rect x="229" y="836" width="48" height="30" rx="7" fill="#ffffff" stroke="#e7e5e4" />
        <rect x="173" y="874" width="104" height="10" rx="5" fill="#e7e5e4" />
        <rect x="173" y="890" width="104" height="10" rx="5" fill="#bbf7d0" />
      </g>
      <rect x="18" y="806" width="86" height="82" rx="18" fill="#ffffff" opacity="0.96" />
      <rect x="44" y="826" width="36" height="46" rx="6" fill="#7c3aed" />
      <ellipse cx="62" cy="849" rx="11" ry="9" fill="#ede9fe" opacity="0.9" />
      <rect x="346" y="806" width="86" height="82" rx="18" fill="#ffffff" opacity="0.96" />
      <rect x="380" y="822" width="20" height="52" rx="6" fill="#fb923c" />
      <rect x="386" y="814" width="8" height="9" rx="2" fill="#9a3412" />
      <circle cx="70" cy="90" r="30" fill="#ffffff" opacity="0.35" />
      <circle cx="392" cy="120" r="24" fill="#ffffff" opacity="0.35" />
      <circle cx="405" cy="742" r="28" fill="#ffffff" opacity="0.35" />
    </svg>
  );
}

export function AuthBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(155deg,#cdeffd_0%,#d8f3e2_32%,#eef6e9_58%,#fdf0d3_100%)]" />
      <div className="absolute inset-0 opacity-90 blur-[1px] max-md:hidden">
        <ShelfIllustration />
      </div>
      <div className="absolute inset-0 opacity-90 blur-[1px] md:hidden">
        <MobileIllustration />
      </div>
      {/* keep the centre calm behind the card */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.5),rgba(255,255,255,0)_60%)]" />
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
      <div className="absolute -right-20 bottom-24 h-80 w-80 rounded-full bg-white/40 blur-3xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card shell with logo header + legal footer                        */
/* ------------------------------------------------------------------ */

export function AuthCard({
  heading,
  subtitle,
  children,
}: {
  heading: string;
  subtitle: string;
  children: ReactNode;
}) {
  const year = new Date().getFullYear();
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <AuthBackground />
      <div className="relative w-full max-w-md rounded-[24px] bg-white/95 p-7 shadow-[0_24px_60px_-16px_rgba(20,83,45,0.35)] ring-1 ring-black/5 backdrop-blur sm:p-9">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#16a34a] to-[#14532d] text-2xl text-white shadow-md">
            <Icon name="boxes-stacked" />
          </span>
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#14532d]">
            {heading}
          </h1>
          <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
        </div>

        {children}

        <div className="mt-7 border-t border-stone-200 pt-4 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500">
            Inventory Management System v1.0
          </p>
          <p className="mt-1 text-xs text-stone-400">
            © {year} Inventory Management System. All rights reserved.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[11px] leading-relaxed text-stone-400">
            This system uses only essential cookies — one secure session cookie that
            keeps you signed in. It does not use advertising or analytics cookies.
          </p>
          <p className="mt-2 text-xs font-medium">
            <Link href="/privacy" className="text-[#15803d] hover:underline">
              Privacy Policy
            </Link>
            <span className="mx-2 text-stone-300">·</span>
            <Link href="/terms" className="text-[#15803d] hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared form bits                                                  */
/* ------------------------------------------------------------------ */

export const authLabelCls =
  "mb-1.5 block text-[13px] font-bold text-stone-600";
export const authInputCls =
  "w-full rounded-full border border-stone-300 bg-white py-2.5 pl-11 pr-4 text-sm text-stone-900 shadow-inner outline-none transition placeholder:text-stone-400 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/25";
export const authInputWithEyeCls =
  "w-full rounded-full border border-stone-300 bg-white py-2.5 pl-11 pr-11 text-sm text-stone-900 shadow-inner outline-none transition placeholder:text-stone-400 focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/25";
export const authPrimaryBtnCls =
  "flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#16a34a] to-[#15803d] py-3 text-[15px] font-bold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60";

export function FieldIcon({ name }: { name: string }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-stone-400">
      <Icon name={name} />
    </span>
  );
}

export function EyeToggle({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      aria-label={show ? "Hide password" : "Show password"}
    >
      <Icon name={show ? "eye-slash" : "eye"} />
    </button>
  );
}

/** Tracks the keyboard Caps Lock state for the password warning. */
export function useCapsLock(): boolean {
  const [capsOn, setCapsOn] = useState(false);
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
  return capsOn;
}

export function CapsLockWarning({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-600">
      <Icon name="triangle-exclamation" /> Caps Lock is on
    </p>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Social sign-in buttons (rendered ONLY when the owner has         */
/*  configured the matching provider credentials)                     */
/* ------------------------------------------------------------------ */

export function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export function FacebookMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07z"
      />
    </svg>
  );
}

export function SocialButtons({
  google,
  facebook,
}: {
  google: boolean;
  facebook: boolean;
}) {
  if (!google && !facebook) return null;
  const btnCls =
    "flex w-full items-center justify-center gap-2.5 rounded-full border border-stone-300 bg-white py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50";
  return (
    <div className="mt-5">
      <div className="flex items-center gap-3 text-xs text-stone-400">
        <span className="h-px flex-1 bg-stone-200" />
        or continue with
        <span className="h-px flex-1 bg-stone-200" />
      </div>
      <div className="mt-3 space-y-2.5">
        {google && (
          <Link href="/auth/social/google" className={btnCls}>
            <GoogleMark /> Continue with Google
          </Link>
        )}
        {facebook && (
          <Link href="/auth/social/facebook" className={btnCls}>
            <FacebookMark /> Continue with Facebook
          </Link>
        )}
      </div>
    </div>
  );
}
