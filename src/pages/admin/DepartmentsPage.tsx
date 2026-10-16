import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'
import type { Department } from '@/types'

async function fetchDepartments(): Promise<Department[]> {
  const { data } = await supabase
    .from('departments')
    .select('*')
    .order('name', { ascending: true })
  return data ?? []
}

export default function DepartmentsPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [renameDialog, setRenameDialog] = useState<Department | null>(null)
  const [renameName, setRenameName] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)

  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments-admin'],
    queryFn: fetchDepartments,
  })

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAddError(null)

    // Case-insensitive uniqueness check
    const exists = departments?.some(d => d.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      setAddError('A department with this name already exists.')
      return
    }

    setAddLoading(true)
    try {
      const { error } = await supabase.from('departments').insert({ name })
      if (error) {
        setAddError(error.message)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['departments-admin'] })
      setNewName('')
      toast({ title: 'Department added', description: `"${name}" has been created.` })
    } finally {
      setAddLoading(false)
    }
  }

  async function handleToggleActive(dept: Department) {
    const { error } = await supabase
      .from('departments')
      .update({ is_active: !dept.is_active, updated_at: new Date().toISOString() })
      .eq('id', dept.id)

    if (error) {
      toast({ title: 'Error', description: 'Failed to update department.', variant: 'destructive' })
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['departments-admin'] })
    toast({ title: 'Updated', description: `"${dept.name}" ${dept.is_active ? 'deactivated' : 'activated'}.` })
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!renameDialog) return
    const name = renameName.trim()
    if (!name) return
    setRenameError(null)

    const exists = departments?.some(
      d => d.name.toLowerCase() === name.toLowerCase() && d.id !== renameDialog.id
    )
    if (exists) {
      setRenameError('A department with this name already exists.')
      return
    }

    setRenameLoading(true)
    try {
      const { error } = await supabase
        .from('departments')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', renameDialog.id)

      if (error) {
        setRenameError(error.message)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['departments-admin'] })
      setRenameDialog(null)
      toast({ title: 'Renamed', description: `Department renamed to "${name}".` })
    } finally {
      setRenameLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#111827] mb-6">Departments</h1>

      {/* Add form */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 mb-6">
        <h2 className="text-base font-semibold text-[#111827] mb-4">Add Department</h2>
        <form onSubmit={handleAdd} className="flex gap-3">
          <div className="flex-1 max-w-sm space-y-1">
            <Label htmlFor="dept-name" className="sr-only">Department name</Label>
            <Input
              id="dept-name"
              value={newName}
              onChange={e => { setNewName(e.target.value); setAddError(null) }}
              placeholder="Department name"
              aria-describedby={addError ? 'dept-add-error' : undefined}
            />
            {addError && (
              <p id="dept-add-error" role="alert" className="text-xs text-[#B91C1C]">{addError}</p>
            )}
          </div>
          <Button type="submit" disabled={addLoading || !newName.trim()}>
            {addLoading ? 'Adding...' : 'Add Department'}
          </Button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#E5E7EB]">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-[#F3F4F6] rounded animate-pulse" />
            ))}
          </div>
        ) : !departments?.length ? (
          <div className="p-12 text-center text-sm text-[#9CA3AF]">No departments yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Name</th>
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Status</th>
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(dept => (
                <tr key={dept.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-6 py-3 font-medium text-[#111827]">{dept.name}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-semibold ${dept.is_active ? 'text-[#B91C1C]' : 'text-[#9CA3AF]'}`}>
                      {dept.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setRenameDialog(dept); setRenameName(dept.name); setRenameError(null) }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggleActive(dept)}
                      >
                        {dept.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rename dialog */}
      <Dialog
        open={renameDialog !== null}
        onOpenChange={(open) => { if (!open) setRenameDialog(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Department</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rename-dept">New name</Label>
              <Input
                id="rename-dept"
                value={renameName}
                onChange={e => { setRenameName(e.target.value); setRenameError(null) }}
                placeholder="Department name"
              />
              {renameError && (
                <p role="alert" className="text-xs text-[#B91C1C]">{renameError}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameDialog(null)} disabled={renameLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={renameLoading || !renameName.trim()}>
                {renameLoading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
