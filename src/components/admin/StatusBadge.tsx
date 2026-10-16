import { Badge } from '@/components/ui/badge'
import type { BatchStatus, RequestStatus } from '@/types'

type Status = BatchStatus | RequestStatus

interface StatusBadgeProps {
  status: Status
}

const statusConfig: Record<Status, { variant: 'pending' | 'approved' | 'declined' | 'partial' | 'completed' | 'default'; label: string }> = {
  pending: { variant: 'pending', label: 'Pending' },
  partially_decided: { variant: 'partial', label: 'Partially Decided' },
  approved: { variant: 'approved', label: 'Approved' },
  declined: { variant: 'declined', label: 'Declined' },
  completed: { variant: 'completed', label: 'Completed' },
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { variant: 'default' as const, label: status }
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  )
}
