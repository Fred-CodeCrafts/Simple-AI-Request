import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/useToast'
import { getPortalAIToolSettings, savePortalAIToolSettings } from '@/lib/portalSettings'
import type { AITool } from '@/types'

async function fetchAITools(): Promise<AITool[]> {
  const { data } = await supabase
    .from('ai_tools')
    .select('*')
    .order('name', { ascending: true })
  return data ?? []
}

export default function AIToolsPage() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addLoading, setAddLoading] = useState(false)

  const [editDialog, setEditDialog] = useState<AITool | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const [formSettings, setFormSettings] = useState(getPortalAIToolSettings)

  const { data: tools, isLoading } = useQuery({
    queryKey: ['ai-tools-admin'],
    queryFn: fetchAITools,
  })

  const activeTools = tools?.filter(t => t.is_active) ?? []
  const effectiveDefaultId =
    formSettings.defaultAiToolId && activeTools.some(t => t.id === formSettings.defaultAiToolId)
      ? formSettings.defaultAiToolId
      : activeTools[0]?.id

  function handleSelectDefaultTool(id: string) {
    const updated = { ...formSettings, defaultAiToolId: id }
    setFormSettings(updated)
    savePortalAIToolSettings(updated)
    toast({ title: 'Default AI Tool updated', description: 'Selected tool will appear as default on the request form.' })
  }

  function handleToggleChangeable(isChangeable: boolean) {
    const updated = { ...formSettings, isChangeable }
    setFormSettings(updated)
    savePortalAIToolSettings(updated)
    toast({
      title: isChangeable ? 'AI Tool selection enabled' : 'AI Tool locked to default',
      description: isChangeable
        ? 'Requesters can now choose from active AI tools.'
        : 'Requesters cannot change the AI tool on the form.',
    })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setAddError(null)

    const exists = tools?.some(t => t.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      setAddError('An AI tool with this name already exists.')
      return
    }

    setAddLoading(true)
    try {
      const { error } = await supabase
        .from('ai_tools')
        .insert({ name, description: newDescription.trim() || null })

      if (error) {
        setAddError(error.message)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['ai-tools-admin'] })
      setNewName('')
      setNewDescription('')
      toast({ title: 'AI Tool added', description: `"${name}" has been created.` })
    } finally {
      setAddLoading(false)
    }
  }

  async function handleToggleActive(tool: AITool) {
    const { error } = await supabase
      .from('ai_tools')
      .update({ is_active: !tool.is_active, updated_at: new Date().toISOString() })
      .eq('id', tool.id)

    if (error) {
      toast({ title: 'Error', description: 'Failed to update AI tool.', variant: 'destructive' })
      return
    }
    await queryClient.invalidateQueries({ queryKey: ['ai-tools-admin'] })
    toast({ title: 'Updated', description: `"${tool.name}" ${tool.is_active ? 'deactivated' : 'activated'}.` })
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editDialog) return
    const name = editName.trim()
    if (!name) return
    setEditError(null)

    const exists = tools?.some(
      t => t.name.toLowerCase() === name.toLowerCase() && t.id !== editDialog.id
    )
    if (exists) {
      setEditError('An AI tool with this name already exists.')
      return
    }

    setEditLoading(true)
    try {
      const { error } = await supabase
        .from('ai_tools')
        .update({
          name,
          description: editDescription.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editDialog.id)

      if (error) {
        setEditError(error.message)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['ai-tools-admin'] })
      setEditDialog(null)
      toast({ title: 'Updated', description: `AI tool updated to "${name}".` })
    } finally {
      setEditLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#111827] mb-6">AI Tools</h1>

      {/* Public Form Settings */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 mb-6">
        <h2 className="text-base font-semibold text-[#111827] mb-1">Public Request Form Settings</h2>
        <p className="text-xs text-[#9CA3AF] mb-4">
          Control which AI tool is selected by default on the public request form, and whether requesters can change it.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="default-tool-select">Default AI Tool</Label>
            <select
              id="default-tool-select"
              value={effectiveDefaultId || ''}
              onChange={e => handleSelectDefaultTool(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#B91C1C]"
              disabled={activeTools.length === 0}
            >
              {activeTools.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-3 pb-2">
            <input
              type="checkbox"
              id="toggle-changeable"
              checked={formSettings.isChangeable}
              onChange={e => handleToggleChangeable(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-[#B91C1C] focus:ring-[#B91C1C] cursor-pointer"
            />
            <Label htmlFor="toggle-changeable" className="cursor-pointer text-sm font-medium text-[#374151]">
              Allow requesters to change AI Tool on form
            </Label>
          </div>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-6 mb-6">
        <h2 className="text-base font-semibold text-[#111827] mb-4">Add AI Tool</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 max-w-sm space-y-1">
              <Label htmlFor="tool-name" className="sr-only">AI Tool name</Label>
              <Input
                id="tool-name"
                value={newName}
                onChange={e => { setNewName(e.target.value); setAddError(null) }}
                placeholder="Tool name"
                aria-describedby={addError ? 'tool-add-error' : undefined}
              />
            </div>
            <div className="flex-1 max-w-sm">
              <Label htmlFor="tool-desc" className="sr-only">Description (optional)</Label>
              <Input
                id="tool-desc"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
              />
            </div>
            <Button type="submit" disabled={addLoading || !newName.trim()}>
              {addLoading ? 'Adding...' : 'Add Tool'}
            </Button>
          </div>
          {addError && (
            <p id="tool-add-error" role="alert" className="text-xs text-[#B91C1C]">{addError}</p>
          )}
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
        ) : !tools?.length ? (
          <div className="p-12 text-center text-sm text-[#9CA3AF]">No AI tools yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Name</th>
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Description</th>
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Status</th>
                <th className="text-left px-6 py-3 font-medium text-[#374151]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tools.map(tool => (
                <tr key={tool.id} className="border-b border-[#E5E7EB] last:border-0">
                  <td className="px-6 py-3 font-medium text-[#111827]">
                    <span>{tool.name}</span>
                    {tool.id === effectiveDefaultId && (
                      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-[#B91C1C]">
                        Default on Form
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-[#9CA3AF] text-xs max-w-xs truncate">
                    {tool.description ?? '—'}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-semibold ${tool.is_active ? 'text-[#B91C1C]' : 'text-[#9CA3AF]'}`}>
                      {tool.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditDialog(tool)
                          setEditName(tool.name)
                          setEditDescription(tool.description ?? '')
                          setEditError(null)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleToggleActive(tool)}
                      >
                        {tool.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editDialog !== null}
        onOpenChange={(open) => { if (!open) setEditDialog(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit AI Tool</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-tool-name">Name</Label>
              <Input
                id="edit-tool-name"
                value={editName}
                onChange={e => { setEditName(e.target.value); setEditError(null) }}
                placeholder="Tool name"
              />
              {editError && (
                <p role="alert" className="text-xs text-[#B91C1C]">{editError}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-tool-desc">Description (optional)</Label>
              <Textarea
                id="edit-tool-desc"
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                placeholder="Describe this AI tool..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(null)} disabled={editLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading || !editName.trim()}>
                {editLoading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
