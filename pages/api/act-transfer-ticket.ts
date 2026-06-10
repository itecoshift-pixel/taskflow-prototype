import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../utils/supabase";
import { MongoClient } from "mongodb";
import { neon } from "@neondatabase/serverless";
import { logAuditTrailWithSession } from "@/lib/auditTrail";

const MONGODB_URI = process.env.MONGODB_URI!;
const MONGODB_DB = process.env.MONGODB_DB!;
const DATABASE_URL = process.env.TASKFLOW_DB_URL!;

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

async function connectToMongo() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }
  if (!MONGODB_URI) throw new Error("Please define the MONGODB_URI environment variable");
  if (!MONGODB_DB) throw new Error("Please define the MONGODB_DB environment variable");

  const client = new MongoClient(MONGODB_URI, { maxPoolSize: 5, minPoolSize: 1, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });
  await client.connect();
  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let results: { [key: string]: string } = {};

  try {
    let { id, newReferenceID } = req.body;

    if (!id || !newReferenceID) {
      return res.status(400).json({ error: "Missing ID or ReferenceID" });
    }

    id = Number(id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "ID must be a valid number" });
    }

    // Step 1: Get activity record from supabase
    const { data: activityData, error: activityError } = await supabase
      .from("activity")
      .select("ticket_reference_number")
      .eq("id", id)
      .single();

    if (activityError) {
      console.error("Supabase fetch activity error:", activityError);
      return res.status(500).json({ error: activityError.message });
    }

    if (!activityData) {
      return res.status(404).json({ error: "Activity not found" });
    }

    const ticketRef = activityData.ticket_reference_number;
    if (!ticketRef) {
      return res.status(400).json({ error: "Activity missing ticket_reference_number" });
    }
    results.step1 = "Fetched activity ticket_reference_number successfully.";

    // Step 2: Update activity status & date_updated in supabase
    const { error: updateActivityError } = await supabase
      .from("activity")
      .update({
        status: "Transfer",
        date_updated: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateActivityError) {
      console.error("Supabase update activity error:", updateActivityError);
      return res.status(500).json({ error: updateActivityError.message });
    }
    results.step2 = "Updated activity status successfully.";

    // Step 3: Update endorsed-ticket record in supabase
    const { error: endorseError } = await supabase
      .from("endorsed-ticket")
      .update({
        referenceid: newReferenceID,
        status: "Endorsed",
        condition: "Transfer",
        date_transfer: new Date().toISOString(),
        date_updated: new Date().toISOString(),
      })
      .eq("ticket_reference_number", ticketRef);

    if (endorseError) {
      console.error("Supabase update endorsed-ticket error:", endorseError);
      return res.status(500).json({ error: endorseError.message });
    }
    results.step3 = "Updated endorsed-ticket record successfully.";

    // Step 4: Update MongoDB activity document's agent by ticket_reference_number
    const { db } = await connectToMongo();

    const mongoUpdateResult = await db.collection("activity").updateOne(
      { ticket_reference_number: ticketRef },
      { $set: { agent: newReferenceID } }
    );

    if (mongoUpdateResult.matchedCount === 0) {
      console.warn("No MongoDB activity document matched ticket_reference_number:", ticketRef);
      results.step4 = "No matching MongoDB activity document found to update.";
    } else {
      results.step4 = "Updated MongoDB activity agent successfully.";
    }

    // Step 5: Update accounts table in Neon
    // Step 5: Update accounts table in Neon
    const pool = neon(DATABASE_URL);

    // Step 5a: Get account_reference_number from endorsed-ticket using Supabase
    const { data: endorsedTicketData, error: endorsedTicketError } = await supabase
      .from("endorsed-ticket")
      .select("account_reference_number")
      .eq("ticket_reference_number", ticketRef)
      .limit(1)
      .single();

    if (endorsedTicketError) {
      console.error("Supabase fetch endorsed-ticket error:", endorsedTicketError);
      results.step5 = `Error fetching endorsed-ticket: ${endorsedTicketError.message}`;
    } else if (!endorsedTicketData) {
      console.warn("No endorsed-ticket found for ticket_reference_number:", ticketRef);
      results.step5 = "No endorsed-ticket found to update accounts table.";
    } else {
      const accountReferenceNumber = endorsedTicketData.account_reference_number;

      // Step 5b: Update accounts table in Neon using the retrieved account_reference_number
      try {
        await pool.query(
          `UPDATE accounts SET referenceid = $1 WHERE account_reference_number = $2`,
          [newReferenceID, accountReferenceNumber]
        );
        results.step5 = "Updated accounts table account_reference_number successfully.";
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("Neon update accounts error:", error.message);
          results.step5 = `Error updating accounts table: ${error.message}`;
        } else {
          console.error("Neon update accounts error:", error);
          results.step5 = "Error updating accounts table: Unknown error";
        }
      }
    }

    // Log audit trail for ticket transfer
    await logAuditTrailWithSession(
      req,
      "update",
      "ticket transfer",
      ticketRef,
      ticketRef,
      `Transferred ticket to new agent`,
      { newReferenceID, ticketRef }
    );

    return res.status(200).json({ success: true, results });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
