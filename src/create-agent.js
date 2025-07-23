const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wvvifjtwpjwvebimxfza.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2dmlmanR3cGp3dmViaW14ZnphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczOTY3MjU5MSwiZXhwIjoyMDU1MjQ4NTkxfQ.t-4NKePsk7wjouCFDWGMeOqjBflAiLApkUpb0ykCJnw', // From Supabase Dashboard > Settings > API
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function createAgent(email, password, name, phone, createdBy) {
  try {
    // Create user with Admin API
    const { data: user, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) {
      throw new Error(`Auth error: ${authError.message} (Code: ${authError.code}, Status: ${authError.status})`);
    }

    console.log('User created:', { id: user.user.id, email });

    // Insert into profiles table (if needed)
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.user.id,
        full_name: name,
        phone: phone,
        // Add other columns expected by your profiles table
      });

    if (profileError) {
      throw new Error(`Profile insert error: ${profileError.message}`);
    }

    // Insert into agents table
    const { error: insertError } = await supabase
      .from('agents')
      .insert({
        id: user.user.id,
        email,
        name,
        phone,
        created_by: createdBy,
      });

    if (insertError) {
      throw new Error(`Agent insert error: ${insertError.message}`);
    }

    console.log('Agent inserted:', { id: user.user.id, email, name, phone });

    // Send password reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'http://localhost:5173/reset-password',
    });

    if (resetError) {
      console.warn('Failed to send password reset email:', resetError.message);
    } else {
      console.log('Password reset email sent');
    }

    return { id: user.user.id, email, name, phone };
  } catch (err) {
    console.error('Error creating agent:', err.message);
    throw err;
  }
}

// Example usage
createAgent(
  `test+${Date.now()}@example.com`,
  'password123',
  'Test Agent',
  '+61412345678',
  'your-profile-id' // Replace with profile.id from auth.users
).then(result => {
  console.log('Success:', result);
}).catch(err => {
  console.error('Failed:', err);
});