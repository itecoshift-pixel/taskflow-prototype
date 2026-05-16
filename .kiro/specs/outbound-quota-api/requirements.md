# Requirements Document

## Introduction

This feature replaces the hardcoded outbound call target (`20`) in the `OutboundCallsCard` component with a dynamic value fetched from the `outbound_quota` column in the `customize` table. A new Next.js API route will expose this value, and the component will consume it at runtime so that the target can be updated in the database without requiring a code change.

## Glossary

- **Outbound_Quota_API**: The Next.js API route at `/api/outbound-quota` that reads the `outbound_quota` value from the database.
- **Customize_Table**: The database table named `customize` that stores application-level configuration values, including `outbound_quota`.
- **OutboundCallsCard**: The React client component located at `components/roles/tsa/dashboard/list/outbound.tsx` that displays outbound call statistics for a TSA user.
- **OB_Target**: The computed outbound call target, calculated as `outbound_quota × daysCount`, previously using the hardcoded value `20`.
- **TASKFLOW_DB_URL**: The environment variable holding the Neon database connection string used by all API routes in this project.

---

## Requirements

### Requirement 1: Outbound Quota API Route

**User Story:** As a system administrator, I want the outbound call target to be stored in the database, so that I can update it without modifying application code.

#### Acceptance Criteria

1. THE Outbound_Quota_API SHALL expose a `GET /api/outbound-quota` endpoint.
2. WHEN the `GET /api/outbound-quota` endpoint is called, THE Outbound_Quota_API SHALL query the `outbound_quota` column from the `Customize_Table` and return the value in a JSON response with the shape `{ success: true, outbound_quota: <number> }`.
3. WHEN the `outbound_quota` value is successfully retrieved, THE Outbound_Quota_API SHALL respond with HTTP status `200`.
4. IF the `outbound_quota` row does not exist in the `Customize_Table`, THEN THE Outbound_Quota_API SHALL respond with HTTP status `404` and a JSON body `{ success: false, error: "outbound_quota not found" }`.
5. IF a database error occurs during the query, THEN THE Outbound_Quota_API SHALL respond with HTTP status `500` and a JSON body `{ success: false, error: "Failed to fetch outbound quota" }`.
6. THE Outbound_Quota_API SHALL use the `TASKFLOW_DB_URL` environment variable to establish the database connection via the `@neondatabase/serverless` client.
7. IF `TASKFLOW_DB_URL` is not set at startup, THEN THE Outbound_Quota_API SHALL throw an error to prevent the route from loading with an invalid configuration.

---

### Requirement 2: Dynamic OB Target in OutboundCallsCard

**User Story:** As a TSA user, I want the outbound call target displayed on my dashboard to reflect the value configured in the database, so that the target is always accurate without requiring a deployment.

#### Acceptance Criteria

1. WHEN the `OutboundCallsCard` component mounts, THE OutboundCallsCard SHALL fetch the `outbound_quota` value from `GET /api/outbound-quota`.
2. WHEN the `outbound_quota` value is successfully fetched, THE OutboundCallsCard SHALL compute `OB_Target` as `outbound_quota × daysCount` and use it in place of the previously hardcoded value `20`.
3. WHILE the `outbound_quota` value is being fetched, THE OutboundCallsCard SHALL display a loading indicator or placeholder in the OB Target cell so the user is aware data is loading.
4. IF the fetch request to `GET /api/outbound-quota` fails, THEN THE OutboundCallsCard SHALL fall back to the default value of `20` for `outbound_quota` and continue rendering without crashing.
5. THE OutboundCallsCard SHALL NOT require any new required props to support this change; the quota fetch SHALL be handled internally by the component.

---

### Requirement 3: Data Integrity and Type Safety

**User Story:** As a developer, I want the outbound quota value to be validated before use, so that invalid database values do not cause runtime errors or incorrect calculations.

#### Acceptance Criteria

1. WHEN the API response is received by the `OutboundCallsCard`, THE OutboundCallsCard SHALL validate that `outbound_quota` is a finite positive number before using it in the `OB_Target` calculation.
2. IF the received `outbound_quota` value is not a finite positive number, THEN THE OutboundCallsCard SHALL fall back to the default value of `20` and log a warning to the browser console.
3. THE Outbound_Quota_API SHALL return `outbound_quota` as a numeric type (not a string) in the JSON response.
