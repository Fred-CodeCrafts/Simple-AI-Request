# Requirements Document

## Introduction

The AI Access Portal is a web application that lets employees (requesters) submit batches of AI tool access requests without logging in, and lets authenticated administrators review, approve, or decline those requests. The system is built on React + TypeScript + Tailwind CSS + shadcn/ui on the frontend, with Supabase (PostgreSQL, Auth, Edge Functions) as the backend. The portal comprises two distinct surfaces: a fully public requester portal and a secured admin portal. Actual AI tool provisioning is out of scope.

---

## Glossary

- **Portal**: The overall AI Access Request and Approval web application.
- **Requester_Portal**: The public-facing surface of the Portal — no authentication required.
- **Admin_Portal**: The authenticated surface of the Portal accessible only to users with the `admin` role.
- **Requester**: Any user of the Requester_Portal who submits a batch of access requests on behalf of employees.
- **Admin**: An authenticated user with `profiles.role = 'admin'` who manages batches and reference data.
- **Batch**: A `request_batches` record grouping one or more Access_Requests for a single department and AI tool, submitted in a single operation.
- **Access_Request**: An `access_requests` record representing one employee's request for access to a specific AI tool.
- **Reference_Number**: A unique, opaque alphanumeric identifier generated for each Batch at submission time.
- **Edge_Function**: A server-side Supabase Edge Function that executes privileged operations (batch submission, bulk decisions) — never exposes the service-role key to the browser.
- **Submit_Batch_Function**: The Edge Function exposed at `POST /submit-batch`.
- **Decide_Batch_Function**: The Edge Function exposed at `POST /decide-batch`.
- **Batch_Status**: The computed state of a Batch: `pending`, `partially_decided`, `approved`, `declined`, or `completed`.
- **RLS**: Row Level Security — PostgreSQL policies that enforce access control at the database layer.
- **Import_File**: An `.xlsx` or `.csv` file uploaded by the Requester to populate employee rows.
- **Formula_Injection**: A cell value in an Import_File that begins with `=`, `+`, `-`, or `@`.
- **Name_Snapshot**: A denormalised copy of a department or AI tool name stored on the Batch at submission time to preserve historical accuracy.
- **Validator**: The client-side and server-side logic that checks `EmployeeRowDraft` fields against defined rules.
- **Audit_Log**: The `audit_logs` table that records all admin decisions with actor, action, entity, and detail snapshot.

---

## Requirements

### Requirement 1: Batch Submission — Public Requester Portal

**User Story:** As a Requester, I want to submit a batch of employee AI access requests without creating an account, so that I can quickly request access on behalf of my team.

#### Acceptance Criteria

1. THE Requester_Portal SHALL allow any user with the URL to access the request form without authentication.
2. WHEN the request form loads, THE Requester_Portal SHALL display only departments and AI tools that have `is_active = true` in their respective selectors.
3. WHEN a Requester submits a Batch, THE Requester_Portal SHALL send the payload to the Submit_Batch_Function via `POST /submit-batch`.
4. WHEN the Submit_Batch_Function receives a submission payload, THE Submit_Batch_Function SHALL validate that the referenced `department_id` corresponds to a department with `is_active = true` before inserting records.
5. WHEN the Submit_Batch_Function receives a submission payload, THE Submit_Batch_Function SHALL validate that the referenced `ai_tool_id` corresponds to an AI tool with `is_active = true` before inserting records.
6. IF all validation passes, THEN THE Submit_Batch_Function SHALL insert one `request_batches` record with `status = 'pending'` and a unique Reference_Number; IF the subsequent `access_requests` bulk insert fails, THEN THE Submit_Batch_Function SHALL roll back the `request_batches` record and return an error.
7. WHEN the Submit_Batch_Function successfully inserts a Batch, THE Submit_Batch_Function SHALL return HTTP 201 with the Reference_Number.
8. WHEN the Requester_Portal receives a successful submission response, THE Requester_Portal SHALL navigate to a confirmation page and display the Reference_Number.
9. WHEN a Requester submits a Batch, THE Submit_Batch_Function SHALL record a Name_Snapshot of the selected department name and AI tool name on the `request_batches` record at the time of insertion.
10. IF the `access_requests` bulk insert fails after the `request_batches` record has been inserted, THEN THE Submit_Batch_Function SHALL roll back the `request_batches` record so no orphaned batch exists.

