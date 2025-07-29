import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function retry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Retry ${i + 1}/${retries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function createAgent() {
  try {
    // Check for existing user in profiles
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', 'Leila.sed@harcourts.com.au')
      .single();
    if (existingProfile) {
      console.error('Email already registered in profiles');
      return null;
    }

    // Sign up user with retry
    const { data, error } = await retry(() =>
      supabase.auth.signUp({
        email: 'Leila.sed@harcourts.com.au',
        password: 'Agent123!',
        options: {
          emailRedirectTo: undefined,
          data: {
            name: 'Leila',
            phone: '+61450885200',
            role: 'agent',
          },
        },
      })
    );

    if (error) {
      console.error('SignUp error:', {
        message: error.message,
        code: error.code,
        details: error,
      });
      throw new Error(`Authentication error: ${error.message} (Code: ${error.code || 'N/A'})`);
    }

    if (!data.user) {
      console.error('No user returned from signUp');
      return null;
    }

    console.log('User created:', {
      id: data.user.id,
      email: data.user.email,
      confirmed_at: data.user.confirmed_at,
    });

    // Insert into profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: 'Leila.sed@harcourts.com.au',
        name: 'Leila',
        phone: '+61450885200',
        role: 'agent',
      });

    if (profileError) {
      console.error('Profile insert error:', {
        message: profileError.message,
        code: profileError.code,
        details: profileError,
      });
      throw new Error(`Profile insert error: ${profileError.message} (Code: ${profileError.code || 'N/A'})`);
    }

    console.log('Profile inserted successfully');
    return data.user.id;
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

createAgent().then(userId => {
  if (userId) console.log('Agent created with ID:', userId);
}).catch(console.error);