import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import StatusBadge from '@/components/admin/StatusBadge'
import type { RequestBatch } from '@/types'

interface DashboardStats {
  totalBatches: number
  pendingBatches: number
  pendingRequests: number
  approvedRequests: number
  declinedRequests: number
}

async function fetchStats(): Promise<DashboardStats> {
  const [batchesRes, pendingBatchesRes, requestsRes] = await Promise.all([
    supabase.from('request_batches').select('*', { count: 'exact', head: true }),
    supabase.from('request_batches').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('access_requests').select('status'),
  ])

  const requests = requestsRes.data ?? []
  return {
    totalBatches: batchesRes.count ?? 0,
    pendingBatches: pendingBatchesRes.count ?? 0,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    approvedRequests: requests.filter(r => r.status === 'approved').length,
    declinedRequests: requests.filter(r => r.status === 'declined').length,
  }
}

async function fetchRecentBatches(): Promise<RequestBatch[]> {
  const { data } = await supabase
    .from('request_batches')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(5)
  return data ?? []
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg border border-[#E5E7EB] p-5">
      <p className="text-sm text-[#9CA3AF] font-medium">{label}</p>
      <p className="text-3xl font-bold text-[#111827] mt-1">{value}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchStats,
  })

  const { data: recentBatches, isLoading: batchesLoading } = useQuery({
    queryKey: ['recent-batches'],
    queryFn: fetchRecentBatches,
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#111827] mb-6">Dashboard</h1>

      {/* Stats cards */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-[#E5E7EB] p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Batches" value={stats?.totalBatches ?? 0} />
          <StatCard label="Pending Batches" value={stats?.pendingBatches ?? 0} />
          <StatCard label="Pending Requests" value={stats?.pendingRequests ?? 0} />
          <StatCard label="Approved Requests" value={stats?.approvedRequests ?? 0} />
          <StatCard label="Declined Requests" value={stats?.declinedRequests ?? 0} />
        </div>
      )}

      {/* Recent submissions */}
      <div className="bg-white rounded-lg border border-[#E5E7EB]">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#111827]">Recent Submissions</h2>
          <Link to="/admin/batches" className="text-sm text-[#B91C1C] hover:underline">
            View all
          </Link>
        </div>

        {batchesLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 bg-[#F3F4F6] rounded animate-pulse" />
            ))}
          </div>
        ) : !recentBatches?.length ? (
          <div className="p-6 text-center text-sm text-[#9CA3AF]">No submissions yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Reference</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Sub Directory</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">AI Tool</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Submitted</th>
                  <th className="text-left px-6 py-3 font-medium text-[#374151]">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map(batch => (
                  <tr key={batch.id} className="border-b border-[#E5E7EB] last:border-0 hover:bg-[#F9FAFB]">
                    <td className="px-6 py-3">
                      <Link
                        to={`/admin/batches/${batch.id}`}
                        className="font-mono text-[#B91C1C] hover:underline"
                      >
                        {batch.reference_number}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-[#374151]">{batch.department_name_snapshot}</td>
                    <td className="px-6 py-3 text-[#374151]">{batch.ai_tool_name_snapshot}</td>
                    <td className="px-6 py-3 text-[#9CA3AF]">
                      {new Date(batch.submitted_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={batch.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
