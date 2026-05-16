# Tasks

## Implementation Plan

### Task 1: Create the API route

- [x] 1.1 Create `app/api/outbound-quota/route.ts`
  - Import `NextResponse` from `next/server` and `supabase` from `@/utils/supabase`
  - Implement `GET` handler: query `supabase.from("customize").select("outbound_quota").limit(1).single()`
  - Return `{ success: true, outbound_quota: <number> }` with status 200 on success
  - Return `{ success: false, error: "outbound_quota not found" }` with status 404 if query returns error or no data
  - Return `{ success: false, error: "Failed to fetch outbound quota" }` with status 500 on unexpected error
  - Export `dynamic = "force-dynamic"`

### Task 2: Update the OutboundCallsCard component

- [x] 2.1 Add quota state and fetch logic to `components/roles/tsa/dashboard/list/outbound.tsx`
  - Add `outboundQuota` state (number, default `20`) and `quotaLoading` state (boolean, default `true`)
  - Add inline `isFinitePositive` validation helper
  - Add `useEffect` on mount to fetch `/api/outbound-quota`
  - On success: validate value with `isFinitePositive`; if valid set `outboundQuota`, else fall back to `20` and `console.warn`
  - On fetch error: fall back to `20` and `console.warn`
  - Always set `quotaLoading` to `false` in the finally block

- [x] 2.2 Replace hardcoded `20` with dynamic quota value
  - Change `const obTarget = 20 * daysCount` to `const obTarget = outboundQuota * daysCount`
  - In the OB Target `<TableCell>`, render `"…"` while `quotaLoading` is `true`, otherwise render `{obTarget}`

### Task 3: Write property-based tests

- [x] 3.1 Write property test for Property 1 (API response round-trip)
  - Use `fast-check` to generate random positive integers as `outbound_quota`
  - Mock the Supabase client to return the generated value
  - Assert response shape, `success === true`, `typeof outbound_quota === 'number'`, value equality
  - Run minimum 100 iterations
  - Tag: `Feature: outbound-quota-api, Property 1: API response round-trip preserves the quota value`

- [x] 3.2 Write property test for Property 2 (OB Target computation)
  - Use `fast-check` to generate random positive integers for `outbound_quota` and `daysCount`
  - Assert `outbound_quota * daysCount === obTarget`
  - Run minimum 100 iterations
  - Tag: `Feature: outbound-quota-api, Property 2: OB Target computation is correct for all valid inputs`

- [x] 3.3 Write property test for Property 3 (validation rejects invalid values)
  - Use `fast-check` to generate non-finite-positive values (null, undefined, strings, NaN, Infinity, 0, negatives)
  - Assert `isFinitePositive(value) === false` for all generated values
  - Run minimum 100 iterations
  - Tag: `Feature: outbound-quota-api, Property 3: Validation rejects all non-finite-positive values`

### Task 4: Write unit tests

- [-] 4.1 Write unit tests for the API route
  - Success path: mock DB returns `{ outbound_quota: 25 }`, verify 200 and response body
  - Not found: mock DB returns empty array, verify 404 and error body
  - DB error: mock DB throws, verify 500 and error body

- [ ] 4.2 Write unit tests for the OutboundCallsCard component
  - Loading state: while fetch is pending, OB Target cell shows `"…"`
  - Fetch failure fallback: mock fetch rejects, verify `outboundQuota` defaults to `20`
  - Invalid value fallback: mock fetch resolves with `outbound_quota: -5`, verify fallback to `20`
