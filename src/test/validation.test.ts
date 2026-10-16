import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { validateEmployeeRow, FIELD_LIMITS } from '@/lib/validation'
import type { EmployeeRowDraft } from '@/types'

const FIELDS = Object.keys(FIELD_LIMITS) as Array<keyof typeof FIELD_LIMITS>

function validRow(): EmployeeRowDraft {
  return {
    id: 'test-id',
    employeeFullName: 'Jane Doe',
    position: 'Software Engineer',
    employeeJustification: 'Need AI assistance for coding tasks',
    aiUsageJustification: 'Will use for code review and generation',
    expectedImpact: 'Improved productivity by 30%',
    errors: {},
  }
}

describe('validateEmployeeRow', () => {
  // Property: never throws for any input
  it('never throws — arbitrary input', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(() => validateEmployeeRow(input)).not.toThrow()
      })
    )
  })

  // Property: always returns an object
  it('always returns an object', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = validateEmployeeRow(input)
        expect(typeof result).toBe('object')
        expect(result).not.toBeNull()
      })
    )
  })

  // Valid row produces no errors
  it('valid row produces no errors', () => {
    const errors = validateEmployeeRow(validRow())
    expect(Object.keys(errors)).toHaveLength(0)
  })

  // Empty string fields produce errors
  it('empty employeeFullName produces an error', () => {
    const row = { ...validRow(), employeeFullName: '' }
    const errors = validateEmployeeRow(row)
    expect(errors.employeeFullName).toBeTruthy()
  })

  it('whitespace-only fields produce errors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<keyof typeof FIELD_LIMITS>(...FIELDS),
        fc.stringMatching(/^\s+$/),
        (field, whitespace) => {
          const row = { ...validRow(), [field]: whitespace }
          const errors = validateEmployeeRow(row)
          expect(errors[field]).toBeTruthy()
        }
      )
    )
  })

  // null/undefined/non-string inputs produce errors for all fields
  it('null input produces at least one error', () => {
    const errors = validateEmployeeRow(null)
    expect(Object.keys(errors).length).toBeGreaterThan(0)
  })

  it('undefined input produces at least one error', () => {
    const errors = validateEmployeeRow(undefined)
    expect(Object.keys(errors).length).toBeGreaterThan(0)
  })

  it('empty object produces errors for all fields', () => {
    const errors = validateEmployeeRow({})
    for (const field of FIELDS) {
      expect(errors[field]).toBeTruthy()
    }
  })

  // Field length violations produce errors
  it('field exceeding max length produces an error', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<keyof typeof FIELD_LIMITS>(...FIELDS),
        (field) => {
          const maxLen = FIELD_LIMITS[field]
          const tooLong = 'a'.repeat(maxLen + 1)
          const row = { ...validRow(), [field]: tooLong }
          const errors = validateEmployeeRow(row)
          expect(errors[field]).toBeTruthy()
        }
      )
    )
  })

  // Field at exactly max length does NOT produce an error
  it('field at exactly max length is valid', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<keyof typeof FIELD_LIMITS>(...FIELDS),
        (field) => {
          const maxLen = FIELD_LIMITS[field]
          const exactLen = 'a'.repeat(maxLen)
          const row = { ...validRow(), [field]: exactLen }
          const errors = validateEmployeeRow(row)
          expect(errors[field]).toBeUndefined()
        }
      )
    )
  })

  // Property: non-string values (number, boolean) are treated as missing
  it('non-string values are treated as missing', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<keyof typeof FIELD_LIMITS>(...FIELDS),
        fc.oneof(fc.integer(), fc.boolean()),
        (field, nonString) => {
          const row = { ...validRow(), [field]: nonString }
          const errors = validateEmployeeRow(row)
          expect(errors[field]).toBeTruthy()
        }
      )
    )
  })
})
