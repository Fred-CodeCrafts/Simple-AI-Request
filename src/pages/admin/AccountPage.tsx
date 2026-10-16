import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'

export default function AccountPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#111827] mb-6">Account</h1>

      <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 max-w-md">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Email</p>
            <p className="text-sm text-[#374151] mt-1">{user?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Display Name</p>
            <p className="text-sm text-[#374151] mt-1">{profile?.display_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">Role</p>
            <p className="text-sm text-[#374151] mt-1 capitalize">{profile?.role ?? '—'}</p>
          </div>
          <div className="pt-2 border-t border-[#E5E7EB]">
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
