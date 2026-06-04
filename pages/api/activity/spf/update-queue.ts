import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";

type QueueRow = {
  spf_number: string | null;
  for_pool_date: string | null;
};

function formatShanghaiTime(dateIso?: string | null) {
  const date = dateIso ? new Date(dateIso) : new Date();
  return date.toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

async function appendSystemMessage(spfNumber: string, message: string) {
  const docRef = doc(dbCollab, "spf_creations", spfNumber);
  const messagePayload = {
    id: `sys-${Date.now()}`,
    text: message,
    senderId: "system",
    senderName: "System",
    role: "system",
    time: new Date().toISOString(),
    isSystem: true,
    seenBy: [],
  };

  try {
    await updateDoc(docRef, { messages: arrayUnion(messagePayload) });
  } catch (docError: any) {
    if (docError?.code === "not-found") {
      await setDoc(docRef, {
        messages: [messagePayload],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return;
    }
    throw docError;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const excludeSpfNumber: string | undefined =
      typeof req.body?.excludeSpfNumber === "string" ? req.body.excludeSpfNumber : undefined;

    const { data: queueData, error: queueError } = await supabase
      .from("spf_request")
      .select("spf_number, for_pool_date")
      .eq("is_pool_finished", false)
      .not("for_pool_date", "is", null)
      .order("for_pool_date", { ascending: true });

    if (queueError) throw queueError;

    const queue = (queueData || []) as QueueRow[];

    const updates = queue
      .map((row, index) => {
        const spfNumber = row.spf_number?.trim();
        if (!spfNumber) return null;
        if (excludeSpfNumber && spfNumber === excludeSpfNumber) return null;

        const queueNumber = index + 1;
        const shanghaiTime = formatShanghaiTime(row.for_pool_date);
        const systemMessage = `PROJECT STATUS: YOUR SPF PROJECT HAS BEEN SENT TO Product Development (PD) Department. Pool Date: ${shanghaiTime} (Asia/Shanghai). You are currently on queue number [${queueNumber}].`;

        return appendSystemMessage(spfNumber, systemMessage);
      })
      .filter(Boolean) as Promise<void>[];

    await Promise.all(updates);

    return res.status(200).json({
      success: true,
      totalInQueue: queue.length,
      updatedChats: updates.length,
      excluded: excludeSpfNumber || null,
    });
  } catch (err: any) {
    console.error("Update queue error:", err);
    return res.status(500).json({ error: err?.message || "Failed to update queue" });
  }
}

