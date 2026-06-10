"use client";

import React, { useState } from "react";
import {//importsss
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface CancelDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    spfNumber: string;
    spfId?: number;
    onConfirm?: (reason: string, customReason?: string) => void;
}

const REASON_OPTIONS = [
    "Client Asked to Cancel",
    "Lead Time Concerns",
    "Agent Asked to Cancel",
];

export const CancelDialog: React.FC<CancelDialogProps> = ({
    open,
    onOpenChange,
    spfNumber,
    spfId,
    onConfirm,
}) => {
    const [selectedReason, setSelectedReason] = useState<string>("");
    const [customReason, setCustomReason] = useState<string>("");

    const handleConfirm = () => {
        if (!selectedReason) {
            alert("Please select a reason");
            return;
        }
        if (selectedReason === "Others" && !customReason.trim()) {
            alert("Please provide a reason");
            return;
        }
        if (onConfirm) {
            onConfirm(selectedReason, selectedReason === "Others" ? customReason : undefined);
        }
        onOpenChange(false);
        setSelectedReason("");
        setCustomReason("");
    };

    const handleCancel = () => {
        onOpenChange(false);
        setSelectedReason("");
        setCustomReason("");
    };

    return (
        <Dialog open={open} onOpenChange={handleCancel}>
            <DialogContent className="rounded-none max-w-sm p-0 overflow-hidden border border-red-200">
                <div className="bg-red-600 px-6 py-4">
                    <DialogTitle className="text-white text-sm font-bold uppercase tracking-widest">
                        DANGER ZONE
                    </DialogTitle>
                </div>
                <div className="px-6 py-6 text-center">
                    <p className="text-sm font-semibold text-zinc-800 mb-4">
                        Do you want to Cancel <span className="text-lg font-bold text-red-600 font-mono">{spfNumber}</span>
                    </p>
                    <div className="space-y-3">
                        <Select value={selectedReason} onValueChange={setSelectedReason}>
                            <SelectTrigger className="rounded-none">
                                <SelectValue placeholder="Select a reason" />
                            </SelectTrigger>
                            <SelectContent>
                                {REASON_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                        {option}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedReason === "Others" && (
                            <Textarea
                                placeholder="Please specify the reason..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                className="rounded-none min-h-20 text-xs"
                            />
                        )}
                    </div>/
                </div>
                <DialogFooter className="flex gap-2 px-6 pb-6">
                    <Button
                        variant="outline"
                        onClick={handleCancel}
                        className="rounded-none h-9 text-xs uppercase font-bold tracking-wider border-zinc-200 flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleConfirm}
                        className="rounded-none h-9 text-xs uppercase font-bold tracking-wider flex-1"
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};