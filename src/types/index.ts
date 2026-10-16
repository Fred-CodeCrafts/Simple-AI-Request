// ── Reference Data ────────────────────────────────────────────

export interface Department {
  id: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AITool {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Submissions ───────────────────────────────────────────────

export type BatchStatus =
  | 'pending'
  | 'partially_decided'
  | 'approved'
  | 'declined'
  | 'completed'

export interface RequestBatch {
  id: string
  reference_number: string
  department_id: string
  department_name_snapshot: string
  ai_tool_id: string
  ai_tool_name_snapshot: string
  submitted_by_name: string | null
  submitted_by_email: string | null
  submitted_at: string
  status: BatchStatus
  finalized_at: string | null
  access_requests?: AccessRequest[]
  // computed field from join
  request_count?: number
}

export type RequestStatus = 'pending' | 'approved' | 'declined'

export interface AccessRequest {
  id: string
  batch_id: string
  employee_full_name: string
  position: string
  employee_justification: string
  ai_usage_justification: string
  expected_impact: string
  status: RequestStatus
  decision_note: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
}

// ── Admin ─────────────────────────────────────────────────────

export interface Profile {
  user_id: string
  display_name: string
  role: 'admin'
  created_at: string
  updated_at: string
}

// ── Form / UI types ───────────────────────────────────────────

export interface EmployeeRowDraft {
  id: string // local uuid for keying
  employeeFullName: string
  position: string
  employeeJustification: string
  aiUsageJustification: string
  expectedImpact: string
  errors: Partial<Record<'employeeFullName' | 'position' | 'employeeJustification' | 'aiUsageJustification' | 'expectedImpact', string>>
}

export interface RowValidationError {
  rowIndex: number
  field: string
  message: string
}

// ── Edge Function Payloads ────────────────────────────────────

export interface SubmitBatchPayload {
  departmentId: string
  aiToolId: string
  submittedByName?: string
  submittedByEmail?: string
  employees: {
    employeeFullName: string
    position: string
    employeeJustification: string
    aiUsageJustification: string
    expectedImpact: string
  }[]
}

export interface SubmitBatchResponse {
  referenceNumber: string
}

export interface DecideBatchPayload {
  batchId: string
  decision: 'approved' | 'declined'
  note?: string
}

export type DecisionStatus = 'approved' | 'declined'
