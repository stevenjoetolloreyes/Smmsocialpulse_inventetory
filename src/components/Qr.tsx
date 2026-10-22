"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Renders a product's QR code (its SKU/item code) as an image, generated
 *  entirely in the browser with the `qrcode` package — no external service. */
export function QrImage({
  value,
  size = 160,
  className = "",
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) setSrc("");
      });
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-stone-100 text-xs text-stone-400 ${className}`}
        style={{ width: size, height: size }}
      >
        QR…
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`QR code for ${value}`}
      width={size}
      height={size}
      className={className}
    />
  );
}

/** Square product thumbnail: the stored image URL, or brand-colored initials. */
export function ProductThumb({
  name,
  imageUrl,
  size = 44,
}: {
  name: string;
  imageUrl: string;
  size?: number;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className="shrink-0 rounded-lg object-cover"
        style={{ width: size, height: size }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
      style={{ width: size, height: size, background: "var(--brand)", fontSize: size * 0.36 }}
    >
      {initials || "?"}
    </div>
  );
}
