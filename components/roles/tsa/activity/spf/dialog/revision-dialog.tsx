"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog, DialogContent, DialogHeader,
    DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RefreshCw, Package, DollarSign, Settings2, Layers, ArrowRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpfCreationData {
    id: number;
    spf_number: string;
    referenceid: string;
    tsm: string;
    manager: string;
    status: string;
    company_name: string;
    supplier_brand: string;
    contact_name: string;
    contact_number: string;
    item_code: string;
    product_offer_image: string;
    product_offer_qty: string;
    product_offer_technical_specification: string;
    product_offer_unit_cost: string;
    product_offer_packaging_details: string;
    product_offer_factory_address: string;
    product_offer_port_of_discharge: string;
    product_offer_subtotal: string;
    product_offer_pcs_per_carton: string;
    final_selling_cost: string;
    final_unit_cost: string;
    final_subtotal: string;
    proj_lead_time: string;
    price_validity: string;
    tds: string;
    dimensional_drawing: string;
    illuminance_drawing: string;
    original_technical_specification: string;
    product_reference_id: string;
    date_created: string;
    date_updated: string;
    spf_creation_start_time: string;
    spf_creation_end_time: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    spf_number: string | null;
    onRequestRevision: (spf_number: string, revision_type: string, revision_remarks: string) => Promise<void>;
}

type RevisionStep = "select-type" | "review-data" | "add-remarks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseRowData = (value: string | null): string[] => {
    if (!value) return [];
    return value.split("|ROW|").map(s => s.trim());
};

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 py-2 border-b border-gray-200 mb-3">
        <Icon className="w-4 h-4 text-gray-500" />
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-700">
            {title}
        </span>
    </div>
);

