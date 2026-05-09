"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { UserProvider, useUser } from "@/contexts/UserContext";
import { FormatProvider } from "@/contexts/FormatContext";

import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";

import {
  Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";

import { type DateRange } from "react-day-picker";
import ProtectedPageWrapper from "@/components/protected-page-wrapper";

import {
  Laptop, Smartphone, Monitor, Globe, AlertCircle,
  ShieldAlert, ChevronLeft, ChevronRight, Loader2, Inbox,
} from "lucide-react";
import { UAParser } from "ua-parser-js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityAlert {
  Email: string;
  ipAddress: string;
  deviceId: string;
  userAgent?: string;
  message: string;
  timestamp: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 8;

function getDeviceIcon(userAgent?: string) {
  if (!userAgent) return Monitor;
  const parser = new UAParser(userAgent);
  const type = parser.getDevice().type ?? "desktop";
  if (type === "mobile") return Smartphone;
  if (type === "tablet") return Laptop;
  return Monitor;
}

function getDeviceLabel(userAgent?: string): string {
  if (!userAgent) return "Desktop";
  const parser = new UAParser(userAgent);
  const type = parser.getDevice().type ?? "desktop";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getDeviceModel(userAgent?: string, deviceId?: string): string {
  if (!userAgent) return deviceId ? `Device: ${deviceId}` : "Unknown Device";
  const parser = new UAParser(userAgent);
  const device = parser.getDevice();
  
  // Try to get device model and name from various sources
  const model = device.model || "";
  const vendor = device.vendor || "";
  
  // Common device name mappings for better readability
  const deviceNameMap: Record<string, string> = {
    // iPhone models
    "iPhone15,2": "iPhone 14 Pro",
    "iPhone15,3": "iPhone 14 Pro Max",
    "iPhone14,7": "iPhone 14",
    "iPhone14,8": "iPhone 14 Plus",
    "iPhone13,1": "iPhone 12 mini",
    "iPhone13,2": "iPhone 12",
    "iPhone13,3": "iPhone 12 Pro",
    "iPhone13,4": "iPhone 12 Pro Max",
    "iPhone12,1": "iPhone 11",
    "iPhone12,3": "iPhone 11 Pro",
    "iPhone12,5": "iPhone 11 Pro Max",
    
    // Samsung models
    "SM-G991B": "Samsung Galaxy S21",
    "SM-G996B": "Samsung Galaxy S21+",
    "SM-G998B": "Samsung Galaxy S21 Ultra",
    "SM-S901B": "Samsung Galaxy S22",
    "SM-S906B": "Samsung Galaxy S22+",
    "SM-S908B": "Samsung Galaxy S22 Ultra",
    "SM-S911B": "Samsung Galaxy S23",
    "SM-S916B": "Samsung Galaxy S23+",
    "SM-S918B": "Samsung Galaxy S23 Ultra",
    "SM-F711B": "Samsung Galaxy Z Flip 3",
    "SM-F721B": "Samsung Galaxy Z Flip 4",
    "SM-F926B": "Samsung Galaxy Z Fold 3",
    "SM-F936B": "Samsung Galaxy Z Fold 4",
    
    // iPad models
    "iPad13,1": "iPad Air (5th gen)",
    "iPad13,2": "iPad Air (5th gen)",
    "iPad14,1": "iPad mini (6th gen)",
    "iPad14,2": "iPad mini (6th gen)",
    "iPad13,4": "iPad Pro 11-inch (3rd gen)",
    "iPad13,5": "iPad Pro 11-inch (3rd gen)",
    "iPad13,6": "iPad Pro 11-inch (3rd gen)",
    "iPad13,7": "iPad Pro 11-inch (3rd gen)",
    "iPad13,8": "iPad Pro 12.9-inch (5th gen)",
    "iPad13,9": "iPad Pro 12.9-inch (5th gen)",
    "iPad13,10": "iPad Pro 12.9-inch (5th gen)",
    "iPad13,11": "iPad Pro 12.9-inch (5th gen)",
  };
  
  // Check if we have a mapped device name
  const mappedName = deviceNameMap[model];
  if (mappedName) {
    return mappedName;
  }
  
  // Return vendor + model if available
  if (model && vendor) {
    return `${vendor} ${model}`;
  } else if (model) {
    return model;
  } else if (vendor) {
    return vendor;
  }
  
  // Fallback to browser and OS info if device info is not available
  const browser = parser.getBrowser();
  const os = parser.getOS();
  
  if (browser.name && os.name) {
    return `${browser.name} on ${os.name}`;
  } else if (browser.name) {
    return browser.name;
  } else if (os.name) {
    return os.name;
  }
  
  // Final fallback: use device ID if available
  if (deviceId) {
    return `Device: ${deviceId}`;
  }
  
  return "Unknown Device";
}

// ─── Section card ─────────────────────────────────────────────────────────────

const SectionCard = ({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <div className="border border-gray-200 bg-white shadow-sm overflow-hidden">
    <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
      <div className="mt-0.5 p-1.5 bg-gray-900 text-white">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div>
        <h2 className="text-[11px] font-black uppercase tracking-widest text-gray-800">
          {title}
        </h2>
        {description && (
          <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

// ─── Alert row ────────────────────────────────────────────────────────────────

const AlertRow = ({ alert, index }: { alert: SecurityAlert; index: number }) => {
  const DeviceIcon = getDeviceIcon(alert.userAgent);
  const deviceLabel = getDeviceLabel(alert.userAgent);
  const deviceModel = getDeviceModel(alert.userAgent, alert.deviceId);

  return (
    <tr className={`border-b border-gray-100 last:border-b-0 text-xs ${index % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
      {/* Email */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span className="text-gray-700 font-mono text-[11px]">{alert.Email}</span>
        </div>
      </td>

      {/* IP */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="font-mono text-[11px] text-gray-600">{alert.ipAddress || "—"}</span>
        </div>
      </td>

      {/* Device */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <DeviceIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <div>
            <p className="text-[11px] font-bold text-gray-700 uppercase">{deviceLabel}</p>
            <p className="text-[10px] text-gray-600 font-semibold truncate max-w-[120px]">
              {deviceModel}
            </p>
            <p className="text-[9px] text-gray-400 font-mono truncate max-w-[120px]">
              {alert.deviceId || "—"}
            </p>
          </div>
        </div>
      </td>

      {/* Message */}
      <td className="px-3 py-3">
        <span className="inline-block bg-red-50 border border-red-100 text-red-700 text-[10px] font-semibold px-2 py-0.5 uppercase tracking-wide max-w-[200px] truncate">
          {alert.message || "—"}
        </span>
      </td>

      {/* Timestamp */}
      <td className="px-3 py-3 whitespace-nowrap">
        <span className="text-[11px] font-mono text-gray-500">
          {new Date(alert.timestamp).toLocaleString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </td>
    </tr>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────

const Pagination = ({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) => {
  if (total <= 1) return null;

  // Show at most 5 page buttons, centred on current
  const range = (start: number, end: number) =>
    Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const half = 2;
  const start = Math.max(1, current - half);
  const end = Math.min(total, current + half);
  const pages = range(start, end);

  return (
    <div className="flex items-center justify-center gap-1 mt-4 select-none">
      <button
        className="h-7 w-7 flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {start > 1 && (
        <>
          <button
            className="h-7 w-7 text-[11px] font-semibold border border-gray-200 hover:bg-gray-100 transition-colors"
            onClick={() => onChange(1)}
          >
            1
          </button>
          {start > 2 && <span className="text-gray-300 text-xs px-0.5">…</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          className={`h-7 w-7 text-[11px] font-bold border transition-colors ${
            p === current
              ? "bg-gray-900 text-white border-gray-900"
              : "border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}

      {end < total && (
        <>
          {end < total - 1 && <span className="text-gray-300 text-xs px-0.5">…</span>}
          <button
            className="h-7 w-7 text-[11px] font-semibold border border-gray-200 hover:bg-gray-100 transition-colors"
            onClick={() => onChange(total)}
          >
            {total}
          </button>
        </>
      )}

      <button
        className="h-7 w-7 flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        disabled={current === total}
        onClick={() => onChange(current + 1)}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      <span className="ml-2 text-[10px] text-gray-400 font-mono">
        {current} / {total}
      </span>
    </div>
  );
};

// ─── Main content ─────────────────────────────────────────────────────────────

function SettingsContent() {
  const searchParams = useSearchParams();
  const { userId, setUserId } = useUser();
  const queryUserId = searchParams?.get("id") ?? "";

  const [dateCreatedFilterRange, setDateCreatedFilterRangeAction] =
    useState<DateRange | undefined>(undefined);

  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [loadingUser, setLoadingUser] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // ── Sync userId from URL ──────────────────────────────────────────────────

  useEffect(() => {
    if (queryUserId && queryUserId !== userId) setUserId(queryUserId);
  }, [queryUserId, userId, setUserId]);

  // ── Fetch user email ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      setLoadingUser(true);
      try {
        const res = await fetch(`/api/user?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user");
        const data = await res.json();
        setUserEmail(data.Email || "");
      } catch (err) {
        console.error("User fetch error:", err);
        // No toast here — failed user fetch is a silent background operation
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUser();
  }, [userId]);

  // ── Fetch security alerts (filtered client-side by email) ──────────────────

  useEffect(() => {
    if (!userEmail) return;

    const fetchAlerts = async () => {
      setLoadingAlerts(true);
      try {
        const res = await fetch("/api/security-alerts");
        if (!res.ok) throw new Error("Failed to fetch alerts");
        const data: SecurityAlert[] = await res.json();
        // Filter to this user only
        const mine = (data || []).filter((a) => a.Email === userEmail);
        // Sort newest first
        mine.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setSecurityAlerts(mine);
        setCurrentPage(1);
      } catch (err) {
        console.error("Security alerts fetch error:", err);
      } finally {
        setLoadingAlerts(false);
      }
    };

    fetchAlerts();
  }, [userEmail]);

  // ── Pagination ────────────────────────────────────────────────────────────

  const totalPages = Math.ceil(securityAlerts.length / PAGE_SIZE);

  const paginated = useMemo(
    () => securityAlerts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [securityAlerts, currentPage]
  );

  const isLoading = loadingUser || loadingAlerts;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ProtectedPageWrapper>
      <SidebarLeft />

      <SidebarInset>
        {/* Header */}
        <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-gray-100">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wide">
                    Security
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* Alert count badge */}
          {securityAlerts.length > 0 && (
            <div className="pr-4">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-red-600 text-white px-2.5 py-1">
                <ShieldAlert className="w-3 h-3" />
                {securityAlerts.length} Alert{securityAlerts.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </header>

        {/* Content */}
        <div className="flex flex-col gap-5 p-5 w-full mx-auto w-full">
          <SectionCard
            icon={ShieldAlert}
            title="Security Alerts"
            description="Recent login and access events associated with your account."
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Loading security data…</span>
              </div>
            ) : securityAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-300 gap-3">
                <Inbox className="w-10 h-10 opacity-40" />
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  No security alerts on record
                </p>
                <p className="text-[10px] text-gray-300">
                  Your account has no recent security events.
                </p>
              </div>
            ) : (
              <>
                {/* Record count */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {securityAlerts.length} record{securityAlerts.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-gray-300 font-mono">
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, securityAlerts.length)} of{" "}
                    {securityAlerts.length}
                  </span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-gray-100">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-900 text-white">
                        {["Email", "IP Address", "Device Info", "Message", "Timestamp"].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((alert, i) => (
                        <AlertRow key={`${alert.timestamp}-${i}`} alert={alert} index={i} />
                      ))}
                    </tbody>
                  </table>
                </div>

                <Pagination
                  current={currentPage}
                  total={totalPages}
                  onChange={setCurrentPage}
                />
              </>
            )}
          </SectionCard>
        </div>
      </SidebarInset>

      <SidebarRight
        dateCreatedFilterRange={dateCreatedFilterRange}
        setDateCreatedFilterRangeAction={setDateCreatedFilterRangeAction}
      />
    </ProtectedPageWrapper>
  );
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <UserProvider>
      <FormatProvider>
        <SidebarProvider>
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-screen gap-2 text-gray-400 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            }
          >
            <SettingsContent />
          </Suspense>
        </SidebarProvider>
      </FormatProvider>
    </UserProvider>
  );
}