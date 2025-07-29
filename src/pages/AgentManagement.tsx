import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Loader2, Pencil, Trash2, Eye, Mail, Copy, Share2, MessageCircle } from 'lucide-react';
import { Agent } from '../types/agent';

interface AgentDetails {
  email: string;
  name: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface CreateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  fetchAgents: () => Promise<void>;
}

interface EditAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent | null;
  fetchAgents: () => Promise<void>;
}

interface ShareDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: Agent | null;
}

const generatePassword = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

const CreateAgentModal = ({ isOpen, onClose, fetchAgents }: CreateAgentModalProps) => {
  const { profile } = useAuthStore();
  const [agentDetails, setAgentDetails] = useState<AgentDetails>({
    email: '',
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AgentDetails & { id: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateAgent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      if (!agentDetails.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agentDetails.email)) {
        throw new Error('Please enter a valid email address');
      }
      if (!agentDetails.name) {
        throw new Error('Please enter a name');
      }
      if (!agentDetails.phone) {
        throw new Error('Please enter a phone number');
      }
      if (!agentDetails.password || agentDetails.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      if (agentDetails.password !== agentDetails.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (!profile || profile.role !== 'admin') {
        throw new Error('Only admins can create new agent accounts');
      }

      let authData;
      let authError;

      try {
        const { data, error } = await supabase.auth.signUp({
          email: agentDetails.email,
          password: agentDetails.password,
          options: {
            data: {
              name: agentDetails.name,
              phone: agentDetails.phone,
              role: 'agent',
            },
          },
        });
        authData = data;
        authError = error;
      } catch (signUpError) {
        const { data, error } = await supabase.auth.admin.createUser({
          email: agentDetails.email,
          password: agentDetails.password,
          email_confirm: true,
          user_metadata: {
            name: agentDetails.name,
            phone: agentDetails.phone,
            role: 'agent',
          },
        });
        authData = data;
        authError = error;
      }

      if (authError) {
        if (authError.message.includes('User already registered')) {
          throw new Error('This email is already registered. Please use a different email.');
        }
        throw new Error(`Authentication error: ${authError.message}`);
      }
      if (!authData.user) {
        throw new Error('Failed to create agent: No user returned');
      }

      const { error: agentError } = await supabase
        .from('agents')
        .upsert(
          {
            id: authData.user.id,
            email: agentDetails.email,
            name: agentDetails.name,
            phone: agentDetails.phone,
            role: 'agent',
          },
          { onConflict: 'id' }
        );

      if (agentError) {
        throw new Error(`Failed to create agent record: ${agentError.message}`);
      }

      const permissions = {
        canRegisterProperties: true,
        canEditProperties: true,
        canDeleteProperties: false,
      };

      const { error: profileError, data: profileData } = await supabase
        .from('profiles')
        .upsert(
          {
            id: authData.user.id,
            email: agentDetails.email,
            name: agentDetails.name,
            phone: agentDetails.phone,
            role: 'agent',
            permissions,
          },
          { onConflict: 'id' }
        );

      if (profileError) {
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      console.log('Profile created with permissions:', profileData);

      const { error: credentialError } = await supabase
        .from('agent_credentials')
        .insert({
          agent_id: authData.user.id,
          password: agentDetails.password,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

      if (credentialError) {
        throw new Error(`Failed to store credentials: ${credentialError.message}`);
      }

      setSuccess({
        id: authData.user.id,
        ...agentDetails,
      });

      toast.success(
        `Agent created: ${agentDetails.email}\nPassword: ${agentDetails.password}\nPlease share this securely.`,
        {
          duration: 10000,
          style: { background: '#3B82F6', color: '#fff', borderRadius: '8px', maxWidth: '500px' },
        }
      );

      await fetchAgents();
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(`Failed to create agent: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [agentDetails, profile, fetchAgents]);

  const handleClose = () => {
    setAgentDetails({ email: '', name: '', phone: '', password: '', confirmPassword: '' });
    setSuccess(null);
    setError(null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
      role="dialog"
      onClick={handleBackdropClick}
    >
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="bg-blue-100 rounded-lg shadow-xl p-8 w-full max-w-md border border-blue-300"
      >
        <h1 className="text-2xl font-bold mb-6 text-blue-900 text-center">Create New Agent</h1>
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <p className="text-blue-600 font-semibold">Agent created successfully!</p>
              <div className="text-left space-y-2 bg-blue-50 p-4 rounded-md">
                <p className="text-blue-900">Agent ID: <span className="font-semibold">{success.id}</span></p>
                <p className="text-blue-900">Name: <span className="font-semibold">{success.name}</span></p>
                <p className="text-blue-900">Email: <span className="font-semibold">{success.email}</span></p>
                <p className="text-blue-900">Phone: <span className="font-semibold">{success.phone}</span></p>
                <p className="text-blue-900">Password: <span className="font-semibold">{success.password}</span></p>
              </div>
              <div className="flex justify-between gap-2">
                <button
                  onClick={() => setSuccess(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  aria-label="Create Another Agent"
                >
                  Create Another
                </button>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-blue-900 rounded-md hover:bg-blue-200 transition-colors"
                  aria-label="Close Modal"
                >
                  Close
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="mb-4">
                <label htmlFor="agent-email" className="block text-sm font-medium text-blue-900 mb-1">
                  Email
                </label>
                <input
                  id="agent-email"
                  type="email"
                  value={agentDetails.email}
                  onChange={(e) => setAgentDetails({ ...agentDetails, email: e.target.value })}
                  className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
                  placeholder="agent@example.com"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="agent-name" className="block text-sm font-medium text-blue-900 mb-1">
                  Name
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={agentDetails.name}
                  onChange={(e) => setAgentDetails({ ...agentDetails, name: e.target.value })}
                  className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
                  placeholder="John Doe"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="agent-phone" className="block text-sm font-medium text-blue-900 mb-1">
                  Phone
                </label>
                <input
                  id="agent-phone"
                  type="tel"
                  value={agentDetails.phone}
                  onChange={(e) => setAgentDetails({ ...agentDetails, phone: e.target.value })}
                  className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
                  placeholder="+1234567890"
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="mb-4">
                <label htmlFor="agent-password" className="block text-sm font-medium text-blue-900 mb-1">
                  Password
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    id="agent-password"
                    type="text"
                    value={agentDetails.password}
                    onChange={(e) => setAgentDetails({ ...agentDetails, password: e.target.value })}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
                    placeholder="Minimum 6 characters"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setAgentDetails({ ...agentDetails, password: generatePassword(), confirmPassword: '' })}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    disabled={isLoading}
                    aria-label="Generate Password"
                  >
                    Generate
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="agent-confirm-password" className="block text-sm font-medium text-blue-900 mb-1">
                  Confirm Password
                </label>
                <input
                  id="agent-confirm-password"
                  type="password"
                  value={agentDetails.confirmPassword}
                  onChange={(e) => setAgentDetails({ ...agentDetails, confirmPassword: e.target.value })}
                  className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
                  placeholder="Confirm password"
                  disabled={isLoading}
                  required
                />
              </div>
              {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}
              <div className="flex justify-between gap-2">
                <button
                  onClick={handleClose}
                  disabled={isLoading}
                  className="px-4 py-2 text-blue-900 rounded-md hover:bg-blue-200 transition-colors"
                  aria-label="Cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAgent}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-lg text-white ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 transition-colors'}`}
                  aria-label="Create Agent"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create Agent'
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

const EditAgentModal = ({ isOpen, onClose, agent, fetchAgents }: EditAgentModalProps) => {
  const [editDetails, setEditDetails] = useState({
    name: agent?.name || '',
    phone: agent?.phone || '',
    password: '',
    confirmPassword: '',
    canRegisterProperties: agent?.permissions?.canRegisterProperties ?? false,
    canEditProperties: agent?.permissions?.canEditProperties ?? false,
    canDeleteProperties: agent?.permissions?.canDeleteProperties ?? false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuthStore();

  useEffect(() => {
    if (agent) {
      setEditDetails({
        name: agent.name || '',
        phone: agent.phone || '',
        password: '',
        confirmPassword: '',
        canRegisterProperties: agent.permissions?.canRegisterProperties ?? false,
        canEditProperties: agent.permissions?.canEditProperties ?? false,
        canDeleteProperties: agent.permissions?.canDeleteProperties ?? false,
      });
    }
  }, [agent]);

  const handleUpdateAgent = async () => {
    if (!agent || !profile || profile.role !== 'admin') {
      setError('Unauthorized or invalid agent');
      toast.error('Unauthorized or invalid agent');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (!editDetails.name) {
        throw new Error('Name is required');
      }
      if (editDetails.password && editDetails.password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      if (editDetails.password && editDetails.password !== editDetails.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      const permissions = {
        canRegisterProperties: editDetails.canRegisterProperties,
        canEditProperties: editDetails.canEditProperties,
        canDeleteProperties: editDetails.canDeleteProperties,
      };

      const { error: profileError, data: profileData } = await supabase
        .from('profiles')
        .update({
          name: editDetails.name,
          phone: editDetails.phone,
          permissions,
        })
        .eq('id', agent.id);

      if (profileError) {
        throw new Error(`Failed to update profile: ${profileError.message}`);
      }

      console.log('Profile updated with permissions:', profileData);

      const { error: agentError } = await supabase
        .from('agents')
        .update({
          name: editDetails.name,
          phone: editDetails.phone,
        })
        .eq('id', agent.id);

      if (agentError) {
        throw new Error(`Failed to update agent record: ${agentError.message}`);
      }

      if (editDetails.password) {
        const { error: authError } = await supabase.auth.admin.updateUserById(agent.id, {
          password: editDetails.password,
        });
        if (authError) {
          throw new Error(`Failed to update password: ${authError.message}`);
        }

        const { error: credentialError } = await supabase
          .from('agent_credentials')
          .upsert(
            {
              agent_id: agent.id,
              password: editDetails.password,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: 'agent_id' }
          );

        if (credentialError) {
          throw new Error(`Failed to store credentials: ${credentialError.message}`);
        }
      }

      toast.success('Agent updated successfully!');
      await fetchAgents();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      toast.error(`Failed to update agent: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-100 rounded-lg shadow-xl p-8 w-full max-w-md border border-blue-300"
      >
        <h1 className="text-2xl font-bold mb-6 text-blue-900 text-center">Edit Agent</h1>
        <div className="mb-4">
          <label htmlFor="edit-name" className="block text-sm font-medium text-blue-900 mb-1">
            Name
          </label>
          <input
            id="edit-name"
            type="text"
            value={editDetails.name}
            onChange={(e) => setEditDetails({ ...editDetails, name: e.target.value })}
            className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
            placeholder="Enter agent name"
            disabled={isLoading}
            required
          />
        </div>
        <div className="mb-4">
          <label htmlFor="edit-phone" className="block text-sm font-medium text-blue-900 mb-1">
            Phone
          </label>
          <input
            id="edit-phone"
            type="tel"
            value={editDetails.phone}
            onChange={(e) => setEditDetails({ ...editDetails, phone: e.target.value })}
            className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
            placeholder="Enter phone number"
            disabled={isLoading}
          />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-medium text-blue-900 mb-1">Permissions</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editDetails.canRegisterProperties}
                onChange={(e) => setEditDetails({ ...editDetails, canRegisterProperties: e.target.checked })}
                className="mr-2"
                disabled={isLoading}
              />
              Register Properties
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editDetails.canEditProperties}
                onChange={(e) => setEditDetails({ ...editDetails, canEditProperties: e.target.checked })}
                className="mr-2"
                disabled={isLoading}
              />
              Edit Properties
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={editDetails.canDeleteProperties}
                onChange={(e) => setEditDetails({ ...editDetails, canDeleteProperties: e.target.checked })}
                className="mr-2"
                disabled={isLoading}
              />
              Delete Properties
            </label>
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="edit-password" className="block text-sm font-medium text-blue-900 mb-1">
            New Password (Optional)
          </label>
          <div className="flex items-center space-x-2">
            <input
              id="edit-password"
              type="text"
              value={editDetails.password}
              onChange={(e) => setEditDetails({ ...editDetails, password: e.target.value })}
              className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
              placeholder="Minimum 6 characters"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setEditDetails({ ...editDetails, password: generatePassword(), confirmPassword: '' })}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              disabled={isLoading}
              aria-label="Generate Password"
            >
              Generate
            </button>
          </div>
        </div>
        <div className="mb-4">
          <label htmlFor="edit-confirm-password" className="block text-sm font-medium text-blue-900 mb-1">
            Confirm New Password
          </label>
          <input
            id="edit-confirm-password"
            type="password"
            value={editDetails.confirmPassword}
            onChange={(e) => setEditDetails({ ...editDetails, confirmPassword: e.target.value })}
            className="w-full p-3 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-blue-50"
            placeholder="Confirm new password"
            disabled={isLoading}
          />
        </div>
        {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-blue-900 rounded-md hover:bg-blue-200 transition-colors"
            disabled={isLoading}
            aria-label="Cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdateAgent}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-white ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 transition-colors'}`}
            aria-label="Update Agent"
          >
            {isLoading ? 'Updating...' : 'Update Agent'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ShareDetailsModal = ({ isOpen, onClose, agent }: ShareDetailsModalProps) => {
  if (!isOpen || !agent) return null;

  const shareText = `Agent Details:
ID: ${agent.id}
Name: ${agent.name || 'N/A'}
Email: ${agent.email}
Phone: ${agent.phone || 'N/A'}
Password: ${agent.password || 'Not available'}
Role: ${agent.role}
Permissions:
- Register Properties: ${agent.permissions.canRegisterProperties ? 'Yes' : 'No'}
- Edit Properties: ${agent.permissions.canEditProperties ? 'Yes' : 'No'}
- Delete Properties: ${agent.permissions.canDeleteProperties ? 'Yes' : 'No'}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    toast.success('Details copied to clipboard!');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Agent Details',
          text: shareText,
        });
        toast.success('Shared successfully!');
      } catch (err) {
        toast.error('Failed to share');
      }
    } else {
      toast.error('Web Share API not supported in this browser');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-100 rounded-lg shadow-xl p-8 w-full max-w-md border border-blue-300"
      >
        <h3 className="text-lg font-bold mb-4 text-blue-900">Share Agent Details</h3>
        <div className="space-y-4">
          <p className="text-blue-900">{shareText}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`mailto:?subject=Agent%20Details&body=${encodeURIComponent(shareText)}`}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              aria-label="Share via Email"
            >
              <Mail className="w-4 h-4 mr-2" />
              Email
            </a>
            <a
              href={`sms:?body=${encodeURIComponent(shareText)}`}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              aria-label="Share via SMS"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              SMS
            </a>
            <a
              href={`whatsapp://send?text=${encodeURIComponent(shareText)}`}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              aria-label="Share via WhatsApp"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </a>
            <button
              onClick={handleCopy}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              aria-label="Copy to Clipboard"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </button>
            {navigator.share && (
              <button
                onClick={handleShare}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                aria-label="Share via Other Apps"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Other Apps
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-full mt-4 py-2 text-blue-900 rounded-md hover:bg-blue-200 transition-colors"
            aria-label="Close"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export function AgentManagement() {
  const { profile } = useAuthStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState<Agent | null>(null);
  const [showEditModal, setShowEditModal] = useState<Agent | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<Agent | null>(null);
  const [showShareModal, setShowShareModal] = useState<Agent | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');

  if (profile?.role !== 'admin') {
    return <div className="text-red-600" role="alert">Unauthorized access</div>;
  }

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, permissions, name, phone')
        .in('role', ['agent', 'admin'])
        .is('deleted_at', null);

      if (profileError) {
        throw new Error(`Failed to fetch profiles: ${profileError.message}`);
      }

      console.log('Raw profile data:', profileData);

      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('id, email, name, phone, role')
        .is('deleted_at', null);

      if (agentError) {
        throw new Error(`Failed to fetch agents: ${agentError.message}`);
      }

      const mergedData = profileData.map((profile) => {
        const agentRecord = agentData.find((agent) => agent.id === profile.id);
        const permissions = profile.permissions || {
          canRegisterProperties: profile.role === 'admin' ? true : false,
          canEditProperties: profile.role === 'admin' ? true : false,
          canDeleteProperties: profile.role === 'admin' ? true : false,
        };
        return {
          ...profile,
          name: profile.name || agentRecord?.name || 'N/A',
          phone: profile.phone || agentRecord?.phone || 'N/A',
          role: profile.role || agentRecord?.role || 'agent',
          permissions,
        };
      });

      console.log('Merged agent data:', mergedData);

      setAgents(mergedData);
    } catch (error: any) {
      toast.error(`Failed to fetch agents: ${error.message}`);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentDetails = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('agent_credentials')
        .select('password')
        .eq('agent_id', agentId)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.password || 'Not available';
    } catch {
      return 'Not available';
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!newAdminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newAdminEmail)) {
        throw new Error('Please enter a valid email address');
      }
      if (!generatedPassword || generatedPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newAdminEmail,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: {
          name: newAdminName || newAdminEmail.split('@')[0],
          role: 'admin',
        },
      });

      if (authError) {
        throw new Error(`Failed to create user: ${authError.message}`);
      }

      if (!authData.user?.id) {
        throw new Error('User creation succeeded but no user ID returned');
      }

      const permissions = {
        canRegisterProperties: true,
        canEditProperties: true,
        canDeleteProperties: true,
      };

      const profileData = {
        id: authData.user.id,
        email: newAdminEmail,
        role: 'admin' as const,
        permissions,
        name: newAdminName || newAdminEmail.split('@')[0],
        phone: '',
      };

      const { error: profileError, data: insertedProfile } = await supabase.from('profiles').insert(profileData);

      if (profileError) {
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }

      console.log('Admin profile created with permissions:', insertedProfile);

      const { error: agentError } = await supabase.from('agents').insert({
        id: authData.user.id,
        email: newAdminEmail,
        name: newAdminName || newAdminEmail.split('@')[0],
        phone: '',
        role: 'admin',
      });

      if (agentError) {
        throw new Error(`Failed to create agent record: ${agentError.message}`);
      }

      const { error: credentialError } = await supabase
        .from('agent_credentials')
        .insert({
          agent_id: authData.user.id,
          password: generatedPassword,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

      if (credentialError) {
        throw new Error(`Failed to store credentials: ${credentialError.message}`);
      }

      toast.success(`Admin created! Email: ${newAdminEmail}, Password: ${generatedPassword}`);
      setShowAdminModal(false);
      setNewAdminEmail('');
      setNewAdminName('');
      setGeneratedPassword('');
      await fetchAgents();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!profile || profile.role !== 'admin') {
      toast.error('Unauthorized');
      return;
    }

    setLoading(true);
    try {
      if (agentId === profile.id) {
        throw new Error('You cannot delete your own account');
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', agentId);
      if (profileError) {
        throw new Error(`Failed to soft delete profile: ${profileError.message}`);
      }

      const { error: agentError } = await supabase
        .from('agents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', agentId);
      if (agentError) {
        throw new Error(`Failed to soft delete agent record: ${agentError.message}`);
      }

      const { error: credentialError } = await supabase
        .from('agent_credentials')
        .delete()
        .eq('agent_id', agentId);
      if (credentialError) {
        throw new Error(`Failed to delete credentials: ${credentialError.message}`);
      }

      setAgents((prevAgents) => prevAgents.filter((agent) => agent.id !== agentId));
      toast.success('Agent deleted successfully!');
      await fetchAgents();
      setShowDeleteModal(null);
    } catch (error: any) {
      toast.error(`Failed to delete agent: ${error.message}`);
      await fetchAgents();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 bg-blue-50 min-h-screen">
      <Toaster position="top-center" />
      <h2 className="text-3xl font-bold mb-8 flex items-center text-blue-900">
        <Users className="w-8 h-8 mr-3" />
        Agent Management
      </h2>
      <div className="mb-8 flex flex-wrap gap-4">
        <button
          onClick={() => setShowAgentModal(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md"
          aria-label="Create Agent"
        >
          Create Agent
        </button>
        <button
          onClick={() => {
            setShowAdminModal(true);
            setGeneratedPassword(generatePassword());
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md"
          aria-label="Create Admin"
        >
          Create Admin
        </button>
      </div>
      <AnimatePresence>
        {showAgentModal && (
          <CreateAgentModal
            isOpen={showAgentModal}
            onClose={() => setShowAgentModal(false)}
            fetchAgents={fetchAgents}
          />
        )}
        {showAdminModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-100 rounded-lg shadow-xl p-8 w-full max-w-md border border-blue-300"
            >
              <h3 className="text-xl font-bold mb-6 text-blue-900">Create New Admin</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="admin-email" className="block text-sm font-medium text-blue-900">
                    Email
                  </label>
                  <input
                    id="admin-email"
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-lg bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="admin-name" className="block text-sm font-medium text-blue-900">
                    Name (Optional)
                  </label>
                  <input
                    id="admin-name"
                    type="text"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-lg bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Admin Name"
                  />
                </div>
                <div>
                  <label htmlFor="admin-password" className="block text-sm font-medium text-blue-900">
                    Password
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id="admin-password"
                      type="text"
                      value={generatedPassword}
                      readOnly
                      className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-lg bg-blue-100"
                    />
                    <button
                      type="button"
                      onClick={() => setGeneratedPassword(generatePassword())}
                      className="mt-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      aria-label="Regenerate Password"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      setNewAdminEmail('');
                      setNewAdminName('');
                      setGeneratedPassword('');
                    }}
                    className="px-4 py-2 text-blue-900 rounded-md hover:bg-blue-200 transition-colors"
                    aria-label="Cancel"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateAdmin}
                    disabled={loading}
                    className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    aria-label="Create Admin"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Admin'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-100 rounded-lg shadow-xl p-8 w-full max-w-md border border-blue-300"
            >
              <h3 className="text-lg font-bold mb-4 text-blue-900">Agent Details</h3>
              <div className="space-y-2 bg-blue-50 p-4 rounded-md">
                <p className="text-blue-900">Agent ID: <span className="font-semibold">{showDetailsModal.id}</span></p>
                <p className="text-blue-900">Name: <span className="font-semibold">{showDetailsModal.name || 'N/A'}</span></p>
                <p className="text-blue-900">Email: <span className="font-semibold">{showDetailsModal.email}</span></p>
                <p className="text-blue-900">Phone: <span className="font-semibold">{showDetailsModal.phone || 'N/A'}</span></p>
                <p className="text-blue-900">Password: <span className="font-semibold">{showDetailsModal.password || 'Not available'}</span></p>
                <p className="text-blue-900">Role: <span className="font-semibold">{showDetailsModal.role}</span></p>
                <p className="text-blue-900">Permissions:</p>
                <ul className="list-disc pl-5">
                  <li className={showDetailsModal.permissions.canRegisterProperties ? 'text-green-600' : 'text-gray-400'}>
                    Register Properties: {showDetailsModal.permissions.canRegisterProperties ? '✓ Yes' : '✗ No'}
                  </li>
                  <li className={showDetailsModal.permissions.canEditProperties ? 'text-yellow-600' : 'text-gray-400'}>
                    Edit Properties: {showDetailsModal.permissions.canEditProperties ? '✓ Yes' : '✗ No'}
                  </li>
                  <li className={showDetailsModal.permissions.canDeleteProperties ? 'text-red-600' : 'text-gray-400'}>
                    Delete Properties: {showDetailsModal.permissions.canDeleteProperties ? '✓ Yes' : '✗ No'}
                  </li>
                </ul>
              </div>
              <div className="flex justify-between gap-2 mt-4">
                <button
                  onClick={() => setShowShareModal(showDetailsModal)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  aria-label="Share Details"
                >
                  Share
                </button>
                <button
                  onClick={() => setShowDetailsModal(null)}
                  className="px-4 py-2 text-blue-900 rounded-md hover:bg-blue-200 transition-colors"
                  aria-label="Close"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
        <EditAgentModal
          isOpen={!!showEditModal}
          onClose={() => setShowEditModal(null)}
          agent={showEditModal}
          fetchAgents={fetchAgents}
        />
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center" role="dialog">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-100 rounded-lg shadow-xl p-8 w-full max-w-md border border-blue-300"
            >
              <h3 className="text-lg font-bold mb-4 text-blue-900">Confirm Delete</h3>
              <p className="text-blue-900 mb-4">
                Are you sure you want to delete <span className="font-semibold">{showDeleteModal.email}</span>? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="px-4 py-2 text-blue-900 rounded-md hover:bg-blue-200 transition-colors"
                  disabled={loading}
                  aria-label="Cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAgent(showDeleteModal.id)}
                  className={`px-4 py-2 rounded-md text-white ${loading ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 transition-colors'}`}
                  disabled={loading}
                  aria-label="Delete"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
        <ShareDetailsModal
          isOpen={!!showShareModal}
          onClose={() => setShowShareModal(null)}
          agent={showShareModal}
        />
      </AnimatePresence>
      <div className="bg-blue-100 shadow-lg rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-6 text-blue-900">Existing Agents & Admins</h3>
        {loading ? (
          <div className="flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-blue-900">Loading agents...</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center text-blue-900">No agents or admins found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-blue-50 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <h4 className="text-lg font-semibold text-blue-900">{agent.name || 'N/A'}</h4>
                <p className="text-blue-900">{agent.email}</p>
                <p className="text-blue-900 capitalize">{agent.role}</p>
                <div className="mt-2">
                  <p className="text-blue-900 font-medium">Permissions:</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {agent.permissions ? (
                      <>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            agent.permissions.canRegisterProperties ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          Register {agent.permissions.canRegisterProperties ? '✓' : '✗'}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            agent.permissions.canEditProperties ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          Edit {agent.permissions.canEditProperties ? '✓' : '✗'}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            agent.permissions.canDeleteProperties ? 'bg-red-200 text-red-800' : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          Delete {agent.permissions.canDeleteProperties ? '✓' : '✗'}
                        </span>
                      </>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs bg-red-200 text-red-800">No permissions</span>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={async () => {
                      const password = await fetchAgentDetails(agent.id);
                      setShowDetailsModal({ ...agent, password });
                    }}
                    className="p-2 text-blue-600 hover:text-blue-800"
                    aria-label="View Details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowEditModal(agent)}
                    className="p-2 text-blue-600 hover:text-blue-800"
                    aria-label="Edit Agent"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(agent)}
                    className="p-2 text-red-600 hover:text-red-800"
                    aria-label="Delete Agent"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={async () => {
                      const password = await fetchAgentDetails(agent.id);
                      setShowShareModal({ ...agent, password });
                    }}
                    className="p-2 text-blue-600 hover:text-blue-800"
                    aria-label="Share Details"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}