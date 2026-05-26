import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "PUT") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    try {
        const { spf_number, revision_type, revision_remarks, edited_data } = req.body;

        if (!spf_number) {
            return res.status(400).json({ message: "spf_number is required" });
        }

        const updateData: any = {
            status: "For Revision",
            date_updated: new Date().toISOString()
        };

        if (revision_type) updateData.revision_type = revision_type;
        if (revision_remarks) updateData.revision_remarks = revision_remarks;

        // Update spf_creation table with revision info
        const { data: creationData, error: creationError } = await supabase
            .from("spf_creation")
            .update(updateData)
            .eq("spf_number", spf_number)
            .select()
            .single();

        if (creationError) throw creationError;

        if (!creationData) {
            return res.status(404).json({ message: "No spf_creation record found" });
        }

        // If edited_data is provided, update the spf_request table
        if (edited_data) {
            // Remove status from edited_data to keep spf_request status unchanged
            const { status, ...requestDataWithoutStatus } = edited_data;
            const { error: requestError } = await supabase
                .from("spf_request")
                .update({
                    ...requestDataWithoutStatus,
                    date_updated: new Date().toISOString()
                })
                .eq("spf_number", spf_number);

            if (requestError) throw requestError;
        }

        return res.status(200).json({
            success: true,
            message: "Status updated to For Revision",
            data: creationData
        });
    } catch (err: any) {
        console.error("Server error:", err);
        return res.status(500).json({ message: err.message || "Server error" });
    }
}
