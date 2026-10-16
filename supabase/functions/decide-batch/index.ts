import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  // Extract JWT from Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const token = authHeader.slice(7)

  // Create an authenticated client with the user's JWT
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  // Verify the caller
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check admin role
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Parse body
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

  // Validate batchId
  if (!payload.batchId || typeof payload.batchId !== 'string') {
    return new Response(JSON.stringify({ error: 'batchId is required' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Validate decision
  if (!payload.decision || !['approved', 'declined'].includes(payload.decision as string)) {
    return new Response(JSON.stringify({ error: 'decision must be "approved" or "declined"' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const decision = payload.decision as 'approved' | 'declined'
  const note = typeof payload.note === 'string' ? payload.note.trim() : null

  if (note && note.length > 500) {
    return new Response(JSON.stringify({ error: 'note must not exceed 500 characters' }), {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check batch exists and is not finalized
  const { data: batch } = await supabaseAdmin
    .from('request_batches')
    .select('id, status, finalized_at')
    .eq('id', payload.batchId)
    .single()

  if (!batch) {
    return new Response(JSON.stringify({ error: 'Batch not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (batch.finalized_at !== null) {
    return new Response(JSON.stringify({ error: 'Batch is already finalized' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Update all pending access_requests in the batch
  const { data: updatedRequests, error: updateError } = await supabaseAdmin
    .from('access_requests')
    .update({
      status: decision,
      decision_note: note || null,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq('batch_id', payload.batchId)
    .eq('status', 'pending')
    .select('id')

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update requests' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const updatedCount = updatedRequests?.length ?? 0

  // Insert audit log record
  await supabaseAdmin.from('audit_logs').insert({
    actor_user_id: user.id,
    action: decision === 'approved' ? 'bulk_approve' : 'bulk_decline',
    entity_type: 'request_batch',
    entity_id: payload.batchId,
    details: {
      decision,
      note: note || null,
      updated_count: updatedCount,
    },
  })

  return new Response(JSON.stringify({ updated_count: updatedCount }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
