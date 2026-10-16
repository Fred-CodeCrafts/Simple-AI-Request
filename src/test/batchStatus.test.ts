import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { getBatchStatus, isBatchFinalized } from '@/lib/batchStatus'
import type { AccessRequest, RequestStatus } from '@/types'

// Arbitrary for a single RequestStatus
const statusArb = fc.constantFrom<RequestStatus>('pending', 'approved', 'declined')

// Arbitrary for an AccessRequest (only status matters for batchStatus logic)
const accessRequestArb = fc.record<AccessRequest>({
  id: fc.uuid(),
  batch_id: fc.uuid(),
  employee_full_name: fc.string(),
  position: fc.string(),
  employee_justification: fc.string(),
  ai_usage_justification: fc.string(),
  expected_impact: fc.string(),
  status: statusArb,
  decision_note: fc.option(fc.string(), { nil: null }),
  decided_by: fc.option(fc.uuid(), { nil: null }),
  decided_at: fc.option(fc.string(), { nil: null }),
  created_at: fc.string(),
})

const requestsArb = fc.array(accessRequestArb, { minLength: 0, maxLength: 50 })

describe('getBatchStatus — property-based tests', () => {
  // Property 1: Empty array always returns 'pending'
  it('empty requests → pending', () => {
    expect(getBatchStatus([])).toBe('pending')
  })

  // Property 2: All pending → status is 'pending'
  it('all-pending requests → pending', () => {
    fc.assert(
      fc.property(
        fc.array(accessRequestArb.map(r => ({ ...r, status: 'pending' as RequestStatus })), { minLength: 1, maxLength: 50 }),
        (requests) => {
          expect(getBatchStatus(requests)).toBe('pending')
        }
      )
    )
  })

  // Property 3: No pending, all approved → approved
  it('all-approved requests → approved', () => {
    fc.assert(
      fc.property(
        fc.array(accessRequestArb.map(r => ({ ...r, status: 'approved' as RequestStatus })), { minLength: 1, maxLength: 50 }),
        (requests) => {
          expect(getBatchStatus(requests)).toBe('approved')
        }
      )
    )
  })

  // Property 4: No pending, all declined → declined
  it('all-declined requests → declined', () => {
    fc.assert(
      fc.property(
        fc.array(accessRequestArb.map(r => ({ ...r, status: 'declined' as RequestStatus })), { minLength: 1, maxLength: 50 }),
        (requests) => {
          expect(getBatchStatus(requests)).toBe('declined')
        }
      )
    )
  })

  // Property 5: Mix of approved+declined and no pending → completed
  it('mix of approved and declined (no pending) → completed', () => {
    fc.assert(
      fc.property(
        fc.array(accessRequestArb.map(r => ({ ...r, status: 'approved' as RequestStatus })), { minLength: 1, maxLength: 25 }),
        fc.array(accessRequestArb.map(r => ({ ...r, status: 'declined' as RequestStatus })), { minLength: 1, maxLength: 25 }),
        (approved, declined) => {
          const requests = [...approved, ...declined]
          expect(getBatchStatus(requests)).toBe('completed')
        }
      )
    )
  })

  // Property 6: Any pending + at least one decided → partially_decided
  it('pending + some decided → partially_decided', () => {
    fc.assert(
      fc.property(
        fc.array(accessRequestArb.map(r => ({ ...r, status: 'pending' as RequestStatus })), { minLength: 1, maxLength: 25 }),
        fc.array(
          accessRequestArb.map(r => ({
            ...r,
            status: fc.sample(fc.constantFrom<RequestStatus>('approved', 'declined'), 1)[0],
          })),
          { minLength: 1, maxLength: 25 }
        ),
        (pending, decided) => {
          const requests = [...pending, ...decided]
          expect(getBatchStatus(requests)).toBe('partially_decided')
        }
      )
    )
  })

  // Property 7: isBatchFinalized returns true iff status ∈ {approved, declined, completed}
  it('isBatchFinalized is true exactly for approved, declined, completed', () => {
    fc.assert(
      fc.property(requestsArb, (requests) => {
        const status = getBatchStatus(requests)
        const finalized = isBatchFinalized(status)
        const isTerminal = ['approved', 'declined', 'completed'].includes(status)
        expect(finalized).toBe(isTerminal)
      })
    )
  })

  // Property 8: Result is always a valid BatchStatus string
  it('always returns a valid BatchStatus', () => {
    const validStatuses = new Set(['pending', 'partially_decided', 'approved', 'declined', 'completed'])
    fc.assert(
      fc.property(requestsArb, (requests) => {
        const status = getBatchStatus(requests)
        expect(validStatuses.has(status)).toBe(true)
      })
    )
  })
})
