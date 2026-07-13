// ============================================================
//  create-user — Supabase Edge Function
//  Only admins can call this. Creates a Supabase Auth user
//  and the matching profiles row in one atomic operation.
//
//  POST /functions/v1/create-user
//  Body: { username, password, role }
//  Auth: Bearer <admin JWT>
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ ok: false, error: 'Not authenticated.' }, 401);
    }

    // ── Verify caller is an admin ────────────────────────────
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: profile, error: profileErr } = await supabaseUser
      .from('profiles')
      .select('role, id')
      .single();

    if (profileErr || profile?.role !== 'admin') {
      return json({ ok: false, error: 'Insufficient privileges.' }, 403);
    }

    // ── Validate body ────────────────────────────────────────
    const { username, password, role } = await req.json();

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return json({ ok: false, error: 'Username is required.' }, 400);
    }
    if (!password || password.length < 10) {
      return json({ ok: false, error: 'Password must be at least 10 characters.' }, 400);
    }
    if (!['admin', 'teacher'].includes(role)) {
      return json({ ok: false, error: "Role must be 'admin' or 'teacher'." }, 400);
    }

    // ── Admin client (service role, bypasses RLS) ────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check username is not already taken
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle();

    if (existing) {
      return json({ ok: false, error: 'Username already exists.' }, 400);
    }

    // ── Create auth user ─────────────────────────────────────
    // We store accounts as username@examsystem.local internally.
    // The login page converts username → email before calling signInWithPassword.
    const email = `${username.trim().toLowerCase()}@examsystem.local`;

    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email verification, this is an internal system
    });

    if (createErr || !newUser?.user) {
      return json({ ok: false, error: createErr?.message ?? 'Failed to create user.' }, 500);
    }

    // ── Create profile row ───────────────────────────────────
    const { error: insertErr } = await supabaseAdmin
      .from('profiles')
      .insert({ id: newUser.user.id, username: username.trim(), role });

    if (insertErr) {
      // Roll back — delete the orphaned auth user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return json({ ok: false, error: 'Failed to create user profile.' }, 500);
    }

    // ── Audit log ────────────────────────────────────────────
    await supabaseAdmin.from('forensic_audit_log').insert({
      user_id:      profile.id,
      action_taken: 'USER_CREATED',
      ip_address:   req.headers.get('x-forwarded-for') ?? null,
    });

    return json({ ok: true, user_id: newUser.user.id }, 201);

  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'Internal server error.' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
