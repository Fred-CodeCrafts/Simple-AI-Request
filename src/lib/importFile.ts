import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import type { EmployeeRowDraft } from '@/types'
import { validateEmployeeRow } from './validation'

export const FORMULA_INJECTION_PREFIXES = ['=', '+', '-', '@']

export const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  // Some browsers report .csv as application/csv
  'application/csv',
  'text/plain',
]

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB
export const MAX_DATA_ROWS = 500

export interface ParsedImportRow extends EmployeeRowDraft {
  hasFormulaInjection: boolean
  rowIndex: number
}

export interface ImportValidationResult {
  error?: string
  rows: ParsedImportRow[]
}

/**
 * Validates file type, size, and row count before parsing.
 * Returns an error string if the file is rejected, otherwise null.
 */
export function validateImportFile(file: File): string | null {
  // MIME type check (accept by extension fallback too)
  const isXlsx = file.name.endsWith('.xlsx')
  const isCsv = file.name.endsWith('.csv')
  const mimeOk = ACCEPTED_MIME_TYPES.includes(file.type) || isXlsx || isCsv

  if (!mimeOk) {
    return 'Unsupported file type. Please upload an .xlsx or .csv file.'
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File exceeds the 2 MB limit.'
  }

  return null
}

/**
 * Checks a cell value for formula injection.
 */
export function hasFormulaInjection(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return FORMULA_INJECTION_PREFIXES.some(p => value.startsWith(p))
}

/**
 * Parses an import file into rows.
 * Returns rows with validation errors and formula injection flags.
 * NEVER throws on well-formed files (Property 14).
 */
export async function parseImportFile(file: File): Promise<ImportValidationResult> {
  try {
    const arrayBuffer = await file.arrayBuffer()

    // Use raw string type to prevent formula execution
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      raw: true,
    })

    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) {
      return { error: 'No worksheet found in file.', rows: [] }
    }

    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    })

    if (raw.length === 0) {
      return { error: 'File contains no data rows.', rows: [] }
    }

    if (raw.length > MAX_DATA_ROWS) {
      return { error: `File contains too many rows. Maximum is ${MAX_DATA_ROWS}.`, rows: [] }
    }

    const rows: ParsedImportRow[] = raw.map((rawRow, index) => {
      // Map column names (case-insensitive)
      const get = (keys: string[]): string => {
        for (const key of keys) {
          const found = Object.keys(rawRow).find(k => k.toLowerCase() === key.toLowerCase())
          if (found && rawRow[found] !== undefined && rawRow[found] !== null) {
            return String(rawRow[found]).trim()
          }
        }
        return ''
      }

      const employeeFullName = get(['employee full name', 'employeefullname', 'full name', 'name'])
      const position = get(['position', 'job title', 'jobtitle'])
      const employeeJustification = get(['employee justification', 'employeejustification', 'justification'])
      const aiUsageJustification = get(['ai usage justification', 'aiusagejustification', 'ai justification'])
      const expectedImpact = get(['expected impact', 'expectedimpact', 'impact'])

      // Check formula injection on any field
      const allValues = [employeeFullName, position, employeeJustification, aiUsageJustification, expectedImpact]
      const rowHasFormula = allValues.some(v => hasFormulaInjection(v))

      const draft: EmployeeRowDraft = {
        id: uuidv4(),
        employeeFullName,
        position,
        employeeJustification,
        aiUsageJustification,
        expectedImpact,
        errors: {},
      }

      // Validate the row
      const errors = validateEmployeeRow(draft)
      draft.errors = errors

      return {
        ...draft,
        hasFormulaInjection: rowHasFormula,
        rowIndex: index,
      }
    })

    return { rows }
  } catch {
    return { error: 'Failed to parse file. Please check the format and try again.', rows: [] }
  }
}

/**
 * Generates a downloadable Excel template.
 */
export function downloadTemplate(): void {
  const headers = [
    'Employee Full Name',
    'Position',
    'Employee Justification',
    'AI Usage Justification',
    'Expected Impact',
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  XLSX.writeFile(wb, 'ai-access-request-template.xlsx')
}