---

### Requirement 2: Batch Submission Validation

**User Story:** As a Requester, I want the system to validate my submission and show me clear errors, so that I can correct mistakes before they are stored.

#### Acceptance Criteria

1. WHEN a Requester attempts to submit a Batch with any required field (department, AI tool, or any employee row field) missing or empty, THE Requester_Portal SHALL prevent submission and display a field-level validation error identifying each missing field.
2. WHEN a Requester attempts to submit a Batch with a text field exceeding its defined maximum character length (255 characters for `employeeFullName` and `position`; 2000 characters for `employeeJustification`, `aiUsageJustification`, and `expectedImpact`), THE Requester_Portal SHALL prevent submission and display a validation error naming the field and its specific limit.
3. WHEN a Requester attempts to submit a Batch with zero employee rows, THE Requester_Portal SHALL prevent submission and display an error indicating that at least one employee row is required.
4. WHEN a Requester attempts to submit a Batch with more than 200 employee rows, THE Requester_Portal SHALL prevent submission client-side and display an error; IF the payload reaches the Submit_Batch_Function with more than 200 rows, THEN THE Submit_Batch_Function SHALL reject the request with HTTP 422 and the message "Too many employee rows".
5. WHEN the Submit_Batch_Function receives a `department_id` or `ai_tool_id` that does not correspond to an active record, THE Submit_Batch_Function SHALL return HTTP 422 with the message "Invalid department or AI tool selection".
6. WHEN a submitted field value exceeds its maximum length (255 characters for name/position fields; 2000 characters for justification/impact fields), THE Submit_Batch_Function SHALL return HTTP 422 with a field-level error identifying the field name and its limit.
7. IF an internal server error occurs during batch insertion, THEN THE Submit_Batch_Function SHALL return HTTP 500 with the message "Submission failed. Please try again." and SHALL NOT include internal error details in the response.
8. WHEN the Validator receives any `EmployeeRowDraft` input — including objects with missing keys or oversized strings — THE Validator SHALL return a field-level error map and SHALL NOT throw an exception.
9. WHEN the Validator receives an `EmployeeRowDraft` where `employeeFullName`, `position`, `employeeJustification`, `aiUsageJustification`, or `expectedImpact` is empty or whitespace-only, THE Validator SHALL include a non-empty error entry for each such field in the returned error map.
10. WHEN the Validator receives an `EmployeeRowDraft` where all required fields are non-empty, `employeeFullName` and `position` are at most 255 characters, and `employeeJustification`, `aiUsageJustification`, and `expectedImpact` are each at most 2000 characters, THE Validator SHALL return an empty error map.
11. WHEN the Submit_Batch_Function returns HTTP 422 with field-level errors, THE Requester_Portal SHALL display the server-returned error messages to the Requester so they can correct the specific fields identified.

---

### Requirement 3: Excel / CSV Import

**User Story:** As a Requester, I want to import employee data from an Excel or CSV file, so that I can populate many rows quickly without manual entry.

#### Acceptance Criteria

