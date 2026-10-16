import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { v4 as uuidv4 } from 'uuid'
import { Plus, Trash2, Upload, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { validateEmployeeRow } from '@/lib/validation'
import { parseImportFile, validateImportFile, downloadTemplate } from '@/lib/importFile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ImportPreviewModal from '@/components/public/ImportPreviewModal'
import type { EmployeeRowDraft, Department, AITool } from '@/types'
import type { ParsedImportRow } from '@/lib/importFile'

const FORM_SLUG = import.meta.env.VITE_FORM_SLUG as string

const FIELDS: { key: keyof Omit<EmployeeRowDraft, 'id' | 'errors'>; label: string; type: 'input' | 'textarea' }[] = [
  { key: 'employeeFullName', label: 'Employee Full Name', type: 'input' },
  { key: 'position', label: 'Position / Job Title', type: 'input' },
  { key: 'employeeJustification', label: 'Employee Justification', type: 'textarea' },
  { key: 'aiUsageJustification', label: 'AI Usage Justification', type: 'textarea' },
  { key: 'expectedImpact', label: 'Expected Impact', type: 'textarea' },
]

function emptyRow(): EmployeeRowDraft {
  return {
    id: uuidv4(),
    employeeFullName: '',
    position: '',
    employeeJustification: '',
    aiUsageJustification: '',
    expectedImpact: '',
    errors: {},
  }
}

async function fetchDepartments(): Promise<Department[]> {
  const { data } = await supabase
    .from('departments')
    .select('*')
    .eq('is_active', true)
    .order('name')
  return data ?? []
}

async function fetchAITools(): Promise<AITool[]> {
  const { data } = await supabase
    .from('ai_tools')
    .select('*')
    .eq('is_active', true)
    .order('name')
  return data ?? []
}

export default function RequestFormPage() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [departmentId, setDepartmentId] = useState('')
  const [aiToolId, setAiToolId] = useState('')
  const [submittedByName, setSubmittedByName] = useState('')
  const [submittedByEmail, setSubmittedByEmail] = useState('')
  const [rows, setRows] = useState<EmployeeRowDraft[]>([emptyRow()])
  const [formErrors, setFormErrors] = useState<{ departmentId?: string; aiToolId?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [importPreview, setImportPreview] = useState<ParsedImportRow[]>([])
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFileError, setImportFileError] = useState<string | null>(null)

  const { data: departments } = useQuery({ queryKey: ['departments-public'], queryFn: fetchDepartments })
  const { data: aiTools } = useQuery({ queryKey: ['ai-tools-public'], queryFn: fetchAITools })

  function updateRow(id: string, field: keyof Omit<EmployeeRowDraft, 'id' | 'errors'>, value: string) {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r
        const updated = { ...r, [field]: value }
        // Re-validate this row
        const errors = validateEmployeeRow(updated)
        return { ...updated, errors }
      })
    )
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }

  function removeRow(id: string) {
    setRows(prev => {
      if (prev.length <= 1) return prev
      return prev.filter(r => r.id !== id)
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-selected
    e.target.value = ''
    setImportFileError(null)

    const fileError = validateImportFile(file)
    if (fileError) {
      setImportFileError(fileError)
      return
    }

    const result = await parseImportFile(file)
    if (result.error) {
      setImportFileError(result.error)
      return
    }

    setImportPreview(result.rows)
    setImportModalOpen(true)
  }

  function handleImportConfirm(validRows: ParsedImportRow[]) {
    setRows(prev => {
      // If only one empty row, replace it; otherwise append
      const hasOnlyEmptyRow =
        prev.length === 1 &&
        !prev[0].employeeFullName &&
        !prev[0].position

      const base = hasOnlyEmptyRow ? [] : prev
      return [...base, ...validRows]
    })
    setImportModalOpen(false)
  }

  function validateForm(): boolean {
    const errors: typeof formErrors = {}
    if (!departmentId) errors.departmentId = 'Please select a department.'
    if (!aiToolId) errors.aiToolId = 'Please select an AI tool.'
    setFormErrors(errors)

    // Validate all rows
    const validatedRows = rows.map(r => ({
      ...r,
      errors: validateEmployeeRow(r),
    }))
    setRows(validatedRows)

    const anyRowErrors = validatedRows.some(r => Object.keys(r.errors).length > 0)
    return Object.keys(errors).length === 0 && !anyRowErrors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    if (!validateForm()) return

    setSubmitting(true)
    try {
      const payload = {
        departmentId,
        aiToolId,
        submittedByName: submittedByName.trim() || undefined,
        submittedByEmail: submittedByEmail.trim() || undefined,
        employees: rows.map(r => ({
          employeeFullName: r.employeeFullName.trim(),
          position: r.position.trim(),
          employeeJustification: r.employeeJustification.trim(),
          aiUsageJustification: r.aiUsageJustification.trim(),
          expectedImpact: r.expectedImpact.trim(),
        })),
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setSubmitError((data as { error?: string }).error ?? 'Submission failed. Please try again.')
        return
      }

      const data = await response.json() as { referenceNumber: string }
      navigate(`/submit/${FORM_SLUG}/confirmation`, { state: { referenceNumber: data.referenceNumber } })
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#111827]">AI Access Request</h1>
          <p className="text-[#9CA3AF] mt-2">
            Submit access requests for your team members. All fields are required unless marked optional.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Department & AI Tool */}
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
            <h2 className="text-base font-semibold text-[#111827] mb-4">Request Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="department">Department</Label>
                <select
                  id="department"
                  value={departmentId}
                  onChange={e => { setDepartmentId(e.target.value); setFormErrors(prev => ({ ...prev, departmentId: undefined })) }}
                  className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#B91C1C]"
                  aria-describedby={formErrors.departmentId ? 'dept-error' : undefined}
                  aria-invalid={!!formErrors.departmentId}
                >
                  <option value="">Select department...</option>
                  {departments?.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {formErrors.departmentId && (
                  <p id="dept-error" role="alert" className="text-xs text-[#B91C1C]">{formErrors.departmentId}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-tool">AI Tool</Label>
                <select
                  id="ai-tool"
                  value={aiToolId}
                  onChange={e => { setAiToolId(e.target.value); setFormErrors(prev => ({ ...prev, aiToolId: undefined })) }}
                  className="w-full border border-[#E5E7EB] rounded-md px-3 py-2 text-sm bg-white text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#B91C1C]"
                  aria-describedby={formErrors.aiToolId ? 'tool-error' : undefined}
                  aria-invalid={!!formErrors.aiToolId}
                >
                  <option value="">Select AI tool...</option>
                  {aiTools?.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {formErrors.aiToolId && (
                  <p id="tool-error" role="alert" className="text-xs text-[#B91C1C]">{formErrors.aiToolId}</p>
                )}
              </div>
            </div>

            {/* Optional requester info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-[#E5E7EB]">
              <div className="space-y-1.5">
                <Label htmlFor="requester-name">Your Name <span className="text-[#9CA3AF] font-normal">(optional)</span></Label>
                <Input
                  id="requester-name"
                  value={submittedByName}
                  onChange={e => setSubmittedByName(e.target.value)}
                  placeholder="Jane Smith"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="requester-email">Your Email <span className="text-[#9CA3AF] font-normal">(optional)</span></Label>
                <Input
                  id="requester-email"
                  type="email"
                  value={submittedByEmail}
                  onChange={e => setSubmittedByEmail(e.target.value)}
                  placeholder="jane@company.com"
                  autoComplete="email"
                />
              </div>
            </div>
          </div>

          {/* Employee rows */}
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#111827]">
                Employees <span className="text-[#9CA3AF] font-normal text-sm">({rows.length})</span>
              </h2>
              <div className="flex gap-2">
                {/* Import button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  Import
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="sr-only"
                  aria-label="Import employees from file"
                  onChange={handleFileChange}
                />
                {/* Download template */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Template
                </Button>
              </div>
            </div>

            {importFileError && (
              <p role="alert" className="text-sm text-[#B91C1C] mb-3">{importFileError}</p>
            )}

            <div className="space-y-6">
              {rows.map((row, idx) => (
                <div key={row.id} className="border border-[#E5E7EB] rounded-md p-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[#374151]">Employee {idx + 1}</h3>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-[#9CA3AF] hover:text-[#B91C1C] transition-colors"
                        aria-label={`Remove employee ${idx + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FIELDS.map(f => {
                      const error = row.errors[f.key]
                      const inputId = `${row.id}-${f.key}`
                      const errId = `${inputId}-error`
                      return (
                        <div key={f.key} className={`space-y-1 ${f.type === 'textarea' ? 'md:col-span-2' : ''}`}>
                          <Label htmlFor={inputId}>{f.label}</Label>
                          {f.type === 'input' ? (
                            <Input
                              id={inputId}
                              value={row[f.key]}
                              onChange={e => updateRow(row.id, f.key, e.target.value)}
                              aria-describedby={error ? errId : undefined}
                              aria-invalid={!!error}
                            />
                          ) : (
                            <Textarea
                              id={inputId}
                              value={row[f.key]}
                              onChange={e => updateRow(row.id, f.key, e.target.value)}
                              rows={3}
                              aria-describedby={error ? errId : undefined}
                              aria-invalid={!!error}
                            />
                          )}
                          {error && (
                            <p id={errId} role="alert" className="text-xs text-[#B91C1C]">{error}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={addRow}
              disabled={rows.length >= 200}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add Employee
            </Button>
          </div>

          {/* Submit */}
          {submitError && (
            <p role="alert" className="text-sm text-[#B91C1C]">{submitError}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </form>
      </div>

      {/* Import preview modal */}
      <ImportPreviewModal
        open={importModalOpen}
        rows={importPreview}
        onConfirm={handleImportConfirm}
        onCancel={() => setImportModalOpen(false)}
      />
    </div>
  )
}
