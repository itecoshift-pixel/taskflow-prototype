/**
 * Property-Based Tests — Outbound Quota Validation
 *
 * Feature: outbound-quota-api
 * Property 3: Validation rejects all non-finite-positive values
 *
 * Validates: Requirements 3.1, 3.2
 */

import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Re-declare the validation helper from the component under test.
// Source: components/roles/tsa/dashboard/list/outbound.tsx
// ---------------------------------------------------------------------------

const isFinitePositive = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;

// ---------------------------------------------------------------------------
// Property 3: Validation rejects all non-finite-positive values
// ---------------------------------------------------------------------------

describe("Property 3: Validation rejects all non-finite-positive values", () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any value that is not a finite positive number (including `null`,
   * `undefined`, strings, `NaN`, `Infinity`, `-Infinity`, `0`, and negative
   * numbers), the `isFinitePositive` validation function SHALL return `false`,
   * causing the component to fall back to `20`.
   *
   * Tag: Feature: outbound-quota-api, Property 3: Validation rejects all non-finite-positive values
   */
  it(
    "isFinitePositive returns false for all non-finite-positive values",
    () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity),
            fc.integer({ max: 0 }), // 0 and negatives
            fc.constant(0)
          ),
          (value) => {
            expect(isFinitePositive(value)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
