"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * Live camera QR/barcode scanner.
 * Uses the native BarcodeDetector where available, with a jsQR fallback over
 * the same video stream (decoded from canvas frames) for other browsers.
 * Calls onDetect once per code; the parent decides what to do with it.
 */
export function Scanner({
  onDetect,
  active,
}: {
  onDetect: (code: string) => void;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const seenRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [state, setState] = useState<"idle" | "starting" | "on" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!active) {
      setState("idle");
      return;
    }
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    const start = async () => {
      setState("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        if (!stopped) {
          setState("error");
          setErrorMsg(
            "Camera unavailable or permission denied. Use manual code entry below instead.",
          );
        }
        return;
      }
      const video = videoRef.current;
      if (!video || stopped) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      if (stopped) return;
      setState("on");

      const detector: BarcodeDetectorLike | null =
        typeof window !== "undefined" && window.BarcodeDetector
          ? new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13", "ean_8", "code_39"] })
          : null;
      let jsQR: typeof import("jsqr").default | null = null;
      if (!detector) {
        try {
          const mod = await import("jsqr");
          jsQR = mod.default;
        } catch {
          jsQR = null;
        }
      }

      const fire = (code: string) => {
        const now = Date.now();
        if (seenRef.current.code === code && now - seenRef.current.at < 2500) return;
        seenRef.current = { code, at: now };
        onDetect(code);
      };

      const tick = async () => {
        if (stopped) return;
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (v && canvas && v.readyState >= 2) {
          try {
            if (detector) {
              const found = await detector.detect(v);
              if (found && found[0]?.rawValue) fire(found[0].rawValue);
            } else if (jsQR) {
              const w = v.videoWidth;
              const h = v.videoHeight;
              if (w && h) {
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d", { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(v, 0, 0, w, h);
                  const img = ctx.getImageData(0, 0, w, h);
                  const res = jsQR(img.data, w, h);
                  if (res?.data) fire(res.data);
                }
              }
            }
          } catch {
            /* a failed frame is ignored; the next one may succeed */
          }
        }
        raf = window.setTimeout(() => {
          raf = requestAnimationFrame(() => void tick());
        }, 120) as unknown as number;
      };
      void tick();
    };

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="aspect-[4/3] w-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />
      {state !== "on" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center text-white">
          <Icon name={state === "error" ? "triangle-exclamation" : "camera"} className="text-3xl" />
          <p className="text-sm font-medium">
            {state === "starting"
              ? "Starting camera…"
              : state === "error"
                ? errorMsg
                : "Camera is off."}
          </p>
        </div>
      )}
      {state === "on" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-44 w-44 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        </div>
      )}
    </div>
  );
}
