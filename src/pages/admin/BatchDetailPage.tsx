import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isBatchFinalized } from '@/lib/batchStatus'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import StatusBadge from '@/components/admin/StatusBadge'
import BulkActionBar from '@/components/admin/BulkActionBar'
import { toast } from '@/hooks/useToast'
import type { RequestBatch, AccessRequest } from '@/types'

interface BatchDetailData {
  batch: RequestBatch
  requests: AccessRequest[]
}

async function fetchBatchDetail(id: string): Promise<BatchDetailData> {
  const [batchRes, requestsRes] = await Promise.all([
    supabase.from('request_batches').select('*').eq('id', id).single(),
    supabase
      .from('access_requests')
      .select('*')
      .eq('batch_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (!batchRes.data) throw new Error('Batch not found')

  return {
    batch: batchRes.data,
    requests: requestsRes.data ?? [],
  }
}

interface DecisionDialogState {
  requestId: string
  employeeName: string
  decision: 'approved' | 'declined'
}

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [decisionDialog, setDecisionDialog] = useState<DecisionDialogState | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['batch-detail', id],
    queryFn: () => fetchBatchDetail(id!),
    enabled: !!id,
  })

  async function handleDecision() {
    if (!decisionDialog || !id) return
    setSubmitting(true)
    try {
      const { error: err } = await supabase
        .from('access_requests')
        .update({
          status: decisionDialog.decision,
          decision_note: note.trim() || null,
          decided_at: new Date().toISOString(),
        })
        .eq('id', decisionDialog.requestId)

      if (err) {
        toast({ title: 'Error', description: 'Failed to update decision.', variant: 'destructive' })
        return
      }

      await queryClient.invalidateQueries({ queryKey: ['batch-detail', id] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setDecisionDialog(null)
      setNote('')
      toast({ title: 'Decision saved', description: `Request ${decisionDialog.decision}.` })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleBulkDecision(decision: 'approved' | 'declined') {
    if (!id || !data) return
    const pendingIds = data.requests
      .filter(r => r.status === 'pending')
      .map(r => r.id)

    if (pendingIds.length === 0) return

    const { error: err } = await supabase
      .from('access_requests')
      .update({
        status: decision,
        decided_at: new Date().toISOString(),
      })
      .in('id', pendingIds)

    if (err) {
      toast({ title: 'Error', description: 'Bulk action failed.', variant: 'destructive' })
      return
    }

    await queryClient.invalidateQueries({ queryKey: ['batch-detail', id] })
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    toast({ title: 'Bulk action applied', description: `${pendingIds.length} requests ${decision}.` })
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-white rounded border border-[#E5E7EB] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-sm text-[#B91C1C]">Failed to load batch details.</p>
        <Link to="/admin/batches" className="text-sm text-[#B91C1C] hover:underline mt-2 inline-block">
          ← Back to batches
        </Link>
      </div>
    )
  }

  const { batch, requests } = data
  const finalized = isBatchFinalized(batch.status)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="p-8">
      {/* Back link */}
      <Link
        to="/admin/batches"
        className="inline-flex items-center gap-1 text-sm text-[#9CA3AF] hover:text-[#374151] mb-6"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to batches
      </Link>

      {/* Batch header */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#111827] font-mono">{batch.reference_number}</h1>
            <p className="text-sm text-[#9CA3AF] mt-0.5">
              Submitted {new Date(batch.submitted_at).toLocaleString()}
            </p>
          </div>
          <StatusBadge status={batch.status} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[#E5E7EB]">
          <div>
            <p className="text-xs text-[#9CA3AF] font-medium">Department</p>
            <p className="text-sm text-[#374151] mt-0.5">{batch.department_name_snapshot}</p>
          </div>
          <div>
            <p className="text-xs text-[#9CA3AF] font-medium">AI Tool</p>
            <p className="text-sm text-[#374151] mt-0.5">{batch.ai_tool_name_snapshot}</p>
          </div>
          <div>
            <p className="text-xs text-[#9CA3AF] font-medium">Submitted by</p>
            <p className="text-sm text-[#374151] mt-0.5">
              {batch.submitted_by_name || batch.submitted_by_email || 'Anonymous'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#9CA3AF] font-medium">Requests</p>
            <p className="text-sm text-[#374151] mt-0.5">{requests.length} employees</p>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {!finalized && pendingCount > 0 && (
        <div className="mb-4">
          <BulkActionBar
            pendingCount={pendingCount}
            batchId={batch.id}
            onBulkDecision={handleBulkDecision}
          />
        </div>
      )}

      {/* Requests table */}
      <div className="bg-white rounded-lg border border-[#E5E7EB]">
        <div className="px-6 py-4 border-b border-[#E5E7EB]">
          <h2 className="text-base font-semibold text-[#111827]">Access Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Employee</th>
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Position</th>
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Justification</th>
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Status</th>
                {!finalized && (
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-6 py-4">
                    <p className="font-medium text-[#111827]">{req.employee_full_name}</p>
                  </td>
                  <td className="px-6 py-4 text-[#374151]">{req.position}</td>
                  <td className="px-6 py-4 max-w-xs">
                    <p className="text-[#374151] text-xs line-clamp-2">{req.employee_justification}</p>
                    {req.decision_note && (
                      <p className="text-[#9CA3AF] text-xs mt-1 italic">Note: {req.decision_note}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={req.status} />
                  </td>
                  {!finalized && (
                    <td className="px-6 py-4">
                      {req.status === 'pending' ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              setDecisionDialog({
                                requestId: req.id,
                                employeeName: req.employee_full_name,
                                decision: 'approved',
                              })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setDecisionDialog({
                                requestId: req.id,
                                employeeName: req.employee_full_name,
                                decision: 'declined',
                              })
                            }
                          >
                            Decline
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#9CA3AF]">
                          {req.decided_at ? new Date(req.decided_at).toLocaleDateString() : '—'}
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision dialog */}
      <Dialog
        open={decisionDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionDialog(null)
            setNote('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionDialog?.decision === 'approved' ? 'Approve' : 'Decline'} Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-[#374151]">
              Employee: <strong>{decisionDialog?.employeeName}</strong>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="decision-note">Note (optional)</Label>
              <Textarea
                id="decision-note"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add an optional note..."
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-[#9CA3AF] text-right">{note.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDecisionDialog(null); setNote('') }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDecision}
              disabled={submitting}
              variant={decisionDialog?.decision === 'declined' ? 'secondary' : 'default'}
            >
              {submitting ? 'Saving...' : decisionDialog?.decision === 'approved' ? 'Approve' : 'Decline'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
