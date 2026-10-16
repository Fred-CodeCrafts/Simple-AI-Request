import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#B91C1C] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[#B91C1C] text-white',
        secondary: 'border-transparent bg-[#F3F4F6] text-[#374151]',
        destructive: 'border-transparent bg-[#991B1B] text-white',
        outline: 'border-[#E5E7EB] text-[#374151]',
        pending: 'border-[#E5E7EB] bg-[#F3F4F6] text-[#374151]',
        approved: 'border-[#B91C1C] bg-white text-[#B91C1C]',
        declined: 'border-transparent bg-[#374151] text-white',
        partial: 'border-[#9CA3AF] bg-white text-[#9CA3AF]',
        completed: 'border-transparent bg-[#111827] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
