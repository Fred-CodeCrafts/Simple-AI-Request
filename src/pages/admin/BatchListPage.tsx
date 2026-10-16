import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import StatusBadge from '@/components/admin/StatusBadge'
import type { RequestBatch, BatchStatus } from '@/types'

const PAGE_SIZE = 25

interface BatchWithCount extends RequestBatch {
  employee_count: number
}

async function fetchBatches(
  page: number,
  search: string,
  statusFilter: BatchStatus | 'all'
): Promise<{ data: BatchWithCount[]; total: number }> {
  let query = supabase
    .from('request_batches')
    .select('*, access_requests(count)', { count: 'exact' })
    .order('submitted_at', { ascending: false })

  if (search.trim()) {
    query = query.or(
      `reference_number.ilike.%${search}%,department_name_snapshot.ilike.%${search}%,ai_tool_name_snapshot.ilike.%${search}%`
    )
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  query = query.range(from, to)

  const { data, count } = await query

  const batches: BatchWithCount[] = (data ?? []).map((b) => {
    const arr = b.access_requests as { count: number }[] | null
    return {
      ...b,
      access_requests: undefined,
      employee_count: arr?.[0]?.count ?? 0,
    }
  })

  return { data: batches, total: count ?? 0 }
}

const STATUS_OPTIONS: { value: BatchStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'partially_decided', label: 'Partially Decided' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'completed', label: 'Completed' },
]

export default function BatchListPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BatchStatus | 'all'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['batches', page, search, statusFilter],
    queryFn: () => fetchBatches(page, search, statusFilter),
  })

  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  function handleSearch(value: string) {
    setSearch(value)
    setPage(0)
  }

  function handleStatusChange(value: BatchStatus | 'all') {
    setStatusFilter(value)
    setPage(0)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#111827] mb-6">Request Batches</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" aria-hidden="true" />
          <Input
            placeholder="Search reference, department, tool..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9"
            aria-label="Search batches"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => handleStatusChange(e.target.value as BatchStatus | 'all')}
          className="border border-[#E5E7EB] rounded-md px-3 py-1.5 text-sm bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#B91C1C]"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#E5E7EB]">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-[#F3F4F6] rounded animate-pulse" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <div className="p-12 text-center text-sm text-[#9CA3AF]">No batches found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Reference</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Department</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">AI Tool</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Employees</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Submitted</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map(batch => (
                  <tr key={batch.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                    <td className="px-6 py-3">
                      <span className="font-mono text-sm text-[#374151]">{batch.reference_number}</span>
                    </td>
                    <td className="px-6 py-3 text-[#374151]">{batch.department_name_snapshot}</td>
                    <td className="px-6 py-3 text-[#374151]">{batch.ai_tool_name_snapshot}</td>
                    <td className="px-6 py-3 text-[#374151]">{batch.employee_count}</td>
                    <td className="px-6 py-3 text-[#9CA3AF]">
                      {new Date(batch.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={batch.status} />
                    </td>
                    <td className="px-6 py-3">
                      <Link
                        to={`/admin/batches/${batch.id}`}
                        className="text-[#B91C1C] hover:underline text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#9CA3AF]">
            Page {page + 1} of {totalPages} ({data?.total ?? 0} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
