import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

// Admin reference ID — sees ALL records from ALL users with no status restriction
const ADMIN_REFERENCE_ID = "JG-NCR-920587";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const {
    referenceid,
    from,
    to,
    limit = "10",
    page = "1",
    search,
    status,
    type_activity,
    source,
    type_client,
    call_status,
    quotation_status,
  } = req.query;

  if (!referenceid || typeof referenceid !== "string") {
    return res.status(400).json({ message: "Missing or invalid referenceid" });
  }

  // Parse pagination parameters
  const pageNum = Math.max(1, parseInt(typeof page === "string" ? page : "1", 10));
  const limitNum = Math.min(Math.max(1, parseInt(typeof limit === "string" ? limit : "10", 10)), 50);
  const offset = (pageNum - 1) * limitNum;

  // Admin view: sees ALL records from ALL users, no status restriction
  const isAdminView = referenceid === ADMIN_REFERENCE_ID;

  try {
    // Build base query
    let query = supabase
      .from("history")
      .select("*", { count: "exact" })
      .order("date_updated", { ascending: false })
      .order("date_created", { ascending: false });

    if (isAdminView) {
      // Admin: no referenceid filter, no status filter — sees everything
      query = query
        .eq("status", "Quote-Done");
    } else {
      // Regular user: own data only, Quote-Done status only
      query = query
        .eq("referenceid", referenceid)
        .eq("status", "Quote-Done");
    }

    // Apply search filter
    if (search && typeof search === "string") {
      const searchTerm = search.trim();
      if (searchTerm) {
        query = query.or(
          `company_name.ilike.%${searchTerm}%,quotation_number.ilike.%${searchTerm}%,activity_reference_number.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,contact_number.ilike.%${searchTerm}%,email_address.ilike.%${searchTerm}%,remarks.ilike.%${searchTerm}%`
        );
      }
    }

    // Apply filters
    if (status && typeof status === "string" && status !== "all") {
      query = query.eq("status", status);
    }
    if (type_activity && typeof type_activity === "string" && type_activity !== "all") {
      query = query.eq("type_activity", type_activity);
    }
    if (source && typeof source === "string" && source !== "all") {
      query = query.eq("source", source);
    }
    if (type_client && typeof type_client === "string" && type_client !== "all") {
      query = query.eq("type_client", type_client);
    }
    if (call_status && typeof call_status === "string" && call_status !== "all") {
      query = query.eq("call_status", call_status);
    }
    if (quotation_status && typeof quotation_status === "string" && quotation_status !== "all") {
      query = query.eq("quotation_status", quotation_status);
    }

    // Apply date range filter
    if (from && typeof from === "string") {
      query = query.gte("date_created", from);
    }
    if (to && typeof to === "string") {
      query = query.lte("date_created", to);
    }

    // Apply pagination
    query = query.range(offset, offset + limitNum - 1);

    // Execute query
    const { data: historyData, error: historyError, count: totalCount } = await query;

    if (historyError) {
      console.error("History query error:", historyError);
      throw historyError;
    }

    // Fetch revised quotations for PDF configuration
    const quotationNumbers = historyData?.map((item) => item.quotation_number).filter(Boolean) || [];

    // For admin, fetch revised_quotations without referenceid restriction
    let revisedQuery = supabase
      .from("revised_quotations")
      .select("*")
      .in("quotation_number", quotationNumbers.length > 0 ? quotationNumbers : [""]);
    if (!isAdminView) {
      revisedQuery = revisedQuery.eq("referenceid", referenceid);
    }
    const { data: revisedData, error: revisedError } = await revisedQuery;
    if (revisedError) {
      console.error("Revised quotations query error:", revisedError);
    }

    // For admin, fetch signatories without referenceid restriction
    let signatoryQuery = supabase
      .from("signatories")
      .select("*")
      .in("quotation_number", quotationNumbers.length > 0 ? quotationNumbers : [""]);
    if (!isAdminView) {
      signatoryQuery = signatoryQuery.eq("referenceid", referenceid);
    }
    const { data: signatoryData, error: signatoryError } = await signatoryQuery;
    if (signatoryError) {
      console.error("Signatories query error:", signatoryError);
    }

    // Create maps for quick lookup
    const revisedMap = new Map();
    (revisedData || []).forEach((item) => {
      revisedMap.set(item.activity_reference_number || item.quotation_number, item);
    });

    const signaturesMap = new Map();
    (signatoryData || []).forEach((item) => {
      signaturesMap.set(item.quotation_number, item);
    });

    // Filter out items without meaningful data and merge with additional data
    const filteredData = (historyData || [])
      .filter((item) => {
        if (!item || typeof item !== "object") return false;
        const checks = ["activity_reference_number", "referenceid", "quotation_number", "quotation_amount"];
        return checks.some((col) => {
          try {
            const val = item[col as keyof typeof item];
            if (val === null || val === undefined) return false;
            if (typeof val === "string") return val.trim() !== "" && val.trim() !== "-";
            if (typeof val === "number") return !isNaN(val);
            return Boolean(val);
          } catch {
            return false;
          }
        });
      })
      .map((item) => {
        const revised = revisedMap.get(item.activity_reference_number || item.quotation_number);
        const sig = signaturesMap.get(item.quotation_number);

        return {
          ...item,
          // PDF configuration from revised_quotations
          hide_discount_in_preview: revised?.hide_discount_in_preview ?? item.hide_discount_in_preview ?? false,
          show_discount_columns: revised?.show_discount_columns ?? item.show_discount_columns ?? false,
          show_summary_discounts: revised?.show_summary_discounts ?? item.show_summary_discounts ?? false,
          show_profit_margins: revised?.show_profit_margins ?? item.show_profit_margins ?? false,
          margin_alert_threshold: revised?.margin_alert_threshold ?? item.margin_alert_threshold ?? 0,
          show_margin_alerts: revised?.show_margin_alerts ?? item.show_margin_alerts ?? false,
          product_view_mode: revised?.product_view_mode ?? item.product_view_mode ?? "list",
          visible_columns: revised?.visible_columns ?? item.visible_columns ?? null,
          // Signatory data
          agent_signature: sig?.agent_signature || null,
          agent_contact_number: sig?.agent_contact_number || null,
          agent_email_address: sig?.agent_email_address || null,
          tsm_signature: sig?.tsm_signature || null,
          tsm_contact_number: sig?.tsm_contact_number || null,
          tsm_email_address: sig?.tsm_email_address || null,
          manager_signature: sig?.manager_signature || null,
          manager_contact_number: sig?.manager_contact_number || null,
          manager_email_address: sig?.manager_email_address || null,
          tsm_approval_date: sig?.tsm_approval_date || null,
          tsm_remarks: sig?.tsm_remarks || null,
          manager_remarks: sig?.manager_remarks || null,
          manager_approval_date: sig?.manager_approval_date || null,
        };
      });

    // Calculate pagination info
    const totalPages = Math.ceil((totalCount || 0) / limitNum);
    const hasMore = pageNum < totalPages;

    return res.status(200).json({
      activities: filteredData || [],
      totalCount: Math.max(0, totalCount || 0),
      totalPages: Math.max(0, totalPages),
      currentPage: Math.max(1, pageNum),
      itemsPerPage: Math.max(1, limitNum),
      hasMore: Boolean(hasMore),
      offset: Math.max(0, offset),
      isAdminView,
      search_applied: {
        query: typeof search === "string" ? search.trim() : null,
        filters: {
          status: typeof status === "string" ? status : null,
          type_activity: typeof type_activity === "string" ? type_activity : null,
          source: typeof source === "string" ? source : null,
          type_client: typeof type_client === "string" ? type_client : null,
          call_status: typeof call_status === "string" ? call_status : null,
          quotation_status: typeof quotation_status === "string" ? quotation_status : null,
          date_range: {
            from: from || null,
            to: to || null,
          },
        },
      },
      cached: false,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error",
      activities: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      itemsPerPage: 10,
      hasMore: false,
      offset: 0,
    });
  }
}
