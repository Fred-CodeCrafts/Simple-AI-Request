import type { AccessRequest, BatchStatus } from '@/types'

/**
 * Computes the batch status from its access requests.
 * Properties 1–5 of the correctness properties.
 */
export function getBatchStatus(requests: AccessRequest[]): BatchStatus {
  if (requests.length === 0) return 'pending'

  const pending = requests.filter(r => r.status === 'pending')
  const approved = requests.filter(r => r.status === 'approved')
  const declined = requests.filter(r => r.status === 'declined')

  // Any pending → not finalized
  if (pending.length > 0) {
    if (approved.length > 0 || declined.length > 0) {
      return 'partially_decided'
    }
    return 'pending'
  }

  // No pending — all decided
  if (approved.length > 0 && declined.length === 0) return 'approved'
  if (declined.length > 0 && approved.length === 0) return 'declined'
  return 'completed'
}

export function isBatchFinalized(status: BatchStatus): boolean {
  return status === 'approved' || status === 'declined' || status === 'completed'
}

export function batchStatusLabel(status: BatchStatus): string {
  const labels: Record<BatchStatus, string> = {
    pending: 'Pending',
    partially_decided: 'Partially Decided',
    approved: 'Approved',
    declined: 'Declined',
    completed: 'Completed',
  }
  return labels[status]
}