1. THE Requester_Portal SHALL provide a downloadable Excel template that matches the required employee row fields.
2. WHEN a Requester uploads a file, THE Requester_Portal SHALL accept only files with MIME type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`.xlsx`) or `text/csv` (`.csv`), a maximum file size of 2 MB, and a maximum of 500 data rows (excluding the header row).
3. IF a Requester uploads a file that exceeds the 2 MB size limit, THEN THE Requester_Portal SHALL reject the file client-side before any server interaction and display the error "File exceeds the 2 MB limit". IF a Requester uploads a file with an unsupported MIME type, THEN THE Requester_Portal SHALL reject the file and display the error "Unsupported file type. Please upload an .xlsx or .csv file". IF a Requester uploads a file with more than 500 data rows, THEN THE Requester_Portal SHALL reject the file and display the error "File contains too many rows. Maximum is 500".
4. WHEN a Requester uploads a valid Import_File, THE Requester_Portal SHALL parse the file and display an import preview modal showing all parsed rows and any row-level validation errors before allowing confirmation.
5. IF the import preview contains zero rows that passed validation, THEN THE Requester_Portal SHALL disable the confirmation action and display a message indicating that no valid rows are available to import. WHEN the import preview is confirmed by the Requester, THE Requester_Portal SHALL add only the rows that passed validation to the employee table.
6. WHEN parsing an Import_File, THE Requester_Portal SHALL inspect every cell value; IF a cell value begins with `=`, `+`, `-`, or `@`, THEN THE Requester_Portal SHALL flag that row in the preview with a distinct Formula_Injection indicator (visually distinct from row-level validation errors) and SHALL NOT include that row's data in the final submission payload.
7. WHEN a valid `.xlsx` or `.csv` file within the accepted size and row limits is parsed successfully, THE Requester_Portal SHALL display the import preview modal without a parse-level error; IF parsing fails for any reason other than file rejection, THEN THE Requester_Portal SHALL display a descriptive parse error and close the preview modal.
8. IF a Requester uploads an Import_File that contains zero data rows (only a header or completely empty), THEN THE Requester_Portal SHALL reject the file client-side and display the error "File contains no data rows".

---

### Requirement 4: Reference Number Generation and Confirmation

**User Story:** As a Requester, I want to receive a unique reference number after submitting a batch, so that I can track my submission.

#### Acceptance Criteria

1. WHEN the Submit_Batch_Function inserts a new Batch, THE Submit_Batch_Function SHALL generate a Reference_Number that matches the format: a fixed 3-character uppercase alphabetic prefix (e.g., `REQ`) followed by a hyphen and 8 uppercase alphanumeric characters (e.g., `REQ-A1B2C3D4`), totalling 12 visible characters.
2. THE Submit_Batch_Function SHALL guarantee that the Reference_Number is unique across all existing `request_batches` records; IF a collision is detected, THEN THE Submit_Batch_Function SHALL regenerate until a unique value is obtained.
3. WHEN the confirmation page is displayed, THE Requester_Portal SHALL show the Reference_Number in a visually prominent, clearly labelled element (e.g., large bold text under a "Your reference number" heading) so that the Requester can easily read and record it.
4. THE Portal SHALL NOT expose any public API endpoint that accepts a Reference_Number to retrieve submission details.
5. IF the Submit_Batch_Function fails to generate a unique Reference_Number after a defined maximum number of retries, THEN THE Submit_Batch_Function SHALL return HTTP 500 with the message "Submission failed. Please try again." and SHALL NOT insert any records.

---

### Requirement 5: Admin Authentication

**User Story:** As an Admin, I want to sign in with my email and password, so that I can securely access the Admin_Portal.

#### Acceptance Criteria

