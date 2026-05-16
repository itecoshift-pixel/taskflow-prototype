/**
 * Unit Tests — Outbound Quota API
 *
 * Feature: outbound-quota-api
 * Tests the three core code paths of GET /api/outbound-quota:
 *   1. Success path (200)
 *   2. Not found — empty DB result (404)
 *   3. DB error (500)
 */

// ---------------------------------------------------------------------------
// Minimal stub for NextResponse.json used by the route
// ---------------------------------------------------------------------------

function makeNextResponseJson(body: unknown, init?: { status?: number }) {
  const status = init?.status ?? 200;
  return {
    status,
    async json() {
      return body;
    },
  };
}

// ---------------------------------------------------------------------------
// Mock @neondatabase/serverless BEFORE importing the route module.
// ---------------------------------------------------------------------------

let mockSqlImpl: () => Promise<Array<Record<string, unknown>>>;

jest.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const sql = async (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      mockSqlImpl();
    return sql;
  },
}));

// Mock next/server so NextResponse.json works outside the Next.js runtime.
jest.mock("next/server", () => ({
  NextResponse: {
    json: makeNextResponseJson,
  },
}));

// ---------------------------------------------------------------------------
// Provide the required env variable so the module-level guard doesn't throw.
// ---------------------------------------------------------------------------
process.env.TASKFLOW_DB_URL = "postgresql://mock:mock@mock/mock";

// ---------------------------------------------------------------------------
// Import the route handler AFTER mocks are in place.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require("../app/api/outbound-quota/route") as {
  GET: () => Promise<{ status: number; json: () => Promise<unknown> }>;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/outbound-quota — unit tests", () => {
  // 1. Success path
  it("returns 200 and { success: true, outbound_quota: 25 } when DB returns a row", async () => {
    mockSqlImpl = async () => [{ outbound_quota: 25 }];

    const response = await GET();
    const body = (await response.json()) as {
      success: boolean;
      outbound_quota: unknown;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, outbound_quota: 25 });
  });

  // 2. Not found
  it("returns 404 and { success: false, error: 'outbound_quota not found' } when DB returns empty array", async () => {
    mockSqlImpl = async () => [];

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ success: false, error: "outbound_quota not found" });
  });

  // 3. DB error
  it("returns 500 and { success: false, error: 'Failed to fetch outbound quota' } when DB throws", async () => {
    mockSqlImpl = async () => {
      throw new Error("connection refused");
    };

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: "Failed to fetch outbound quota",
    });
  });
});
