import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface BulkActionBarProps {
  pendingCount: number
  batchId: string
  onBulkDecision: (decision: 'approved' | 'declined') => Promise<void>
  disabled?: boolean
}

export default function BulkActionBar({ pendingCount, onBulkDecision, disabled }: BulkActionBarProps) {
  const [confirmAction, setConfirmAction] = useState<'approved' | 'declined' | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!confirmAction) return
    setLoading(true)
    try {
      await onBulkDecision(confirmAction)
    } finally {
      setLoading(false)
      setConfirmAction(null)
    }
  }

  if (pendingCount === 0) return null

  return (
    <>
      <div className="flex items-center gap-3 p-4 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg">
        <span className="text-sm text-[#374151] flex-1">
          <strong>{pendingCount}</strong> pending {pendingCount === 1 ? 'request' : 'requests'}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || loading}
          onClick={() => setConfirmAction('approved')}
        >
          Approve All Pending
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || loading}
          onClick={() => setConfirmAction('declined')}
        >
          Decline All Pending
        </Button>
      </div>

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'approved' ? 'Approve All Pending' : 'Decline All Pending'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will {confirmAction === 'approved' ? 'approve' : 'decline'} all {pendingCount} pending{' '}
              {pendingCount === 1 ? 'request' : 'requests'} in this batch. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={loading}
              className={confirmAction === 'declined' ? 'bg-[#374151] hover:bg-[#111827]' : ''}
            >
              {loading ? 'Processing...' : confirmAction === 'approved' ? 'Approve All' : 'Decline All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