1. THE Admin_Portal SHALL provide a sign-in page at `/admin/login` that accepts email and password credentials via Supabase Auth.
2. WHEN an Admin provides valid credentials, THE Admin_Portal SHALL retrieve the Admin's profile; IF the profile exists and `profiles.role = 'admin'`, THEN THE Admin_Portal SHALL redirect to `/admin/dashboard`; IF the profile does not exist or `profiles.role` is not `'admin'`, THEN THE Admin_Portal SHALL sign out the session and display the error "Insufficient permissions".
3. WHEN an Admin provides invalid credentials (wrong email or password), THE Admin_Portal SHALL display the error "Invalid email or password" and SHALL NOT redirect.
4. WHEN an unauthenticated user attempts to access any Admin_Portal route other than `/admin/login`, THE Admin_Portal SHALL redirect them to `/admin/login`.
5. IF an authenticated user's `profiles.role` is not `'admin'`, THEN any Admin_Portal resource request SHALL be rejected with a 403 error message "Insufficient permissions".
6. THE Admin_Portal SHALL NOT provide a public self-registration path; admin role assignment SHALL only be performed via direct SQL `INSERT` into `profiles` by a trusted operator.
7. WHEN an Admin session expires or the Admin signs out, THE Admin_Portal SHALL invalidate the session token and redirect to `/admin/login`; subsequent attempts to access protected routes with the invalidated token SHALL be rejected.

---

### Requirement 6: Admin — Batch List and Detail

**User Story:** As an Admin, I want to browse submitted batches and view their details, so that I can manage access requests efficiently.

#### Acceptance Criteria

1. WHEN an Admin navigates to `/admin/batches`, THE Admin_Portal SHALL display a paginated list of Batches showing between 25 and 50 rows inclusive per page, ordered by `submitted_at` descending.
2. WHEN an Admin views the Batch list, THE Admin_Portal SHALL display for each Batch: Reference_Number, department name snapshot, AI tool name snapshot, submission date, Batch_Status, and total request count.
3. WHEN an Admin selects a Batch from the list, THE Admin_Portal SHALL navigate to `/admin/batches/:id`; THE Admin_Portal SHALL NOT fetch Access_Requests for that Batch until the detail page is opened.
4. WHEN an Admin views a Batch detail page, THE Admin_Portal SHALL display for each Access_Request: employee full name, position, employee justification, AI usage justification, expected impact, current status; and for decided requests: decision note (blank if null), decided-by admin name, and decision date.
5. WHILE a Batch has `status` in `{'approved', 'declined', 'completed'}` (finalized), THE Admin_Portal SHALL display all decision fields as read-only and SHALL NOT render the Approve button, Decline button, or bulk decision controls for any request in that Batch.

---

### Requirement 7: Admin — Individual Request Decisions

**User Story:** As an Admin, I want to approve or decline individual access requests within a batch, so that I can make granular decisions per employee.

#### Acceptance Criteria

1. WHEN an Admin clicks "Approve" or "Decline" on an Access_Request row with `status = 'pending'`, THE Admin_Portal SHALL update `access_requests.status`, `decided_by`, and `decided_at` for that row; the `decision_note` field SHALL be optional and, if provided, SHALL NOT exceed 500 characters.
2. WHEN an individual request decision is saved, THE Admin_Portal SHALL trigger recalculation of the parent Batch's Batch_Status according to the transition rules.
3. WHEN an Admin attempts to decide a request belonging to a finalized Batch, THE Admin_Portal SHALL reject the action and display the error "Batch is already finalized"; the Access_Request row SHALL remain unchanged.
4. WHEN an individual decision update is successfully persisted, THE Admin_Portal SHALL update only the affected Access_Request row and the Batch status indicator in the current view without a full page reload.
5. WHEN an individual decision update fails to persist (network or server error), THE Admin_Portal SHALL display an error message and revert the Access_Request row to its pre-decision state.

---

### Requirement 8: Admin — Bulk Batch Decisions

**User Story:** As an Admin, I want to approve or decline all pending requests in a batch at once, so that I can process large batches efficiently.

#### Acceptance Criteria

