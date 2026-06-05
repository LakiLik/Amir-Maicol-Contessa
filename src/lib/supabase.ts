import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Mancano le variabili d'ambiente per Supabase. Verifica il file .env");
}

export const supabase = createClient(supabaseUrl || 'https://xyz.supabase.co', supabaseAnonKey || 'public-anon-key');
