"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2, ShieldCheck, ShieldX, SendToBack, FileText, Package, Building2, X, ZoomIn } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  isEditMode: boolean;
  prepared_by?: string;
  firstname?: string;
  lastname?: string;
  currentSPF: any;
  setCurrentSPF: (data: any) => void;
  handleCreateSPF: (payload?: any) => void;
  handleEditSPF: (payload?: any) => void;
  referenceid: string;
}

interface SPFCreationRow {
  id: number;
  spf_number: string;
  company_name?: string;
  supplier_brand?: string;
  contact_name?: string;
  contact_number?: string;
  item_code?: string;
  product_offer_image?: string;
  product_offer_qty?: string;
  product_offer_technical_specification?: string;
  product_offer_unit_cost?: string;
  product_offer_packaging_details?: string;
  product_offer_factory_address?: string;
  product_offer_port_of_discharge?: string;
  product_offer_subtotal?: string;
  product_offer_pcs_per_carton?: string;
  final_selling_cost?: string;
  final_unit_cost?: string;
  final_subtotal?: string;
  proj_lead_time?: string;
  status?: string;
}

interface SpecItem {
  key: string;
  value: string;
  multiValues: string[];
}

interface SpecCategory {
  name: string;
  items: SpecItem[];
}

interface OfferProduct {
  image: string;
  qty: string;
  spec: SpecCategory[];
  unit_cost: string;
  packaging: string;
  factory_address: string;
  port_of_discharge: string;
  subtotal: string;
  pcs_per_carton: string;
  company_name: string;
  supplier_brand: string;
  contact_number: string;
  item_code: string;
  lead_time: string;
  final_selling: string;
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

/**
 * Separators:
 *   |ROW|  — splits item rows (groups of products)
 *   ||     — splits product variants within a row  (specs, costs, packaging, etc.)
 *   ,      — splits product variants within a row  (images, qty, item_code, lead_time, selling_cost)
 *   |      — splits multiple values within a single spec field (handled inside parseSpec)
 */

/** For spec/cost/packaging/factory/port/subtotal/pcs fields — variants separated by || */
const parseField2D = (val?: string): string[][] => {
  if (!val?.trim()) return [[""]];
  return val.split("|ROW|").map((row) =>
    row.split("||").map((s) => s.trim()).filter((s) => s.length > 0)
  );
};

/** For image, qty, item_code, lead_time, selling_cost — variants separated by , (comma) */
const parseCommaField2D = (val?: string): string[][] => {
  if (!val?.trim()) return [[""]];
  return val.split("|ROW|").map((row) =>
    row.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
  );
};

/**
 * Parse a technical spec string into structured categories.
 * Format: CATEGORY~~key: val;;key: val@@CATEGORY~~key: val|alt val;;key: val
 */
const parseSpec = (raw: string): SpecCategory[] => {
  if (!raw?.trim()) return [];
  return raw
    .split("@@")
    .map((catChunk) => {
      const [catName, rest] = catChunk.split("~~");
      if (!catName?.trim()) return null;
      const items: SpecItem[] = (rest || "")
        .split(";;")
        .map((entry) => {
          const colonIdx = entry.indexOf(":");
          if (colonIdx === -1) return null;
          const key = entry.slice(0, colonIdx).trim();
          const rawVal = entry.slice(colonIdx + 1).trim();
          const multiValues = rawVal.split("|").map((v) => v.trim()).filter(Boolean);
          return { key, value: rawVal, multiValues } as SpecItem;
        })
        .filter(Boolean) as SpecItem[];
      return { name: catName.trim(), items } as SpecCategory;
    })
    .filter(Boolean) as SpecCategory[];
};

/**
 * Build 2D array of products per row for a given offer.
 * Returns: rows → products (variants)
 */
const parseOfferRows = (row: SPFCreationRow): OfferProduct[][] => {
  const f = parseField2D;
  const fc = parseCommaField2D;

  // comma-separated variant fields
  const images = fc(row.product_offer_image);
  const qtys = fc(row.product_offer_qty);
  const codes = fc(row.item_code);
  const leads = fc(row.proj_lead_time);
  const sellings = fc(row.final_selling_cost);

  // ||-separated variant fields
  const specs = f(row.product_offer_technical_specification);
  const costs = f(row.product_offer_unit_cost);
  const packs = f(row.product_offer_packaging_details);
  const factories = f(row.product_offer_factory_address);
  const ports = f(row.product_offer_port_of_discharge);
  const subtotals = f(row.product_offer_subtotal);
  const pcs = f(row.product_offer_pcs_per_carton);
  const companies = f(row.company_name);
  const brands = f(row.supplier_brand);
  const contacts = f(row.contact_number);

  const numRows = Math.max(images.length, qtys.length, specs.length);

  return Array.from({ length: numRows }, (_, ri) => {
    const rImg = images[ri] ?? [""];
    const rQty = qtys[ri] ?? [""];
    const rSpc = specs[ri] ?? [""];
    const rCst = costs[ri] ?? [""];
    const rPck = packs[ri] ?? [""];
    const rFct = factories[ri] ?? [""];
    const rPrt = ports[ri] ?? [""];
    const rSub = subtotals[ri] ?? [""];
    const rPcs = pcs[ri] ?? [""];
    const rComp = companies[ri] ?? [""];
    const rBrnd = brands[ri] ?? [""];
    const rCont = contacts[ri] ?? [""];
    const rCode = codes[ri] ?? [""];
    const rLead = leads[ri] ?? [""];
    const rSell = sellings[ri] ?? [""];

    const numProds = Math.max(rImg.length, rQty.length, rSpc.length);

    return Array.from({ length: numProds }, (_, pi) => ({
      image: rImg[pi] ?? "",
      qty: rQty[pi] ?? "",
      spec: parseSpec(rSpc[pi] ?? ""),
      unit_cost: rCst[pi] ?? "",
      packaging: rPck[pi] ?? "",
      factory_address: rFct[pi] ?? "",
      port_of_discharge: rPrt[pi] ?? "",
      subtotal: rSub[pi] ?? "",
      pcs_per_carton: rPcs[pi] ?? "",
      company_name: rComp[pi] ?? "",
      supplier_brand: rBrnd[pi] ?? "",
      contact_number: rCont[pi] ?? "",
      item_code: rCode[pi] ?? "",
      lead_time: rLead[pi] ?? "",
      final_selling: rSell[pi] ?? "",
    }));
  });
};

// ─── Style constants ──────────────────────────────────────────────────────────

const F: React.CSSProperties = {
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const FormRow = ({ label, value, wide }: { label: string; value?: string; wide?: boolean }) => (
  <div className={`flex flex-col gap-0.5 ${wide ? "col-span-2" : ""}`}>
    <span style={{ ...F, fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>
      {label}
    </span>
    <div style={{ ...F, borderBottom: "1.5px solid #374151", minHeight: "26px", paddingBottom: "2px", paddingTop: "3px", fontSize: "12px", color: value ? "#111827" : "#d1d5db", letterSpacing: "0.03em" }}>
      {value || "—"}
    </div>
  </div>
);

const SectionHeader = ({ children, accent = "#1f2937" }: { children: React.ReactNode; accent?: string }) => (
  <div style={{ background: accent, padding: "5px 12px", marginBottom: "10px" }}>
    <span style={{ ...F, fontSize: "9px", letterSpacing: "0.15em", textTransform: "uppercase", color: "#f9fafb", fontWeight: 700 }}>
      {children}
    </span>
  </div>
);

const SpecDisplay = ({ categories }: { categories: SpecCategory[] }) => {
  if (!categories.length) return (
    <span style={{ ...F, fontSize: "10px", color: "#9ca3af", fontStyle: "italic" }}>No specifications</span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {categories.map((cat, ci) => (
        <div key={ci} style={{ border: "1px solid #dbeafe", overflow: "hidden" }}>
          <div style={{ background: "#eff6ff", borderBottom: "1px solid #dbeafe", padding: "3px 9px" }}>
            <span style={{ ...F, fontSize: "8px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1e40af" }}>
              {cat.name}
            </span>
          </div>
          <div style={{ padding: "0" }}>
            {cat.items.map((item, ii) => (
              <div key={ii} style={{ display: "grid", gridTemplateColumns: "38% 62%", borderBottom: ii < cat.items.length - 1 ? "1px solid #f0f9ff" : "none" }}>
                <div style={{ background: "#f8faff", borderRight: "1px solid #dbeafe", padding: "4px 9px" }}>
                  <span style={{ ...F, fontSize: "9.5px", color: "#374151", fontWeight: 600 }}>{item.key}</span>
                </div>
                <div style={{ padding: "4px 9px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "3px" }}>
                  {item.multiValues.length > 1
                    ? item.multiValues.map((v, vi) => (
                      <span key={vi} style={{ ...F, fontSize: "9px", background: "#dbeafe", color: "#1e40af", padding: "1px 6px", fontWeight: 600, border: "1px solid #bfdbfe" }}>
                        {v}
                      </span>
                    ))
                    : <span style={{ ...F, fontSize: "9.5px", color: "#1f2937" }}>{item.value}</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RequestDialog({
  open, onClose, isEditMode, prepared_by, firstname, lastname,
  currentSPF, setCurrentSPF, handleCreateSPF, handleEditSPF,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [offers, setOffers] = useState<SPFCreationRow[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);

  const openFullImage = (url: string) => {
    setFullImageUrl(url);
    setIsImageDialogOpen(true);
  };

  const fullName = [firstname, lastname].filter(Boolean).join(" ").trim() || prepared_by || "";

  const isReadyForQuotation = (currentSPF?.status || "").toLowerCase() === "approved by procurement";

  // ── Parse main SPF items ──
  const items = (() => {
    const descs = (currentSPF?.item_description || "").split(",").map((s: string) => s.trim());
    const photos = (currentSPF?.item_photo || "").split(",").map((s: string) => s.trim());
    const maxLen = Math.max(descs.filter(Boolean).length, photos.filter(Boolean).length);
    return maxLen > 0
      ? Array.from({ length: maxLen }, (_, i) => ({ item_description: descs[i] || "", item_photo: photos[i] || "" }))
      : [];
  })();

  // ── Fetch spf_creation offers ──
  useEffect(() => {
    if (!open || !isReadyForQuotation || !currentSPF?.spf_number) { setOffers([]); return; }
    setLoadingOffers(true);
    supabase
      .from("spf_creation")
      .select("*")
      .eq("spf_number", currentSPF.spf_number)
      .order("id", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setOffers(data as SPFCreationRow[]);
        setLoadingOffers(false);
      });
  }, [open, isReadyForQuotation, currentSPF?.spf_number]);

  // ── Submit ──
  const handleSubmit = async (status: "Approved" | "Endorsed to Sales Head" | "Declined by TSM") => {
    setSubmitting(true);
    const updated = { ...currentSPF, approved_by: fullName, status };
    setCurrentSPF(updated);
    try {
      if (isEditMode) await handleEditSPF(updated);
      else await handleCreateSPF(updated);
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

  const sl = (currentSPF?.status || "").toLowerCase();
  const statusColor = sl === "approved" ? "#065f46" : sl === "endorsed to sales head" ? "#1e40af" : "#92400e";
  const statusBg = sl === "approved" ? "#d1fae5" : sl === "endorsed to sales head" ? "#dbeafe" : "#fef3c7";
  const statusBorder = sl === "approved" ? "#6ee7b7" : sl === "endorsed to sales head" ? "#93c5fd" : "#fcd34d";
  const statusLabel = sl === "approved by procurement" ? "Ready for Quotation" : currentSPF?.status;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="p-0 overflow-hidden"
        style={{
          maxWidth: isReadyForQuotation ? "1280px" : "720px",
          width: "100%",
          borderRadius: "2px",
          border: "1px solid #d1d5db",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.1)",
          transition: "max-width 0.25s ease",
        }}
      >
        <div style={{ background: "#f8f7f4", maxHeight: "calc(100vh - 60px)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

            {/* LEFT — SPF Form */}
            <div style={{ flex: isReadyForQuotation ? "0 0 490px" : "1", minWidth: 0 }}>
              <div style={{ background: "#fff", margin: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)" }}>

                {/* Letterhead */}
                <div style={{ borderBottom: "3px solid #1f2937", padding: "16px 22px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ ...F, fontSize: "15px", fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1f2937", lineHeight: 1 }}>SPF Form</div>
                    <div style={{ ...F, fontSize: "9px", letterSpacing: "0.1em", color: "#6b7280", marginTop: "4px", textTransform: "uppercase" }}>Internal Document · For Approval</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#1f2937", padding: "4px 10px" }}>
                      <FileText style={{ width: "10px", height: "10px", color: "#f9fafb" }} />
                      <span style={{ ...F, fontSize: "10px", color: "#f9fafb", fontWeight: 700 }}>{currentSPF?.spf_number || "SPF-PENDING"}</span>
                    </div>
                    <div style={{ ...F, fontSize: "9px", color: "#9ca3af", marginTop: "5px" }}>{today}</div>
                  </div>
                </div>

                {/* Status */}
                {currentSPF?.status && (
                  <div style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", padding: "5px 22px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ ...F, fontSize: "8px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>Status:</span>
                    <span style={{ ...F, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: statusColor, fontWeight: 700, background: statusBg, padding: "2px 8px", border: `1px solid ${statusBorder}` }}>
                      {statusLabel}
                    </span>
                  </div>
                )}

                <div style={{ padding: "14px 18px 18px", flex: 1, overflowY: "auto", minHeight: 0, maxHeight: "70vh" }}>
                  {/* 01 Customer Info */}
                  <div style={{ marginBottom: "16px" }}>
                    <SectionHeader>01 · Customer Information</SectionHeader>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px 14px", padding: "0 2px" }}>
                      <FormRow label="Customer Name" value={currentSPF?.customer_name} wide />
                      <FormRow label="Contact Person" value={currentSPF?.contact_person} />
                      <FormRow label="Contact Number" value={currentSPF?.contact_number} />
                      <FormRow label="TIN Number" value={currentSPF?.tin_no} />
                      <FormRow label="Registered Address" value={currentSPF?.registered_address} wide />
                      <FormRow label="Delivery Address" value={currentSPF?.delivery_address} wide />
                      <FormRow label="Billing Address" value={currentSPF?.billing_address} />
                      <FormRow label="Collection Address" value={currentSPF?.collection_address} />
                    </div>
                  </div>

                  {/* 02 Order Terms */}
                  <div style={{ marginBottom: "16px" }}>
                    <SectionHeader>02 · Order Terms</SectionHeader>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px 14px", padding: "0 2px" }}>
                      <FormRow label="Payment Terms" value={currentSPF?.payment_terms} />
                      <FormRow label="Warranty" value={currentSPF?.warranty} />
                      <FormRow label="Delivery Date" value={currentSPF?.delivery_date ? new Date(currentSPF.delivery_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : undefined} />
                      <FormRow label="Special Instructions" value={currentSPF?.special_instructions} wide />
                    </div>
                  </div>

                  {/* 03 Items */}
                  <div style={{ marginBottom: "16px" }}>
                    <SectionHeader>03 · Items ({items.length})</SectionHeader>
                    {items.length === 0 ? (
                      <div style={{ border: "1.5px dashed #d1d5db", padding: "18px", textAlign: "center" }}>
                        <span style={{ ...F, fontSize: "10px", color: "#9ca3af", letterSpacing: "0.08em", textTransform: "uppercase" }}>No items on record</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 2px" }}>
                        {items.map((item, i) => (
                          <div key={i} style={{ border: "1px solid #e5e7eb", display: "grid", gridTemplateColumns: "76px 1fr" }}>
                            <div style={{ background: "#f3f4f6", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 6px", gap: "5px" }}>
                              <span style={{ ...F, fontSize: "7px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700 }}>Item</span>
                              <span style={{ ...F, fontSize: "18px", fontWeight: 900, color: "#374151", lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</span>
                              {item.item_photo ? (
                                <>
                                  <div style={{ width: "50px", height: "50px", border: "1px solid #d1d5db", background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <img src={item.item_photo} alt={`Item ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                  </div>
                                  <button
                                    onClick={() => openFullImage(item.item_photo!)}
                                    style={{ ...F, fontSize: "7px", background: "#1f2937", color: "#f9fafb", padding: "2px 6px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "2px", marginTop: "2px" }}
                                  >
                                    <ZoomIn style={{ width: "8px", height: "8px" }} />
                                    View Full
                                  </button>
                                </>
                              ) : (
                                <div style={{ width: "50px", height: "50px", border: "1.5px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  <span style={{ fontSize: "7px", color: "#d1d5db", ...F, textTransform: "uppercase" }}>No Photo</span>
                                </div>
                              )}
                            </div>
                            <div style={{ padding: "9px 10px" }}>
                              <span style={{ ...F, fontSize: "7.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700, display: "block", marginBottom: "4px" }}>Description</span>
                              <p
                                style={{
                                  ...F,
                                  fontSize: "11px",
                                  color: item.item_description ? "#111827" : "#9ca3af",
                                  margin: 0,
                                  whiteSpace: "pre-line",
                                }}
                              >
                                {(item.item_description || "No description provided.")
                                  .replace(/([A-Za-z ]+:\s*)/g, "\n$1")
                                  .trim()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 04 Signatories */}
                  <div>
                    <SectionHeader>04 · Signatories</SectionHeader>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", padding: "0 2px" }}>
                      <FormRow label="Sales Person" value={currentSPF?.sales_person} />
                      <FormRow label="Prepared By" value={currentSPF?.prepared_by} />
                      <FormRow label="Approved By" value={fullName || currentSPF?.approved_by} />

                    </div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb", padding: "6px 18px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ ...F, fontSize: "8px", color: "#d1d5db", letterSpacing: "0.08em", textTransform: "uppercase" }}>Confidential · Internal Use Only</span>
                  <span style={{ ...F, fontSize: "8px", color: "#d1d5db" }}>{currentSPF?.spf_number || "—"}</span>
                </div>
              </div>
            </div>

            {/* RIGHT — Product Offers */}
            {isReadyForQuotation && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: "#fff", margin: "16px 16px 16px 0", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", height: "calc(100% - 32px)" }}>

                  <div style={{ borderBottom: "3px solid #1e3a8a", padding: "16px 20px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
                    <div>
                      <div style={{ ...F, fontSize: "13px", fontWeight: 900, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1e3a8a", lineHeight: 1 }}>Product Offers</div>
                      <div style={{ ...F, fontSize: "9px", letterSpacing: "0.1em", color: "#6b7280", marginTop: "3px", textTransform: "uppercase" }}>Procurement Costing Results</div>
                    </div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#1e3a8a", padding: "4px 10px" }}>
                      <Package style={{ width: "10px", height: "10px", color: "#93c5fd" }} />
                      <span style={{ ...F, fontSize: "10px", color: "#bfdbfe", fontWeight: 700, letterSpacing: "0.08em" }}>
                        {offers.length} Offer{offers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
                    {loadingOffers ? (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100px", gap: "8px" }}>
                        <Loader2 style={{ width: "15px", height: "15px", color: "#6b7280", animation: "spin 1s linear infinite" }} />
                        <span style={{ ...F, fontSize: "10px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.1em" }}>Loading offers…</span>
                      </div>
                    ) : offers.length === 0 ? (
                      <div style={{ border: "1.5px dashed #dbeafe", padding: "28px", textAlign: "center" }}>
                        <Package style={{ width: "26px", height: "26px", color: "#bfdbfe", margin: "0 auto 8px" }} />
                        <span style={{ ...F, fontSize: "10px", color: "#93c5fd", letterSpacing: "0.08em", textTransform: "uppercase" }}>No offers recorded yet</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {offers.map((offer, oi) => {
                          const offerRows = parseOfferRows(offer);
                          const totalProducts = offerRows.reduce((sum, r) => sum + r.length, 0);
                          return (
                            <div key={offer.id} style={{ border: "1px solid #e2e8f0", overflow: "hidden" }}>
                              <div style={{ background: "#1e3a8a", padding: "7px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                                  <Building2 style={{ width: "11px", height: "11px", color: "#93c5fd", flexShrink: 0 }} />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ ...F, fontSize: "8px", color: "#93c5fd", background: "rgba(255,255,255,0.1)", padding: "2px 7px", border: "1px solid rgba(147,197,253,0.3)" }}>
                                    {offerRows.length} row{offerRows.length !== 1 ? "s" : ""} · {totalProducts} product{totalProducts !== 1 ? "s" : ""}
                                  </span>
                                  <span style={{ ...F, fontSize: "10px", color: "#60a5fa", fontWeight: 900 }}>{String(oi + 1).padStart(2, "0")}</span>
                                </div>
                              </div>

                              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                                {offerRows.map((rowProducts, ri) => (
                                  <div key={ri}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "7px" }}>
                                      <div style={{ background: "#1e3a8a", padding: "2px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                        <span style={{ ...F, fontSize: "7.5px", color: "#bfdbfe", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Item Row {ri + 1}</span>
                                      </div>
                                      <div style={{ flex: 1, height: "1px", background: "#dbeafe" }} />
                                      <span style={{ ...F, fontSize: "7.5px", color: "#93c5fd" }}>{rowProducts.length} variant{rowProducts.length !== 1 ? "s" : ""}</span>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: rowProducts.length > 1 ? `repeat(${Math.min(rowProducts.length, 2)}, 1fr)` : "1fr", gap: "8px" }}>
                                      {rowProducts.map((prod, pi) => (
                                        <div key={pi} style={{ border: "1px solid #e5e7eb", overflow: "hidden" }}>
                                          <div style={{ background: "#f0f9ff", borderBottom: "1px solid #dbeafe", padding: "4px 10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                            <span style={{ ...F, fontSize: "7.5px", color: "#1e40af", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Variant {pi + 1}</span>
                                            {prod.image ? (
                                              <>
                                                <div
                                                  onClick={() => openFullImage(prod.image)}
                                                  style={{ width: "32px", height: "32px", border: "1px solid #bfdbfe", background: "#fff", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                                                  title="Click to view full image"
                                                >
                                                  <img src={prod.image} alt={`R${ri + 1}P${pi + 1}`} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                                                </div>
                                                <button
                                                  onClick={() => openFullImage(prod.image)}
                                                  style={{ ...F, fontSize: "6px", background: "#1e3a8a", color: "#bfdbfe", padding: "1px 4px", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "1px" }}
                                                >
                                                  <ZoomIn style={{ width: "7px", height: "7px" }} />
                                                  View
                                                </button>
                                              </>
                                            ) : (
                                              <div style={{ width: "32px", height: "32px", border: "1.5px dashed #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                <span style={{ fontSize: "6px", color: "#bfdbfe", ...F, textTransform: "uppercase" }}>No Img</span>
                                              </div>
                                            )}
                                          </div>

                                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0", borderBottom: "1px solid #e5e7eb" }}>
                                            {[
                                              { label: "Item Code", value: prod.item_code },
                                              { label: "Lead Time", value: prod.lead_time },
                                              { label: "Selling Cost", value: prod.final_selling },
                                              { label: "Qty", value: prod.qty },
                                            ].map(({ label, value }, mi) => (
                                              <div key={mi} style={{ padding: "4px 7px", borderRight: mi % 3 !== 2 ? "1px solid #f3f4f6" : "none", borderBottom: mi < 3 ? "1px solid #f3f4f6" : "none", background: mi % 2 === 0 ? "#fff" : "#fafafa" }}>
                                                <div style={{ ...F, fontSize: "7px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700 }}>{label}</div>
                                                <div style={{ ...F, fontSize: "10px", color: value ? "#1f2937" : "#d1d5db", fontWeight: 600 }}>{value || "—"}</div>
                                              </div>
                                            ))}
                                          </div>

                                          <div style={{ padding: "8px 9px" }}>
                                            <div style={{ ...F, fontSize: "7px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", fontWeight: 700, marginBottom: "6px" }}>Technical Specifications</div>
                                            <SpecDisplay categories={prod.spec} />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid #dbeafe", background: "#f0f9ff", padding: "6px 14px", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
                    <span style={{ ...F, fontSize: "8px", color: "#93c5fd", letterSpacing: "0.08em", textTransform: "uppercase" }}>Procurement Costing Data</span>
                    <span style={{ ...F, fontSize: "8px", color: "#93c5fd" }}>{currentSPF?.spf_number || "—"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          {!(
            currentSPF?.status?.includes("Approved By Procurement") ||
            ["Processed by PD"].includes(currentSPF?.status || "") ||
            currentSPF?.status?.includes("Approved by TSM") ||
            currentSPF?.status?.includes("Approved by Sales Head")
          ) && (
              <div style={{ position: "sticky", bottom: 0, zIndex: 10, background: "#1f2937", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #374151" }}>
                <button
                  onClick={onClose}
                  disabled={submitting}
                  style={{ ...F, fontSize: "9px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#9ca3af", background: "transparent", border: "1px solid #4b5563", padding: "7px 16px", cursor: "pointer", fontWeight: 700 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#f9fafb"; e.currentTarget.style.borderColor = "#9ca3af"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.borderColor = "#4b5563"; }}
                >
                  ← Close
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => handleSubmit("Endorsed to Sales Head")}
                    disabled={submitting}
                    style={{ ...F, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#bfdbfe", background: "#1e3a8a", border: "1px solid #3b82f6", padding: "7px 16px", cursor: submitting ? "not-allowed" : "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", opacity: submitting ? 0.6 : 1 }}
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = "#1e40af"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#1e3a8a"; }}
                  >
                    {submitting ? <Loader2 style={{ width: "10px", height: "10px", animation: "spin 1s linear infinite" }} /> : <SendToBack style={{ width: "10px", height: "10px" }} />}
                    Endorse to Sales Head
                  </button>

                  <button
                    onClick={() => handleSubmit("Approved")}
                    disabled={submitting}
                    style={{ ...F, fontSize: "9px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#d1fae5", background: "#065f46", border: "1px solid #10b981", padding: "7px 16px", cursor: submitting ? "not-allowed" : "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", opacity: submitting ? 0.6 : 1 }}
                    onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = "#047857"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#065f46"; }}
                  >
                    {submitting ? <Loader2 style={{ width: "10px", height: "10px", animation: "spin 1s linear infinite" }} /> : <ShieldCheck style={{ width: "10px", height: "10px" }} />}
                    Approved
                  </button>
                  
                </div>
              </div>
            )}
        </div>
      </DialogContent>

      {/* Full Image Dialog */}
      <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
        <DialogContent className="p-0 max-w-5xl w-[120vw] bg-white border-none">
          <div style={{ position: "relative", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsImageDialogOpen(false)}
              className="absolute top-2 right-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
            {fullImageUrl ? (
              <img
                src={fullImageUrl}
                alt="Full view"
                style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain" }}
              />
            ) : (
              <div style={{ padding: "40px", color: "#9ca3af" }}>No image</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}