import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { UserPlus, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

interface FormData {
  email: string;
  password: string;
  name: string;
  phone: string;
  agencyName: string;
}

export function AgentRegister() {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    name: '',
    phone: '',
    agencyName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryWithoutMetadata, setRetryWithoutMetadata] = useState(false);
  const [forceMinimalSignup, setForceMinimalSignup] = useState(false); // Manual toggle
  const navigate = useNavigate();
  const { setUser, fetchProfile } = useAuthStore();

  const validateForm = (): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;
    if (!formData.name.trim()) return 'Name is required';
    if (formData.name.length > 50) return 'Name must be 50 characters or less';
    if (!formData.phone.trim() || !isValidPhoneNumber(formData.phone, 'AU')) return 'Valid Australian phone number is required (e.g., +61412345678)';
    if (!emailRegex.test(formData.email)) return 'Valid email is required';
    if (formData.email.length > 255) return 'Email must be 255 characters or less';
    if (!formData.agencyName.trim()) return 'Agency name is required';
    if (formData.agencyName.length > 50) return 'Agency name must be 50 characters or less';
    if (!passwordRegex.test(formData.password)) return 'Password must be at least 8 characters with letters and numbers';
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const sanitizedValue =
      name === 'phone'
        ? value.trim().replace(/[^+0-9]/g, '')
        : name === 'email'
        ? value.trim().replace(/[^a-zA-Z0-9@.]/g, '')
        : value.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    setFormData((prev) => ({ ...prev, [name]: sanitizedValue }));
    setError(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        setLoading(false);
        return;
      }

      const phoneNumber = parsePhoneNumber(formData.phone, 'AU');
      const formattedPhone = phoneNumber?.isValid() ? phoneNumber.format('E.164') : formData.phone;

      console.log('Signup attempt:', {
        timestamp: new Date().toISOString(),
        projectId: 'wvvifjtwpjwvebimxfza',
        email: formData.email,
        password: '****',
        retryWithoutMetadata,
        forceMinimalSignup,
        options: forceMinimalSignup || retryWithoutMetadata
          ? null
          : {
              data: {
                name: formData.name,
                phone: formattedPhone,
                agency_name: formData.agencyName,
              },
            },
      });

      const signupOptions = forceMinimalSignup || retryWithoutMetadata
        ? { email: formData.email, password: formData.password }
        : {
            email: formData.email,
            password: formData.password,
            options: {
              data: {
                name: formData.name.slice(0, 50),
                phone: formattedPhone,
                agency_name: formData.agencyName.slice(0, 50),
              },
            },
          };

      const { data, error: signUpError } = await supabase.auth.signUp(signupOptions);

      if (signUpError) {
        console.error('Signup error:', JSON.stringify({
          error: signUpError,
          status: signUpError.status,
          code: signUpError.code,
          message: signUpError.message,
          timestamp: new Date().toISOString(),
        }, null, 2));
        const errorMessages: Record<string, string> = {
          user_already_exists: 'This email is already registered. Please try logging in instead.',
          invalid_email: 'Please enter a valid email address.',
          weak_password: 'Password is too weak. Please use at least 8 characters with letters and numbers.',
          unexpected_failure: forceMinimalSignup || retryWithoutMetadata
            ? `Database error saving new user. Please try again later or contact Supabase support with project ID wvvifjtwpjwvebimxfza, error code: unexpected_failure, and timestamp: ${new Date().toISOString()}.`
            : `Database error saving new user. Retrying with minimal data. If this persists, please check your inputs (e.g., phone: +61412345678) or contact Supabase support with project ID wvvifjtwpjwvebimxfza, error code: unexpected_failure, and timestamp: ${new Date().toISOString()}.`,
          default: `Registration failed: ${signUpError.message} (Code: ${signUpError.code})`,
        };
        setError(errorMessages[signUpError.code] || errorMessages.default);
        if (signUpError.code === 'unexpected_failure' && !retryWithoutMetadata && !forceMinimalSignup) {
          setRetryWithoutMetadata(true);
          setLoading(false);
          return;
        }
        if (signUpError.code === 'unexpected_failure' && retryWithoutMetadata && !forceMinimalSignup) {
          setRetryWithoutMetadata(false);
          setForceMinimalSignup(true);
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('No user data returned from registration');
        setLoading(false);
        return;
      }

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (!existingProfile && !forceMinimalSignup) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          name: formData.name.slice(0, 50),
          phone: formattedPhone,
          email: formData.email,
          role: 'agent',
          agency_name: formData.agencyName.slice(0, 50),
        });

        if (profileError) {
          console.error('Profile error:', JSON.stringify({
            error: profileError,
            message: profileError.message,
            details: profileError.details,
            code: profileError.code,
            timestamp: new Date().toISOString(),
          }, null, 2));
          setError('Failed to create profile. Please try again or contact support with error code: profile_insert_failure.');
          setLoading(false);
          return;
        }
      }

      setFormData({
        email: '',
        password: '',
        name: '',
        phone: '',
        agencyName: '',
      });
      setRetryWithoutMetadata(false);
      setForceMinimalSignup(false);
      setUser(data.user);
      await fetchProfile();
      navigate('/agent-login', {
        state: { message: 'Registration successful! Please check your email to confirm, then log in.' },
      });
    } catch (err: any) {
      console.error('Registration error:', JSON.stringify({
        error: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString(),
      }, null, 2));
      setError(
        `Database error during signup. Please try again later or contact Supabase support with project ID wvvifjtwpjwvebimxfza, error code: unexpected_failure, and timestamp: ${new Date().toISOString()}.`
      );
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-center mb-6">
          <UserPlus className="w-12 h-12 text-blue-600" />
          <h2 className="text-2xl font-bold ml-2">Register as Agent</h2>
        </div>
        {error && (
          <div
            id="error-message"
            className="bg-red-50 text-red-500 p-4 rounded mb-4 flex items-start space-x-2"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p>{error}</p>
              {error.includes('already registered') && (
                <Link to="/agent-login" className="text-blue-600 hover:underline">
                  Go to Login
                </Link>
              )}
            </div>
          </div>
        )}
        <form onSubmit={handleRegister} className="space-y-4" aria-busy={loading}>
          {['name', 'email', 'phone', 'agencyName', 'password'].map((field) => (
            <div key={field}>
              <label htmlFor={field} className="block text-gray-700 mb-1 capitalize">
                {field.replace('agencyName', 'Agency Name')}
              </label>
              <input
                id={field}
                name={field}
                type={field === 'email' ? 'email' : field === 'password' ? 'password' : field === 'phone' ? 'tel' : 'text'}
                value={formData[field as keyof FormData]}
                onChange={handleChange}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                disabled={loading}
                required
                maxLength={field === 'name' || field === 'agencyName' ? 50 : field === 'email' ? 255 : undefined}
                minLength={field === 'password' ? 8 : undefined}
                placeholder={field === 'phone' ? 'e.g., +61412345678' : field === 'email' ? 'e.g., user@example.com' : undefined}
                aria-describedby={error ? 'error-message' : undefined}
              />
            </div>
          ))}
          <div>
            <label htmlFor="forceMinimalSignup" className="block text-gray-700 mb-1">
              Force Minimal Signup (Debug: Email and Password Only)
            </label>
            <input
              id="forceMinimalSignup"
              type="checkbox"
              checked={forceMinimalSignup}
              onChange={(e) => setForceMinimalSignup(e.target.checked)}
              className="mr-2"
            />
            <span className="text-sm text-gray-600">Enable for testing minimal signup</span>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Registering...
              </>
            ) : (
              'Register'
            )}
          </button>
          <p className="text-center text-sm text-gray-600">
            Already registered?{' '}
            <Link to="/agent-login" className="text-blue-600 hover:underline">
              Login here
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}