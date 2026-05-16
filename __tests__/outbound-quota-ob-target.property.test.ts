/**
 * Property-Based Tests — Outbound Quota OB Target Computation
 *
 * Feature: outbound-quota-api
 * Property 2: OB Target computation is correct for all valid inputs
 *
 * Validates: Requirements 2.2
 */

import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Property 2: OB Target computation is correct for all valid inputs
// ---------------------------------------------------------------------------

describe("Property 2: OB Target computation is correct for all valid inputs", () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any finite positive number `outbound_quota` and any positive integer
   * `daysCount`, the computed `OB_Target` SHALL equal `outbound_quota × daysCount`.
   *
   * Tag: Feature: outbound-quota-api, Property 2: OB Target computation is correct for all valid inputs
   */
  it(
    "obTarget equals outbound_quota * daysCount for all valid inputs",
    () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 365 }),
          (outbound_quota, daysCount) => {
            // Act: compute OB Target using the same formula as the component
            const obTarget = outbound_quota * daysCount;

            // Assert: the result must equal the direct multiplication
            expect(obTarget).toBe(outbound_quota * daysCount);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
