"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sileo } from "sileo";
import { 
  CheckCircle2Icon, 
  FileText, 
  Eye, 
  Download, 
  FileSpreadsheet,
  History,
  Building2,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import jsPDF from "jspdf";

// ── DSI Form Constants ──────────────────────────────────────────────────────
const MODES = ["DELIVERY", "PICK UP", "WALK IN"];

const SO_TYPES = [
  "REGULAR SO", "WILLING TO WAIT", "WALK IN", "FB MARKETPLACE",
  "ECOMMERCE", "PROMO ITEM", "INTERNAL ORDER-REGULAR", "INTERNAL ORDER-PROMO",
  "SPECIAL PROJECT", "LOCAL SPF", "DELIVERY", "PICK UP"
];

const INVOICE_TYPES = ["SALES INVOICE", "RECEIVING SLIP"];

const PAYMENT_TERMS = [
  "CASH", "DATED CHECK", "BANK TRANSFER", "30 DAYS STRAIGHT", "30 DAYS PDC",
  "60 DAYS STRAIGHT", "60 DAYS PDC", "90 DAYS STRAIGHT", "90 DAYS PDC",
  "50% DP 50% 30 DAYS STRAIGHT", "50% DP 50% 30 DAYS PDC",
  "60% DP 40% 30 DAYS STRAIGHT", "60% DP 40% 30 DAYS PDC",
  "50% DP 50% DATED CHECK UPON DELIVERY", "60% DP 40% DATED CHECK UPON DELIVERY",
  "50% DP 50% BANK TRANSFER UPON DELIVERY", "60% DP 40% BANK TRANSFER UPON DELIVERY",
  "50% DP 50% 7 DAYS PDC", "OTHERS"
];

const IO_DEPTS = [
  "ACCOUNTING", "ADMIN", "BUS DEV", "CUSTOMER SERVICE", "ECOMMERCE",
  "ENGINEERING", "HUMAN RESOURCES", "INFORMATION TECH", "MARKETING",
  "PURCHASING", "RESEARCH&DEVT", "SALES", "WAREHOUSE", "N/A"
];

const SALES_GROUPS = [
  "OFFICE", "ECOMMERCE", "PROJECTS", "DISTRIBUTOR", "FB MARKETPLACE",
  "BUS DEV", "GOVERNMENT", "EMPLOYEE", "EM CO", "TPC", "TPC REGULAR"
];

const INDUSTRIES = [
  "AGRICULTURE HUNTING AND FORESTRY", "CONSTRUCTION", "DATA CENTER", "EDUCATION",
  "ELECTRICITY GAS AND WATER", "FINANCE AND INSURANCE", "FISHING", "GOVERNMENT OFFICES",
  "HEALTH AND SOCIAL WORK", "HOTELS AND RESTAURANTS", "MANUFACTURING", "MINING",
  "PERSONAL SERVICES", "REAL ESTATE AND RENTING", "TRANSPORT STORAGE AND COMMUNICATION",
  "WHOLESALE AND RETAIL", "OTHERS"
];

const CONFORME_OPTIONS = ["SIGNED CONFORME", "THRU EMAIL", "THRU FB MARKETPLACE"];

const WITHHOLDING_AGENT_OPTIONS = ["YES", "NO"];

const FLAG_OPTIONS = ["REFLECT", "DO NOT REFLECT"];

const VAT_TYPES = ["VATABLE", "NON-VATABLE", "ZERO-RATED", "EXEMPT"];

const PROJECT_INDUSTRIES = [
  "AGRICULTURE", "CONSTRUCTION", "DATA CENTER", "EDUCATION",
  "ELECTRICITY", "FINANCE", "FISHING", "GOVERNMENT",
  "HEALTH", "HOSPITALITY", "MANUFACTURING", "MINING",
  "REAL ESTATE", "TRANSPORT", "RETAIL", "TECHNOLOGY", "OTHERS"
];

const TPC_TYPES = [
  "NO TPC", "TPC SPF", "TPC PROMO", "TPC REGULAR", "TPC REGULAR SPF",
  "TPC REGULAR PROMO", "TPC SPF PROMO", "TPC REGULAR SPF PROMO"
];

const SO_STATUS_OPTIONS = [
  "Waiting for Payment",
  "For Delivery Scheduled", 
  "Convert to SI",
  "Cancelled",
  "Partially Paid",
  "Fully Paid",
  "For Pick Up",
  "Delivered"
];

// ── Interfaces ─────────────────────────────────────────────────────────────
interface ProductItem {
  id: number;
  sku: string;
  title: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discPercent: number;
  netPrice: number;
  subtotal: number;
  isPromo: boolean;
  isSelected?: boolean;
  photo?: string;
}

interface SORevision {
  version: string;
  date: string;
  soNumber: string;
  soAmount: number;
  status: string;
  modifiedBy: string;
  changes: string[];
}

interface QuotationData {
  id: number;
  activity_reference_number: string;
  referenceid: string;
  quotation_number?: string;
  quotation_amount?: number | string;
  quotation_type?: string;
  quotation_subject?: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  vat_type: string;
  delivery_fee: string;
  delivery_address?: string;
  restocking_fee?: string;
  wht_type?: string;
  item_remarks?: string;
  project_name?: string;
  project_type?: string;
  tsm_approved_status?: string;
  // Product data
  product_quantity?: string;
  product_amount?: string;
  product_description?: string;
  product_photo?: string;
  product_title?: string;
  product_sku?: string;
  product_category?: string;
  discounted_priced?: string;
  discounted_amount?: string;
  product_is_promo?: string;
  product_is_hidden?: string;
  product_display_mode?: string;
  // Signatory data
  agent_name?: string;
  agent_signature?: string;
  agent_contact_number?: string;
  agent_email_address?: string;
  tsm_signature?: string;
  tsm_contact_number?: string;
  tsm_email_address?: string;
  manager_signature?: string;
  manager_contact_number?: string;
  manager_email_address?: string;
  // SO Data (for revisions)
  so_number?: string;
  so_amount?: number;
  so_status?: string;
}

interface GenerateSODialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  quotationData: QuotationData | null;
  // User details
  firstname?: string;
  lastname?: string;
  email?: string;
  contact?: string;
  tsmname?: string;
  managername?: string;
  // SO Revisions history
  soRevisions?: SORevision[];
}

