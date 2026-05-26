"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldTitle, } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { sileo } from "sileo";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2Icon, 
  Eye, 
  Download, 
  FileSpreadsheet,
  History,
  X,
  FileText,
  Calculator
} from "lucide-react";

// ── Interfaces ─────────────────────────────────────────────────────────────
interface ProductItem {
  id: number;
  category: string;
  quantity: string | number;
  sku: string;
  title: string;
  description: string;
  photo: string;
  discountedPrice: string | number;
  discountedAmount: string | number;
  isPromo: string;
  isSelected?: boolean;
  unitPrice?: number;
  discPercent?: number;
  netPrice?: number;
  subtotal?: number;
}

interface SORevision {
  version: string;
  date: string;
  soNumber: string;
  soAmount: number;
  status: string;
  modifiedBy: string;
  changes: string[];
  isLatest?: boolean;
}

interface Props {
  step: number;
  setStep: (step: number) => void;
  source: string;
  setSource: (v: string) => void;
  soAmount: string;
  setSoAmount: (v: string) => void;
  callType: string;
  setCallType: (v: string) => void;
  remarks: string;
  setRemarks: (v: string) => void;
  status: string;
  setStatus: (v: string) => void;
  typeClient: string;
  setTypeClient: (value: string) => void;
  soStatus: string;
  setSoStatus: (v: string) => void;
  paymentStatus: string;
  setPaymentStatus: (v: string) => void;
  handleBack: () => void;
  handleNext: () => void;
  handleSave: () => void;

  // Quotation data to pull from
  quotationNumber?: string;
  quotationAmount?: string;
  productCat?: string;
  productQuantity?: string;
  productSku?: string;
  productTitle?: string;
  productDescription?: string;
  productPhoto?: string;
  productDiscountedPrice?: string;
  productDiscountedAmount?: string;
  productIsPromo?: string;
  vatType?: string;
  deliveryFee?: string;
  deliveryAddress?: string;
  restockingFee?: string;
  whtType?: string;
  quotationSubject?: string;
  itemRemarks?: string;
  projectType?: string;
  projectName?: string;

  // Client details
  company_name?: string;
  address?: string;
  contact_person?: string;
  contact_number?: string;
  email_address?: string;

  // SO Revisions
  soRevisions?: SORevision[];
  quotationType?: string;
  
  // New callback for enhanced save
  onEnhancedSave?: (soData: any) => void;
}

const SO_SOURCES = [
    {
        label: "Existing Client",
        description: "Clients with active accounts or previous transactions.",
    },
    {
        label: "CSR Inquiry",
        description: "Customer Service Representative inquiries.",
    },
    {
        label: "Government",
        description: "Calls coming from government agencies.",
    },
    {
        label: "Philgeps Website",
        description: "Inquiries from Philgeps online platform.",
    },
    {
        label: "Philgeps",
        description: "Other Philgeps related contacts.",
    },
    {
        label: "Distributor",
        description: "Calls from product distributors or resellers.",
    },
    {
        label: "Modern Trade",
        description: "Contacts from retail or modern trade partners.",
    },
    {
        label: "Facebook Marketplace",
        description: "Leads or inquiries from Facebook Marketplace.",
    },
    {
        label: "Walk-in Showroom",
        description: "Visitors physically coming to showroom.",
    },
];

const CALL_TYPES = [
    {
        label: "Regular SO",
        description: "Standard sales order without special conditions.",
    },
    {
        label: "Willing to Wait",
        description: "Client agrees to wait for product availability or delivery.",
    },
    {
        label: "SPF - Special Project",
        description: "Sales order related to special projects requiring special handling.",
    },
    {
        label: "SPF - Local",
        description: "Special project sales order for local clients.",
    },
    {
        label: "SPF - Foreign",
        description: "Special project sales order for foreign clients.",
    },
    {
        label: "Promo",
        description: "Sales order under promotional campaigns or discounts.",
    },
    {
        label: "FB Marketplace",
        description: "Sales orders generated from Facebook Marketplace leads.",
    },
    {
        label: "Internal Order",
        description: "Orders placed internally within the company.",
    },
];

