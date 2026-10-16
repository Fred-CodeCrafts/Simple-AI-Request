import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { ParsedImportRow } from '@/lib/importFile'

interface ImportPreviewModalProps {
  open: boolean
  rows: ParsedImportRow[]
  onConfirm: (validRows: ParsedImportRow[]) => void
  onCancel: () => void
}

export default function ImportPreviewModal({ open, rows, onConfirm, onCancel }: ImportPreviewModalProps) {
  const validRows = rows.filter(r => Object.keys(r.errors).length === 0 && !r.hasFormulaInjection)
  const invalidRows = rows.filter(r => Object.keys(r.errors).length > 0)
  const injectionRows = rows.filter(r => r.hasFormulaInjection)
  const hasWarnings = injectionRows.length > 0 || invalidRows.length > 0

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Preview</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-2">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-[#F3F4F6] rounded-md p-3">
              <p className="text-[#9CA3AF] text-xs font-medium">Total rows</p>
              <p className="text-lg font-bold text-[#111827]">{rows.length}</p>
            </div>
            <div className="bg-[#F3F4F6] rounded-md p-3">
              <p className="text-[#9CA3AF] text-xs font-medium">Valid rows</p>
              <p className="text-lg font-bold text-[#B91C1C]">{validRows.length}</p>
            </div>
            <div className="bg-[#F3F4F6] rounded-md p-3">
              <p className="text-[#9CA3AF] text-xs font-medium">Invalid / skipped</p>
              <p className="text-lg font-bold text-[#374151]">{rows.length - validRows.length}</p>
            </div>
          </div>

          {/* Formula injection warning */}
          {injectionRows.length > 0 && (
            <div className="rounded-md border border-[#E5E7EB] bg-[#FFFBEB] p-3">
              <p className="text-sm font-medium text-[#92400E]">Formula injection detected</p>
              <p className="text-xs text-[#92400E] mt-0.5">
                {injectionRows.length} row(s) contain values starting with =, +, -, or @ and will be skipped.
              </p>
            </div>
          )}

          {/* Rows table */}
          <div className="overflow-x-auto border border-[#E5E7EB] rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="text-left px-3 py-2 font-medium text-[#374151]">#</th>
                  <th className="text-left px-3 py-2 font-medium text-[#374151]">Employee</th>
                  <th className="text-left px-3 py-2 font-medium text-[#374151]">Position</th>
                  <th className="text-left px-3 py-2 font-medium text-[#374151]">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-[#374151]">Issues</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const hasErrors = Object.keys(row.errors).length > 0
                  const hasInjection = row.hasFormulaInjection
                  const isValid = !hasErrors && !hasInjection

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-[#E5E7EB] last:border-0 ${
                        !isValid ? 'bg-[#FFF9F9]' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-[#9CA3AF]">{row.rowIndex + 1}</td>
                      <td className="px-3 py-2 text-[#374151] max-w-[150px] truncate">
                        {row.employeeFullName || '—'}
                      </td>
                      <td className="px-3 py-2 text-[#374151] max-w-[120px] truncate">
                        {row.position || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isValid
                              ? 'bg-[#F3F4F6] text-[#374151]'
                              : 'bg-[#FEE2E2] text-[#B91C1C]'
                          }`}
                        >
                          {isValid ? 'Valid' : hasInjection ? 'Injection risk' : 'Invalid'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#9CA3AF] max-w-[200px]">
                        {hasInjection && (
                          <p>Formula injection in one or more fields</p>
                        )}
                        {!hasInjection && hasErrors && (
                          <ul className="space-y-0.5">
                            {Object.values(row.errors).map((msg, i) => (
                              <li key={i}>{msg}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hasWarnings && (
            <p className="text-xs text-[#9CA3AF]">
              Only valid rows without formula injection will be added to the form.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(validRows)}
            disabled={validRows.length === 0}
          >
            Add {validRows.length} Valid {validRows.length === 1 ? 'Row' : 'Rows'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
