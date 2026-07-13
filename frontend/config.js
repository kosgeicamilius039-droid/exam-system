// ============================================================
//  config.js — Supabase project credentials
//  Loaded before shared.js on every page.
//  These are SAFE to commit — the publishable key is public by design.
//  Row Level Security (RLS) enforces what each user can access.
// ============================================================
const SUPABASE_URL  = 'https://jzruydcwcdapfnlzfifa.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_Qkwc2L1jD9-vKatm31Nh3g_A8qSWEhi';

// Edge Function base URL (same Supabase project)
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;