// DSI Form Constants
const MODES = ["DELIVERY", "PICK UP", "WALK IN"];

const SO_TYPES = [
    "REGULAR SO", "WILLING TO WAIT", "WALK IN", "FB MARKETPLACE",
    "ECOMMERCE", "PROMO ITEM", "INTERNAL ORDER-REGULAR", "INTERNAL ORDER-PROMO",
    "SPECIAL PROJECT", "LOCAL SPF", "DELIVERY", "PICK UP"
];

const VAT_TYPES = ["VATABLE", "VAT EXEMPT", "ZERO-RATED"];

const INVOICE_TYPES = ["SALES INVOICE", "RECEIVING SLIP"];

const WITHHOLDING_OPTIONS = ["YES", "NO"];

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

const TPC_TYPES = [
    "NO TPC", "TPC SPF", "TPC PROMO", "TPC REGULAR", "TPC REGULAR SPF",
    "TPC REGULAR PROMO", "TPC SPF PROMO", "TPC REGULAR SPF PROMO"
];

const CHARGE_FLAGS = ["REFLECT", "WAIVE", "HIDDEN"];

// ── Helper Functions ─────────────────────────────────────────────────────
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

// ── SO Preview Component (Internal) ────────────────────────────────────────
interface SOPreviewProps {
  isOpen: boolean;
  onClose: () => void;
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
  };
  products: ProductItem[];
  customerData: {
    company_name?: string;
    address?: string;
    contact_person?: string;
    contact_number?: string;
    email_address?: string;
    deliveryAddress?: string;
  };
  computations: {
    totalSubtotal: number;
    addDisc: number;
    deliveryFee: number;
    restockFee: number;
    netSales: number;
    totalSales: number;
    vatAmount: number;
    netOfVat: number;
    whtAmount: number;
    totalAmountDue: number;
  };
  quotationType?: string;
  onDownloadExcel: () => void;
}

