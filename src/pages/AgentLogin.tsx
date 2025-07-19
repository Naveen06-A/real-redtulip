import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { Lock, Mail, AlertCircle, CheckCircle, LogIn, Loader2 } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  update: () => void;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export function AgentLogin() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, initializeAuth, loading: authLoading } = useAuthStore();
  const successMessage = location.state?.message;

  // Particle animation setup
  useEffect(() => {
    const canvas = document.getElementById('particleCanvas') as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Particle[] = [];
    const particleCount = 60;

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;

      constructor() {
        if (!canvas) return; // Ensure canvas exists
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2.5 + 1;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * 0.4 - 0.2;
      }

      update() {
        if (!canvas) return; // Ensure canvas exists
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.size > 0.2) this.size -= 0.008;
        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.7)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function init() {
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw(ctx);
        if (particles[i].size <= 0.2) {
          particles.splice(i, 1);
          i--;
          particles.push(new Particle());
        }
      }
      requestAnimationFrame(animate);
    }

    init();
    animate();

    const handleResize = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pre-login role check and redirect
  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'agent') {
        console.log('Redirecting to agent-dashboard: User and profile verified', { user, profile });
        navigate('/agent-dashboard');
      } else if (profile.role === 'admin') {
        console.log('Agent portal accessed by admin, redirecting to admin-login');
        navigate('/admin-login', {
          state: { message: 'This portal is for agents only. Please use the admin login.' },
        });
      }
    }
  }, [user, profile, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
    setResetMessage(null);
  };

  const handleAgentLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    setLoading(true);

    try {
      // Authenticate user
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) throw new Error('Invalid email or password.');
      if (!data.user) throw new Error('No user data returned from login.');

      // Fetch and validate profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .eq('role', 'agent')
        .single();

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        throw new Error('Access denied: This portal is for agents only. Please use the admin login portal.');
      }

      // Initialize auth store
      await initializeAuth();

      // Verify role in store
      const currentProfile = useAuthStore.getState().profile;
      if (!currentProfile || currentProfile.role !== 'agent') {
        await supabase.auth.signOut();
        throw new Error('Access denied: This portal is for agents only.');
      }

      toast.success('Agent login successful! Redirecting to dashboard...');
      navigate('/agent-dashboard');
    } catch (err: unknown) {
      console.error('Agent Login Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please check your credentials and try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please enter your email to reset your password.');
      toast.error('Email required for password reset.');
      return;
    }

    setLoading(true);
    setError(null);
    setResetMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: 'http://localhost:3000/reset-password',
      });

      if (error) throw new Error('Failed to send password reset email.');
      setResetMessage('Password reset email sent! Check your inbox.');
      toast.success('Password reset email sent!');
    } catch (err: unknown) {
      console.error('Forgot Password Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send password reset email.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-cyan-100 to-blue-200">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-sky-800 text-lg font-medium">Authenticating...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-100 via-cyan-100 to-blue-200 relative overflow-hidden">
      <canvas id="particleCanvas" className="absolute inset-0 pointer-events-none" />
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <div className="relative bg-white/15 backdrop-blur-xl rounded-3xl shadow-2xl p-10 w-full max-w-lg border border-cyan-200/30 animate-slideIn">
        <div className="flex items-center justify-center mb-8">
          <LogIn className="w-10 h-10 text-cyan-400 mr-3 drop-shadow-md" />
          <h1 className="text-3xl font-extrabold text-sky-900 drop-shadow-md">Agent Portal</h1>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-100/80 text-green-800 rounded-xl flex items-center space-x-3 animate-pulseSuccess">
            <CheckCircle className="w-6 h-6" />
            <p className="text-sm">{successMessage}</p>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-100/80 text-red-800 rounded-xl flex items-start space-x-3 animate-pulseError">
            <AlertCircle className="w-6 h-6 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}
        {resetMessage && (
          <div className="mb-6 p-4 bg-green-100/80 text-green-800 rounded-xl flex items-center space-x-3 animate-pulseSuccess">
            <CheckCircle className="w-6 h-6" />
            <p className="text-sm">{resetMessage}</p>
          </div>
        )}

        <form onSubmit={handleAgentLogin} className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-sky-800 mb-2">Agent Email</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-cyan-400 group-hover:text-cyan-300 transition-all duration-300 group-hover:scale-110" />
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-14 pr-4 py-4 rounded-xl bg-sky-50/50 border border-cyan-200/50 text-sky-900 placeholder-cyan-300/70 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-200/50 transition-all duration-500 shadow-inner hover:shadow-cyan-300/30 disabled:opacity-50"
                placeholder="your.email@agency.com"
                required
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-sky-800 mb-2">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-cyan-400 group-hover:text-cyan-300 transition-all duration-300 group-hover:scale-110" />
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-14 pr-4 py-4 rounded-xl bg-sky-50/50 border border-cyan-200/50 text-sky-900 placeholder-cyan-300/70 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-200/50 transition-all duration-500 shadow-inner hover:shadow-cyan-300/30 disabled:opacity-50"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full flex justify-center items-center py-4 px-6 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-300 text-white font-semibold shadow-lg hover:from-cyan-500 hover:to-blue-400 focus:outline-none focus:ring-4 focus:ring-cyan-300/50 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 relative overflow-hidden group"
            disabled={loading}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-cyan-200/50 to-blue-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <span className="relative z-10 flex items-center">
                Sign In
                <LogIn className="w-5 h-5 ml-2" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-cyan-500 hover:text-cyan-400 transition-colors duration-300 hover:underline disabled:opacity-50"
            disabled={loading}
          >
            Forgot Password?
          </button>
          <p className="text-sm text-sky-800">
            Not an agent?{' '}
            <Link to="/admin-login" className="text-cyan-500 hover:text-cyan-400 hover:underline transition-colors duration-300">
              Use Admin Login
            </Link>
          </p>
        </div>
      </div>

      <style>
        {`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .animate-slideIn {
            animation: slideIn 0.8s ease-out forwards;
          }
          @keyframes pulseSuccess {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.02);
            }
          }
          .animate-pulseSuccess {
            animation: pulseSuccess 0.6s ease-in-out;
          }
          @keyframes pulseError {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.02);
            }
          }
          .animate-pulseError {
            animation: pulseError 0.6s ease-in-out;
          }
        `}
      </style>
    </div>
  );
}