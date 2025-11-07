import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'dotenv/config';
// import { Database } from '../types/database.types';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log("Using Supabase key starts with:", process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 15));


if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for server');
}

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export default supabaseAdmin;
