// supabase/functions/create-agent/index.ts
import { serve } from 'std/http';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { email, permissions, name, phone } = await req.json();
    
    console.log('Creating agent for:', { email, name, phone, timestamp: new Date().toISOString() });

    // Create auth user
    console.log('Before auth.admin.createUser:', { email, timestamp: new Date().toISOString() });
    const { data: user, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: 'agent' },
    });
    console.log('After auth.admin.createUser:', { user, authError, timestamp: new Date().toISOString() });

    if (authError) {
      console.error('Auth error:', {
        message: authError.message,
        code: authError.code,
        details: authError,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Authentication error: ${authError.message} (Code: ${authError.code || 'N/A'})`);
    }

    // Create profile
    console.log('Before profiles insert:', { userId: user.user.id, timestamp: new Date().toISOString() });
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .insert({
        id: user.user.id,
        email,
        name,
        phone,
        role: 'agent',
        agent_id: `AGENT-${crypto.randomUUID().slice(0, 8)}`,
        permissions,
      })
      .select()
      .single();
    console.log('After profiles insert:', { profile, profileError, timestamp: new Date().toISOString() });

    if (profileError) {
      console.error('Profile error:', {
        message: profileError.message,
        code: profileError.code,
        details: profileError,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Profile insert error: ${profileError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: profile }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  } catch (error) {
    console.error('Error:', {
      message: error.message,
      code: error.code,
      details: error,
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
});