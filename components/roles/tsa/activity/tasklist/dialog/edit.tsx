"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sileo } from "sileo";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, PenLine } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Completed {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  tsm: string;
  manager: string;
  project_name?: string;
  type_activity?: string;
  product_category?: string;
  project_type?: string;
  source?: string;
  call_status?: string;
  call_type?: string;
  quotation_number?: string;
  quotation_amount?: number;
  quotation_status?: string;
  so_number?: string;
  so_amount?: number;
  actual_sales?: number;
  delivery_date?: string;
  dr_number?: string;
  remarks?: string;
  company_name: string;
  contact_number: string;
  contact_person?: string;
  email_address?: string;
  address?: string;
  payment_terms?: string;
}

interface TaskListEditDialogProps {
  item: Completed;
  onClose: () => void;
  onSave: () => void;
  company?: {
    account_reference_number: string;
    company_name?: string;
    contact_number?: string;
    type_client?: string;
    email_address?: string;
    address?: string;
    contact_person?: string;
  };
  firstname?: string;
  lastname?: string;
  email?: string;
  contact?: string;
  tsmname?: string;
  managername?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EDITABLE_FIELDS: (keyof Completed)[] = [
  "contact_person",
  "contact_number",
  "email_address",
  "address",
  "project_name",
  "project_type",
  "source",
  "type_activity",
  "call_type",
  "call_status",
  "quotation_amount",
  "quotation_status",
  "so_number",
  "so_amount",
  "actual_sales",
  "delivery_date",
  "dr_number",
  "remarks",
  "payment_terms",
];

const QUOTATION_STATUS_OPTIONS = [
  "Pending Client Approval",
  "For Bidding",
  "Nego",
  "Order Complete",
  "Convert to SO",
  "Loss Price is Too High",
  "Lead Time Issue",
  "Out of Stock",
  "Insufficient Stock",
  "Lost Bid",
  "Canvass Only",
  "Did Not Meet the Specs",
  "Declined / Disapproved",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLabel(key: string): string {
  if (key === "call_type") return "Type";
  if (key === "company_name") return "Company Name";
  if (key === "contact_person") return "Contact Person";
  if (key === "contact_number") return "Contact Number";
  if (key === "email_address") return "Email Address";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInputType(key: string): string {
  switch (key) {
    case "delivery_date": return "date";
    case "quotation_amount":
    case "so_amount":
    case "actual_sales": return "number";
    case "email_address": return "email";
    default: return "text";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaskListEditDialog({
  item,
  onClose,
  onSave,
}: TaskListEditDialogProps) {
  const [saving, setSaving] = useState(false);

  // Always-visible editable fields (shown even when empty so user can update them)
  const ALWAYS_VISIBLE_FIELDS: (keyof Completed)[] = [
    "contact_person", "contact_number", "email_address", "address", "remarks",
  ];

  const buildInitial = (src: Completed): Partial<Completed> =>
    EDITABLE_FIELDS.reduce((acc, key) => {
      const val = src[key];
      if (ALWAYS_VISIBLE_FIELDS.includes(key)) {
        (acc as any)[key] = val || "";
      } else if (val !== undefined && val !== null && String(val).trim() !== "") {
        (acc as any)[key] = val;
      }
      return acc;
    }, {} as Partial<Completed>);

  const [formData, setFormData] = useState<Partial<Completed>>(() => buildInitial(item));

  // FIX: reset form when item changes (dialog reused for different rows)
  useEffect(() => {
    setFormData(buildInitial(item));
  }, [item.id]);

  const handleChange = (field: keyof Completed, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    // Debug: Log what we're sending
    console.log("Saving edit:", { id: item.id, formData });

    try {
      const res = await fetch(`/api/activity/tsa/historical/update?id=${item.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Protection": "1"
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Update failed:", errorData);
        throw new Error(errorData?.error || "Failed to update");
      }

      sileo.success({
        title: "Saved",
        description: "Activity updated successfully.",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
      onSave();
    } catch (err: any) {
      console.error("Edit save error:", err);
      sileo.error({
        title: "Failed",
        description: err?.message || "Update failed. Please try again.",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setSaving(false);
    }
  };

  // Visible fields — type_activity and company_name are read-only, remarks shown separately
  const visibleEntries = Object.entries(formData).filter(
    ([key]) => key !== "type_activity" && key !== "remarks" && key !== "company_name",
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl border-none shadow-2xl">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-6 pt-6 pb-4 bg-white border-b border-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-zinc-100 rounded-full p-2">
                <PenLine className="h-4 w-4 text-zinc-900" />
              </div>
              <DialogTitle className="text-sm font-bold tracking-tight text-zinc-900">
                Edit Activity
              </DialogTitle>
            </div>
            <p className="text-zinc-500 text-[11px] font-medium mt-0.5">
              {item.activity_reference_number}
            </p>
          </DialogHeader>
        </div>

        {/* ── Fields ──────────────────────────────────────────────────── */}
        <div className="px-6 py-6 space-y-5 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200">

          {/* type_activity — read-only display */}
          {item.type_activity && (
            <div>
              <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                Activity Type
              </Label>
              <div className="border border-zinc-100 px-4 py-3 bg-zinc-50/50 text-xs text-zinc-600 font-medium rounded-xl">
                {item.type_activity}
              </div>
            </div>
          )}

          {/* company_name — read-only display, not editable */}
          {item.company_name && (
            <div>
              <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                Company Name
              </Label>
              <div className="border border-zinc-100 px-4 py-3 bg-zinc-50/50 text-xs text-zinc-900 font-bold rounded-xl">
                {item.company_name}
              </div>
            </div>
          )}

          {/* ── remarks textarea — always shown ─────────────────── */}
          <div>
            <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
              Remarks
            </Label>
            <Textarea
              className="w-full text-xs resize-none rounded-2xl border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200 transition-all min-h-[100px]"
              rows={3}
              value={String(formData.remarks ?? "")}
              onChange={(e) => handleChange("remarks", e.target.value)}
              placeholder="Enter remarks..."
            />
          </div>

          {visibleEntries.length === 0 && (
            <p className="text-xs text-zinc-400 italic text-center py-4">
              No editable fields with data for this record.
            </p>
          )}

          {visibleEntries.map(([key, value]) => {
            // ── call_status select ──────────────────────────────────
            if (key === "call_status") {
              return (
                <div key={key}>
                  <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                    {getLabel(key)}
                  </Label>
                  <Select
                    value={String(value ?? "")}
                    onValueChange={(val) => handleChange(key as keyof Completed, val)}
                  >
                    <SelectTrigger className="w-full text-xs rounded-full h-11 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                      <SelectValue placeholder="Select call status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectGroup>
                        <SelectItem value="Successful">Successful</SelectItem>
                        <SelectItem value="Unsuccessful">Unsuccessful</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            // ── quotation_status select ─────────────────────────────
            if (key === "quotation_status") {
              return (
                <div key={key}>
                  <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                    Quotation Status
                  </Label>
                  <Select
                    value={String(value ?? "")}
                    onValueChange={(val) => handleChange("quotation_status", val)}
                  >
                    <SelectTrigger className="w-full text-xs rounded-full h-11 border-zinc-200 bg-zinc-50/50 focus:ring-zinc-200">
                      <SelectValue placeholder="Select quotation status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectGroup>
                        {QUOTATION_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs font-medium">{s}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              );
            }

            // ── default input ───────────────────────────────────────
            return (
              <div key={key}>
                <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block mb-2 ml-1">
                  {getLabel(key)}
                </Label>
                <Input
                  className="w-full text-xs rounded-full h-11 border-zinc-200 bg-zinc-50/50 focus-visible:ring-zinc-200"
                  type={getInputType(key)}
                  value={String(value ?? "")}
                  onChange={(e) => handleChange(key as keyof Completed, e.target.value)}
                />
              </div>
            );
          })}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-6 py-5 border-t border-zinc-100 flex gap-3 bg-zinc-50/50">
          <Button
            variant="ghost"
            className="flex-1 text-xs h-11 rounded-full font-bold text-zinc-500 hover:bg-zinc-100"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 text-xs h-11 bg-zinc-900 hover:bg-zinc-800 rounded-full font-bold text-white shadow-lg shadow-zinc-200"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
