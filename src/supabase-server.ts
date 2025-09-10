import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseKey) {
  throw new Error('Missing Supabase server credentials');
}
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
export const supabaseClient = createClient(supabaseUrl, supabaseKey);