const Field = ({ label, value }: { label: string, value: string }) => (
    <div className="mb-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase">{label}:</span>
        <p className="text-xs text-gray-800 mt-0.5">{value || "—"}</p>
    </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

const revisionTypes = [
    {
        id: "Price Update",
        title: "Price Update",
        description: "Update only the unit cost for existing products",
        icon: DollarSign,
        color: "green",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        hoverBorder: "hover:border-green-400",
        iconBg: "bg-green-100",
        iconColor: "text-green-600",
        buttonBg: "bg-green-600 hover:bg-green-700"
    },
    {
        id: "Change Item Specs & Qty",
        title: "Change Item Specs & Qty",
        description: "Revise technical specifications and quantity. Quantity cannot be reduced below original.",
        icon: Settings2,
        color: "blue",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        hoverBorder: "hover:border-blue-400",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        buttonBg: "bg-blue-600 hover:bg-blue-700"
    },
    {
        id: "Both",
        title: "Both",
        description: "Update both price and specifications with full edit access",
        icon: Layers,
        color: "orange",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
        hoverBorder: "hover:border-orange-400",
        iconBg: "bg-orange-100",
        iconColor: "text-orange-600",
        buttonBg: "bg-orange-600 hover:bg-orange-700"
    }
];

export function RevisionDialog({ open, onClose, spf_number, onRequestRevision }: Props) {
    const [data, setData] = useState<SpfCreationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<RevisionStep>("select-type");
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [remarks, setRemarks] = useState("");

    useEffect(() => {
        if (!open || !spf_number) {
            setData(null);
            setError(null);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/activity/tsa/spf/fetch-creation?spf_number=${encodeURIComponent(spf_number)}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        setError("No creation record found for this SPF.");
                        return;
                    }
                    throw new Error("Failed to fetch creation data");
                }
                const json = await res.json();
                setData(json.data);
            } catch (err: any) {
                setError(err.message || "Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [open, spf_number]);

    useEffect(() => {
        if (!open) {
            setStep("select-type");
            setSelectedType(null);
            setRemarks("");
            setError(null);
        }
    }, [open]);

    const handleTypeSelect = (typeId: string) => {
        setSelectedType(typeId);
        setStep("review-data");
    };

    const handleContinueToRemarks = () => {
        setStep("add-remarks");
    };

    const handleBack = () => {
        if (step === "review-data") {
            setStep("select-type");
            setSelectedType(null);
        } else if (step === "add-remarks") {
            setStep("review-data");
        }
    };

    const handleSave = async () => {
        if (!spf_number || !selectedType) return;
        setSaving(true);
        try {
            await onRequestRevision(spf_number, selectedType, remarks);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to request revision");
        } finally {
            setSaving(false);
        }
    };

    const renderProductItems = () => {
        if (!data) return null;

        const images = parseRowData(data.product_offer_image);
        const qtys = parseRowData(data.product_offer_qty);
        const specs = parseRowData(data.product_offer_technical_specification);
        const unitCosts = parseRowData(data.product_offer_unit_cost);
        const subtotals = parseRowData(data.product_offer_subtotal);
        const packagings = parseRowData(data.product_offer_packaging_details);
        const factoryAddresses = parseRowData(data.product_offer_factory_address);
        const ports = parseRowData(data.product_offer_port_of_discharge);
        const pcsPerCartons = parseRowData(data.product_offer_pcs_per_carton);
        const companies = parseRowData(data.company_name);
        const brands = parseRowData(data.supplier_brand);
        const contactNames = parseRowData(data.contact_name);
        const contactNumbers = parseRowData(data.contact_number);
        const finalSellingCosts = parseRowData(data.final_selling_cost);
        const finalUnitCosts = parseRowData(data.final_unit_cost);
        const finalSubtotals = parseRowData(data.final_subtotal);
        const leadTimes = parseRowData(data.proj_lead_time);
        const itemCodes = parseRowData(data.item_code);
        const priceValidities = parseRowData(data.price_validity);
        const tdss = parseRowData(data.tds);
        const dimDrawings = parseRowData(data.dimensional_drawing);
        const illumDrawings = parseRowData(data.illuminance_drawing);
        const origSpecs = parseRowData(data.original_technical_specification);
        const prodRefIds = parseRowData(data.product_reference_id);

        const itemCount = Math.max(
            images.length, qtys.length, specs.length, itemCodes.length,
            companies.length, brands.length
        ) || 1;

        return Array.from({ length: itemCount }, (_, i) => (
            <div key={i} className="border border-gray-200 p-3 mb-3 bg-gray-50/50">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-700 mb-2 pb-1 border-b border-gray-200">
                    Item {i + 1}
                </div>

                {images[i] && images[i] !== "-" && (
                    <div className="mb-3">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Product Image:</span>
                        <img
                            src={images[i]}
                            alt={`Product ${i + 1}`}
                            className="mt-1 max-w-[200px] max-h-[150px] object-contain border border-gray-200"
                        />
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                    <Field label="Item Code" value={itemCodes[i]} />
                    <Field label="Qty" value={qtys[i]} />
                    <Field label="Price Validity" value={priceValidities[i]} />
                    <Field label="TDS" value={tdss[i]} />
                    <Field label="Packaging" value={packagings[i]} />
                    <Field label="Port of Discharge" value={ports[i]} />
                </div>

                {specs[i] && specs[i] !== "-" && (
                    <div className="mt-3 p-2 bg-white border border-gray-200">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">Technical Specification:</span>
                        <pre className="text-[10px] text-gray-700 mt-1 whitespace-pre-wrap font-mono">
                            {specs[i].replace(/\|\|/g, "\n").replace(/;;/g, "\n  • ")}
                        </pre>
                    </div>
                )}

                {origSpecs[i] && origSpecs[i] !== "-" && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-100">
                        <span className="text-[10px] font-bold text-blue-600 uppercase">Original Tech Spec:</span>
                        <pre className="text-[10px] text-blue-800 mt-1 whitespace-pre-wrap font-mono">
                            {origSpecs[i].replace(/\|\|/g, "\n").replace(/;;/g, "\n  • ")}
                        </pre>
                    </div>
                )}

                {(dimDrawings[i] && dimDrawings[i] !== "-") || (illumDrawings[i] && illumDrawings[i] !== "-") ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                        {dimDrawings[i] && dimDrawings[i] !== "-" && (
                            <a href={dimDrawings[i]} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline">
                                📐 Dimensional Drawing
                            </a>
                        )}
                        {illumDrawings[i] && illumDrawings[i] !== "-" && (
                            <a href={illumDrawings[i]} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-600 hover:underline">
                                💡 Illuminance Drawing
                            </a>
                        )}
                    </div>
                ) : null}

                {prodRefIds[i] && prodRefIds[i] !== "-" && (
                    <div className="mt-2 text-[10px] text-gray-500">
                        Product Ref ID: {prodRefIds[i]}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden rounded-none">
                <div className="bg-amber-600 px-5 py-4">
                    <DialogTitle className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Request Revision
                    </DialogTitle>
                    <p className="text-amber-100 text-[11px] mt-0.5">
                        {spf_number ? `SPF: ${spf_number}` : ""}
                    </p>
                </div>

                <ScrollArea className="max-h-[60vh]">
                    <div className="px-5 py-4">
                        {loading && (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="w-5 h-5 animate-spin mr-2 text-gray-400" />
                                <span className="text-xs text-gray-500">Loading...</span>
                            </div>
                        )}

                        {error && !loading && (
                            <div className="bg-red-50 border border-red-200 p-4 rounded-none">
                                <p className="text-xs text-red-600">{error}</p>
                            </div>
                        )}

                        {/* STEP 1: Select Revision Type */}
                        {step === "select-type" && !loading && !error && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <RefreshCw className="w-4 h-4 text-amber-600" />
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-800">
                                        Select Revision Type — {spf_number}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {revisionTypes.map((type) => (
                                        <div
                                            key={type.id}
                                            className={`flex items-center justify-between p-4 border-2 ${type.borderColor} ${type.bgColor} ${type.hoverBorder} transition-all cursor-pointer`}
                                            onClick={() => handleTypeSelect(type.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-12 h-12 ${type.iconBg} flex items-center justify-center shrink-0`}>
                                                    <type.icon className={`w-6 h-6 ${type.iconColor}`} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-gray-800">{type.title}</h4>
                                                    <p className="text-[11px] text-gray-500 mt-0.5">{type.description}</p>
                                                </div>
                                            </div>
                                            <button
                                                className={`px-4 py-2 text-xs font-bold text-white ${type.buttonBg} flex items-center gap-1`}
                                                onClick={() => handleTypeSelect(type.id)}
                                            >
                                                Select <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-[10px] text-gray-400 mt-4">
                                    Choose the appropriate revision type based on what needs to be updated. This cannot be changed after selection.
                                </p>
                            </div>
                        )}

                        {/* STEP 2: Review Data */}
                        {step === "review-data" && !loading && !error && data && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-gray-600" />
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-800">
                                            Review Current Data
                                        </span>
                                    </div>
                                    <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 font-semibold">
                                        {selectedType}
                                    </span>
                                </div>

                                {/* Header Info */}
                                <div className="grid grid-cols-4 gap-3 bg-gray-100 p-3">
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">SPF Number</span>
                                        <p className="text-xs font-mono font-semibold">{data.spf_number}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Reference ID</span>
                                        <p className="text-xs font-mono">{data.referenceid}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Status</span>
                                        <p className="text-xs font-semibold">{data.status}</p>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">TSM</span>
                                        <p className="text-xs">{data.tsm}</p>
                                    </div>
                                </div>

                                {/* Product Items */}
                                <SectionHeader icon={Package} title="Product Offer Details" />
                                {renderProductItems()}
                            </div>
                        )}

                        {/* STEP 3: Add Remarks */}
                        {step === "add-remarks" && !loading && !error && data && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4 text-amber-600" />
                                        <span className="text-xs font-black uppercase tracking-widest text-gray-800">
                                            Add Revision Remarks
                                        </span>
                                    </div>
                                    <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 font-semibold">
                                        {selectedType}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                        Remarks / Reason for Revision <span className="text-red-500">*</span>
                                    </label>
                                    <Textarea
                                        value={remarks}
                                        onChange={(e) => setRemarks(e.target.value)}
                                        placeholder="Enter detailed remarks about the revision request..."
                                        className="min-h-[120px] rounded-none text-xs resize-none"
                                    />
                                    <p className="text-[10px] text-gray-400">
                                        Please provide specific details about what needs to be revised.
                                    </p>
                                </div>
                            </div>
                        )}

                        {!loading && !error && !data && step !== "select-type" && (
                            <div className="text-center py-10 text-gray-400">
                                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">No creation data available</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter className="px-5 py-4 border-t border-gray-200 bg-gray-50">
                    <Button
                        variant="outline"
                        onClick={step === "select-type" ? onClose : handleBack}
                        disabled={saving}
                        className="rounded-none h-9 text-xs uppercase font-bold tracking-wider"
                    >
                        {step === "select-type" ? "Cancel" : "Back"}
                    </Button>

                    {step === "review-data" && data && (
                        <Button
                            onClick={handleContinueToRemarks}
                            disabled={saving}
                            className="rounded-none h-9 text-xs uppercase font-black tracking-wider bg-gray-900 hover:bg-gray-800 text-white"
                        >
                            Continue <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                    )}

                    {step === "add-remarks" && (
                        <Button
                            onClick={handleSave}
                            disabled={saving || !remarks.trim()}
                            className="rounded-none h-9 text-xs uppercase font-black tracking-wider bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {saving ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Saving...</>
                            ) : (
                                <><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Request Revision</>
                            )}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
