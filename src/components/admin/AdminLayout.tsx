import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileStack, Building2, Cpu, User, LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/batches', label: 'Request Batches', icon: FileStack },
  { to: '/admin/departments', label: 'Sub Directories', icon: Building2 },
  { to: '/admin/ai-tools', label: 'AI Tools', icon: Cpu },
  { to: '/admin/account', label: 'Account', icon: User },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#E5E7EB] flex flex-col">
        <div className="px-6 py-5 border-b border-[#E5E7EB]">
          <h1 className="text-lg font-bold text-[#111827]">AI Access Portal</h1>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Admin Console</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Admin navigation">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#B91C1C] text-white'
                    : 'text-[#374151] hover:bg-[#F3F4F6]'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-[#E5E7EB]">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
