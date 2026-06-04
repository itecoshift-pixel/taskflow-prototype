// /pages/api/activity/tsa/spf/update.ts
import { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { logAuditTrailWithSession } from "@/lib/auditTrail";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Siguraduhin na PUT method ang ginagamit
    if (req.method !== "PUT") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // Kunin lamang ang ID at ang dalawang fields na kailangang i-update
        const { id, status, noted_by, date_approved_sales_head, referenceid } = req.body;

        // Validation para sa ID
        if (!id) {
            return res.status(400).json({ error: "Missing SPF id" });
        }

        const updateData: any = {
            status,
            noted_by,
        };

        // Set date_approved_sales_head when Sales Head approves
        if (status === "Approved by Sales Head") {
            updateData.date_approved_sales_head = new Date().toISOString();
            updateData.for_pool_date = new Date().toISOString();
            updateData.is_pool_finished = false;
        }

        const { data, error } = await supabase
            .from("spf_request")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        // Calculate queue number based on oldest for_pool_date with is_pool_finished = FALSE
        let queueNumber = 1;
        if (status === "Approved by Sales Head") {
            try {
                const { data: queueData, error: queueError } = await supabase
                    .from("spf_request")
                    .select("id, for_pool_date")
                    .eq("is_pool_finished", false)
                    .order("for_pool_date", { ascending: true });

                if (!queueError && queueData) {
                    const currentIndex = queueData.findIndex(item => String(item.id) === String(id));
                    if (currentIndex !== -1) {
                        queueNumber = currentIndex + 1;
                    }
                }
            } catch (queueError) {
                console.error("Failed to calculate queue number:", queueError);
                // Default to 1 if queue calculation fails
            }
        }

        // Send system message to collaboration hub when approved by Sales Head
        if (status === "Approved by Sales Head" && data.spf_number) {
            try {
                // Convert for_pool_date to Asia/Shanghai time
                const forPoolDate = new Date(data.for_pool_date || new Date());
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

                const docRef = doc(dbCollab, "spf_creations", data.spf_number);
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
        }

        // Update queue numbers for all SPFs in the pool (real-time sync)
        if (status === "Approved by Sales Head") {
            try {
                const forwardedProto = req.headers["x-forwarded-proto"];
                const protocol = typeof forwardedProto === "string" ? forwardedProto : "http";
                const host = req.headers.host;
                const baseUrl =
                    process.env.NEXT_PUBLIC_BASE_URL || (host ? `${protocol}://${host}` : "http://localhost:3000");

                await fetch(`${baseUrl}/api/activity/spf/update-queue`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ excludeSpfNumber: data?.spf_number || null }),
                });
            } catch (queueError) {
                console.error("Failed to update queue numbers:", queueError);
            }
        }

        // Log audit trail for manager SPF status update
        await logAuditTrailWithSession(
            req,
            "update",
            "SPF request",
            id,
            data.spf_number || id,
            `Manager updated SPF status to ${status}`,
            { status, noted_by }
        );

        return res.status(200).json({ 
            success: true, 
            message: "SPF status and signatory updated successfully",
            updated: data 
        });

    } catch (err: any) {
        console.error("SPF Update Error:", err);
        return res.status(500).json({ 
            error: err.message || "Failed to update SPF" 
        });
    }
}