// ── Helper Functions ───────────────────────────────────────────────────────
function splitAndTrim(val: string | undefined | null): string[] {
  if (!val || typeof val !== "string") return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function generateSONumber(prefix: string = "SO"): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}${month}${day}-${random}`;
}

// ── SO Preview Component ───────────────────────────────────────────────────
interface SOPreviewProps {
  soData: {
    soNumber: string;
    poNumber: string;
    mode: string;
    soType: string;
    invoiceType: string;
    withholdingAgent: string;
    salesGroup: string;
    industry: string;
    conforme: string;
    paymentTerms: string;
    deliveryDate: string;
    ioDept: string;
    tpcRef: string;
    tpcAmount: string;
    tpcType: string;
    discountFlag: string;
    freightFlag: string;
    inlandFlag: string;
    restockingFlag: string;
    additionalDiscount: string;
    deliveryFee: string;
    inlandFee: string;
    restockingFee: string;
    soStatus: string;
    remarks: string;
    // Additional accounting fields
    isReSo: boolean;
    oldSoNumber: string;
    spfRef: string;
    dsoNumber: string;
    soDate: string;
    salesperson: string;
    preparedBy: string;
    customerName: string;
    tinNo: string;
    registeredAddress: string;
    billingAddress: string;
    collectionAddress: string;
    deliveryAddress: string;
    landlineNo: string;
    projectName: string;
    projectIndustry: string;
    vatType: string;
    specialInstructions: string;
  };
  products: ProductItem[];
  quotationData: QuotationData;
  computations: {
    totalSubtotal: number;
    addDisc: number;
    deliveryFee: number;
    inlandFee: number;
    restockFee: number;
    netSales: number;
    totalSales: number;
    vatAmount: number;
    netOfVat: number;
    whtRate: number;
    whtAmount: number;
    totalAmountDue: number;
  };
  onClose: () => void;
  onDownloadPDF: () => void;
  onDownloadExcel: () => void;
  onPrint: () => void;
  // User details for signatories
  firstname?: string;
  lastname?: string;
  email?: string;
  contact?: string;
  tsmname?: string;
  managername?: string;
}

function SOPreview({
  soData,
  products,
  quotationData,
  computations,
  onClose,
  onDownloadPDF,
  onDownloadExcel,
  onPrint,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername
}: SOPreviewProps) {
  const isEcoshift = quotationData?.quotation_type === "Ecoshift Corporation";
  const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";
  const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";

  // QR Code Security
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

  // Generate QR Code
  React.useEffect(() => {
    const generateQr = async () => {
      try {
        const QRCode = await import("qrcode");

        // Security Token Generation (must match verify page logic)
        const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
        const generateToken = (ref: string, total: string) => {
          const raw = `${ref}|${total}|${SECURITY_SALT}`;
          let hash = 0;
          for (let i = 0; i < raw.length; i++) {
            const chr = raw.charCodeAt(i);
            hash = (hash << 5) - hash + chr;
            hash |= 0;
          }
          return Math.abs(hash).toString(36).toUpperCase();
        };

        const totalStr = computations.totalAmountDue.toFixed(2);
        const token = generateToken(soData.soNumber || "DRAFT", totalStr);

        const verificationUrl = `${window.location.origin}/verify-so?ref=${encodeURIComponent(soData.soNumber || "DRAFT")}&total=${totalStr}&v=${token}`;

        const dataUrl = await QRCode.toDataURL(verificationUrl, {
          width: 128,
          margin: 1,
          color: { dark: "#121212", light: "#ffffff" },
          errorCorrectionLevel: "H",
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("QR Generation failed", err);
      }
    };
    generateQr();
  }, [soData.soNumber, computations.totalAmountDue, isEcoshift]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent
        className="max-w-[1000px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 border-none bg-white shadow-2xl"
        style={{ maxWidth: "950px", width: "100vw" }}
      >
        <div className="sr-only">
          <DialogTitle>Sales Order Preview</DialogTitle>
          <DialogDescription>
            Sales Order document preview
          </DialogDescription>
        </div>
        
        {/* Header */}
        <div className="sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-gray-600" />
            <h2 className="font-bold text-sm">SO Preview: {soData.soNumber || "(Draft)"}</h2>
            <Badge variant="outline" className="rounded-none text-[10px]">
              {companyLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="rounded-none h-8" onClick={onDownloadExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-1 text-green-600" />
              Excel
            </Button>
            <Button size="sm" variant="outline" className="rounded-none h-8" onClick={onDownloadPDF}>
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
            <Button size="sm" variant="outline" className="rounded-none h-8" onClick={onPrint}>
              Print
            </Button>
            <Button size="sm" variant="ghost" className="rounded-none h-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content with Watermark */}
        <div className="relative">
          {/* Diagonal Watermark Overlay */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 0,
              overflow: "hidden",
            }}
          >
            <svg
              width="100%"
              height="100%"
              style={{ position: "absolute", inset: 0 }}
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <pattern
                  id="so-watermark"
                  x="0"
                  y="0"
                  width="800"
                  height="150"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(-25)"
                >
                  <text
                    x="0"
                    y="40"
                    fontFamily="Arial, sans-serif"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#121212"
                    fillOpacity="0.06"
                    letterSpacing="1"
                  >
                    {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'} · OFFICIAL SALES ORDER · {soData.soNumber || "DRAFT"}
                  </text>
                  <text
                    x="400"
                    y="115"
                    fontFamily="Arial, sans-serif"
                    fontSize="9"
                    fontWeight="bold"
                    fill="#121212"
                    fillOpacity="0.06"
                    letterSpacing="1"
                  >
                    {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'} · OFFICIAL SALES ORDER · {soData.soNumber || "DRAFT"}
                  </text>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#so-watermark)" />
            </svg>
          </div>

          {/* Document Preview */}
          <div id="so-preview-content" className="p-8 relative z-10">
          {/* Banner */}
          <img src={headerImagePath} alt="Header" className="w-full h-auto mb-4" />
          
          {/* Document Info */}
          <div className="flex justify-between text-[10px] uppercase tracking-wider mb-4">
            <div>
              <span className="font-bold">SO #: {soData.soNumber || "(Draft)"}</span>
              {soData.poNumber && <span className="ml-4">PO #: {soData.poNumber}</span>}
            </div>
            <div>
              <span>Date: {soData.soDate || new Date().toLocaleDateString("en-PH")}</span>
              {soData.dsoNumber && <span className="ml-4">DSO #: {soData.dsoNumber}</span>}
            </div>
          </div>

          {/* SO Details Section */}
          <div className="grid grid-cols-4 gap-2 mb-4 text-[10px]">
            <div><span className="font-semibold">Mode:</span> {soData.mode}</div>
            <div><span className="font-semibold">SO Type:</span> {soData.soType}</div>
            <div><span className="font-semibold">Invoice Type:</span> {soData.invoiceType}</div>
            <div><span className="font-semibold">Payment Terms:</span> {soData.paymentTerms}</div>
            <div><span className="font-semibold">VAT Type:</span> {soData.vatType}</div>
            <div><span className="font-semibold">IO Dept:</span> {soData.ioDept}</div>
            <div><span className="font-semibold">SO Status:</span> {soData.soStatus}</div>
            <div><span className="font-semibold">Delivery Date:</span> {soData.deliveryDate || "-"}</div>
          </div>

          {soData.isReSo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-4 text-[10px]">
              <span className="font-semibold text-yellow-800">RE-SO REFERENCE:</span> Old SO#: {soData.oldSoNumber || "-"}
            </div>
          )}

          {/* Customer Info */}
          <div className="bg-blue-50 border border-blue-100 rounded p-4 mb-4">
            <h3 className="font-bold text-xs text-blue-800 mb-2">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4 text-[11px] text-blue-700">
              <div>
                <div className="font-semibold">{soData.customerName || quotationData.company_name}</div>
                <div>TIN: {soData.tinNo || "-"}</div>
                <div>Landline: {soData.landlineNo || "-"}</div>
              </div>
              <div>
                <div><span className="font-semibold">Salesperson:</span> {soData.salesperson || "-"}</div>
                <div><span className="font-semibold">Prepared By:</span> {soData.preparedBy || "-"}</div>
              </div>
            </div>
            <div className="mt-2 text-[10px] space-y-1">
              <div><span className="font-semibold">Registered:</span> {soData.registeredAddress || quotationData.address}</div>
              <div><span className="font-semibold">Billing:</span> {soData.billingAddress || "-"}</div>
              <div><span className="font-semibold">Collection:</span> {soData.collectionAddress || "-"}</div>
              <div><span className="font-semibold">Delivery:</span> {soData.deliveryAddress || quotationData.delivery_address || "-"}</div>
            </div>
          </div>

          {/* Project Information */}
          <div className="bg-green-50 border border-green-100 rounded p-4 mb-4">
            <h3 className="font-bold text-xs text-green-800 mb-2">Project Information</h3>
            <div className="grid grid-cols-2 gap-4 text-[11px] text-green-700">
              <div>
                <div><span className="font-semibold">Project Name:</span> {soData.projectName || quotationData.project_name || "-"}</div>
                <div><span className="font-semibold">Project Industry:</span> {soData.projectIndustry || "-"}</div>
              </div>
              <div>
                <div><span className="font-semibold">SPF REF#:</span> {soData.spfRef || "-"}</div>
                <div><span className="font-semibold">Conforme:</span> {soData.conforme || "-"}</div>
                <div><span className="font-semibold">Withholding Agent:</span> {soData.withholdingAgent || "-"}</div>
              </div>
            </div>
            {soData.specialInstructions && (
              <div className="mt-2 text-[10px]">
                <span className="font-semibold">Special Instructions:</span> {soData.specialInstructions}
              </div>
            )}
          </div>

          {/* Sales Classification */}
          <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
            <h3 className="font-bold text-xs text-gray-800 mb-2">Sales Classification</h3>
            <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-700">
              <div><span className="font-semibold">Sales Group:</span> {soData.salesGroup}</div>
              <div><span className="font-semibold">Industry:</span> {soData.industry}</div>
              <div><span className="font-semibold">TPC Type:</span> {soData.tpcType}</div>
              <div><span className="font-semibold">TPC Ref:</span> {soData.tpcRef || "-"}</div>
              <div><span className="font-semibold">TPC Amount:</span> {soData.tpcAmount ? `₱${parseFloat(soData.tpcAmount).toFixed(2)}` : "-"}</div>
            </div>
          </div>

          {/* Flags Section */}
          <div className="bg-orange-50 border border-orange-100 rounded p-3 mb-4">
            <h3 className="font-bold text-xs text-orange-800 mb-2">Flags & Fees</h3>
            <div className="grid grid-cols-4 gap-2 text-[10px] text-orange-700">
              <div><span className="font-semibold">Discount Flag:</span> {soData.discountFlag}</div>
              <div><span className="font-semibold">Freight Flag:</span> {soData.freightFlag}</div>
              <div><span className="font-semibold">Inland Flag:</span> {soData.inlandFlag}</div>
              <div><span className="font-semibold">Restocking Flag:</span> {soData.restockingFlag}</div>
              {soData.additionalDiscount && <div><span className="font-semibold">Addl Disc:</span> ₱{parseFloat(soData.additionalDiscount).toFixed(2)}</div>}
              {soData.deliveryFee && <div><span className="font-semibold">Delivery Fee:</span> ₱{parseFloat(soData.deliveryFee).toFixed(2)}</div>}
              {soData.inlandFee && <div><span className="font-semibold">Inland Fee:</span> ₱{parseFloat(soData.inlandFee).toFixed(2)}</div>}
              {soData.restockingFee && <div><span className="font-semibold">Restock Fee:</span> ₱{parseFloat(soData.restockingFee).toFixed(2)}</div>}
            </div>
          </div>

          {/* Remarks */}
          {soData.remarks && (
            <div className="bg-purple-50 border border-purple-100 rounded p-3 mb-4">
              <h3 className="font-bold text-xs text-purple-800 mb-1">Remarks</h3>
              <div className="text-[10px] text-purple-700">{soData.remarks}</div>
            </div>
          )}

          {/* Products Table */}
          <table className="w-full text-xs border-collapse border border-gray-300 mb-6">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-left">#</th>
                <th className="border border-gray-300 px-2 py-2 text-left">SKU</th>
                <th className="border border-gray-300 px-2 py-2 text-left">Description</th>
                <th className="border border-gray-300 px-2 py-2 text-center">Qty</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Unit Price</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Disc %</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Net Price</th>
                <th className="border border-gray-300 px-2 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-2">{i + 1}</td>
                  <td className="border border-gray-300 px-2 py-2 font-mono">{p.sku}</td>
                  <td className="border border-gray-300 px-2 py-2">{p.title}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center">{p.quantity}</td>
                  <td className="border border-gray-300 px-2 py-2 text-right">₱{p.unitPrice?.toFixed(2) || 0}</td>
                  <td className="border border-gray-300 px-2 py-2 text-right">{p.discPercent?.toFixed(0) || 0}%</td>
                  <td className="border border-gray-300 px-2 py-2 text-right">₱{p.netPrice?.toFixed(2) || 0}</td>
                  <td className="border border-gray-300 px-2 py-2 text-right font-semibold">₱{p.subtotal?.toFixed(2) || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Computation Summary */}
          <div className="border border-gray-300 rounded p-4">
            <h3 className="font-bold text-xs mb-3">Computation Summary</h3>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Total Subtotal:</span>
                <span>₱{computations.totalSubtotal?.toFixed(2) || 0}</span>
              </div>
              {computations.addDisc > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Less: Additional Discount:</span>
                  <span>-₱{computations.addDisc?.toFixed(2) || 0}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Net Sales:</span>
                <span>₱{computations.netSales?.toFixed(2) || 0}</span>
              </div>
              {computations.deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span>+ Freight Charge:</span>
                  <span>₱{computations.deliveryFee?.toFixed(2) || 0}</span>
                </div>
              )}
              {computations.inlandFee > 0 && (
                <div className="flex justify-between">
                  <span>+ Inland Del Charge:</span>
                  <span>₱{computations.inlandFee?.toFixed(2) || 0}</span>
                </div>
              )}
              {computations.restockFee > 0 && (
                <div className="flex justify-between">
                  <span>+ Restocking Fee:</span>
                  <span>₱{computations.restockFee?.toFixed(2) || 0}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1 mt-1">
                <span>Total Sales:</span>
                <span>₱{computations.totalSales?.toFixed(2) || 0}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Less VAT (12%):</span>
                <span>-₱{computations.vatAmount?.toFixed(2) || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Net of VAT:</span>
                <span>₱{computations.netOfVat?.toFixed(2) || 0}</span>
              </div>
              {computations.whtAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Less: Withholding Tax:</span>
                  <span>-₱{computations.whtAmount?.toFixed(2) || 0}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-green-700 text-lg border-t pt-2 mt-2">
                <span>Total Amount Due:</span>
                <span>₱{computations.totalAmountDue?.toFixed(2) || 0}</span>
              </div>
            </div>
          </div>

          {/* Signatories */}
          <div className="mt-8 border-t border-gray-300 pt-6">
            <div className="font-bold uppercase mb-4 text-[11px]">Payment Terms: {soData.paymentTerms || "CASH"}</div>

            <div className="grid grid-cols-2 gap-x-20 gap-y-12">
              {/* Left Side: Internal Team */}
              <div className="space-y-10">
                {/* Prepared By - Sales Representative */}
                <div>
                  <p className="italic text-[10px] font-black mb-10">{isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</p>
                  {quotationData?.agent_signature ? (
                    <div className="relative inline-block">
                      <img
                        src={quotationData.agent_signature}
                        alt="Agent Signature"
                        className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                          Official Verified
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                  )}
                  <p className="text-[11px] font-black uppercase mt-1">{firstname} {lastname}</p>
                  <div className="border-b border-black w-64"></div>
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales Representative</p>
                  <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {contact || "N/A"}</p>
                  <p className="text-[9px] text-gray-500 font-bold italic">Email: {email || "N/A"}</p>
                </div>

                {/* Approved By - Territory Sales Manager */}
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Approved By:</p>
                  {quotationData?.tsm_signature ? (
                    <div className="relative inline-block">
                      <img
                        src={quotationData.tsm_signature}
                        alt="TSM Signature"
                        className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                          Official Verified
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                  )}
                  <p className="text-[11px] font-black uppercase mt-1">{tsmname || "—"}</p>
                  <div className="border-b border-black w-64"></div>
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Territory Sales Manager</p>
                  <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {quotationData?.tsm_contact_number || "N/A"}</p>
                  <p className="text-[9px] text-gray-500 font-bold italic">Email: {quotationData?.tsm_email_address || "N/A"}</p>
                </div>

                {/* Noted By - Sales Head */}
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-400 mb-10">Noted By:</p>
                  {quotationData?.manager_signature ? (
                    <div className="relative inline-block">
                      <img
                        src={quotationData.manager_signature}
                        alt="Manager Signature"
                        className="w-40 h-20 object-contain flex align-items center justify-center mb-2 border-none"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] font-black text-[#121212] opacity-[0.03] rotate-[-15deg] uppercase tracking-[0.5em]">
                          Official Verified
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] text-gray-500 italic mb-2">No signature available</p>
                  )}
                  <p className="text-[11px] font-black uppercase mt-1">{managername || "—"}</p>
                  <div className="border-b border-black w-64"></div>
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">Sales Head</p>
                  <p className="text-[9px] text-gray-500 font-bold italic">Mobile: {quotationData?.manager_contact_number || "N/A"}</p>
                  <p className="text-[9px] text-gray-500 font-bold italic">Email: {quotationData?.manager_email_address || "N/A"}</p>
                </div>
              </div>

              {/* Right Side: Client Side */}
              <div className="space-y-10 flex flex-col items-end">
                {/* Company Authorized Representative */}
                <div className="w-64 text-center">
                  <p className="text-[10px] font-black uppercase mb-1">{quotationData?.contact_person || "—"}</p>
                  <div className="border-b border-black w-64" />
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest leading-none">
                    Company Authorized Representative
                  </p>
                  <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                    (PLEASE SIGN OVER PRINTED NAME)
                  </p>
                </div>

                {/* Payment Release Date */}
                <div className="w-64 text-center">
                  <div className="border-b border-black w-64 mt-12" />
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">
                    Payment Release Date
                  </p>
                </div>

                {/* Position in Company */}
                <div className="w-64 text-center">
                  <div className="border-b border-black w-64 mt-12" />
                  <p className="text-[9px] font-bold text-gray-500 mt-1 uppercase tracking-widest">
                    Position In The Company
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Document Security Micro-Footer */}
          <div className="mx-12 mb-8 border-t border-dashed border-gray-300 pt-3 flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <p className="text-[8px] text-gray-400 font-medium leading-relaxed">
                Document ID: <span className="font-black text-gray-500">{soData.soNumber || "DRAFT"}</span>
                &nbsp;·&nbsp; Issued: {new Date().toISOString()}
                &nbsp;·&nbsp; {isEcoshift ? 'ECOSHIFT CORPORATION' : 'DISRUPTIVE SOLUTIONS INC.'}
              </p>
              <p className="text-[8px] text-gray-400 italic shrink-0 mt-1">
                This document is only valid when downloaded from Taskflow.
              </p>
            </div>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="flex flex-col items-center">
                <img src={qrDataUrl} alt="Verification QR" className="w-20 h-20 opacity-80 mix-blend-multiply" />
                <span className="text-[6px] font-black text-gray-300 uppercase tracking-widest mt-1">Verify Authenticity</span>
              </div>
            )}
          </div>
        </div>
      </div>
      </DialogContent>
    </Dialog>
  );
}

// ── SO History Component ───────────────────────────────────────────────────
interface SOHistoryProps {
  revisions: SORevision[];
  onSelectRevision: (revision: SORevision) => void;
  onClose: () => void;
}

function SOHistory({ revisions, onSelectRevision, onClose }: SOHistoryProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-none max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-bold text-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            SO Revision History
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          {revisions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No SO revisions found for this quotation.
            </div>
          ) : (
            <div className="space-y-3">
              {revisions.map((rev, index) => (
                <div 
                  key={index} 
                  className="border rounded-none p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onSelectRevision(rev)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="rounded-none text-[10px]">
                        v{rev.version}
                      </Badge>
                      <span className="font-mono text-xs">{rev.soNumber}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{rev.date}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="text-gray-500">Amount:</span> {formatCurrency(rev.soAmount)}</div>
                    <div><span className="text-gray-500">Status:</span> {rev.status}</div>
                    <div><span className="text-gray-500">By:</span> {rev.modifiedBy}</div>
                  </div>
                  {rev.changes.length > 0 && (
                    <div className="mt-2 text-[10px]">
                      <span className="text-gray-500">Changes:</span>
                      <ul className="list-disc list-inside mt-1 text-gray-600">
                        {rev.changes.map((change, i) => (
                          <li key={i}>{change}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function GenerateSODialog({
  open,
  onClose,
  onSaved,
  quotationData,
  firstname,
  lastname,
  email,
  contact,
  tsmname,
  managername,
  soRevisions = [],
}: GenerateSODialogProps) {
  // ── State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("details");
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // SO Fields
  const [soNumber, setSoNumber] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [mode, setMode] = useState("DELIVERY");
  const [soType, setSoType] = useState("REGULAR SO");
  const [invoiceType, setInvoiceType] = useState("SALES INVOICE");
  const [withholdingAgent, setWithholdingAgent] = useState("NO");
  const [salesGroup, setSalesGroup] = useState("OFFICE");
  const [industry, setIndustry] = useState("");
  const [conforme, setConforme] = useState("SIGNED CONFORME");
  const [paymentTerms, setPaymentTerms] = useState("CASH");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [ioDept, setIoDept] = useState("N/A");
  const [tpcRef, setTpcRef] = useState("");
  const [tpcAmount, setTpcAmount] = useState("");
  const [tpcType, setTpcType] = useState("NO TPC");
  const [discountFlag, setDiscountFlag] = useState("NO DISCOUNT");
  const [freightFlag, setFreightFlag] = useState("REFLECT FREIGHT");
  const [inlandFlag, setInlandFlag] = useState("REFLECT INLAND");
  const [restockingFlag, setRestockingFlag] = useState("REFLECT RESTOCKING");
  const [additionalDiscount, setAdditionalDiscount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [inlandFee, setInlandFee] = useState("");
  const [restockingFee, setRestockingFee] = useState("");
  const [soStatus, setSoStatus] = useState("Waiting for Payment");
  const [remarks, setRemarks] = useState("");

  // Additional Accounting Fields
  const [isReSo, setIsReSo] = useState(false);
  const [oldSoNumber, setOldSoNumber] = useState("");
  const [spfRef, setSpfRef] = useState("");
  const [dsoNumber, setDsoNumber] = useState("");
  const [soDate, setSoDate] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [tinNo, setTinNo] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [collectionAddress, setCollectionAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [landlineNo, setLandlineNo] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectIndustry, setProjectIndustry] = useState("");
  const [vatType, setVatType] = useState("VATABLE");
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Products
  const [products, setProducts] = useState<ProductItem[]>([]);

  // Memoized computations
  const computations = useMemo(() => {
    const selectedProducts = products.filter(p => selectedItems.has(p.id));
    const totalSubtotal = selectedProducts.reduce((sum, p) => sum + (p.subtotal || 0), 0);
    const addDisc = parseFloat(additionalDiscount) || 0;
    const deliveryFeeValue = parseFloat(deliveryFee) || 0;
    const inlandFeeValue = parseFloat(inlandFee) || 0;
    const restockFeeValue = parseFloat(restockingFee) || 0;
    const netSales = totalSubtotal - addDisc;
    const totalSales = netSales + deliveryFeeValue + inlandFeeValue + restockFeeValue;
    // VAT-inclusive calculation: VAT = Total / 1.12 * 0.12
    const vatAmount = totalSales > 0 ? totalSales / 1.12 * 0.12 : 0;
    const netOfVat = totalSales - vatAmount;
    
    // Calculate withholding tax based on quotation data
    const whtRate = quotationData?.wht_type === "EWT 1%" ? 0.01 : 
                   quotationData?.wht_type === "EWT 2%" ? 0.02 : 0;
    const whtAmount = netOfVat * whtRate;
    const totalAmountDue = netOfVat - whtAmount;

    return {
      totalSubtotal,
      addDisc,
      deliveryFee: deliveryFeeValue,
      inlandFee: inlandFeeValue,
      restockFee: restockFeeValue,
      netSales,
      totalSales,
      vatAmount,
      netOfVat,
      whtRate,
      whtAmount,
      totalAmountDue
    };
  }, [products, selectedItems, additionalDiscount, deliveryFee, inlandFee, restockingFee, quotationData?.wht_type]);

  // Memoized soData object
  const soData = useMemo(() => ({
    soNumber,
    poNumber,
    mode,
    soType,
    invoiceType,
    withholdingAgent,
    salesGroup,
    industry,
    conforme,
    paymentTerms,
    deliveryDate,
    ioDept,
    tpcRef,
    tpcAmount,
    tpcType,
    discountFlag,
    freightFlag,
    inlandFlag,
    restockingFlag,
    additionalDiscount,
    deliveryFee,
    inlandFee,
    restockingFee,
    soStatus,
    remarks,
    // Additional accounting fields
    isReSo,
    oldSoNumber,
    spfRef,
    dsoNumber,
    soDate,
    salesperson,
    preparedBy,
    customerName,
    tinNo,
    registeredAddress,
    billingAddress,
    collectionAddress,
    deliveryAddress,
    landlineNo,
    projectName,
    projectIndustry,
    vatType,
    specialInstructions
  }) as {
    soNumber: string;
    poNumber: string;
    mode: string;
    soType: string;
    invoiceType: string;
    withholdingAgent: string;
    salesGroup: string;
    industry: string;
    conforme: string;
    paymentTerms: string;
    deliveryDate: string;
    ioDept: string;
    tpcRef: string;
    tpcAmount: string;
    tpcType: string;
    discountFlag: string;
    freightFlag: string;
    inlandFlag: string;
    restockingFlag: string;
    additionalDiscount: string;
    deliveryFee: string;
    inlandFee: string;
    restockingFee: string;
    soStatus: string;
    remarks: string;
    isReSo: boolean;
    oldSoNumber: string;
    spfRef: string;
    dsoNumber: string;
    soDate: string;
    salesperson: string;
    preparedBy: string;
    customerName: string;
    tinNo: string;
    registeredAddress: string;
    billingAddress: string;
    collectionAddress: string;
    deliveryAddress: string;
    landlineNo: string;
    projectName: string;
    projectIndustry: string;
    vatType: string;
    specialInstructions: string;
  }, [soNumber, poNumber, mode, soType, invoiceType, withholdingAgent, salesGroup, industry, conforme, paymentTerms, deliveryDate, ioDept, tpcRef, tpcAmount, tpcType, discountFlag, freightFlag, inlandFlag, restockingFlag, additionalDiscount, deliveryFee, inlandFee, restockingFee, soStatus, remarks, isReSo, oldSoNumber, spfRef, dsoNumber, soDate, salesperson, preparedBy, customerName, tinNo, registeredAddress, billingAddress, collectionAddress, deliveryAddress, landlineNo, projectName, projectIndustry, vatType, specialInstructions]);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (open && quotationData) {
      // Reset state
      setActiveTab("details");
      setStep(1);
      setSoNumber(generateSONumber());
      setPoNumber("");
      setMode("DELIVERY");
      setSoType("REGULAR SO");
      setInvoiceType("SALES INVOICE");
      setWithholdingAgent("NO");
      setSalesGroup("OFFICE");
      setIndustry("");
      setConforme("SIGNED CONFORME");
      setPaymentTerms("CASH");
      setDeliveryDate("");
      setIoDept("N/A");
      setTpcRef("");
      setTpcAmount("");
      setTpcType("NO TPC");
      setDiscountFlag("NO DISCOUNT");
      setFreightFlag("REFLECT FREIGHT");
      setInlandFlag("REFLECT INLAND");
      setRestockingFlag("REFLECT RESTOCKING");
      setAdditionalDiscount("");
      setDeliveryFee(quotationData?.delivery_fee || "");
      setInlandFee("");
      setRestockingFee(quotationData?.restocking_fee || "");
      setSoStatus("Waiting for Payment");
      setRemarks("");
      setSelectedItems(new Set());

      // Reset new accounting fields
      setIsReSo(false);
      setOldSoNumber("");
      setSpfRef("");
      setDsoNumber("");
      setSoDate(new Date().toISOString().split('T')[0]);
      setSalesperson(quotationData?.agent_name || "");
      setPreparedBy("");
      setCustomerName(quotationData?.company_name || "");
      setTinNo("");
      setRegisteredAddress(quotationData?.address || "");
      setBillingAddress("");
      setCollectionAddress("");
      setDeliveryAddress(quotationData?.delivery_address || "");
      setLandlineNo("");
      setProjectName(quotationData?.project_name || "");
      setProjectIndustry("");
      setVatType("VATABLE");
      setSpecialInstructions("");

      // Parse products
      try {
        const quantities = splitAndTrim(quotationData.product_quantity);
        const amounts = splitAndTrim(quotationData.product_amount);
        const titles = splitAndTrim(quotationData.product_title);
        const skus = splitAndTrim(quotationData.product_sku);
        const descriptions = splitAndTrim(quotationData.product_description);
        const discPrices = splitAndTrim(quotationData.discounted_priced);
        const promoFlags = splitAndTrim(quotationData.product_is_promo);
        const photos = splitAndTrim(quotationData.product_photo);

        const maxLen = Math.max(quantities.length, amounts.length, titles.length, skus.length);
        const productList: ProductItem[] = [];
        const initialSelected = new Set<number>();

        for (let i = 0; i < maxLen; i++) {
          const unitPrice = parseFloat(amounts[i] || "0") || 0;
          const discPct = parseFloat(discPrices[i] || "0") || 0;
          const netPrice = unitPrice * (1 - discPct / 100);
          const qty = parseFloat(quantities[i] || "0") || 0;
          
          productList.push({
            id: i,
            sku: skus[i] || "",
            title: titles[i] || "",
            description: descriptions[i] || "",
            quantity: qty,
            unitPrice,
            discPercent: discPct,
            netPrice,
            subtotal: netPrice * qty,
            isPromo: promoFlags[i] === "1",
            isSelected: true,
            photo: photos[i] || "",
          });
          initialSelected.add(i);
        }
        setProducts(productList);
        setSelectedItems(initialSelected);
      } catch (e) {
        console.error("Error parsing products:", e);
        setProducts([]);
      }
    }
  }, [open, quotationData]);

  // ── Branding ─────────────────────────────────────────────────────────────
  const isEcoshift = quotationData?.quotation_type === "Ecoshift Corporation";
  const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";
  const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleItemSelection = (id: number) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedItems(newSet);
  };

  const selectAllItems = () => {
    if (selectedItems.size === products.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(products.map(p => p.id)));
    }
  };

  const handleSave = async () => {
    if (!quotationData) return;
    setSaving(true);
    try {
      const res = await fetch("/api/activity/tsa/historical/update-so", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quotationData.id,
          so_number: soNumber,
          so_amount: String(computations.totalAmountDue.toFixed(2)),
          po_number: poNumber,
          mode,
          so_type: soType,
          invoice_type: invoiceType,
          withholding_agent: withholdingAgent,
          sales_group: salesGroup,
          industry,
          conforme,
          payment_terms: paymentTerms,
          delivery_date: deliveryDate,
          io_dept: ioDept,
          tpc_ref: tpcRef,
          tpc_amount: tpcAmount,
          tpc_type: tpcType,
          discount_flag: discountFlag,
          freight_flag: freightFlag,
          inland_flag: inlandFlag,
          restocking_flag: restockingFlag,
          additional_discount: additionalDiscount,
          so_status: soStatus,
          remarks,
          status: "SO-Done",
          // New accounting fields
          is_re_so: isReSo,
          old_so_number: oldSoNumber,
          spf_ref: spfRef,
          dso_number: dsoNumber,
          so_date: soDate,
          salesperson,
          prepared_by: preparedBy,
          customer_name: customerName,
          tin_no: tinNo,
          registered_address: registeredAddress,
          billing_address: billingAddress,
          collection_address: collectionAddress,
          delivery_address: deliveryAddress,
          landline_no: landlineNo,
          project_name: projectName,
          project_industry: projectIndustry,
          vat_type: vatType,
          special_instructions: specialInstructions,
          // Include selected products data
          selected_products: products.filter(p => selectedItems.has(p.id)).map(p => ({
            sku: p.sku,
            title: p.title,
            quantity: p.quantity,
            unit_price: p.unitPrice,
            discount: p.discPercent,
            subtotal: p.subtotal,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to save SO");
      }

      sileo.success({
        title: "SO Generated",
        description: `Sales Order ${soNumber} created successfully`,
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });

      onSaved();
      onClose();
    } catch (err: any) {
      sileo.error({
        title: "Save Failed",
        description: err?.message || "Could not generate SO",
        duration: 4000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } finally {
      setSaving(false);
    }
  };

  /** Generate a QR code as a base64 PNG data URL */
  const generateQrDataUrl = async (text: string): Promise<string | null> => {
    try {
      const QRCode = await import("qrcode");
      return await QRCode.toDataURL(text, {
        width: 96,
        margin: 1,
        color: { dark: "#121212", light: "#ffffff" },
        errorCorrectionLevel: "M",
      });
    } catch {
      return null;
    }
  };

  /** Stamp diagonal watermark text across the current jsPDF page */
  const stampPdfWatermark = (
    pdf: any,
    companyLabel: string,
    referenceNo: string,
    pdfWidth: number,
    pdfHeight: number,
  ) => {
    pdf.saveGraphicsState();
    const gState = new (pdf as any).GState({ opacity: 0.06 });
    pdf.setGState(gState);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(18, 18, 18);
    const line = `${companyLabel}  ·  OFFICIAL SALES ORDER  ·  ${referenceNo}`;

    const stepX = 800;
    const stepY = 75;
    const angle = 25;

    let rowIdx = 0;
    for (let y = -400; y < pdfHeight + 400; y += stepY) {
      const offset = (rowIdx % 2 === 0) ? 0 : 400;
      for (let x = -1000 + offset; x < pdfWidth + 1000; x += stepX) {
        pdf.text(line, x, y, { angle: angle });
      }
      rowIdx++;
    }
    pdf.restoreGraphicsState();
  };

  /** Stamp the QR code + security footer at the bottom of each PDF page */
  const stampPdfSecurityFooter = (
    pdf: any,
    qrDataUrl: string | null,
    referenceNo: string,
    issuedAt: string,
    pageNum: number,
    totalPages: number,
    pdfWidth: number,
    pdfHeight: number,
  ) => {
    const footerY = pdfHeight - 32;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(20, footerY - 4, pdfWidth - 20, footerY - 4);

    if (qrDataUrl) {
      pdf.addImage(qrDataUrl, "PNG", pdfWidth - 60, footerY - 22, 40, 40);
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(130, 130, 130);
    pdf.text(`REF: ${referenceNo}`, 20, footerY + 4);
    pdf.text(`ISSUED: ${issuedAt}`, 20, footerY + 12);
    pdf.text(`This document is only valid when downloaded from Taskflow.`, 20, footerY + 20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pdfWidth / 2, footerY + 14, { align: "center" });
  };

  const handleDownloadPDF = async () => {
    if (typeof window === "undefined") return;
    const PRIMARY_CHARCOAL = "#121212";
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");
      const isEcoshift = quotationData?.quotation_type === "Ecoshift Corporation";
      const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";
      const companyLabel = isEcoshift ? "ECOSHIFT CORPORATION" : "DISRUPTIVE SOLUTIONS INC.";

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [612, 936],
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Create iframe for rendering HTML content
      const iframe = document.createElement("iframe");
      Object.assign(iframe.style, {
        position: "fixed",
        right: "1000%",
        width: "816px",
        visibility: "hidden",
      });
      document.body.appendChild(iframe);
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error("Initialization Failed");

      // Write HTML with inline styles (no LAB colors)
      iframeDoc.open();
      iframeDoc.write(`
        <html>
          <head>
            <style>
              * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: white; width: 816px; color: ${PRIMARY_CHARCOAL}; overflow: hidden; font-size: 10px; line-height: 1.4; }
              .header-img { width: 100%; display: block; }
              .content-area { padding: 0 50px; margin: 0; box-sizing: border-box; }
              .so-header { display: flex; justify-content: space-between; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px; border-bottom: 1px solid #d1d5db; padding-bottom: 8px; }
              .so-details { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 9px; margin-bottom: 16px; }
              .info-box { border: 1px solid #d1d5db; padding: 12px; margin-bottom: 12px; }
              .info-box h3 { font-size: 10px; font-weight: 900; margin: 0 0 8px 0; text-transform: uppercase; }
              .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 9px; }
              .info-row { margin-bottom: 4px; }
              .label { font-weight: 700; }
              .re-so-box { background: #fef9c3; border: 1px solid #f59e0b; padding: 8px; margin-bottom: 12px; font-size: 9px; }
              .products-table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 16px; }
              .products-table th { background: ${PRIMARY_CHARCOAL}; color: white; padding: 6px 8px; text-align: left; font-weight: 900; font-size: 8px; text-transform: uppercase; border: 1px solid #374151; }
              .products-table td { padding: 6px 8px; border: 1px solid #d1d5db; vertical-align: top; }
              .products-table .text-right { text-align: right; }
              .products-table .text-center { text-align: center; }
              .summary-box { border: 1px solid #d1d5db; padding: 12px; }
              .summary-box h3 { font-size: 10px; font-weight: 900; margin: 0 0 8px 0; text-transform: uppercase; }
              .summary-row { display: flex; justify-content: space-between; font-size: 9px; margin-bottom: 4px; }
              .summary-row.total { font-weight: 900; font-size: 11px; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
              .flags-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 9px; }
              .signatory-section { margin-top: 20px; border-top: 2px solid #1d4ed8; padding-top: 12px; }
              .signatory-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
              .signatory-col { display: flex; flex-direction: column; }
              .signatory-label { font-size: 8px; font-weight: 900; text-transform: uppercase; margin-bottom: 18px; }
              .signatory-label.approved { color: #9ca3af; }
              .signatory-sig-box { height: 50px; margin-bottom: 4px; }
              .signatory-sig-img { max-width: 160px; max-height: 50px; object-fit: contain; }
              .signatory-name { font-size: 9.5px; font-weight: 900; text-transform: uppercase; margin: 0; }
              .signatory-line { border-bottom: 1px solid #000; width: 180px; margin: 2px 0; }
              .signatory-role { font-size: 8px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 4px; }
              .signatory-email { font-size: 8px; color: #4b5563; margin-top: 6px; word-break: break-all; line-height: 1.4; }
              .signatory-company { font-size: 8px; font-weight: 700; font-style: italic; margin-bottom: 12px; }
            </style>
          </head>
          <body></body>
        </html>
      `);
      iframeDoc.close();

      // Build the SO content HTML
      const soDate = soData.soDate || new Date().toLocaleDateString("en-PH");
      const buildSOContent = () => {
        const productsHtml = products
          .filter(p => selectedItems.has(p.id))
          .map((p, i) => `
          <tr>
            <td class="text-center">${i + 1}</td>
            <td class="text-center">${p.photo ? `<img src="${p.photo}" style="width:40px;height:40px;object-fit:cover;" />` : '-'}</td>
            <td>${p.sku}</td>
            <td>${p.title}</td>
            <td class="text-center">${p.quantity}</td>
            <td class="text-right">₱${p.unitPrice?.toFixed(2) || "0.00"}</td>
            <td class="text-right">${p.discPercent?.toFixed(0) || 0}%</td>
            <td class="text-right">₱${p.netPrice?.toFixed(2) || "0.00"}</td>
            <td class="text-right">₱${p.subtotal?.toFixed(2) || "0.00"}</td>
          </tr>
        `).join("");

        return `
          <div style="width:100%;display:block;">
            <img src="${headerImagePath}" class="header-img" style="width:100%;display:block;object-fit:contain;"/>
          </div>
          <div class="content-area">
            <div class="so-header">
              <div>
                <strong>SO #:</strong> ${soData.soNumber || "(Draft)"}
                ${soData.poNumber ? `<br/><strong>PO #:</strong> ${soData.poNumber}` : ""}
              </div>
              <div style="text-align:right;">
                <strong>Date:</strong> ${soDate}
                ${soData.dsoNumber ? `<br/><strong>DSO #:</strong> ${soData.dsoNumber}` : ""}
              </div>
            </div>

            <div class="so-details">
              <div><span class="label">DSO#:</span> ${soData.dsoNumber || "-"}</div>
              <div><span class="label">Mode:</span> ${soData.mode}</div>
              <div><span class="label">Branch:</span> ${soData.ioDept || "-"}</div>
              <div><span class="label">SO Type:</span> ${soData.soType}</div>
              <div><span class="label">Industry:</span> ${soData.industry || "-"}</div>
              <div><span class="label">Invoice Type:</span> ${soData.invoiceType}</div>
              <div><span class="label">Sales Group:</span> ${soData.salesGroup || "-"}</div>
              <div><span class="label">Payment Terms:</span> ${soData.paymentTerms}</div>
              <div><span class="label">VAT Type:</span> ${soData.vatType}</div>
              <div><span class="label">Conforme:</span> ${soData.conforme || "-"}</div>
              <div><span class="label">SO Status:</span> ${soData.soStatus}</div>
              <div><span class="label">Delivery Date:</span> ${soData.deliveryDate || "-"}</div>
            </div>

            ${soData.isReSo ? `
              <div class="re-so-box">
                <strong>RE-SO REFERENCE:</strong> Old SO#: ${soData.oldSoNumber || "-"}
              </div>
            ` : ""}

            <div class="info-box">
              <h3>Customer Information</h3>
              <div class="info-grid">
                <div>
                  <div class="info-row"><strong>${soData.customerName || quotationData?.company_name || "-"}</strong></div>
                  <div class="info-row"><span class="label">Contact Person:</span> ${quotationData?.contact_person || "-"}</div>
                  <div class="info-row"><span class="label">Contact #:</span> ${quotationData?.contact_number || "-"}</div>
                  <div class="info-row"><span class="label">Email:</span> ${quotationData?.email_address || "-"}</div>
                </div>
                <div>
                  <div class="info-row"><span class="label">TIN:</span> ${soData.tinNo || "-"}</div>
                  <div class="info-row"><span class="label">Landline:</span> ${soData.landlineNo || "-"}</div>
                  <div class="info-row"><span class="label">Salesperson:</span> ${soData.salesperson || "-"}</div>
                  <div class="info-row"><span class="label">Prepared By:</span> ${soData.preparedBy || "-"}</div>
                </div>
              </div>
              <div style="margin-top:8px;font-size:9px;">
                <div><span class="label">Registered Address:</span> ${soData.registeredAddress || quotationData?.address || "-"}</div>
                <div><span class="label">Billing Address:</span> ${soData.billingAddress || "-"}</div>
                <div><span class="label">Collection Address:</span> ${soData.collectionAddress || "-"}</div>
                <div><span class="label">Delivery Address:</span> ${soData.deliveryAddress || quotationData?.delivery_address || "-"}</div>
              </div>
            </div>

            <div class="info-box">
              <h3>Project & Additional Information</h3>
              <div class="info-grid">
                <div>
                  <div class="info-row"><span class="label">Project Name:</span> ${soData.projectName || quotationData?.project_name || "-"}</div>
                  <div class="info-row"><span class="label">Project Industry:</span> ${soData.projectIndustry || "-"}</div>
                  <div class="info-row"><span class="label">SPF REF#:</span> ${soData.spfRef || "-"}</div>
                  <div class="info-row"><span class="label">TPC REF:</span> ${soData.tpcRef || "-"}</div>
                  <div class="info-row"><span class="label">TPC Amount:</span> ${soData.tpcAmount ? `₱${parseFloat(soData.tpcAmount).toFixed(2)}` : "-"}</div>
                </div>
                <div>
                  <div class="info-row"><span class="label">Withholding Agent:</span> ${soData.withholdingAgent || "-"}</div>
                  <div class="info-row"><span class="label">Discount Flag:</span> ${soData.discountFlag || "-"}</div>
                  <div class="info-row"><span class="label">Freight Flag:</span> ${soData.freightFlag || "-"}</div>
                  <div class="info-row"><span class="label">Inland Flag:</span> ${soData.inlandFlag || "-"}</div>
                  <div class="info-row"><span class="label">Restocking Flag:</span> ${soData.restockingFlag || "-"}</div>
                </div>
              </div>
              <div style="margin-top:8px;font-size:9px;">
                <div><span class="label">Special Instructions:</span> ${soData.specialInstructions || "-"}</div>
                <div><span class="label">Remarks:</span> ${soData.remarks || "-"}</div>
              </div>
            </div>

            <table class="products-table">
              <thead>
                <tr>
                  <th class="text-center">#</th>
                  <th class="text-center">IMAGE</th>
                  <th>SKU</th>
                  <th>ITEM DESCRIPTION</th>
                  <th class="text-center">QTY</th>
                  <th class="text-right">PRICE</th>
                  <th class="text-right">DISC</th>
                  <th class="text-right">NET PRICE</th>
                  <th class="text-right">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${productsHtml}
              </tbody>
            </table>

            <div class="summary-box">
              <h3>Computation</h3>
              <div class="summary-row"><span>Total Subtotal:</span><span>₱${computations.totalSubtotal?.toFixed(2) || "0.00"}</span></div>
              ${computations.addDisc > 0 ? `<div class="summary-row" style="color:#dc2626;"><span>LESS: OTH DISCOUNT (VAT INC):</span><span>-₱${computations.addDisc?.toFixed(2) || "0.00"}</span></div>` : `<div class="summary-row"><span>LESS: OTH DISCOUNT (VAT INC):</span><span>-</span></div>`}
              <div class="summary-row"><span>NET SALES (VAT INCLUSIVE):</span><span>₱${computations.netSales?.toFixed(2) || "0.00"}</span></div>
              ${computations.deliveryFee > 0 ? `<div class="summary-row"><span>FREIGHT CHARGE (VAT INC):</span><span>₱${computations.deliveryFee?.toFixed(2) || "0.00"}</span></div>` : `<div class="summary-row"><span>FREIGHT CHARGE (VAT INC):</span><span>-</span></div>`}
              ${computations.inlandFee > 0 ? `<div class="summary-row"><span>INLAND DEL CHARGE (VAT INC):</span><span>₱${computations.inlandFee?.toFixed(2) || "0.00"}</span></div>` : `<div class="summary-row"><span>INLAND DEL CHARGE (VAT INC):</span><span>-</span></div>`}
              ${computations.restockFee > 0 ? `<div class="summary-row"><span>RESTOCKING FEE (VAT INC):</span><span>₱${computations.restockFee?.toFixed(2) || "0.00"}</span></div>` : `<div class="summary-row"><span>RESTOCKING FEE (VAT INC):</span><span>-</span></div>`}
              <div class="summary-row"><span>TOTAL SALES (VAT INCLUSIVE):</span><span>₱${computations.totalSales?.toFixed(2) || "0.00"}</span></div>
              ${computations.vatAmount > 0 ? `<div class="summary-row"><span>LESS VAT (12%):</span><span>₱${computations.vatAmount?.toFixed(2) || "0.00"}</span></div>` : `<div class="summary-row"><span>LESS VAT (12%):</span><span>-</span></div>`}
              <div class="summary-row"><span>NET OF VAT TOTAL:</span><span>₱${computations.netOfVat?.toFixed(2) || "0.00"}</span></div>
              ${computations.whtAmount > 0 ? `<div class="summary-row" style="color:#1d4ed8;"><span>LESS: WITHHOLDING TAX:</span><span>-₱${computations.whtAmount?.toFixed(2) || "0.00"}</span></div>` : `<div class="summary-row"><span>LESS: WITHHOLDING TAX:</span><span>-</span></div>`}
              <div class="summary-row total"><span>TOTAL AMOUNT DUE:</span><span>₱${computations.totalAmountDue?.toFixed(2) || "0.00"}</span></div>
            </div>

            <!-- Signatories Section -->
            <div class="signatory-section">
              <div class="signatory-grid">
                <!-- Prepared By - Sales Representative -->
                <div class="signatory-col">
                  <div class="signatory-label">${isEcoshift ? 'Ecoshift Corporation' : 'Disruptive Solutions Inc'}</div>
                  <div class="signatory-sig-box">
                    ${quotationData?.agent_signature ? `<img src="${quotationData.agent_signature}" class="signatory-sig-img" />` : '<span style="font-size:8px;color:#9ca3af;font-style:italic;">No signature available</span>'}
                  </div>
                  <p class="signatory-name">${firstname || "—"} ${lastname || ""}</p>
                  <div class="signatory-line"></div>
                  <p class="signatory-role">Sales Representative</p>
                  <p class="signatory-email">${email || ""}</p>
                </div>

                <!-- Approved By - Territory Sales Manager -->
                <div class="signatory-col">
                  <div class="signatory-label approved">Approved By:</div>
                  <div class="signatory-sig-box">
                    ${quotationData?.tsm_signature ? `<img src="${quotationData.tsm_signature}" class="signatory-sig-img" />` : '<span style="font-size:8px;color:#9ca3af;font-style:italic;">No signature available</span>'}
                  </div>
                  <p class="signatory-name">${tsmname || "—"}</p>
                  <div class="signatory-line"></div>
                  <p class="signatory-role">Territory Sales Manager</p>
                  <p class="signatory-email">${quotationData?.tsm_email_address || ""}</p>
                </div>

                <!-- Noted By - Sales Head -->
                <div class="signatory-col">
                  <div class="signatory-label approved">Noted By:</div>
                  <div class="signatory-sig-box">
                    ${quotationData?.manager_signature ? `<img src="${quotationData.manager_signature}" class="signatory-sig-img" />` : '<span style="font-size:8px;color:#9ca3af;font-style:italic;">No signature available</span>'}
                  </div>
                  <p class="signatory-name">${managername || "—"}</p>
                  <div class="signatory-line"></div>
                  <p class="signatory-role">Sales Head</p>
                  <p class="signatory-email">${quotationData?.manager_email_address || ""}</p>
                </div>
              </div>
            </div>
          </div>
        `;
      };

      // Render the content
      iframeDoc.body.innerHTML = buildSOContent();

      // Wait for images to load
      const images = iframeDoc.querySelectorAll("img");
      await Promise.all(
        Array.from(images).map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      // Capture with html2canvas
      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
      });

      // Cleanup
      document.body.removeChild(iframe);

      // Add to PDF
      const imgData = canvas.toDataURL("image/jpeg", 0.90);
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      // Generate QR code with security token
      const SECURITY_SALT = "TF-SECURE-2024-DS-EC";
      const generateToken = (ref: string, total: string) => {
        const raw = `${ref}|${total}|${SECURITY_SALT}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
          const chr = raw.charCodeAt(i);
          hash = (hash << 5) - hash + chr;
          hash |= 0;
        }
        return Math.abs(hash).toString(36).toUpperCase();
      };

      const totalStr = computations.totalAmountDue.toFixed(2);
      const token = generateToken(soNumber || "DRAFT", totalStr);
      const verificationUrl = `${window.location.origin}/verify-so?ref=${encodeURIComponent(soNumber || "DRAFT")}&total=${totalStr}&v=${token}`;
      const qrDataUrl = await generateQrDataUrl(verificationUrl);

      const issuedAt = new Date().toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });

      let totalPages = 1;
      const usablePageHeight = pdfHeight - 50;

      // Calculate total pages
      if (imgHeight > usablePageHeight) {
        totalPages = Math.ceil(imgHeight / usablePageHeight);
      }

      // Render pages with watermark and footer
      let remainingHeight = imgHeight;
      let sourceY = 0;
      let currentPage = 1;

      while (remainingHeight > 0 || currentPage === 1) {
        if (currentPage > 1) {
          pdf.addPage();
        }

        // Add the image content for this page
        pdf.addImage(imgData, "JPEG", 0, -sourceY, pdfWidth, imgHeight);

        // Stamp watermark on current page
        stampPdfWatermark(pdf, companyLabel, soNumber || "DRAFT", pdfWidth, pdfHeight);

        // Stamp footer on current page
        stampPdfSecurityFooter(pdf, qrDataUrl, soNumber || "DRAFT", issuedAt, currentPage, totalPages, pdfWidth, pdfHeight);

        remainingHeight -= usablePageHeight;
        sourceY += usablePageHeight;
        currentPage++;

        // Break if we've rendered all content
        if (remainingHeight <= 0 && currentPage > 1) break;
        if (currentPage > 50) break; // Safety limit
      }

      pdf.save(`SO-${soNumber || "Draft"}.pdf`);

      sileo.success({
        title: "Success",
        description: "PDF downloaded successfully",
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    } catch (error) {
      console.error("PDF generation failed:", error);
      sileo.error({
        title: "Error",
        description: "Failed to generate PDF: " + (error as Error).message,
        duration: 3000,
        position: "top-right",
        fill: "black",
        styles: { title: "text-white!", description: "text-white" },
      });
    }
  };

  const handleDownloadExcel = () => {
    const selectedProducts = products.filter(p => selectedItems.has(p.id));
    
    // Create Excel content
    const headers = ["Item #", "SKU", "Description", "Qty", "Unit Price", "Disc%", "Net Price", "Subtotal"];
    const rows = selectedProducts.map((p, i) => [
      i + 1,
      p.sku,
      p.title,
      p.quantity,
      p.unitPrice,
      p.discPercent,
      p.netPrice,
      p.subtotal,
    ]);
    
    // Summary rows
    const summaryRows = [
      ["", "", "", "", "", "", "TOTAL", computations.totalSubtotal],
      ["", "", "", "", "", "", "Less: Discount", -computations.addDisc],
      ["", "", "", "", "", "", "Net Sales", computations.netSales],
      ["", "", "", "", "", "", "Freight", computations.deliveryFee],
      ["", "", "", "", "", "", "Restocking", computations.restockFee],
      ["", "", "", "", "", "", "Total Sales", computations.totalSales],
      ["", "", "", "", "", "", "VAT (12%)", -computations.vatAmount],
      ["", "", "", "", "", "", "Net of VAT", computations.netOfVat],
    ];
    
    if (computations.whtAmount > 0) {
      summaryRows.push(["", "", "", "", "", "", `WHT (${(computations.whtRate * 100).toFixed(0)}%)`, -computations.whtAmount]);
    }
    summaryRows.push(["", "", "", "", "", "", "AMOUNT DUE", computations.totalAmountDue]);

    const csvContent = [
      [`Sales Order: ${soNumber || "Draft"}`],
      [`Company: ${quotationData?.company_name}`],
      [`Date: ${new Date().toLocaleDateString("en-PH")}`],
      [],
      headers,
      ...rows,
      [],
      ...summaryRows,
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `SO_${soNumber || "Draft"}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // ── Render ───────────────────────────────────────────────────────────────
  if (!quotationData) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent 
          className="flex flex-col max-w-full w-full h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] p-0 gap-0 overflow-hidden"
          style={{
            maxWidth: "100vw",
            width: "100vw",
          }}
        >
          {/* HEADER */}
          <DialogHeader className="px-6 py-3 border-b border-gray-200 bg-white shrink-0 h-auto">
            <div className="flex items-center justify-between">
              <DialogTitle className="font-black text-sm tracking-tight">
                Generate Sales Order: {quotationData.quotation_number}
              </DialogTitle>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="rounded-none h-8 text-[10px]"
                  onClick={() => setShowHistory(true)}
                >
                  <History className="w-3 h-3 mr-1" />
                  History ({soRevisions.length})
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="rounded-none h-8 text-[10px]"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Main Content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="flex-1 flex flex-col lg:flex-row gap-0 lg:gap-3 lg:pl-3 lg:pr-3 lg:py-3 p-0 overflow-hidden min-h-0">
              {/* Left side: SO Form Fields - Excel Style */}
              <div className="flex flex-col h-full flex-shrink-0 w-[320px] min-w-[320px] border-r border-gray-200 bg-gray-50">
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  
                  {/* HEADER - Like Excel Red Header */}
                  <div className="bg-red-600 text-white px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide">
                    DS SALES ORDER
                  </div>

                  {/* ROW 1: IF RE-SO | Old SO# */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 bg-white border border-gray-300 px-2 py-1">
                      <input
                        type="checkbox"
                        checked={isReSo}
                        onChange={(e) => setIsReSo(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-gray-400"
                      />
                      <label className="text-[10px] font-semibold text-gray-700">IF RE-SO</label>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Old SO#</label>
                      <Input
                        value={oldSoNumber}
                        onChange={(e) => setOldSoNumber(e.target.value)}
                        disabled={!isReSo}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0 disabled:bg-gray-100"
                      />
                    </div>
                  </div>

                  {/* ROW 2: DSO# | SO Date */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">DSO#</label>
                      <Input
                        value={dsoNumber}
                        onChange={(e) => setDsoNumber(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">SO Date</label>
                      <Input
                        type="date"
                        value={soDate}
                        onChange={(e) => setSoDate(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* ROW 3: SO Number | PO Number */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">SO# *</label>
                      <Input
                        value={soNumber}
                        onChange={(e) => setSoNumber(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">PO#</label>
                      <Input
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* SECTION: Sales Info */}
                  <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                    Sales Information
                  </div>

                  {/* Salesperson | Prepared By */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Salesperson</label>
                      <Input
                        value={salesperson}
                        onChange={(e) => setSalesperson(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Prepared By</label>
                      <Input
                        value={preparedBy}
                        onChange={(e) => setPreparedBy(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* Mode | SO Type */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Mode</label>
                      <Select value={mode} onValueChange={setMode}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODES.map((m) => (
                            <SelectItem key={m} value={m} className="text-[11px]">{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">SO Type</label>
                      <Select value={soType} onValueChange={setSoType}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SO_TYPES.slice(0, 8).map((t) => (
                            <SelectItem key={t} value={t} className="text-[11px]">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Invoice Type | Payment Terms */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Invoice Type</label>
                      <Select value={invoiceType} onValueChange={setInvoiceType}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INVOICE_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-[11px]">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Payment Terms</label>
                      <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TERMS.slice(0, 6).map((t) => (
                            <SelectItem key={t} value={t} className="text-[11px]">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* SECTION: Customer Info */}
                  <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                    Customer Information
                  </div>

                  {/* Customer Name */}
                  <div className="bg-white border border-gray-300">
                    <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Customer Name</label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                    />
                  </div>

                  {/* TIN No | Landline */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">TIN No.</label>
                      <Input
                        value={tinNo}
                        onChange={(e) => setTinNo(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Landline #</label>
                      <Input
                        value={landlineNo}
                        onChange={(e) => setLandlineNo(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="bg-white border border-gray-300">
                    <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Registered Address</label>
                    <Textarea
                      value={registeredAddress}
                      onChange={(e) => setRegisteredAddress(e.target.value)}
                      className="text-[11px] rounded-none border-0 px-2 py-1 focus-visible:ring-0 resize-none h-12"
                    />
                  </div>
                  <div className="bg-white border border-gray-300">
                    <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Billing Address</label>
                    <Textarea
                      value={billingAddress}
                      onChange={(e) => setBillingAddress(e.target.value)}
                      className="text-[11px] rounded-none border-0 px-2 py-1 focus-visible:ring-0 resize-none h-12"
                    />
                  </div>
                  <div className="bg-white border border-gray-300">
                    <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Collection Address</label>
                    <Textarea
                      value={collectionAddress}
                      onChange={(e) => setCollectionAddress(e.target.value)}
                      className="text-[11px] rounded-none border-0 px-2 py-1 focus-visible:ring-0 resize-none h-12"
                    />
                  </div>
                  <div className="bg-white border border-gray-300">
                    <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Delivery Address</label>
                    <Textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="text-[11px] rounded-none border-0 px-2 py-1 focus-visible:ring-0 resize-none h-12"
                    />
                  </div>

                  {/* SECTION: Project Info */}
                  <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                    Project Information
                  </div>

                  {/* Project Name | Project Industry */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Project Name</label>
                      <Input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Industry</label>
                      <Select value={projectIndustry} onValueChange={setProjectIndustry}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_INDUSTRIES.map((i) => (
                            <SelectItem key={i} value={i} className="text-[11px]">{i}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* VAT Type | SPF REF# */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">VAT Type</label>
                      <Select value={vatType} onValueChange={setVatType}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VAT_TYPES.map((v) => (
                            <SelectItem key={v} value={v} className="text-[11px]">{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">SPF REF#</label>
                      <Input
                        value={spfRef}
                        onChange={(e) => setSpfRef(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* Conforme | Withholding */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Conforme</label>
                      <Select value={conforme} onValueChange={setConforme}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONFORME_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c} className="text-[11px]">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Withholding</label>
                      <Select value={withholdingAgent} onValueChange={setWithholdingAgent}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WITHHOLDING_AGENT_OPTIONS.map((o) => (
                            <SelectItem key={o} value={o} className="text-[11px]">{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Special Instructions */}
                  <div className="bg-white border border-gray-300">
                    <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Special Instructions</label>
                    <Textarea
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className="text-[11px] rounded-none border-0 px-2 py-1 focus-visible:ring-0 resize-none h-14"
                    />
                  </div>

                  {/* SECTION: Classification */}
                  <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                    Sales Classification
                  </div>

                  {/* Sales Group | Industry */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Sales Group</label>
                      <Select value={salesGroup} onValueChange={setSalesGroup}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SALES_GROUPS.map((g) => (
                            <SelectItem key={g} value={g} className="text-[11px]">{g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Industry</label>
                      <Select value={industry} onValueChange={setIndustry}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INDUSTRIES.slice(0, 8).map((i) => (
                            <SelectItem key={i} value={i} className="text-[11px]">{i}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* IO Dept | Delivery Date */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">IO Dept</label>
                      <Select value={ioDept} onValueChange={setIoDept}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {IO_DEPTS.map((d) => (
                            <SelectItem key={d} value={d} className="text-[11px]">{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Delivery Date</label>
                      <Input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* SECTION: Flags */}
                  <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                    Flags
                  </div>

                  {/* Flags Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Discount</label>
                      <Select value={discountFlag} onValueChange={setDiscountFlag}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FLAG_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f} className="text-[11px]">{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Freight</label>
                      <Select value={freightFlag} onValueChange={setFreightFlag}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FLAG_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f} className="text-[11px]">{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Inland</label>
                      <Select value={inlandFlag} onValueChange={setInlandFlag}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FLAG_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f} className="text-[11px]">{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Restocking</label>
                      <Select value={restockingFlag} onValueChange={setRestockingFlag}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FLAG_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f} className="text-[11px]">{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* SECTION: Fees & TPC */}
                  <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                    Fees & TPC
                  </div>

                  {/* TPC Type | TPC Ref */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">TPC Type</label>
                      <Select value={tpcType} onValueChange={setTpcType}>
                        <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TPC_TYPES.map((t) => (
                            <SelectItem key={t} value={t} className="text-[11px]">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">TPC Ref</label>
                      <Input
                        value={tpcRef}
                        onChange={(e) => setTpcRef(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* TPC Amount | Additional Discount */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">TPC Amt</label>
                      <Input
                        type="number"
                        value={tpcAmount}
                        onChange={(e) => setTpcAmount(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Addl Disc</label>
                      <Input
                        type="number"
                        value={additionalDiscount}
                        onChange={(e) => setAdditionalDiscount(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* Delivery Fee | Inland Fee | Restocking Fee */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Delivery</label>
                      <Input
                        type="number"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Inland</label>
                      <Input
                        type="number"
                        value={inlandFee}
                        onChange={(e) => setInlandFee(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                    <div className="bg-white border border-gray-300">
                      <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Restock</label>
                      <Input
                        type="number"
                        value={restockingFee}
                        onChange={(e) => setRestockingFee(e.target.value)}
                        className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  {/* SO Status | Remarks */}
                  <div className="bg-white border border-gray-300">
                    <label className="block text-[9px] text-gray-500 px-2 pt-0.5">SO Status</label>
                    <Select value={soStatus} onValueChange={setSoStatus}>
                      <SelectTrigger className="h-6 text-[11px] rounded-none border-0 px-2 py-0 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SO_STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s} className="text-[11px]">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-white border border-gray-300">
                    <label className="block text-[9px] text-gray-500 px-2 pt-0.5">Remarks</label>
                    <Textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="text-[11px] rounded-none border-0 px-2 py-1 focus-visible:ring-0 resize-none h-12"
                    />
                  </div>
                </div>
              </div>

              {/* Right side: Products & Computation */}
              <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-gray-50">
                <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-3 p-3">
                    
                    {/* SECTION: Customer Reference */}
                    <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                      Customer Reference
                    </div>
                    <div className="bg-white border border-gray-300 p-2">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        <div><span className="font-semibold text-gray-600">Company:</span> {quotationData.company_name}</div>
                        <div><span className="font-semibold text-gray-600">Contact:</span> {quotationData.contact_person}</div>
                        <div><span className="font-semibold text-gray-600">Phone:</span> {quotationData.contact_number}</div>
                        <div><span className="font-semibold text-gray-600">Email:</span> {quotationData.email_address}</div>
                        <div className="col-span-2"><span className="font-semibold text-gray-600">Registered:</span> {registeredAddress || quotationData.address}</div>
                        <div className="col-span-2"><span className="font-semibold text-gray-600">Billing:</span> {billingAddress || "-"}</div>
                        <div className="col-span-2"><span className="font-semibold text-gray-600">Collection:</span> {collectionAddress || "-"}</div>
                        <div className="col-span-2"><span className="font-semibold text-gray-600">Delivery:</span> {deliveryAddress || quotationData.delivery_address || "-"}</div>
                      </div>
                    </div>

                    {/* SECTION: Products */}
                    <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase flex justify-between items-center">
                      <span>Products ({selectedItems.size}/{products.length})</span>
                      <input
                        type="checkbox"
                        checked={selectedItems.size === products.length && products.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems(new Set(products.map(p => p.id)));
                          } else {
                            setSelectedItems(new Set());
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="bg-white border border-gray-300 overflow-hidden">
                      <table className="w-full text-[11px]">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1.5 text-left border-b w-8"></th>
                            <th className="px-2 py-1.5 text-left border-b">SKU</th>
                            <th className="px-2 py-1.5 text-left border-b">Description</th>
                            <th className="px-2 py-1.5 text-center border-b">Qty</th>
                            <th className="px-2 py-1.5 text-right border-b">Price</th>
                            <th className="px-2 py-1.5 text-right border-b">Disc</th>
                            <th className="px-2 py-1.5 text-right border-b">Net</th>
                            <th className="px-2 py-1.5 text-right border-b">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p, i) => (
                            <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="px-2 py-1.5 border-b">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.has(p.id)}
                                  onChange={(e) => {
                                    const newSelected = new Set(selectedItems);
                                    if (e.target.checked) {
                                      newSelected.add(p.id);
                                    } else {
                                      newSelected.delete(p.id);
                                    }
                                    setSelectedItems(newSelected);
                                  }}
                                  className="w-3.5 h-3.5"
                                />
                              </td>
                              <td className="px-2 py-1.5 border-b font-mono text-[10px]">{p.sku}</td>
                              <td className="px-2 py-1.5 border-b">{p.title}</td>
                              <td className="px-2 py-1.5 border-b text-center">{p.quantity}</td>
                              <td className="px-2 py-1.5 border-b text-right">{formatCurrency(p.unitPrice)}</td>
                              <td className="px-2 py-1.5 border-b text-right">{p.discPercent?.toFixed(0) || 0}%</td>
                              <td className="px-2 py-1.5 border-b text-right">{formatCurrency(p.netPrice)}</td>
                              <td className="px-2 py-1.5 border-b text-right font-semibold">{formatCurrency(p.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* SECTION: Computation */}
                    <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                      Computation Summary
                    </div>
                    <div className="bg-white border border-gray-300 overflow-hidden">
                      <table className="w-full text-[11px]">
                        <tbody>
                          <tr className="bg-white border-b">
                            <td className="px-3 py-2">TOTAL</td>
                            <td className="px-3 py-2 text-right font-semibold">{formatCurrency(computations.totalSubtotal)}</td>
                          </tr>
                          {computations.addDisc > 0 && (
                            <tr className="bg-red-50 border-b">
                              <td className="px-3 py-2">LESS: Other Discount (VAT Inc)</td>
                              <td className="px-3 py-2 text-right text-red-600">-{formatCurrency(computations.addDisc)}</td>
                            </tr>
                          )}
                          <tr className="bg-gray-100 border-b font-semibold">
                            <td className="px-3 py-2">NET SALES (VAT Inclusive)</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(computations.netSales)}</td>
                          </tr>
                          {computations.deliveryFee > 0 && (
                            <tr className="bg-white border-b">
                              <td className="px-3 py-2">FREIGHT CHARGE (VAT Inc)</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(computations.deliveryFee)}</td>
                            </tr>
                          )}
                          {computations.inlandFee > 0 && (
                            <tr className="bg-white border-b">
                              <td className="px-3 py-2">INLAND DEL CHARGE (VAT Inc)</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(computations.inlandFee)}</td>
                            </tr>
                          )}
                          {computations.restockFee > 0 && (
                            <tr className="bg-white border-b">
                              <td className="px-3 py-2">RESTOCKING FEE (VAT Inc)</td>
                              <td className="px-3 py-2 text-right">{formatCurrency(computations.restockFee)}</td>
                            </tr>
                          )}
                          <tr className="bg-gray-200 border-b font-bold">
                            <td className="px-3 py-2">TOTAL SALES (VAT Inclusive)</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(computations.totalSales)}</td>
                          </tr>
                          <tr className="bg-white border-b">
                            <td className="px-3 py-2">LESS VAT (12%)</td>
                            <td className="px-3 py-2 text-right text-red-600">-{formatCurrency(computations.vatAmount)}</td>
                          </tr>
                          <tr className="bg-gray-100 border-b font-semibold">
                            <td className="px-3 py-2">NET OF VAT TOTAL</td>
                            <td className="px-3 py-2 text-right">{formatCurrency(computations.netOfVat)}</td>
                          </tr>
                          {computations.whtAmount > 0 && (
                            <tr className="bg-red-50 border-b">
                              <td className="px-3 py-2">LESS: Withholding Tax ({(computations.whtRate * 100).toFixed(0)}%)</td>
                              <td className="px-3 py-2 text-right text-red-600">-{formatCurrency(computations.whtAmount)}</td>
                            </tr>
                          )}
                          <tr className="bg-green-100 font-bold text-green-800">
                            <td className="px-3 py-2.5">TOTAL AMOUNT DUE</td>
                            <td className="px-3 py-2.5 text-right text-lg">{formatCurrency(computations.totalAmountDue)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* SECTION: Reference Info */}
                    <div className="bg-gray-200 text-gray-700 px-2 py-1 text-[10px] font-bold uppercase">
                      Reference Information
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white border border-gray-300 p-2">
                        <div className="font-semibold text-gray-700 text-[10px] mb-2 uppercase">Quotation</div>
                        <div className="space-y-1 text-[11px]">
                          <div><span className="text-gray-500">Ref#:</span> {quotationData.quotation_number}</div>
                          <div><span className="text-gray-500">Amount:</span> {formatCurrency(Number(quotationData.quotation_amount) || 0)}</div>
                          <div><span className="text-gray-500">VAT:</span> {quotationData.vat_type}</div>
                          <div><span className="text-gray-500">WHT:</span> {quotationData.wht_type || "None"}</div>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-300 p-2">
                        <div className="font-semibold text-gray-700 text-[10px] mb-2 uppercase">Sales Order</div>
                        <div className="space-y-1 text-[11px]">
                          <div><span className="text-gray-500">SO#:</span> <span className="font-mono">{soNumber || "-"}</span></div>
                          <div><span className="text-gray-500">Amount:</span> <span className="font-semibold">{formatCurrency(computations.totalAmountDue)}</span></div>
                          <div><span className="text-gray-500">Status:</span> {soStatus}</div>
                          <div><span className="text-gray-500">Terms:</span> {paymentTerms}</div>
                        </div>
                      </div>
                      <div className="bg-white border border-gray-300 p-2">
                        <div className="font-semibold text-gray-700 text-[10px] mb-2 uppercase">Selection</div>
                        <div className="space-y-1 text-[11px]">
                          <div><span className="text-gray-500">Items:</span> {selectedItems.size} / {products.length}</div>
                          <div><span className="text-gray-500">Subtotal:</span> {formatCurrency(computations.totalSubtotal)}</div>
                          <div><span className="text-gray-500">Net Sales:</span> {formatCurrency(computations.netSales)}</div>
                          <div><span className="text-gray-500">Excluded:</span> {products.length - selectedItems.size}</div>
                        </div>
                      </div>
                    </div>

                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="px-6 py-4 border-t border-gray-200 bg-white shrink-0">
            <div className="flex items-center justify-between w-full">
              <div className="text-[11px] text-gray-500">
                {selectedItems.size !== products.length && (
                  <span className="text-orange-600">{products.length - selectedItems.size} items excluded</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  className="rounded-none h-9 px-4"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button 
                  className="rounded-none h-9 px-4 bg-green-700 hover:bg-green-800"
                  onClick={handleSave}
                  disabled={saving || !soNumber || selectedItems.size === 0}
                >
                  {saving ? (
                    <span className="animate-pulse">Saving...</span>
                  ) : (
                    <>
                      <CheckCircle2Icon className="w-4 h-4 mr-2" />
                      Generate SO
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      {showPreview && quotationData && (
        <SOPreview
          soData={soData}
          products={products.map(p => ({ ...p, isSelected: selectedItems.has(p.id) }))}
          quotationData={quotationData}
          computations={computations}
          onClose={() => setShowPreview(false)}
          onDownloadPDF={handleDownloadPDF}
          onDownloadExcel={handleDownloadExcel}
          onPrint={handleDownloadPDF}
          firstname={firstname}
          lastname={lastname}
          email={email}
          contact={contact}
          tsmname={tsmname}
          managername={managername}
        />
      )}

      {/* History Modal */}
      {showHistory && (
        <SOHistory
          revisions={soRevisions}
          onSelectRevision={(rev) => {
            // Populate form with revision data
            setSoNumber(rev.soNumber);
            setSoStatus(rev.status);
            setShowHistory(false);
            sileo.success({
              title: "Revision Loaded",
              description: `Loaded SO version ${rev.version}`,
              duration: 2000,
              position: "top-right",
            });
          }}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}

export default GenerateSODialog;