1. WHEN an Admin clicks "Approve All Pending" or "Decline All Pending", THE Admin_Portal SHALL display a confirmation dialog that shows the count of pending requests that will be affected before proceeding.
2. WHEN an Admin confirms a bulk decision, THE Admin_Portal SHALL call the Decide_Batch_Function via `POST /decide-batch` with `{batch_id, decision, note}`; the `note` field SHALL NOT exceed 500 characters.
3. THE Decide_Batch_Function SHALL verify the caller has the `admin` role on every bulk decision request before executing any updates.
4. WHEN the Decide_Batch_Function executes a bulk decision, THE Decide_Batch_Function SHALL atomically update all `access_requests` with `status = 'pending'` for the given `batch_id` to the specified decision and recalculate and update `request_batches.status` in the same transaction; IF any part of the transaction fails, THEN no records SHALL be modified.
5. WHEN the Decide_Batch_Function completes successfully, THE Decide_Batch_Function SHALL return HTTP 200 with `{updated_count}`.
6. IF a bulk action is requested on a Batch with no pending requests, THEN THE Decide_Batch_Function SHALL return HTTP 422 with the message "No pending requests to act on".
7. WHEN a bulk decision is completed, THE Admin_Portal SHALL refresh the Batch detail view to reflect the updated statuses.
8. IF the caller does not have `profiles.role = 'admin'`, THEN THE Decide_Batch_Function SHALL return HTTP 403 with the message "Insufficient permissions" and SHALL NOT execute any updates.
9. IF a bulk decision is requested on a finalized Batch (status in `{'approved', 'declined', 'completed'}`), THEN THE Decide_Batch_Function SHALL return HTTP 409 with the message "Batch is already finalized" and SHALL NOT execute any updates.

---

### Requirement 9: Batch Status State Machine

**User Story:** As an Admin, I want the system to automatically compute the correct batch status as decisions are recorded, so that I always know the state of a batch at a glance.

#### Acceptance Criteria

1. WHEN a Batch is first inserted, THE Submit_Batch_Function SHALL set its status to `'pending'`.
2. WHEN any individual or bulk decision write completes for a Batch, IF at least one Access_Request has `status` in `{'approved', 'declined'}` and at least one has `status = 'pending'`, THEN THE Portal SHALL set the Batch_Status to `'partially_decided'`.
3. WHEN any individual or bulk decision write completes for a Batch, IF all Access_Requests have `status = 'approved'` and none have `status = 'pending'`, THEN THE Portal SHALL set the Batch_Status to `'approved'`.
4. WHEN any individual or bulk decision write completes for a Batch, IF all Access_Requests have `status = 'declined'` and none have `status = 'pending'`, THEN THE Portal SHALL set the Batch_Status to `'declined'`.
5. WHEN any individual or bulk decision write completes for a Batch, IF all Access_Requests have a status in `{'approved', 'declined'}` and the set includes at least one `'approved'` and at least one `'declined'`, THEN THE Portal SHALL set the Batch_Status to `'completed'`.
6. WHEN a Batch transitions to `'approved'`, `'declined'`, or `'completed'`, THE Portal SHALL set `finalized_at` to the current timestamp; `finalized_at` SHALL NOT be overwritten on any subsequent operation.
7. WHEN a Batch has `finalized_at` set (i.e., its status is `'approved'`, `'declined'`, or `'completed'`), THE Decide_Batch_Function and the individual-decision path SHALL reject any attempt to update `status`, `decision_note`, `decided_by`, or `decided_at` on Access_Requests belonging to that Batch.

---

### Requirement 10: Row Level Security

**User Story:** As a system operator, I want all database tables protected by Row Level Security, so that data access is enforced at the database layer regardless of client behavior.

#### Acceptance Criteria

1. THE Portal SHALL enable RLS on all six tables: `profiles`, `departments`, `ai_tools`, `request_batches`, `access_requests`, and `audit_logs`.
2. WHILE the database connection uses the `anon` role, THE Portal SHALL permit SELECT only on active `departments` and `ai_tools` records (via a public view); SELECT on `request_batches`, `access_requests`, `profiles`, and `audit_logs` SHALL return an empty result set; and INSERT, UPDATE, or DELETE on any of the six tables SHALL be rejected.
3. WHILE the database connection uses a JWT with `profiles.role = 'admin'`, THE Portal SHALL permit full CRUD on `departments` and `ai_tools`; SELECT and UPDATE (but NOT DELETE) on `request_batches` and `access_requests`; SELECT of the admin's own `profiles` record (where `profiles.id` matches the authenticated user's identity from the JWT); and SELECT and INSERT on `audit_logs`.
4. THE Portal SHALL route all INSERT operations on `request_batches` and `access_requests` through Edge_Functions that hold the service-role key server-side; the service-role key SHALL NOT appear in browser-delivered code.
5. WHEN a query against `request_batches` or `access_requests` is executed using the `anon` role (no JWT), THE Portal SHALL return an empty result set regardless of the filter applied.

