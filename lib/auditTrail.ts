// lib/auditTrail.ts
// Audit trail logging utility for tracking CRUD operations

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { parse } from "cookie";

// Types for audit trail
export type AuditAction = "create" | "update" | "delete" | "export" | "action";

/**
 * Extract userId from session cookie in request
 * Works with both pages/api (NextApiRequest) and app/api (Request)
 */
export function getUserIdFromSession(req: any): string | null {
  try {
    let cookieHeader: string | undefined;

    // For NextApiRequest (pages/api)
    if (req.headers?.cookie) {
      cookieHeader = req.headers.cookie;
    }
    // For Request (app/api)
    else if (req.headers?.get) {
      cookieHeader = req.headers.get("cookie") || undefined;
    }

    if (!cookieHeader) return null;

    const cookies = parse(cookieHeader);
    const sessionCookie = cookies.session;

    if (!sessionCookie) return null;

    // Return the userId from session cookie
    return sessionCookie;
  } catch (error) {
    console.error("Error extracting userId from session:", error);
    return null;
  }
}

/**
 * Log audit trail with automatic user identification from session
 * Use this when you want automatic user detection from session cookie
 */
export async function logAuditTrailWithSession(
  req: any,
  action: AuditAction,
  entityType: string,
  entityId?: string,
  entityName?: string,
  details?: string,
  changes?: Record<string, any>
): Promise<void> {
  try {
    const userId = getUserIdFromSession(req);

    if (!userId) {
      console.warn("No session found, skipping audit trail logging");
      return;
    }

    const userInfo = await getUserInfo(userId);

    if (!userInfo) {
      console.error(`Cannot log audit trail: User ${userId} not found in database`);
      return;
    }

    // Extract request info based on request type
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (req.headers?.["x-forwarded-for"]) {
      // NextApiRequest
      ipAddress = req.headers["x-forwarded-for"]?.toString().split(",")[0];
      userAgent = req.headers["user-agent"];
    } else if (req.headers?.get) {
      // App Router Request
      ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] || undefined;
      userAgent = req.headers.get("user-agent") || undefined;
    }

    await logAuditTrail({
      userId,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      email: userInfo.email,
      action,
      entityType,
      entityId,
      entityName,
      details,
      changes,
      department: userInfo.department,
      role: userInfo.role,
      referenceId: userInfo.referenceId,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Error in logAuditTrailWithSession:", error);
  }
}

export interface AuditTrailData {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  action: AuditAction;
  entityType: string; // e.g., "quotation", "activity", "account", "user"
  entityId?: string; // ID of the affected entity
  entityName?: string; // Name/identifier of the entity (e.g., quotation number)
  details?: string; // Additional details about the action
  changes?: Record<string, any>; // For updates - what fields changed
  department?: string;
  role?: string;
  referenceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Get user information from MongoDB by user ID
 * Uses dynamic import to avoid bundling MongoDB in client-side code
 */
export async function getUserInfo(userId: string) {
  try {
    // Dynamic import to prevent client-side bundling of MongoDB
    const { connectToDatabase } = await import("./mongodb");
    const { ObjectId } = await import("mongodb");
    
    if (!ObjectId.isValid(userId)) {
      console.warn(`Invalid userId format for audit trail: ${userId}`);
      return null;
    }

    const db = await connectToDatabase();
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return null;
    }

    return {
      firstName: user.Firstname || "",
      lastName: user.Lastname || "",
      email: user.Email || "",
      department: user.Department || "",
      role: user.Role || "",
      referenceId: user.ReferenceID || "",
    };
  } catch (error) {
    console.error("Error fetching user info for audit trail:", error);
    return null;
  }
}

/**
 * Create a human-readable message for the audit trail
 */
export function createAuditMessage(
  firstName: string,
  lastName: string,
  action: AuditAction,
  entityType: string,
  entityName?: string
): string {
  const fullName = `${firstName} ${lastName}`.trim();

  switch (action) {
    case "create":
      return entityName
        ? `${fullName} has created this ${entityType}: ${entityName}`
        : `${fullName} has created a new ${entityType}`;
    case "update":
      return entityName
        ? `${fullName} has updated this ${entityType}: ${entityName}`
        : `${fullName} has updated a ${entityType}`;
    case "delete":
      return entityName
        ? `${fullName} has deleted this ${entityType}: ${entityName}`
        : `${fullName} has deleted a ${entityType}`;
    case "export":
      return entityName
        ? `${fullName} exported ${entityType} to Excel: ${entityName}`
        : `${fullName} exported ${entityType} to Excel`;
    case "action":
      return entityName
        ? `${fullName} performed action '${entityType}' on: ${entityName}`
        : `${fullName} performed action '${entityType}'`;
    default:
      return `${fullName} performed an action on ${entityType}`;
  }
}

/**
 * Log an audit trail entry to Firebase Firestore
 */
export async function logAuditTrail(data: AuditTrailData): Promise<void> {
  try {
    const message = createAuditMessage(
      data.firstName,
      data.lastName,
      data.action,
      data.entityType,
      data.entityName
    );

    const auditEntry = {
      userId: data.userId,
      firstName: data.firstName,
      lastName: data.lastName,
      fullName: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId || null,
      entityName: data.entityName || null,
      message: message,
      details: data.details || null,
      changes: data.changes || null,
      department: data.department || null,
      role: data.role || null,
      referenceId: data.referenceId || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    };

    await addDoc(collection(db, "audit_trails"), auditEntry);
    console.log(`Audit trail logged: ${message}`);
  } catch (error) {
    console.error("Error logging audit trail:", error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Log audit trail with user ID lookup
 * Use this when you only have the userId and need to fetch user details
 */
export async function logAuditTrailWithLookup(
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId?: string,
  entityName?: string,
  details?: string,
  changes?: Record<string, any>,
  req?: any // Optional request object for IP/user agent
): Promise<void> {
  try {
    const userInfo = await getUserInfo(userId);

    if (!userInfo) {
      console.error(`Cannot log audit trail: User ${userId} not found`);
      return;
    }

    await logAuditTrail({
      userId,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      email: userInfo.email,
      action,
      entityType,
      entityId,
      entityName,
      details,
      changes,
      department: userInfo.department,
      role: userInfo.role,
      referenceId: userInfo.referenceId,
      ipAddress: req?.headers?.["x-forwarded-for"]?.toString().split(",")[0] || req?.socket?.remoteAddress,
      userAgent: req?.headers?.["user-agent"],
    });
  } catch (error) {
    console.error("Error in logAuditTrailWithLookup:", error);
  }
}

/**
 * Helper to extract request info for App Router (Route Handlers)
 * Works with the new Request object format
 */
export function extractAppRequestInfo(req: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  const headers = req.headers;
  return {
    ipAddress: headers.get("x-forwarded-for")?.split(",")[0] || undefined,
    userAgent: headers.get("user-agent") || undefined,
  };
}

/**
 * Log audit trail for App Router routes
 * Automatically extracts userId from session cookie
 */
export async function logAuditTrailApp(
  req: Request,
  action: AuditAction,
  entityType: string,
  entityId?: string,
  entityName?: string,
  details?: string,
  changes?: Record<string, any>
): Promise<void> {
  try {
    const userId = getUserIdFromSession(req);

    if (!userId) {
      console.warn("No session found in request, skipping audit trail logging");
      return;
    }

    const userInfo = await getUserInfo(userId);

    if (!userInfo) {
      console.error(`Cannot log audit trail: User ${userId} not found`);
      return;
    }

    const requestInfo = extractAppRequestInfo(req);

    await logAuditTrail({
      userId,
      firstName: userInfo.firstName,
      lastName: userInfo.lastName,
      email: userInfo.email,
      action,
      entityType,
      entityId,
      entityName,
      details,
      changes,
      department: userInfo.department,
      role: userInfo.role,
      referenceId: userInfo.referenceId,
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
    });
  } catch (error) {
    console.error("Error in logAuditTrailApp:", error);
  }
}

/**
 * Client-side audit logging for Excel exports and button clicks
 * This function calls the API to log audit trails from React components
 * to avoid bundling MongoDB code client-side
 */
export async function logClientAudit(
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId?: string,
  entityName?: string,
  details?: string,
  changes?: Record<string, any>
): Promise<void> {
  try {
    const response = await fetch("/api/audit-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        action,
        entityType,
        entityId,
        entityName,
        details,
        changes,
        ipAddress: typeof window !== "undefined" ? window.location.hostname : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to log client audit:", error);
    }
  } catch (error) {
    console.error("Error in logClientAudit:", error);
  }
}

/**
 * Log Excel export audit from client-side
 * Convenience wrapper for Excel download tracking
 */
export async function logExcelExport(
  userId: string,
  reportType: string,
  recordCount: number,
  filters?: string
): Promise<void> {
  await logClientAudit(
    userId,
    "export",
    "excel_report",
    undefined,
    reportType,
    `Exported ${reportType} with ${recordCount} records${filters ? ` (${filters})` : ""}`
  );
}

/**
 * Log button click action from client-side
 * Convenience wrapper for tracking important button clicks
 */
export async function logButtonAction(
  userId: string,
  actionName: string,
  targetEntity?: string,
  details?: string
): Promise<void> {
  await logClientAudit(
    userId,
    "action",
    actionName,
    undefined,
    targetEntity,
    details
  );
}
