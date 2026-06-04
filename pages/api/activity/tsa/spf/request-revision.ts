import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";

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
                    date_updated: new Date().toISOString(),
                    for_pool_date: new Date().toISOString(),
                    is_pool_finished: false
                })
                .eq("spf_number", spf_number);

            if (requestError) throw requestError;
        }

        // Calculate queue number based on oldest for_pool_date with is_pool_finished = FALSE
        let queueNumber = 1;
        try {
            const { data: queueData, error: queueError } = await supabase
                .from("spf_request")
                .select("id, spf_number, for_pool_date")
                .eq("is_pool_finished", false)
                .order("for_pool_date", { ascending: true });

            if (!queueError && queueData) {
                const currentIndex = queueData.findIndex(item => item.spf_number === spf_number);
                if (currentIndex !== -1) {
                    queueNumber = currentIndex + 1;
                }
            }
        } catch (queueError) {
            console.error("Failed to calculate queue number:", queueError);
            // Default to 1 if queue calculation fails
        }

        // Send system message to collaboration hub when revision is requested
        try {
            // Convert for_pool_date to Asia/Shanghai time
            const forPoolDate = new Date();
            const shanghaiTime = forPoolDate.toLocaleString("en-US", {
                timeZone: "Asia/Shanghai",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true
            });

            const systemMessage = `PROJECT STATUS: YOUR SPF PROJECT HAS BEEN SENT TO Product Development (PD) Department. Pool Date: ${shanghaiTime} (Asia/Shanghai). You are currently on queue number [${queueNumber}].`;

            const docRef = doc(dbCollab, "spf_creations", spf_number);
            try {
                await updateDoc(docRef, {
                    messages: arrayUnion({
                        id: `sys-${Date.now()}`,
                        text: systemMessage,
                        senderId: "system",
                        senderName: "System",
                        role: "system",
                        time: new Date().toISOString(),
                        isSystem: true,
                        seenBy: []
                    })
                });
            } catch (docError: any) {
                // If document doesn't exist, create it
                if (docError.code === 'not-found') {
                    await setDoc(docRef, {
                        messages: [{
                            id: `sys-${Date.now()}`,
                            text: systemMessage,
                            senderId: "system",
                            senderName: "System",
                            role: "system",
                            time: new Date().toISOString(),
                            isSystem: true,
                            seenBy: []
                        }],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    throw docError;
                }
            }
        } catch (firebaseError) {
            console.error("Failed to send system message to collaboration hub:", firebaseError);
            // Don't fail the request if Firebase message fails
        }

        try {
            const forwardedProto = req.headers["x-forwarded-proto"];
            const protocol = typeof forwardedProto === "string" ? forwardedProto : "http";
            const host = req.headers.host;
            const baseUrl =
                process.env.NEXT_PUBLIC_BASE_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");

            await fetch(`${baseUrl}/api/activity/spf/update-queue`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ excludeSpfNumber: spf_number }),
            });
        } catch (queueError) {
            console.error("Failed to update queue numbers:", queueError);
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