---

### Requirement 11: Security Controls

**User Story:** As a system operator, I want the system to enforce rate limiting, input validation, and CORS restrictions, so that the public endpoint is protected against abuse.

#### Acceptance Criteria

1. IF the Submit_Batch_Function receives more than 10 submission requests from a single IP address within a 60-second window, THEN THE Submit_Batch_Function SHALL return HTTP 429 with the message "Too many requests" for each request beyond the threshold and SHALL NOT insert any records.
2. THE Submit_Batch_Function SHALL validate all string lengths, UUIDs, row counts, and enum values before any database write; IF any value is invalid, THEN THE Submit_Batch_Function SHALL return HTTP 422 with an error message that names the specific field or constraint that was violated.
3. IF a request to an Edge_Function includes an `Origin` header that does not match the Portal's configured origin, THEN THE Edge_Function SHALL return HTTP 403 and SHALL NOT process the request.
4. THE Portal SHALL use only the Supabase `anon` key in browser-delivered code; the service-role key SHALL only be accessible within Edge_Functions.

---

### Requirement 12: Admin — Reference Data Management

**User Story:** As an Admin, I want to create, update, and deactivate departments and AI tools, so that requesters always see an up-to-date list of valid options.

#### Acceptance Criteria

1. WHEN an Admin navigates to `/admin/departments`, THE Admin_Portal SHALL display all departments with their name and active status.
2. WHEN an Admin creates a new department, THE Admin_Portal SHALL validate that the name is non-empty, does not exceed 100 characters, and is unique in a case-insensitive comparison; IF the name already exists (case-insensitively), THEN THE Admin_Portal SHALL reject the operation with the error "Name already exists".
3. WHEN an Admin deactivates a department, THE Admin_Portal SHALL set `is_active = false`; the department SHALL no longer appear in the public department selector. WHEN an Admin reactivates a department, THE Admin_Portal SHALL set `is_active = true`; the department SHALL appear in the public department selector.
4. WHEN an Admin navigates to `/admin/ai-tools`, THE Admin_Portal SHALL display all AI tools with their name, description, and active status.
5. WHEN an Admin creates a new AI tool, THE Admin_Portal SHALL validate that the name is non-empty, does not exceed 100 characters, and is unique in a case-insensitive comparison; IF the name already exists (case-insensitively), THEN THE Admin_Portal SHALL reject the operation with the error "Name already exists".
6. WHEN an Admin deactivates an AI tool, THE Admin_Portal SHALL set `is_active = false`; the AI tool SHALL no longer appear in the public AI tool selector. WHEN an Admin reactivates an AI tool, THE Admin_Portal SHALL set `is_active = true`; the AI tool SHALL appear in the public AI tool selector.
7. WHEN an Admin renames a department, THE Admin_Portal SHALL validate that the new name is non-empty, does not exceed 100 characters, and is unique in a case-insensitive comparison among all departments (excluding the record being renamed); IF the new name already exists, THEN THE Admin_Portal SHALL reject the operation with the error "Name already exists".
8. WHEN an Admin renames an AI tool, THE Admin_Portal SHALL validate that the new name is non-empty, does not exceed 100 characters, and is unique in a case-insensitive comparison among all AI tools (excluding the record being renamed); IF the new name already exists, THEN THE Admin_Portal SHALL reject the operation with the error "Name already exists".

---

