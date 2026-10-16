import type { EmployeeRowDraft } from '@/types'

// Field limits as per Requirement 2.2
export const FIELD_LIMITS = {
  employeeFullName: 255,
  position: 255,
  employeeJustification: 2000,
  aiUsageJustification: 2000,
  expectedImpact: 2000,
} as const

export type FieldErrors = Partial<Record<keyof typeof FIELD_LIMITS, string>>

/**
 * Validates a single employee row draft.
 * NEVER throws — always returns an error map (Property 6).
 */
export function validateEmployeeRow(row: unknown): FieldErrors {
  try {
    const errors: FieldErrors = {}

    // Cast safely — treat as partial object
    const r = (row ?? {}) as Partial<Record<keyof typeof FIELD_LIMITS, unknown>>

    for (const field of Object.keys(FIELD_LIMITS) as Array<keyof typeof FIELD_LIMITS>) {
      const value = r[field]
      const strValue = typeof value === 'string' ? value : ''

      // Required / whitespace-only check (Property 7)
      if (!strValue || strValue.trim() === '') {
        errors[field] = `${fieldLabel(field)} is required`
        continue
      }

      // Max length check (Property 8)
      if (strValue.length > FIELD_LIMITS[field]) {
        errors[field] = `${fieldLabel(field)} must not exceed ${FIELD_LIMITS[field]} characters`
      }
    }

    return errors
  } catch {
    // Property 6: never throw — return a generic error map
    return {
      employeeFullName: 'Validation failed — please check this row',
    }
  }
}

function fieldLabel(field: keyof typeof FIELD_LIMITS): string {
  const labels: Record<keyof typeof FIELD_LIMITS, string> = {
    employeeFullName: 'Employee full name',
    position: 'Position',
    employeeJustification: 'Employee role Justification for AI Usage',
    aiUsageJustification: 'Employee role Justification for AI Usage',
    expectedImpact: 'Expected impact',
  }
  return labels[field]
}

/**
 * Returns true if the row has no validation errors.
 */
export function isRowValid(row: EmployeeRowDraft): boolean {
  const errors = validateEmployeeRow(row)
  return Object.keys(errors).length === 0
}
