import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types/types';

interface AuthState {
  user: { id: string; email?: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  setUser: (user: { id: string; email?: string } | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  initializeAuth: () => Promise<void>;
  fetchProfile: (userId: string, email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  getUserProfile: () => UserProfile | null;
  updateRole: (role: 'user' | 'agent' | 'admin') => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  loading: false,
  authError: null,
  setUser: (user) => {
    console.log('Setting user:', user);
    set({ user });
  },
  setProfile: (profile) => {
    console.log('Setting profile:', profile);
    set({ profile });
  },
  initializeAuth: async () => {
    console.log('Starting initializeAuth...');
    const startTime = performance.now();
    set({ loading: true, authError: null });

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Session response:', { 
        session, 
        userId: session?.user?.id, 
        email: session?.user?.email, 
        time: `${performance.now() - startTime}ms` 
      });
      if (error) {
        console.error('getSession error:', error.message, error);
        throw new Error(`getSession error: ${error.message}`);
      }

      if (session?.user) {
        set({ user: { id: session.user.id, email: session.user.email } });
        await get().fetchProfile(session.user.id, session.user.email);
      } else {
        console.log('No active session found');
        set({ user: null, profile: null });
      }
    } catch (error: any) {
      console.error('initializeAuth failed:', { 
        message: error.message, 
        stack: error.stack 
      });
      set({ authError: error.message, user: null, profile: null });
    } finally {
      set({ loading: false });
      console.log('initializeAuth completed', { 
        user: get().user, 
        profile: get().profile, 
        time: `${performance.now() - startTime}ms` 
      });
    }
  },
  fetchProfile: async (userId: string, email?: string) => {
    console.log('Fetching profile for user:', userId);
    const startTime = performance.now();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, phone, email, role')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No profile found, creating one...');
          const newProfile: UserProfile = {
            id: userId,
            name: email?.split('@')[0] || 'Unknown',
            phone: '',
            email: email || '',
            role: 'user',
          };
          const { data: insertData, error: insertError } = await supabase
            .from('profiles')
            .insert(newProfile)
            .select()
            .single();
          if (insertError) {
            console.error('Profile creation error:', { 
              message: insertError.message, 
              code: insertError.code, 
              details: insertError.details 
            });
            throw new Error(`Profile creation error: ${insertError.message}`);
          }
          console.log('Profile created:', insertData, `Time: ${performance.now() - startTime}ms`);
          set({ profile: insertData });
        } else {
          console.error('fetchProfile error:', { 
            message: error.message, 
            code: error.code, 
            details: error.details 
          });
          throw new Error(`fetchProfile error: ${error.message}`);
        }
      } else {
        console.log('Profile fetched:', data, `Time: ${performance.now() - startTime}ms`);
        set({ profile: data });
      }
    } catch (error: any) {
      console.error('fetchProfile failed:', { 
        message: error.message, 
        stack: error.stack 
      });
      set({ authError: error.message, profile: null });
    }
  },
  updateRole: async (role: 'user' | 'agent' | 'admin') => {
    const { user } = get();
    if (!user) {
      console.log('No user to update role for');
      set({ authError: 'No user logged in' });
      return;
    }
    try {
      console.log('Updating role for user:', user.id, 'to:', role);
      const { data, error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', user.id)
        .select()
        .single();
      if (error) {
        console.error('updateRole error:', { 
          message: error.message, 
          code: error.code, 
          details: error.details 
        });
        throw new Error(`updateRole error: ${error.message}`);
      }
      console.log('Role updated:', data);
      set({ profile: data });
    } catch (error: any) {
      console.error('updateRole failed:', { 
        message: error.message, 
        stack: error.stack 
      });
      set({ authError: error.message });
    }
  },
  signOut: async () => {
    try {
      console.log('Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error.message, error);
        throw new Error(`Sign out error: ${error.message}`);
      }
      set({ user: null, profile: null, loading: false, authError: null });
      console.log('Signed out successfully');
    } catch (error: any) {
      console.error('Sign out failed:', { 
        message: error.message, 
        stack: error.stack 
      });
      set({ authError: error.message });
    }
  },
  getUserProfile: () => get().profile,
  checkAuth: async () => {
    const { user, profile, loading } = get();
    if (loading) {
      console.log('Auth is still loading, waiting...');
      await new Promise(resolve => setTimeout(resolve, 500));
      return get().checkAuth();
    }
    const isAuthenticated = !!user && !!profile && profile.role === 'admin';
    console.log('Check auth result:', isAuthenticated, { user, profile });
    return isAuthenticated;
  },
}));

supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth state changed:', { event, userId: session?.user?.id });
  const { user, loading } = useAuthStore.getState();
  if (event === 'SIGNED_IN' && session?.user && !user && !loading) {
    console.log('Handling SIGNED_IN event for user:', session.user.id);
    useAuthStore.getState().setUser({ id: session.user.id, email: session.user.email });
    await useAuthStore.getState().fetchProfile(session.user.id, session.user.email);
  } else if (event === 'SIGNED_OUT') {
    console.log('Handling SIGNED_OUT event');
    useAuthStore.getState().setUser(null);
    useAuthStore.getState().setProfile(null);
    useAuthStore.getState().set({ authError: null });
  }
});