function SOPreviewModal({ 
  isOpen, 
  onClose, 
  soData, 
  products, 
  customerData, 
  computations,
  quotationType,
  onDownloadExcel 
}: SOPreviewProps) {
  if (!isOpen) return null;

  const isEcoshift = quotationType === "Ecoshift Corporation";
  const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-gray-600" />
          <h2 className="font-bold text-sm">SO Preview: {soData.soNumber || "(Draft)"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-none h-8" onClick={onDownloadExcel}>
            <FileSpreadsheet className="w-4 h-4 mr-1 text-green-600" />
            Excel
          </Button>
          <Button size="sm" variant="outline" className="rounded-none h-8" onClick={handlePrint}>
            Print / PDF
          </Button>
          <Button size="sm" variant="ghost" className="rounded-none h-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Document */}
      <div className="max-w-4xl mx-auto p-8">
        <img src={headerImagePath} alt="Header" className="w-full h-auto mb-4" />
        
        <div className="flex justify-between text-[10px] uppercase tracking-wider mb-6">
          <div><strong>SO #:</strong> {soData.soNumber || "___________"}</div>
          <div><strong>Date:</strong> {new Date().toLocaleDateString("en-PH")}</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
          <div className="border p-3">
            <div className="font-bold uppercase text-[10px] text-gray-500 mb-2">Bill To:</div>
            <div className="font-semibold">{customerData.company_name || "N/A"}</div>
            <div>{customerData.address || "N/A"}</div>
            <div>ATTN: {customerData.contact_person || "N/A"}</div>
            <div>TEL: {customerData.contact_number || "N/A"}</div>
          </div>
          <div className="border p-3">
            <div className="font-bold uppercase text-[10px] text-gray-500 mb-2">Ship To:</div>
            <div>{customerData.deliveryAddress || customerData.address || "N/A"}</div>
            <div className="mt-2"><strong>PO #:</strong> {soData.poNumber || "N/A"}</div>
          </div>
        </div>

        <table className="w-full text-[10px] mb-6">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left">#</th>
              <th className="border px-2 py-1 text-left">SKU</th>
              <th className="border px-2 py-1 text-left">Description</th>
              <th className="border px-2 py-1 text-center">Qty</th>
              <th className="border px-2 py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {products.filter(p => p.isSelected !== false).map((p, i) => (
              <tr key={p.id}>
                <td className="border px-2 py-1">{i + 1}</td>
                <td className="border px-2 py-1 font-mono">{p.sku}</td>
                <td className="border px-2 py-1">{p.title}</td>
                <td className="border px-2 py-1 text-center">{p.quantity}</td>
                <td className="border px-2 py-1 text-right font-semibold">{formatCurrency(p.subtotal || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <table className="text-[10px] w-80">
            <tbody>
              <tr><td className="py-1">TOTAL</td><td className="py-1 text-right">{formatCurrency(computations.totalSubtotal)}</td></tr>
              {computations.addDisc > 0 && (
                <tr><td className="py-1">LESS: Discount</td><td className="py-1 text-right text-red-600">-{formatCurrency(computations.addDisc)}</td></tr>
              )}
              <tr className="font-semibold">
                <td className="py-1">NET SALES</td>
                <td className="py-1 text-right">{formatCurrency(computations.netSales)}</td>
              </tr>
              {computations.deliveryFee > 0 && (
                <tr><td className="py-1">FREIGHT</td><td className="py-1 text-right">{formatCurrency(computations.deliveryFee)}</td></tr>
              )}
              {computations.restockFee > 0 && (
                <tr><td className="py-1">RESTOCKING</td><td className="py-1 text-right">{formatCurrency(computations.restockFee)}</td></tr>
              )}
              <tr className="font-bold bg-gray-100">
                <td className="py-1 px-2">TOTAL SALES</td>
                <td className="py-1 px-2 text-right">{formatCurrency(computations.totalSales)}</td>
              </tr>
              <tr>
                <td className="py-1">LESS VAT (12%)</td>
                <td className="py-1 text-right text-red-600">-{formatCurrency(computations.vatAmount)}</td>
              </tr>
              <tr className="font-semibold">
                <td className="py-1">NET OF VAT</td>
                <td className="py-1 text-right">{formatCurrency(computations.netOfVat)}</td>
              </tr>
              {computations.whtAmount > 0 && (
                <tr><td className="py-1">LESS: WHT</td><td className="py-1 text-right text-red-600">-{formatCurrency(computations.whtAmount)}</td></tr>
              )}
              <tr className="font-bold text-green-700 bg-green-50">
                <td className="py-2 px-2">AMOUNT DUE</td>
                <td className="py-2 px-2 text-right">{formatCurrency(computations.totalAmountDue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="text-[10px] mt-8">
          <div className="font-bold uppercase mb-2">Payment Terms: {soData.paymentTerms}</div>
          <div className="grid grid-cols-2 gap-8 mt-8">
            <div>
              <div className="border-b border-black h-8 mb-1"></div>
              <div className="text-center">Prepared By</div>
            </div>
            <div>
              <div className="border-b border-black h-8 mb-1"></div>
              <div className="text-center">Conforme (Customer)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SO History Component (Internal) ─────────────────────────────────────────
interface SOHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  revisions: SORevision[];
  onSelectRevision: (rev: SORevision) => void;
}

function SOHistoryModal({ isOpen, onClose, revisions, onSelectRevision }: SOHistoryProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
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
              No SO revisions found. Generate your first SO.
            </div>
          ) : (
            <div className="space-y-3">
              {revisions.map((rev, index) => (
                <div 
                  key={index} 
                  className="border rounded-none p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    onSelectRevision(rev);
                    onClose();
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={rev.isLatest ? "default" : "outline"} className="rounded-none text-[10px]">
                        v{rev.version}
                      </Badge>
                      <span className="font-mono text-xs">{rev.soNumber}</span>
                      {rev.isLatest && (
                        <Badge className="rounded-none text-[9px] bg-green-100 text-green-800">LATEST</Badge>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-500">{rev.date}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div><span className="text-gray-500">Amount:</span> {formatCurrency(rev.soAmount)}</div>
                    <div><span className="text-gray-500">Status:</span> {rev.status}</div>
                    <div><span className="text-gray-500">By:</span> {rev.modifiedBy}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// ── Main SOSheet Component ─────────────────────────────────────────────────
export function SOSheet(props: Props) {
    const {
        step,
        setStep,
        source,
        setSource,
        soAmount,
        setSoAmount,
        callType,
        setCallType,
        remarks,
        setRemarks,
        status,
        setStatus,
        typeClient,
        setTypeClient,
        soStatus,
        setSoStatus,
        paymentStatus,
        setPaymentStatus,
        handleBack,
        handleNext,
        handleSave,

        // Quotation data
        quotationNumber,
        quotationAmount,
        productCat,
        productQuantity,
        productSku,
        productTitle,
        productDescription,
        productPhoto,
        productDiscountedPrice,
        productDiscountedAmount,
        productIsPromo,
        vatType,
        deliveryFee,
        deliveryAddress,
        restockingFee,
        whtType,
        quotationSubject,
        itemRemarks,
        projectType,
        projectName,

        // Client details
        company_name,
        address,
        contact_person,
        contact_number,
        email_address,
    } = props;

    // Local state for SO fields
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

    // Parse products from quotation data
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [additionalDiscount, setAdditionalDiscount] = useState("");
    
    // Enhanced state for POS-style features
    const [showPreview, setShowPreview] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
    const [soNumber, setSoNumber] = useState(generateSONumber());

    // Parse quotation products on mount
    React.useEffect(() => {
        if (productCat && productQuantity && productSku && productTitle) {
            try {
                const parsedCat = JSON.parse(productCat);
                const parsedQty = JSON.parse(productQuantity);
                const parsedSku = JSON.parse(productSku);
                const parsedTitle = JSON.parse(productTitle);
                const parsedDesc = productDescription ? JSON.parse(productDescription) : [];
                const parsedPhoto = productPhoto ? JSON.parse(productPhoto) : [];
                const parsedDiscPrice = productDiscountedPrice ? JSON.parse(productDiscountedPrice) : [];
                const parsedDiscAmount = productDiscountedAmount ? JSON.parse(productDiscountedAmount) : [];
                const parsedIsPromo = productIsPromo ? JSON.parse(productIsPromo) : [];

                const productList: ProductItem[] = parsedCat.map((cat: any, index: number) => {
                    const unitPrice = parseFloat(parsedDiscPrice[index]) || 0;
                    const quantity = parseFloat(parsedQty[index]) || 0;
                    const discPercent = parseFloat(parsedDiscAmount[index]) || 0;
                    const netPrice = unitPrice * (1 - discPercent / 100);
                    const subtotal = netPrice * quantity;
                    
                    return {
                        id: index,
                        category: cat,
                        quantity: quantity,
                        sku: parsedSku[index] || "",
                        title: parsedTitle[index] || "",
                        description: parsedDesc[index] || "",
                        photo: parsedPhoto[index] || "",
                        discountedPrice: parsedDiscPrice[index] || 0,
                        discountedAmount: parsedDiscAmount[index] || 0,
                        isPromo: parsedIsPromo[index] || "0",
                        isSelected: true,
                        unitPrice,
                        discPercent,
                        netPrice,
                        subtotal,
                    };
                });

                setProducts(productList);
                setSelectedItems(new Set(productList.map(p => p.id)));
            } catch (e) {
                console.error("Error parsing products:", e);
                setProducts([]);
                setSelectedItems(new Set());
            }
        }
    }, [productCat, productQuantity, productSku, productTitle, productDescription, productPhoto, productDiscountedPrice, productDiscountedAmount, productIsPromo]);

    // Computations
    const computations = useMemo(() => {
        const selectedProducts = products.filter(p => selectedItems.has(p.id));
        const totalSubtotal = selectedProducts.reduce((sum, p) => sum + (p.subtotal || 0), 0);
        const addDisc = parseFloat(additionalDiscount || "0") || 0;
        const deliveryFeeNum = parseFloat(deliveryFee || "0") || 0;
        const restockFee = parseFloat(restockingFee || "0") || 0;
        const netSales = totalSubtotal - addDisc;
        const totalSales = netSales + deliveryFeeNum + restockFee;
        const vatAmount = totalSales / 1.12 * 0.12;
        const netOfVat = totalSales / 1.12;
        const whtRate = whtType === "wht_1" ? 0.01 : whtType === "wht_2" ? 0.02 : 0;
        const whtAmount = netOfVat * whtRate;
        const totalAmountDue = totalSales - whtAmount;

        return {
            totalSubtotal,
            addDisc,
            deliveryFee: deliveryFeeNum,
            restockFee,
            netSales,
            totalSales,
            vatAmount,
            netOfVat,
            whtAmount,
            totalAmountDue,
        };
    }, [products, selectedItems, additionalDiscount, deliveryFee, restockingFee, whtType]);

    // Product selection handlers
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

    // Excel export
    const handleDownloadExcel = () => {
        const selectedProducts = products.filter(p => selectedItems.has(p.id));
        
        const headers = ["Item #", "SKU", "Description", "Qty", "Unit Price", "Disc%", "Net Price", "Subtotal"];
        const rows = selectedProducts.map((p, i) => [
            i + 1,
            p.sku,
            p.title,
            p.quantity,
            p.unitPrice?.toFixed(2) || 0,
            p.discPercent?.toFixed(2) || 0,
            p.netPrice?.toFixed(2) || 0,
            p.subtotal?.toFixed(2) || 0,
        ]);
        
        const summaryRows = [
            ["", "", "", "", "", "", "TOTAL", computations.totalSubtotal.toFixed(2)],
            ["", "", "", "", "", "", "Less: Discount", (-computations.addDisc).toFixed(2)],
            ["", "", "", "", "", "", "Net Sales", computations.netSales.toFixed(2)],
            ["", "", "", "", "", "", "Freight", computations.deliveryFee.toFixed(2)],
            ["", "", "", "", "", "", "Restocking", computations.restockFee.toFixed(2)],
            ["", "", "", "", "", "", "Total Sales", computations.totalSales.toFixed(2)],
            ["", "", "", "", "", "", "VAT (12%)", (-computations.vatAmount).toFixed(2)],
            ["", "", "", "", "", "", "Net of VAT", computations.netOfVat.toFixed(2)],
        ];
        
        if (computations.whtAmount > 0) {
            summaryRows.push(["", "", "", "", "", "", `WHT`, (-computations.whtAmount).toFixed(2)]);
        }
        summaryRows.push(["", "", "", "", "", "", "AMOUNT DUE", computations.totalAmountDue.toFixed(2)]);

        const csvContent = [
            [`Sales Order: ${soNumber || "Draft"}`],
            [`Company: ${company_name || "N/A"}`],
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

    // Header branding
    const isEcoshift = props.quotationType === "Ecoshift Corporation";
    const headerImagePath = isEcoshift ? "/ecoshift-banner.png" : "/disruptive-banner.png";

    // SO Data for preview
    const soData = {
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
    };

    // Validation helpers
    const isStep2Valid = source.trim() !== "";
    const isStep4Valid = callType.trim() !== "";

    // Step 3 Next handler with validation
    const handleNextStep3 = () => {
        if (soAmount.trim() === "" || isNaN(Number(soAmount))) {
            sileo.warning({
                title: "Warning",
                description: "Please enter valid SO Amount.",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
            return;
        }
        handleNext();
    };

    // Step 4 Next handler with validation
    const handleNextStep4 = () => {
        if (callType.trim() === "") {
            sileo.warning({
                title: "Warning",
                description: "Please select Call Type.",
                duration: 4000,
                position: "top-right",
                fill: "black",
                styles: {
                    title: "text-white!",
                    description: "text-white",
                },
            });
            return;
        }
        handleNext();
    };

    const filteredSources =
        typeClient === "CSR Client"
            ? [
                {
                    label: "CSR Inquiry",
                    description: "Customer Service Representative inquiries.",
                },
            ]
            : SO_SOURCES.filter(
                (source) => source.label !== "CSR Inquiry"
            );

    return (
        <>
            {/* STEP 2 — SOURCE */}
            {step === 2 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Source</FieldLabel>
                            <RadioGroup
                                value={source}
                                onValueChange={setSource}
                            >
                                {filteredSources.map(({ label, description }) => (
                                    <FieldLabel key={label}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>

                                                {/* Buttons only visible if selected */}
                                                {source === label && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button type="button" variant="outline" className="rounded-none" onClick={handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button type="button" onClick={handleNext} disabled={!isStep2Valid} className="rounded-none">
                                                            Next <ArrowRight />
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>

                                            {/* RIGHT */}
                                            <RadioGroupItem value={label} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                </div>
            )}

            {/* STEP 3 — SO NUMBER & AMOUNT */}
            {step === 3 && (
                <div>
                    <FieldGroup>
                        {/* SO Amount */}
                        <FieldSet className="mt-3">
                            <FieldLabel className="font-bold">SO Amount</FieldLabel>
                            <p className="text-xs text-muted-foreground mb-1">
                                Total amount of the Sales Order. This should match the approved SO value.
                            </p>
                            <Input
                                type="number"
                                step="0.01"
                                min={0}
                                value={soAmount}
                                onChange={(e) => setSoAmount(e.target.value)}
                                placeholder="Enter SO Amount"
                                className="rounded-none"
                            />
                        </FieldSet>
                    </FieldGroup>

                    <div className="flex justify-between mt-4">
                        <Button variant="outline" className="rounded-none" onClick={handleBack}>
                            <ArrowLeft /> Back
                        </Button>
                        <Button className="rounded-none" onClick={handleNextStep3}>
                            Next <ArrowRight />
                        </Button>
                    </div>
                </div>
            )}

            {/* STEP 4 — CALL TYPE */}
            {step === 4 && (
                <div>
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Type</FieldLabel>

                            <RadioGroup
                                value={callType}
                                onValueChange={setCallType}
                            >
                                {CALL_TYPES.map(({ label, description }) => (
                                    <FieldLabel key={label}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            {/* LEFT */}
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{label}</FieldTitle>
                                                <FieldDescription>{description}</FieldDescription>

                                                {/* Buttons only visible if selected */}
                                                {callType === label && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="rounded-none"
                                                            onClick={handleBack}
                                                        >
                                                            <ArrowLeft /> Back
                                                        </Button>

                                                        <Button
                                                            type="button"
                                                            onClick={handleNextStep4}
                                                            disabled={!isStep4Valid}
                                                            className="rounded-none"
                                                        >
                                                            Next <ArrowRight />
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>

                                            {/* RIGHT */}
                                            <RadioGroupItem value={label} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>
                </div>
            )}


            {/* STEP 5 — REMARKS & STATUS */}
            {step === 5 && (
                <div className="space-y-2">
                    <FieldGroup>
                        <FieldSet>
                            <FieldLabel className="font-bold">Status</FieldLabel>

                            <RadioGroup value={status} onValueChange={props.setStatus}>
                                {[
                                    {
                                        value: "SO-Done",
                                        title: "SO-Done",
                                        desc: "Client was successful and provided with the needed information or support.",
                                    },
                                ].map((item) => (
                                    <FieldLabel key={item.value}>
                                        <Field orientation="horizontal" className="w-full items-start">
                                            <FieldContent className="flex-1">
                                                <FieldTitle>{item.title}</FieldTitle>
                                                <FieldDescription>{item.desc}</FieldDescription>

                                                {/* SO Status dropdown — only when SO-Done is selected */}
                                                {status === "SO-Done" && item.value === "SO-Done" && (
                                                    <div className="mt-3 space-y-2">
                                                        <p className="text-xs font-semibold text-gray-700">Action <span className="text-red-500">*</span></p>
                                                        <select
                                                            value={soStatus}
                                                            onChange={(e) => {
                                                                setSoStatus(e.target.value);
                                                                setPaymentStatus(""); // reset payment status on change
                                                                if (e.target.value !== "Cancelled") setRemarks("");
                                                            }}
                                                            className="w-full h-12 rounded-none border border-gray-200 bg-white px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                                        >
                                                            <option value="">— Select SO Status —</option>
                                                            <option value="Waiting for Payment">Waiting for Payment</option>
                                                            <option value="For Delivery Scheduled">For Delivery Scheduled</option>
                                                            <option value="Convert to SI">Convert to SI</option>
                                                            <option value="Cancelled">Cancelled</option>
                                                        </select>

                                                        {/* Payment Status — only when Convert to SI is selected */}
                                                        {soStatus === "Convert to SI" && (
                                                            <div className="space-y-1.5">
                                                                <p className="text-xs font-semibold text-gray-700">
                                                                    Payment Status <span className="text-red-500">*</span>
                                                                </p>
                                                                <div className="flex gap-2">
                                                                    {["Paid", "With Terms"].map((opt) => (
                                                                        <button
                                                                            key={opt}
                                                                            type="button"
                                                                            onClick={() => setPaymentStatus(opt)}
                                                                            className={`flex-1 h-10 text-xs font-semibold border rounded-none transition-colors ${paymentStatus === opt
                                                                                    ? "bg-gray-900 text-white border-gray-900"
                                                                                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                                                                                }`}
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                                {paymentStatus === "" && (
                                                                    <p className="text-[10px] text-red-500">Please select a payment status.</p>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Remarks — required when Cancelled */}
                                                        {soStatus === "Cancelled" && (
                                                            <div className="space-y-1">
                                                                <p className="text-xs font-semibold text-red-600">
                                                                    Cancellation Reason <span className="text-red-500">*</span>
                                                                </p>
                                                                <Textarea
                                                                    value={remarks}
                                                                    onChange={(e) => setRemarks(e.target.value)}
                                                                    placeholder="Required — enter cancellation reason"
                                                                    className="rounded-none border-red-300 focus:ring-red-300 text-xs"
                                                                />
                                                                {remarks.trim() === "" && (
                                                                    <p className="text-[10px] text-red-500">Remarks are required for cancellation.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {status === item.value && (
                                                    <div className="mt-4 flex gap-2">
                                                        <Button type="button" variant="outline" className="rounded-none" onClick={props.handleBack}>
                                                            <ArrowLeft /> Back
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            className="rounded-none"
                                                            disabled={
                                                                item.value === "SO-Done" && (
                                                                    soStatus.trim() === "" ||
                                                                    (soStatus === "Cancelled" && remarks.trim() === "") ||
                                                                    (soStatus === "Convert to SI" && paymentStatus.trim() === "")
                                                                )
                                                            }
                                                            onClick={handleSave}
                                                        >
                                                            Save <CheckCircle2Icon />
                                                        </Button>
                                                    </div>
                                                )}
                                            </FieldContent>
                                            <RadioGroupItem value={item.value} />
                                        </Field>
                                    </FieldLabel>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                    </FieldGroup>

                </div>
            )}
        </>
    );
}
