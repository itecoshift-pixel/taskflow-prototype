"use client";

import React, { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, Wrench, Clock } from "lucide-react";

// ─── Types (mirrors the API) ──────────────────────────────────────────────────
interface MaintenanceStyles {
  bg: string;
  border: string;
  title_color: string;
  message_color: string;
  icon_color: string;
}

interface MaintenanceData {
  maintenance_enabled: boolean;
  maintenance_title: string;
  maintenance_message: string;
  maintenance_banner_preset: string;
  maintenance_styles: MaintenanceStyles;
}

const DEFAULT_STYLES: MaintenanceStyles = {
  bg: "#fffbeb",
  border: "#f59e0b",
  title_color: "#92400e",
  message_color: "#78350f",
  icon_color: "#f59e0b",
};

// ─── Preset icon map ──────────────────────────────────────────────────────────
function PresetIcon({
  preset,
  color,
}: {
  preset: string;
  color: string;
}) {
  const cls = "h-6 w-6";
  if (preset === "warning")
    return <AlertTriangle className={cls} style={{ color }} />;
  if (preset === "maintenance")
    return <Wrench className={cls} style={{ color }} />;
  return <Clock className={cls} style={{ color }} />;
}

// ─── MaintenanceDialog ────────────────────────────────────────────────────────
export function MaintenanceDialog() {
  const [data, setData] = useState<MaintenanceData | null>(null);

  useEffect(() => {
    fetch("/api/maintenance")
      .then((res) => res.json())
      .then((json) => {
        if (json?.success && json.data) {
          setData(json.data as MaintenanceData);
        }
      })
      .catch((err) => {
        console.error("[MaintenanceDialog] Fetch failed:", err);
      });
  }, []);

  // Not yet loaded or maintenance is off — render nothing
  if (!data || !data.maintenance_enabled) return null;

  const styles: MaintenanceStyles = {
    ...DEFAULT_STYLES,
    ...(data.maintenance_styles ?? {}),
  };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={() => {
        /* intentionally non-closeable while maintenance is active */
      }}
    >
      <DialogPrimitive.Portal>
        {/* Overlay — sits above everything */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{ zIndex: 99998 }}
        />

        {/* Content */}
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-none p-0 overflow-hidden shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          style={{ zIndex: 99999, borderColor: styles.border, borderWidth: 2 }}
        >
          {/* ── Header bar ─────────────────────────────────────────────── */}
          <div
            className="px-6 pt-5 pb-4"
            style={{ backgroundColor: styles.bg, borderBottom: `1px solid ${styles.border}` }}
          >
            <div className="flex items-center gap-3 mb-1">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-none flex-shrink-0"
                style={{ backgroundColor: styles.icon_color + "20" }}
              >
                <PresetIcon
                  preset={data.maintenance_banner_preset}
                  color={styles.icon_color}
                />
              </div>
              <div>
                <DialogPrimitive.Title
                  className="text-base font-black uppercase tracking-wide leading-tight"
                  style={{ color: styles.title_color }}
                >
                  {data.maintenance_title}
                </DialogPrimitive.Title>
                <div
                  className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
                  style={{ color: styles.icon_color }}
                >
                  System Notice
                </div>
              </div>
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────── */}
          <div className="px-6 py-5" style={{ backgroundColor: styles.bg }}>
            <DialogPrimitive.Description
              className="text-sm leading-relaxed"
              style={{ color: styles.message_color }}
            >
              {data.maintenance_message}
            </DialogPrimitive.Description>
          </div>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div
            className="px-6 py-3 flex items-center gap-2"
            style={{
              backgroundColor: styles.bg,
              borderTop: `1px solid ${styles.border}`,
            }}
          >
            <div
              className="h-1.5 w-1.5 rounded-full animate-pulse"
              style={{ backgroundColor: styles.icon_color }}
            />
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: styles.message_color }}
            >
              Please check back later
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
