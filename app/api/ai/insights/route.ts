import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();
  const { metrics } = body as { metrics: Record<string, any> };

  if (!metrics) {
    return NextResponse.json({ error: "Missing metrics payload" }, { status: 400 });
  }

  // Build a structured prompt from the dashboard metrics
  const prompt = buildPrompt(metrics);

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a senior sales analytics AI for a Philippine B2B sales team. " +
              "Generate a concise, insightful, and actionable report in Markdown format. " +
              "Use bullet points, bold highlights, and section headers. " +
              "Be specific — mention agent names, numbers, and percentages where available. " +
              "Keep the tone professional but direct. Max 600 words.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return NextResponse.json({ error: `Groq error: ${err}` }, { status: groqRes.status });
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content ?? "No response generated.";

    return NextResponse.json({ report: content });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(m: Record<string, any>): string {
  const fmt = (n: number) => n.toLocaleString("en-PH");
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "N/A");

  const lines: string[] = [
    `## Dashboard Report — ${m.tab?.toUpperCase() ?? "MANAGER"} VIEW`,
    `**Date Range:** ${m.fromDate ?? "—"} to ${m.toDate ?? "—"}`,
    m.viewingName ? `**Viewing:** ${m.viewingName}` : "",
    "",
    "### Database Coverage",
    `- Total Accounts: ${fmt(m.totalAccounts ?? 0)}`,
    `- With Activity: ${fmt(m.coveredAccounts ?? 0)} (${pct(m.coveredAccounts ?? 0, m.totalAccounts ?? 0)})`,
    `- No Activity: ${fmt(m.uncoveredAccounts ?? 0)} (${pct(m.uncoveredAccounts ?? 0, m.totalAccounts ?? 0)})`,
    `- Top 50: ${m.seg?.top50 ?? 0}/${m.denom?.top50 ?? 0}`,
    `- Next 30: ${m.seg?.next30 ?? 0}/${m.denom?.next30 ?? 0}`,
    `- Balance 20: ${m.seg?.balance20 ?? 0}/${m.denom?.bal20 ?? 0}`,
    `- CSR Client: ${m.seg?.csrClient ?? 0}/${m.denom?.csrClient ?? 0}`,
    `- New Client: ${m.seg?.newClient ?? 0}/${m.denom?.newClient ?? 0}`,
    `- TSA Client: ${m.seg?.tsaClient ?? 0}/${m.denom?.tsaClient ?? 0}`,
    "",
    "### Sales Performance",
    `- Total Sales: ₱${fmt(m.totalSales ?? 0)}`,
    `- Outbound Touchbase Count: ${m.outboundDaily ?? 0}`,
    `- New Clients Developed: ${m.newClientCount ?? 0}`,
    "",
    "### Quotation Pipeline",
    `- Pending Client Approval: ${m.pendingClientApproval ?? 0}`,
    `- Order Complete: ${m.orderComplete ?? 0}`,
    `- Convert to SO: ${m.convertToSO ?? 0}`,
    `- Declined: ${m.declined ?? 0}`,
    `- Cancelled: ${m.cancelled ?? 0}`,
    "",
    "### CSR Handling Times",
    `- TSA Response Time: ${m.avgResponseTime ?? "N/A"}`,
    `- Non-Quotation HT: ${m.avgNonQuotationHT ?? "N/A"}`,
    `- Quotation HT: ${m.avgQuotationHT ?? "N/A"}`,
    `- SPF Handling Duration: ${m.avgSpfHT ?? "N/A"}`,
    "",
    "### Overdue Activities",
    m.overdueCount > 0
      ? `- ${m.overdueCount} overdue activities across ${Object.keys(m.overdueByCompany ?? {}).length} companies`
      : "- No overdue activities",
    ...(Object.entries(m.overdueByCompany ?? {}).slice(0, 5).map(
      ([company, count]) => `  - ${company}: ${count}`
    )),
    "",
    "### New Account Development",
    m.newClientCount > 0
      ? `- ${m.newClientCount} new clients in range`
      : "- No new clients in selected range",
    ...(Object.entries(m.newClientByCompany ?? {}).slice(0, 5).map(
      ([company, count]) => `  - ${company}: ${count}`
    )),
    "",
    "---",
    "Based on the above data, provide:",
    "1. **Executive Summary** — 2-3 sentence overview of performance",
    "2. **Key Highlights** — top 3 positive findings",
    "3. **Areas of Concern** — top 3 issues that need attention",
    "4. **Agent Spotlight** — if agent-level data is available, highlight top and bottom performers",
    "5. **Recommendations** — 3 specific, actionable next steps for the team",
  ];

  return lines.filter((l) => l !== null).join("\n");
}
