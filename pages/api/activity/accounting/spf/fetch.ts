import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { 
    from, 
    to, 
    limit = "10",
    page = "1",
    search,
    status,
    customer,
    salesPerson
  } = req.query;

  // Parse pagination parameters
  const pageNum = Math.max(1, parseInt(typeof page === "string" ? page : "1", 10));
  const limitNum = Math.min(Math.max(1, parseInt(typeof limit === "string" ? limit : "10", 10)), 50);
  const offset = (pageNum - 1) * limitNum;

  try {
    // Build base query for spf_request table - NO referenceid filter to get ALL records
    let query = supabase
      .from("spf_request")
      .select("*", { count: "exact" })
      .order("date_created", { ascending: false })
      .order("spf_number", { ascending: false });

    // Apply search filter
    if (search && typeof search === "string") {
      const searchTerm = search.trim();
      if (searchTerm) {
        query = query.or(`customer_name.ilike.%${searchTerm}%,spf_number.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,contact_number.ilike.%${searchTerm}%,registered_address.ilike.%${searchTerm}%`);
      }
    }

    // Apply customer filter
    if (customer && typeof customer === "string") {
      const customerTerm = customer.trim();
      if (customerTerm) {
        query = query.ilike("customer_name", `%${customerTerm}%`);
      }
    }

    // Apply sales person filter
    if (salesPerson && typeof salesPerson === "string") {
      const salesTerm = salesPerson.trim();
      if (salesTerm) {
        query = query.or(`sales_person.ilike.%${salesTerm}%,prepared_by.ilike.%${salesTerm}%`);
      }
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
    const { data: requestData, error: requestError, count: totalCount } = await query;

    if (requestError) {
      console.error("SPF request query error:", requestError);
      throw requestError;
    }

    // Fetch status and id from spf_creation table for each SPF request
    const spfNumbers = requestData?.map(item => item.spf_number).filter(Boolean) || [];
    let statusMap = new Map();
    let creationIdMap = new Map();
    
    if (spfNumbers.length > 0) {
      let creationQuery = supabase
        .from("spf_creation")
        .select("id, spf_number, status")
        .in("spf_number", spfNumbers);
      
      // Apply status filter if present
      if (status && typeof status === "string" && status.trim()) {
        const statusTerm = status.trim();
        creationQuery = creationQuery.ilike("status", `%${statusTerm}%`);
      }
      
      const { data: creationData, error: creationError } = await creationQuery;
      
      if (creationError) {
        console.error("Error fetching data from spf_creation:", creationError);
      } else if (creationData) {
        statusMap = new Map(creationData.map(item => [item.spf_number, item.status]));
        creationIdMap = new Map(creationData.map(item => [item.spf_number, item.id]));
      }
    }

    // Filter out any SPF requests that don't match the status filter (if status filter is applied)
    let filteredData = requestData || [];
    if (status && typeof status === "string" && status.trim()) {
      filteredData = filteredData.filter(item => statusMap.has(item.spf_number));
    }

    // Merge status and creation id into the data
    const mergedData = (filteredData || []).map(item => ({
      ...item,
      status: statusMap.get(item.spf_number) || item.status || "pending",
      spf_creation_id: creationIdMap.get(item.spf_number) || null
    }));

    // Calculate pagination info
    const finalTotalCount = (status && typeof status === "string" && status.trim()) ? mergedData.length : (totalCount || 0);
    const totalPages = Math.ceil(finalTotalCount / limitNum);
    const hasMore = pageNum < totalPages;

    // Validate and sanitize response data
    const safeResponse = {
      activities: mergedData || [],
      totalCount: Math.max(0, finalTotalCount),
      totalPages: Math.max(0, totalPages),
      currentPage: Math.max(1, pageNum),
      itemsPerPage: Math.max(1, limitNum),
      hasMore: Boolean(hasMore),
      offset: Math.max(0, offset),
      search_applied: {
        query: typeof search === 'string' ? search.trim() : null,
        date_range: {
          from: from || null,
          to: to || null
        }
      },
      cached: false
    };

    return res.status(200).json(safeResponse);
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
      offset: 0
    });
  }
}
