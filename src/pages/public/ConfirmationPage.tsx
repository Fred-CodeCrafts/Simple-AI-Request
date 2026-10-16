import { useEffect } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const FORM_SLUG = import.meta.env.VITE_FORM_SLUG as string

interface LocationState {
  referenceNumber?: string
}

export default function ConfirmationPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as LocationState | null

  useEffect(() => {
    if (!state?.referenceNumber) {
      navigate(`/submit/${FORM_SLUG}`, { replace: true })
    }
  }, [state, navigate])

  if (!state?.referenceNumber) return null

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-[#E5E7EB] shadow-sm p-10 text-center">
        <CheckCircle className="h-14 w-14 text-[#B91C1C] mx-auto mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-[#111827]">Request Submitted</h1>
        <p className="text-sm text-[#9CA3AF] mt-2 mb-6">
          Your AI access request has been submitted and is pending review.
        </p>

        <div className="bg-[#F3F4F6] rounded-md p-4 mb-6">
          <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">
            Reference Number
          </p>
          <p className="text-2xl font-bold font-mono text-[#111827]">
            {state.referenceNumber}
          </p>
        </div>

        <p className="text-sm text-[#9CA3AF] mb-6">
          Please save your reference number for future inquiries.
        </p>

        <Button asChild variant="outline" className="w-full">
          <Link to={`/submit/${FORM_SLUG}`}>Submit Another Request</Link>
        </Button>
      </div>
    </div>
  )
}
