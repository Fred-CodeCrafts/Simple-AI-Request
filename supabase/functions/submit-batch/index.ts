import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function generateReferenceNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'REQ-'
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const windowStart = new Date(Date.now() - 60_000).toISOString()

  const { count: recentCount } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('created_at', windowStart)

  if ((recentCount ?? 0) >= 10) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  await supabase.from('rate_limits').insert({ ip_address: ip })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const payload = body as Record<string, unknown>

  if (!payload.departmentId || typeof payload.departmentId !== 'string') {
    return new Response(JSON.stringify({ error: 'departmentId is required' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!payload.aiToolId || typeof payload.aiToolId !== 'string') {
    return new Response(JSON.stringify({ error: 'aiToolId is required' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const employees = payload.employees as unknown[]
  if (!Array.isArray(employees) || employees.length === 0) {
    return new Response(JSON.stringify({ error: 'At least one employee row is required' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (employees.length > 200) {
    return new Response(JSON.stringify({ error: 'Too many employee rows' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const fieldLimits: Record<string, number> = {
    employeeFullName: 255,
    position: 255,
    employeeJustification: 2000,
    aiUsageJustification: 2000,
    expectedImpact: 2000,
  }

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i] as Record<string, unknown>
    for (const [field, maxLen] of Object.entries(fieldLimits)) {
      const val = emp[field]
      if (!val || typeof val !== 'string' || val.trim() === '') {
        return new Response(JSON.stringify({ error: `Row ${i + 1}: ${field} is required` }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (val.length > maxLen) {
        return new Response(JSON.stringify({ error: `Row ${i + 1}: ${field} exceeds ${maxLen} characters` }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  const { data: dept } = await supabase
    .from('departments')
    .select('id, name')
    .eq('id', payload.departmentId)
    .eq('is_active', true)
    .single()

  if (!dept) {
    return new Response(JSON.stringify({ error: 'Invalid department or AI tool selection' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: tool } = await supabase
    .from('ai_tools')
    .select('id, name')
    .eq('id', payload.aiToolId)
    .eq('is_active', true)
    .single()

  if (!tool) {
    return new Response(JSON.stringify({ error: 'Invalid department or AI tool selection' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let referenceNumber = ''
  let attempts = 0
  while (attempts < 10) {
    const candidate = generateReferenceNumber()
    const { data: existing } = await supabase
      .from('request_batches')
      .select('id')
      .eq('reference_number', candidate)
      .single()
    if (!existing) {
      referenceNumber = candidate
      break
    }
    attempts++
  }

  if (!referenceNumber) {
    return new Response(JSON.stringify({ error: 'Submission failed. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: batch, error: batchError } = await supabase
    .from('request_batches')
    .insert({
      reference_number: referenceNumber,
      department_id: payload.departmentId,
      department_name_snapshot: dept.name,
      ai_tool_id: payload.aiToolId,
      ai_tool_name_snapshot: tool.name,
      submitted_by_name: payload.submittedByName ?? null,
      submitted_by_email: payload.submittedByEmail ?? null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (batchError || !batch) {
    return new Response(JSON.stringify({ error: 'Submission failed. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const accessRequests = (employees as Record<string, string>[]).map(emp => ({
    batch_id: batch.id,
    employee_full_name: emp.employeeFullName.trim(),
    position: emp.position.trim(),
    employee_justification: emp.employeeJustification.trim(),
    ai_usage_justification: emp.aiUsageJustification.trim(),
    expected_impact: emp.expectedImpact.trim(),
    status: 'pending',
  }))

  const { error: requestsError } = await supabase
    .from('access_requests')
    .insert(accessRequests)

  if (requestsError) {
    await supabase.from('request_batches').delete().eq('id', batch.id)
    return new Response(JSON.stringify({ error: 'Submission failed. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ referenceNumber }), {
    status: 201,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
