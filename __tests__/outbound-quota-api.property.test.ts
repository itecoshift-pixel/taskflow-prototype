/**
 * Property-Based Tests — Outbound Quota API
 *
 * Feature: outbound-quota-api
 * Property 1: API response round-trip preserves the quota value
 *
 * Validates: Requirements 1.2, 1.3, 3.3
 */

import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Minimal stubs for Next.js server primitives used by the route
// ---------------------------------------------------------------------------

/** Lightweight stand-in for NextResponse.json() */
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
// Mock @/utils/supabase BEFORE importing the route module.
// We use a module-level variable so each test iteration can swap the mock.
// ---------------------------------------------------------------------------

let mockSupabaseData: Record<string, unknown> | null = null;
let mockSupabaseError: unknown = null;

jest.mock("@/utils/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        limit: () => ({
          single: async () => ({
            data: mockSupabaseData,
            error: mockSupabaseError,
          }),
        }),
      }),
    }),
  },
}));

// Mock next/server so NextResponse.json works outside the Next.js runtime.
jest.mock("next/server", () => ({
  NextResponse: {
    json: makeNextResponseJson,
  },
}));

// ---------------------------------------------------------------------------
// Import the route handler AFTER mocks are in place.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require("../app/api/outbound-quota/route") as {
  GET: () => Promise<{ status: number; json: () => Promise<unknown> }>;
};

// ---------------------------------------------------------------------------
// Property 1: API response round-trip preserves the quota value
// ---------------------------------------------------------------------------

describe("Property 1: API response round-trip preserves the quota value", () => {
  /**
   * **Validates: Requirements 1.2, 1.3, 3.3**
   *
   * For any finite positive integer stored as `outbound_quota` in the
   * `customize` table, calling GET /api/outbound-quota with a mock Supabase
   * client returning that value SHALL produce a JSON response where:
   *   - `success` is `true`
   *   - `outbound_quota` is a `number` (not a string)
   *   - its value equals the stored value
   *
   * Tag: Feature: outbound-quota-api, Property 1: API response round-trip preserves the quota value
   */
  it(
    "round-trip: response.outbound_quota equals the value returned by Supabase",
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10000 }),
          async (generatedQuota) => {
            // Arrange: configure the mock Supabase client to return the generated value
            mockSupabaseData = { outbound_quota: generatedQuota };
            mockSupabaseError = null;

            // Act: call the GET handler
            const response = await GET();
            const body = (await response.json()) as {
              success: boolean;
              outbound_quota: unknown;
            };

            // Assert 1: HTTP status is 200
            expect(response.status).toBe(200);

            // Assert 2: success flag is true
            expect(body.success).toBe(true);

            // Assert 3: outbound_quota is a number (not a string)
            expect(typeof body.outbound_quota).toBe("number");

            // Assert 4: value equality — round-trip preserves the quota
            expect(body.outbound_quota).toBe(generatedQuota);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
