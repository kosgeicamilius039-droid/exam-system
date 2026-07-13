// ============================================================
//  shared.js — Supabase client + Auth helpers
//  Loaded after config.js on every protected page.
//  Requires: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// ============================================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const Auth = {
  // ── Session ───────────────────────────────────────────────
  async getSession() {
    const { data: { session } } = await sb.auth.getSession();
    return session;
  },

  // ── Profile (role + username) ─────────────────────────────
  async getProfile() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', user.id).single();
    return data;
  },

  // ── Sign out ──────────────────────────────────────────────
  async logout() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
  },

  // ── Guard: redirect to login if not authenticated or wrong role ──
  // Usage (at top of every protected page):
  //   const profile = await Auth.requireRole(['admin']);
  //   if (!profile) return;
  async requireRole(allowedRoles) {
    const session = await this.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    const profile = await this.getProfile();
    if (!profile || !allowedRoles.includes(profile.role)) {
      window.location.href = 'index.html';
      return null;
    }
    return profile;
  },

  // ── Change password (verifies current password first) ─────
  async changePassword(currentPassword, newPassword) {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return { ok: false, error: 'Not authenticated.' };

    // Re-authenticate to verify current password
    const { error: verifyErr } = await sb.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyErr) return { ok: false, error: 'Current password is incorrect.' };

    // Now update
    const { error: updateErr } = await sb.auth.updateUser({ password: newPassword });
    if (updateErr) return { ok: false, error: updateErr.message };
    return { ok: true };
  },
};

// ── Audit log helper ──────────────────────────────────────────
async function logAudit(action, targetStudentId = null, oldGrade = null, newGrade = null) {
  const entry = { action_taken: action };
  if (targetStudentId !== null) entry.target_student_id = targetStudentId;
  if (oldGrade       !== null) entry.old_grade         = oldGrade;
  if (newGrade       !== null) entry.new_grade         = newGrade;
  // user_id is auto-set by Supabase DEFAULT auth.uid() — we never send it from the client
  await sb.from('forensic_audit_log').insert(entry);
}
