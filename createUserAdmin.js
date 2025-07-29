import { config } from 'dotenv';
  import { createClient } from '@supabase/supabase-js';

  config();

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  async function createUser() {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: 'Leila.sed@harcourts.com.au',
        password: 'Agent123!',
        email_confirm: true,
        user_metadata: {
          name: 'Leila',
          phone: '+61450885200',
          role: 'agent',
        },
      });
      if (error) throw new Error(`Create error: ${error.message} (Code: ${error.code})`);
      console.log('User created:', {
        id: data.user.id,
        email: data.user.email,
        confirmed_at: data.user.confirmed_at,
      });
      return data.user.id;
    } catch (err) {
      console.error('Error:', err);
      return null;
    }
  }

  createUser().then(userId => {
    if (userId) console.log('User ID:', userId);
  });