### Requirement 13: Audit Logging

**User Story:** As a system operator, I want all admin decisions recorded in an audit log, so that I can trace who approved or declined requests and when.

#### Acceptance Criteria

1. WHEN an Admin records an individual request decision, THE Portal SHALL insert a record into `audit_logs` containing: `actor_user_id` (the Admin's UUID), `action` (one of `'approve'` or `'decline'`), `entity_type` (`'access_request'`), `entity_id` (the Access_Request UUID), and a JSON `details` snapshot containing `{previous_status, new_status, decision_note, decided_at}`.
2. WHEN an Admin executes a bulk decision, THE Portal SHALL insert a record into `audit_logs` containing: `actor_user_id`, `action` (one of `'bulk_approve'` or `'bulk_decline'`), `entity_type` (`'request_batch'`), `entity_id` (the Batch UUID), and a JSON `details` snapshot containing `{updated_count, decision_note, batch_status_before, batch_status_after}`.
3. WHEN an Admin navigates to the audit log view, THE Admin_Portal SHALL display log entries ordered by `created_at` descending (newest first), with a page size of 25; IF the Admin selects a filter by `entity_type` or `entity_id`, THEN THE Admin_Portal SHALL apply that filter to the query; IF the Admin selects a date-range filter on `created_at`, THEN THE Admin_Portal SHALL apply that filter to the query.
4. THE Portal SHALL NOT permit the `anon` role to SELECT from `audit_logs`.

---

### Requirement 14: Design System and Accessibility

**User Story:** As a product owner, I want the Portal to use the defined design system consistently, so that the application has a coherent and professional appearance.

#### Acceptance Criteria

1. THE Portal SHALL use the defined design palette (red `#B91C1C`, dark red `#991B1B`, white `#FFFFFF`, light gray `#F3F4F6`, border gray `#E5E7EB`, medium gray `#9CA3AF`, dark gray `#374151`, near-black `#111827`) via shadcn/ui's token system; no other accent colors (blue, green, purple, or gradients) SHALL appear on any surface.
2. THE Portal SHALL render all interactive controls using shadcn/ui component primitives (Dialog, Table, Select, Button, Badge, etc.).
3. WHEN an Admin views any Admin_Portal page, THE Admin_Portal SHALL display a sidebar navigation linking to Dashboard, Batch List, Departments, AI Tools, and Account pages; the link corresponding to the current page SHALL be visually distinguished from inactive links.
4. WHEN the Batch list contains more than 50 rows, THE Admin_Portal SHALL display pagination controls allowing the Admin to navigate between pages of 25–50 rows.
5. WHEN an import preview contains more than 100 rows, THE Requester_Portal SHALL render the preview list using a virtualised list component.
6. THE Portal SHALL implement the following accessibility requirements: all interactive elements SHALL be keyboard-navigable and SHALL display a visible focus indicator; all form inputs SHALL have associated `<label>` elements or `aria-label` attributes; all icon-only buttons SHALL include `aria-label` text; and status indicators SHALL not rely on color alone (they SHALL include an explicit text label or icon).

---

### Requirement 15: Performance

**User Story:** As a user, I want the Portal to respond quickly even with large data sets, so that I can complete my work without delay.

#### Acceptance Criteria

1. THE Admin_Portal SHALL paginate the Batch list with a fixed page size of 25 records per page.
2. WHEN an Admin opens the Batch list page, THE Admin_Portal SHALL NOT fetch any `access_requests` records; WHEN an Admin navigates to a specific Batch detail page, THE Admin_Portal SHALL fetch the Access_Requests for that Batch only at that point.
3. WHEN a user types in the Batch list search or filter input, THE Admin_Portal SHALL wait at least 300 ms and at most 1000 ms after the last keystroke before issuing a database query.
4. THE Portal database schema SHALL define indexes on `request_batches(status)`, `request_batches(submitted_at DESC)`, `access_requests(batch_id)`, and `access_requests(status)`.
