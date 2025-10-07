import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Loader2, Plus, Trash2, Phone, DoorClosed, Eye, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { StreetSuggestions } from './StreetSuggestions';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const toTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const PREDEFINED_SUBURBS = [
  'Moggill QLD 4070',
  'Bellbowrie QLD 4070',
  'Pullenvale QLD 4069',
  'Brookfield QLD 4069',
  'Anstead QLD 4070',
  'Chapel Hill QLD 4069',
  'Kenmore QLD 4069',
  'Kenmore Hill QLD 4069',
  'Fig Tree Pocket QLD 4069',
  'Pinjara Hills QLD 4069',
  'Spring Mountain QLD 4300',
  'Springfield QLD 4300',
  'Greenbank QLD 4124',
];

interface DoorKnockStreet {
  id: string;
  name: string;
  why: string;
  house_count: string;
  target_knocks: string;
}

interface PhoneCallStreet {
  id: string;
  name: string;
  why: string;
  target_calls: string;
  target_connects: string;
}

interface VaultToDoStreet {
  id: string;
  name: string;
  why: string;
  target_actions: string;
}

interface MarketingPlan {
  id: string;
  agent: string;
  suburb: string;
  start_date: string;
  end_date: string;
  door_knock_streets: DoorKnockStreet[];
  phone_call_streets: PhoneCallStreet[];
  vault_to_do_streets: VaultToDoStreet[];
  desktop_appraisals: string;
  face_to_face_appraisals: string;
  created_at?: string;
  updated_at?: string;
}

export function MarketingPlanPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [marketingPlan, setMarketingPlan] = useState<MarketingPlan>({
    id: uuidv4(),
    agent: '',
    suburb: '',
    start_date: '',
    end_date: '',
    door_knock_streets: [],
    phone_call_streets: [],
    vault_to_do_streets: [],
    desktop_appraisals: '',
    face_to_face_appraisals: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isCustomSuburb, setIsCustomSuburb] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<'all' | 'door_knock' | 'phone_call' | 'vault_to_do'>('all');
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [savedPlans, setSavedPlans] = useState<MarketingPlan[]>([]);
  const [soldPropertiesFilter, setSoldPropertiesFilter] = useState<string>('30_days');

  useEffect(() => {
    const initializeAgent = async () => {
      if (!user) {
        setLoading(false);
        navigate('/agent-login');
        return;
      }

      if (!profile) {
        return;
      }

      if (profile.role === 'agent' || profile.role === 'admin') {
        try {
          let { data: agentData, error: agentError } = await supabase
            .from('agents')
            .select('id, name')
            .eq('id', user.id)
            .single();

          if (agentError && agentError.code !== 'PGRST116') {
            throw agentError;
          }

          if (!agentData) {
            const { error: insertAgentError } = await supabase
              .from('agents')
              .insert({ id: user.id, name: profile.name || user.email || 'Unknown Agent' });
            if (insertAgentError) throw insertAgentError;
            const { data: newAgentData, error: newAgentError } = await supabase
              .from('agents')
              .select('id, name')
              .eq('id', user.id)
              .single();
            if (newAgentError) throw newAgentError;
            agentData = newAgentData;
          }

          setMarketingPlan((prev) => ({
            ...prev,
            agent: user.id,
          }));

          await loadMarketingPlan(user.id);
          await loadSavedPlans(user.id);
        } catch (error) {
          setSaveError('Failed to initialize agent data');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        navigate('/agent-login');
      }
    };

    initializeAgent();
  }, [user, profile, navigate]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const loadMarketingPlan = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('marketing_plans')
        .select('*')
        .eq('agent', agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const loadedSuburb = data.suburb || '';
        setIsCustomSuburb(!PREDEFINED_SUBURBS.includes(loadedSuburb) && loadedSuburb !== '');
        setMarketingPlan({
          id: data.id || uuidv4(),
          agent: data.agent || '',
          suburb: loadedSuburb,
          start_date: data.start_date || '',
          end_date: data.end_date || '',
          door_knock_streets: (data.door_knock_streets || []).map((street: any) => ({
            ...street,
            id: street.id || uuidv4(),
            name: toTitleCase(street.name || ''),
            why: street.why || '',
            house_count: street.house_count || '',
            target_knocks: street.target_knocks || '',
          })),
          phone_call_streets: (data.phone_call_streets || []).map((street: any) => ({
            ...street,
            id: street.id || uuidv4(),
            name: toTitleCase(street.name || ''),
            why: street.why || '',
            target_calls: street.target_calls || '',
            target_connects: street.target_connects || '',
          })),
          vault_to_do_streets: (data.vault_to_do_streets || []).map((street: any) => ({
            ...street,
            id: street.id || uuidv4(),
            name: toTitleCase(street.name || ''),
            why: street.why || '',
            target_actions: street.target_actions || '',
          })),
          desktop_appraisals: data.desktop_appraisals || '',
          face_to_face_appraisals: data.face_to_face_appraisals || '',
          created_at: data.created_at || undefined,
          updated_at: data.updated_at || undefined,
        });
      } else {
        setMarketingPlan({
          id: uuidv4(),
          agent: agentId,
          suburb: '',
          start_date: '',
          end_date: '',
          door_knock_streets: [],
          phone_call_streets: [],
          vault_to_do_streets: [],
          desktop_appraisals: '',
          face_to_face_appraisals: '',
        });
      }
    } catch (error) {
      console.error('Error loading marketing plan:', error);
      setMarketingPlan({
        id: uuidv4(),
        agent: agentId,
        suburb: '',
        start_date: '',
        end_date: '',
        door_knock_streets: [],
        phone_call_streets: [],
        vault_to_do_streets: [],
        desktop_appraisals: '',
        face_to_face_appraisals: '',
      });
    }
  };

  const loadSavedPlans = async (agentId: string) => {
    try {
      const { data, error } = await supabase
        .from('marketing_plans')
        .select('*')
        .eq('agent', agentId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setSavedPlans(
        (data || []).map((plan) => ({
          ...plan,
          suburb: toTitleCase(plan.suburb || ''),
          door_knock_streets: (plan.door_knock_streets || []).map((street: any) => ({
            ...street,
            id: street.id || uuidv4(),
            name: toTitleCase(street.name || ''),
            why: street.why || '',
            house_count: street.house_count || '',
            target_knocks: street.target_knocks || '',
          })),
          phone_call_streets: (plan.phone_call_streets || []).map((street: any) => ({
            ...street,
            id: street.id || uuidv4(),
            name: toTitleCase(street.name || ''),
            why: street.why || '',
            target_calls: street.target_calls || '',
            target_connects: street.target_connects || '',
          })),
          vault_to_do_streets: (plan.vault_to_do_streets || []).map((street: any) => ({
            ...street,
            id: street.id || uuidv4(),
            name: toTitleCase(street.name || ''),
            why: street.why || '',
            target_actions: street.target_actions || '',
          })),
          desktop_appraisals: plan.desktop_appraisals || '',
          face_to_face_appraisals: plan.face_to_face_appraisals || '',
          created_at: plan.created_at || undefined,
          updated_at: plan.updated_at || undefined,
        }))
      );
    } catch (error) {
      console.error('Error loading saved plans:', error);
    }
  };

  const validatePlan = () => {
    const newErrors: { [key: string]: string } = {};
    if (!marketingPlan.suburb) newErrors.suburb = 'Please select or enter a suburb';
    if (!marketingPlan.start_date) newErrors.start_date = 'Please select a start date';
    if (!marketingPlan.end_date) newErrors.end_date = 'Please select an end date';
    if (
      marketingPlan.start_date &&
      marketingPlan.end_date &&
      new Date(marketingPlan.end_date) <= new Date(marketingPlan.start_date)
    ) {
      newErrors.end_date = 'End date must be after start date';
    }
    marketingPlan.door_knock_streets.forEach((street, index) => {
      if (!street.name)
        newErrors[`door_knock_street_${index}_name`] = `Please enter a street name for door knock ${index + 1}`;
      if (!street.target_knocks || parseInt(street.target_knocks) <= 0)
        newErrors[`door_knock_street_${index}_target_knocks`] = `Please enter a valid number of target knocks for door knock ${index + 1}`;
    });
    marketingPlan.phone_call_streets.forEach((street, index) => {
      if (!street.name) newErrors[`phone_call_street_${index}_name`] = `Please enter a street name for phone call ${index + 1}`;
      if (!street.target_calls || parseInt(street.target_calls) <= 0)
        newErrors[`phone_call_street_${index}_target_calls`] = `Please enter a valid number of target calls for phone call ${index + 1}`;
      if (!street.target_connects || parseInt(street.target_connects) < 0)
        newErrors[`phone_call_street_${index}_target_connects`] = `Please enter a valid number of target connects for phone call ${index + 1}`;
    });
    marketingPlan.vault_to_do_streets.forEach((street, index) => {
      if (!street.name) newErrors[`vault_to_do_street_${index}_name`] = `Please enter a street name for vault to-do ${index + 1}`;
      if (!street.target_actions || parseInt(street.target_actions) <= 0)
        newErrors[`vault_to_do_street_${index}_target_actions`] = `Please enter a valid number of target actions for vault to-do ${index + 1}`;
    });
    if (!marketingPlan.desktop_appraisals || parseInt(marketingPlan.desktop_appraisals) < 0)
      newErrors.desktop_appraisals = 'Please enter a valid number of desktop appraisals';
    if (!marketingPlan.face_to_face_appraisals || parseInt(marketingPlan.face_to_face_appraisals) < 0)
      newErrors.face_to_face_appraisals = 'Please enter a valid number of face-to-face appraisals';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveMarketingPlan = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    if (!validatePlan()) {
      setSaveError('Please fix the errors in the form before saving.');
      setIsSaving(false);
      return;
    }

    if (!user?.id) {
      setSaveError('Please log in to save the marketing plan.');
      setIsSaving(false);
      return;
    }

    try {
      const formattedPlan = {
        id: marketingPlan.id,
        agent: user.id,
        suburb: marketingPlan.suburb,
        start_date: marketingPlan.start_date,
        end_date: marketingPlan.end_date,
        door_knock_streets: marketingPlan.door_knock_streets.map((street) => ({
          id: street.id,
          name: street.name,
          why: street.why || '',
          house_count: street.house_count || '',
          target_knocks: street.target_knocks,
        })),
        phone_call_streets: marketingPlan.phone_call_streets.map((street) => ({
          id: street.id,
          name: street.name,
          why: street.why || '',
          target_calls: street.target_calls,
          target_connects: street.target_connects,
        })),
        vault_to_do_streets: marketingPlan.vault_to_do_streets.map((street) => ({
          id: street.id,
          name: street.name,
          why: street.why || '',
          target_actions: street.target_actions,
        })),
        desktop_appraisals: marketingPlan.desktop_appraisals,
        face_to_face_appraisals: marketingPlan.face_to_face_appraisals,
        updated_at: new Date().toISOString(),
      };

      const { data: existingPlan, error: selectError } = await supabase
        .from('marketing_plans')
        .select('id')
        .eq('id', marketingPlan.id)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw new Error(`Failed to check existing plan: ${selectError.message}`);
      }

      if (existingPlan) {
        const { error: updateError } = await supabase
          .from('marketing_plans')
          .update(formattedPlan)
          .eq('id', marketingPlan.id);

        if (updateError) {
          throw new Error(`Failed to update marketing plan: ${updateError.message}`);
        }
      } else {
        const { error: insertError } = await supabase.from('marketing_plans').insert(formattedPlan);

        if (insertError) {
          throw new Error(`Failed to insert marketing plan: ${insertError.message}`);
        }
      }

      await loadMarketingPlan(user.id);
      await loadSavedPlans(user.id);
      setSaveSuccess(true);
    } catch (error: any) {
      setSaveError(`Failed to save marketing plan: ${error.message || 'Please try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const createNewPlan = () => {
    setMarketingPlan({
      id: uuidv4(),
      agent: user?.id || '',
      suburb: '',
      start_date: '',
      end_date: '',
      door_knock_streets: [],
      phone_call_streets: [],
      vault_to_do_streets: [],
      desktop_appraisals: '',
      face_to_face_appraisals: '',
    });
    setIsCustomSuburb(false);
    setErrors({});
    setSelectedActivity('all');
    setSoldPropertiesFilter('30_days');
    setSaveError(null);
    setSaveSuccess(false);
  };

  const viewPlan = async (plan: MarketingPlan) => {
    setMarketingPlan({
      ...plan,
      door_knock_streets: Array.isArray(plan.door_knock_streets) ? plan.door_knock_streets : [],
      phone_call_streets: Array.isArray(plan.phone_call_streets) ? plan.phone_call_streets : [],
      vault_to_do_streets: Array.isArray(plan.vault_to_do_streets) ? plan.vault_to_do_streets : [],
      desktop_appraisals: plan.desktop_appraisals || '',
      face_to_face_appraisals: plan.face_to_face_appraisals || '',
      created_at: plan.created_at || undefined,
      updated_at: plan.updated_at || undefined,
    });
    setIsCustomSuburb(!PREDEFINED_SUBURBS.includes(plan.suburb) && plan.suburb !== '');
    setShowPlansModal(false);
  };

  const addStreet = (type: 'door_knock' | 'phone_call' | 'vault_to_do') => {
    if (type === 'door_knock') {
      setMarketingPlan({
        ...marketingPlan,
        door_knock_streets: [
          ...marketingPlan.door_knock_streets,
          {
            id: uuidv4(),
            name: '',
            why: '',
            house_count: '',
            target_knocks: '',
          },
        ],
      });
    } else if (type === 'phone_call') {
      setMarketingPlan({
        ...marketingPlan,
        phone_call_streets: [
          ...marketingPlan.phone_call_streets,
          {
            id: uuidv4(),
            name: '',
            why: '',
            target_calls: '',
            target_connects: '',
          },
        ],
      });
    } else {
      setMarketingPlan({
        ...marketingPlan,
        vault_to_do_streets: [
          ...marketingPlan.vault_to_do_streets,
          {
            id: uuidv4(),
            name: '',
            why: '',
            target_actions: '',
          },
        ],
      });
    }
  };

  const removeStreet = (type: 'door_knock' | 'phone_call' | 'vault_to_do', id: string) => {
    if (type === 'door_knock') {
      setMarketingPlan({
        ...marketingPlan,
        door_knock_streets: marketingPlan.door_knock_streets.filter((street) => street.id !== id),
      });
    } else if (type === 'phone_call') {
      setMarketingPlan({
        ...marketingPlan,
        phone_call_streets: marketingPlan.phone_call_streets.filter((street) => street.id !== id),
      });
    } else {
      setMarketingPlan({
        ...marketingPlan,
        vault_to_do_streets: marketingPlan.vault_to_do_streets.filter((street) => street.id !== id),
      });
    }
  };

  const updateStreet = (
    type: 'door_knock' | 'phone_call' | 'vault_to_do',
    id: string,
    field: string,
    value: string
  ) => {
    if (type === 'door_knock') {
      setMarketingPlan({
        ...marketingPlan,
        door_knock_streets: marketingPlan.door_knock_streets.map((street) =>
          street.id === id
            ? {
                ...street,
                [field]: field === 'name' || field === 'why' ? toTitleCase(value) : value,
              }
            : street
        ),
      });
    } else if (type === 'phone_call') {
      setMarketingPlan({
        ...marketingPlan,
        phone_call_streets: marketingPlan.phone_call_streets.map((street) =>
          street.id === id
            ? {
                ...street,
                [field]: field === 'name' || field === 'why' ? toTitleCase(value) : value,
              }
            : street
        ),
      });
    } else {
      setMarketingPlan({
        ...marketingPlan,
        vault_to_do_streets: marketingPlan.vault_to_do_streets.map((street) =>
          street.id === id
            ? {
                ...street,
                [field]: field === 'name' || field === 'why' ? toTitleCase(value) : value,
              }
            : street
        ),
      });
    }
  };

  const handleSelectStreet = (street: { name: string }, type: 'door_knock' | 'phone_call' | 'vault_to_do') => {
    if (type === 'door_knock') {
      if (!marketingPlan.door_knock_streets.some((s) => s.name === street.name)) {
        setMarketingPlan({
          ...marketingPlan,
          door_knock_streets: [
            ...marketingPlan.door_knock_streets,
            {
              id: uuidv4(),
              name: street.name,
              why: '',
              house_count: '',
              target_knocks: '',
            },
          ],
        });
      }
    } else if (type === 'phone_call') {
      if (!marketingPlan.phone_call_streets.some((s) => s.name === street.name)) {
        setMarketingPlan({
          ...marketingPlan,
          phone_call_streets: [
            ...marketingPlan.phone_call_streets,
            {
              id: uuidv4(),
              name: street.name,
              why: '',
              target_calls: '',
              target_connects: '',
            },
          ],
        });
      }
    } else if (type === 'vault_to_do') {
      if (!marketingPlan.vault_to_do_streets.some((s) => s.name === street.name)) {
        setMarketingPlan({
          ...marketingPlan,
          vault_to_do_streets: [
            ...marketingPlan.vault_to_do_streets,
            {
              id: uuidv4(),
              name: street.name,
              why: '',
              target_actions: '',
            },
          ],
        });
      }
    }
  };

  const handleSuburbChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'custom') {
      setIsCustomSuburb(true);
      setMarketingPlan({ ...marketingPlan, suburb: '' });
    } else {
      setIsCustomSuburb(false);
      setMarketingPlan({ ...marketingPlan, suburb: value });
    }
  };
  // Add this function inside the MarketingPlanPage component
  const addAllStreets = () => {
    // Add a street for door knocks
    setMarketingPlan((prev) => ({
      ...prev,
      door_knock_streets: [
        ...prev.door_knock_streets,
        {
          id: uuidv4(),
          name: '',
          why: '',
          house_count: '',
          target_knocks: '',
        },
      ],
      phone_call_streets: [
        ...prev.phone_call_streets,
        {
          id: uuidv4(),
          name: '',
          why: '',
          target_calls: '',
          target_connects: '',
        },
      ],
    }));
  };
  
   
  const totalKnocks = marketingPlan.door_knock_streets.reduce(
    (sum, street) => sum + (parseInt(street.target_knocks || '0') || 0),
    0
  );
  const totalCalls = marketingPlan.phone_call_streets.reduce(
    (sum, street) => sum + (parseInt(street.target_calls || '0') || 0),
    0
  );
  const totalVaultActions = marketingPlan.vault_to_do_streets.reduce(
    (sum, street) => sum + (parseInt(street.target_actions || '0') || 0),
    0
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 className="w-12 h-12 text-indigo-600" />
        </motion.div>
      </div>
    );
  }

  const handleBackToDashboard = () => {
    if (profile?.role === 'admin') {
      navigate('/admin-dashboard');
    } else {
      navigate('/agent-dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.h1
          className="text-4xl font-extrabold text-gray-900 mb-8 flex items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <svg
            className="w-8 h-8 mr-3 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          Weekly Marketing Plan
        </motion.h1>

        <motion.div
          className="mb-8 flex gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.button
            onClick={handleBackToDashboard}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-full hover:from-green-700 hover:to-green-800 transition-all shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Back to dashboard"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </motion.button>
          <motion.button
            onClick={() => setShowPlansModal(true)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="View saved plans"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Saved Plans
          </motion.button>
          <motion.button
            onClick={createNewPlan}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-full hover:from-orange-700 hover:to-orange-800 transition-all shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Create new plan"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Plan
          </motion.button>
        </motion.div>

        {showPlansModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <h2 className="text-2xl font-bold mb-4">Saved Marketing Plans</h2>
              {savedPlans.length === 0 ? (
                <p className="text-gray-600">No saved plans found.</p>
              ) : (
                <div className="space-y-6">
                  {savedPlans.map((plan) => (
                    <div key={plan.id} className="border p-4 rounded-lg bg-gray-50">
                      <p><strong>Suburb:</strong> {plan.suburb}</p>
                      <p><strong>Start Date:</strong> {new Date(plan.start_date).toLocaleDateString()}</p>
                      <p><strong>End Date:</strong> {new Date(plan.end_date).toLocaleDateString()}</p>
                      <p>
                        <strong>Total Target Knocks:</strong>{' '}
                        {(plan.door_knock_streets || []).reduce(
                          (sum, s) => sum + (parseInt(s.target_knocks || '0') || 0),
                          0
                        )}
                      </p>
                      <p>
                        <strong>Total Target Calls:</strong>{' '}
                        {(plan.phone_call_streets || []).reduce(
                          (sum, s) => sum + (parseInt(s.target_calls || '0') || 0),
                          0
                        )}
                      </p>
                      <p>
                        <strong>Total Vault To-Do Actions:</strong>{' '}
                        {(plan.vault_to_do_streets || []).reduce(
                          (sum, s) => sum + (parseInt(s.target_actions || '0') || 0),
                          0
                        )}
                      </p>
                      <p><strong>Desktop Appraisals:</strong> {plan.desktop_appraisals || '0'}</p>
                      <p><strong>Face-to-Face Appraisals:</strong> {plan.face_to_face_appraisals || '0'}</p>
                      <h4 className="text-lg font-semibold mt-4 mb-2">Door Knock Streets</h4>
                      {plan.door_knock_streets.length === 0 ? (
                        <p className="text-gray-600">No door knock streets added.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-indigo-600 text-white text-sm">
                                <th className="p-2 text-left">Street Name</th>
                                <th className="p-2 text-left">Why This Street</th>
                                <th className="p-2 text-left">House Count</th>
                                <th className="p-2 text-left">Target Knocks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.door_knock_streets.map((street, index) => (
                                <tr key={street.id} className="border-b border-gray-200 hover:bg-gray-100">
                                  <td className="p-2">{street.name || 'N/A'}</td>
                                  <td className="p-2">{street.why || 'N/A'}</td>
                                  <td className="p-2">{street.house_count || 'N/A'}</td>
                                  <td className="p-2">{street.target_knocks || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <h4 className="text-lg font-semibold mt-4 mb-2">Phone Call Streets</h4>
                      {plan.phone_call_streets.length === 0 ? (
                        <p className="text-gray-600">No phone call streets added.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-indigo-600 text-white text-sm">
                                <th className="p-2 text-left">Street Name</th>
                                <th className="p-2 text-left">Why This Street</th>
                                <th className="p-2 text-left">Target Calls</th>
                                <th className="p-2 text-left">Target Connects</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.phone_call_streets.map((street, index) => (
                                <tr key={street.id} className="border-b border-gray-200 hover:bg-gray-100">
                                  <td className="p-2">{street.name || 'N/A'}</td>
                                  <td className="p-2">{street.why || 'N/A'}</td>
                                  <td className="p-2">{street.target_calls || 'N/A'}</td>
                                  <td className="p-2">{street.target_connects || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <h4 className="text-lg font-semibold mt-4 mb-2">Vault To-Do Streets</h4>
                      {plan.vault_to_do_streets.length === 0 ? (
                        <p className="text-gray-600">No vault to-do streets added.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-indigo-600 text-white text-sm">
                                <th className="p-2 text-left">Street Name</th>
                                <th className="p-2 text-left">Why This Street</th>
                                <th className="p-2 text-left">Target Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.vault_to_do_streets.map((street, index) => (
                                <tr key={street.id} className="border-b border-gray-200 hover:bg-gray-100">
                                  <td className="p-2">{street.name || 'N/A'}</td>
                                  <td className="p-2">{street.why || 'N/A'}</td>
                                  <td className="p-2">{street.target_actions || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <motion.button
                        onClick={() => viewPlan(plan)}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        View Plan
                      </motion.button>
                    </div>
                  ))}
                </div>
              )}
              <motion.button
                onClick={() => setShowPlansModal(false)}
                className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-full hover:bg-gray-700"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Close
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        <motion.div
          className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {saveSuccess && (
            <div className="fixed top-4 right-4 flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-lg shadow z-[1000]">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <div className="flex flex-col">
                <span>Successfully created marketing plan</span>
                <button
                  onClick={() => viewPlan(marketingPlan)}
                  className="mt-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View Plan
                </button>
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-800 font-semibold mb-2">Start Date *</label>
                <input
                  type="date"
                  value={marketingPlan.start_date}
                  onChange={(e) => setMarketingPlan({ ...marketingPlan, start_date: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                  aria-label="Select start date"
                />
                {errors.start_date && (
                  <p className="text-red-600 text-sm mt-1 font-medium">{errors.start_date}</p>
                )}
              </div>
              <div>
                <label className="block text-gray-800 font-semibold mb-2">End Date *</label>
                <input
                  type="date"
                  value={marketingPlan.end_date}
                  onChange={(e) => setMarketingPlan({ ...marketingPlan, end_date: e.target.value })}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                  aria-label="Select end date"
                />
                {errors.end_date && (
                  <p className="text-red-600 text-sm mt-1 font-medium">{errors.end_date}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-gray-800 font-semibold mb-2">Suburb *</label>
              <select
                value={isCustomSuburb ? 'custom' : marketingPlan.suburb}
                onChange={handleSuburbChange}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                aria-label="Select suburb"
              >
                <option value="">Select Suburb</option>
                {PREDEFINED_SUBURBS.map((suburb) => (
                  <option key={suburb} value={suburb}>
                    {suburb}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
              {isCustomSuburb && (
                <motion.input
                  type="text"
                  value={marketingPlan.suburb}
                  onChange={(e) =>
                    setMarketingPlan({ ...marketingPlan, suburb: toTitleCase(e.target.value) })
                  }
                  className="w-full p-3 mt-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                  placeholder="Enter custom suburb"
                  aria-label="Enter custom suburb"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                />
              )}
              {errors.suburb && (
                <p className="text-red-600 text-sm mt-1 font-medium">{errors.suburb}</p>
              )}
            </div>

            {marketingPlan.suburb && (
              <StreetSuggestions
                suburb={marketingPlan.suburb}
                soldPropertiesFilter={soldPropertiesFilter}
                onSelectStreet={handleSelectStreet}
                existingDoorKnocks={marketingPlan.door_knock_streets}
                existingPhoneCalls={marketingPlan.phone_call_streets}
                existingVaultToDo={marketingPlan.vault_to_do_streets}
              />
            )}

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">Activities</h3>
              <div className="flex gap-4 mb-4">
                <motion.button
                  onClick={() => setSelectedActivity('all')}
                  className={`px-4 py-2 rounded-full ${
                    selectedActivity === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  } hover:bg-indigo-700 hover:text-white transition-all`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  All
                </motion.button>
                <motion.button
                  onClick={() => setSelectedActivity('door_knock')}
                  className={`px-4 py-2 rounded-full ${
                    selectedActivity === 'door_knock'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  } hover:bg-indigo-700 hover:text-white transition-all`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Door Knocks
                </motion.button>
                <motion.button
                  onClick={() => setSelectedActivity('phone_call')}
                  className={`px-4 py-2 rounded-full ${
                    selectedActivity === 'phone_call'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  } hover:bg-indigo-700 hover:text-white transition-all`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Phone Calls
                </motion.button>
                <motion.button
                  onClick={() => setSelectedActivity('vault_to_do')}
                  className={`px-4 py-2 rounded-full ${
                    selectedActivity === 'vault_to_do'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  } hover:bg-indigo-700 hover:text-white transition-all`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Vault To-Do
                </motion.button>
                
              </div>
              <div className="flex justify-between mb-4">
                <p className="text-gray-700 font-medium">Total Knocks: {totalKnocks}</p>
                <p className="text-gray-700 font-medium">Total Calls: {totalCalls}</p>
                <p className="text-gray-700 font-medium">Total Vault Actions: {totalVaultActions}</p>
              </div>
              {errors.streets && <p className="text-red-600 text-sm mb-4 font-medium">{errors.streets}</p>}

              {(selectedActivity === 'all' || selectedActivity === 'door_knock') && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                      <DoorClosed className="w-5 h-5 mr-2 text-indigo-600" />
                      Door Knocks
                    </h3>
                    <motion.button
                      onClick={() => addStreet('door_knock')}
                      className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-full hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title="Add door knock street"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Street
                    </motion.button>
                  </div>
                  {(marketingPlan.door_knock_streets || []).map((street, index) => (
                    <motion.div
                      key={street.id}
                      className="border border-gray-200 p-4 mb-4 rounded-lg bg-gray-50 hover:shadow-md transition-shadow duration-200"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <input
                            type="text"
                            value={street.name}
                            onChange={(e) => updateStreet('door_knock', street.id, 'name', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                            placeholder="Street Name *"
                            aria-label={`Door knock street ${index + 1} name`}
                          />
                          {errors[`door_knock_street_${index}_name`] && (
                            <p className="text-red-600 text-sm mt-1 font-medium">
                              {errors[`door_knock_street_${index}_name`]}
                            </p>
                          )}
                        </div>
                        <input
                          type="text"
                          value={street.why}
                          onChange={(e) => updateStreet('door_knock', street.id, 'why', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                          placeholder="Why this street?"
                          aria-label={`Door knock street ${index + 1} reason`}
                        />
                        <input
                          type="number"
                          value={street.house_count}
                          onChange={(e) => updateStreet('door_knock', street.id, 'house_count', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                          placeholder="Number of Houses"
                          min="0"
                          aria-label={`Door knock street ${index + 1} house count`}
                        />
                        <div>
                          <input
                            type="number"
                            value={street.target_knocks}
                            onChange={(e) => updateStreet('door_knock', street.id, 'target_knocks', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                            placeholder="Target Knocks *"
                            min="1"
                            aria-label={`Door knock street ${index + 1} target knocks`}
                          />
                          {errors[`door_knock_street_${index}_target_knocks`] && (
                            <p className="text-red-600 text-sm mt-1 font-medium">
                              {errors[`door_knock_street_${index}_target_knocks`]}
                            </p>
                          )}
                        </div>
                      </div>
                      <motion.button
                        onClick={() => removeStreet('door_knock', street.id)}
                        className="mt-4 flex items-center text-red-600 hover:text-red-800 font-medium transition-colors duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={`Remove door knock street ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Street
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}

              {(selectedActivity === 'all' || selectedActivity === 'phone_call') && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                      <Phone className="w-5 h-5 mr-2 text-indigo-600" />
                      Phone Calls
                    </h3>
                    <motion.button
                      onClick={() => addStreet('phone_call')}
                      className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-full hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title="Add phone call street"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Street
                    </motion.button>
                  </div>
                  {(marketingPlan.phone_call_streets || []).map((street, index) => (
                    <motion.div
                      key={street.id}
                      className="border border-gray-200 p-4 mb-4 rounded-lg bg-gray-50 hover:shadow-md transition-shadow duration-200"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <input
                            type="text"
                            value={street.name}
                            onChange={(e) => updateStreet('phone_call', street.id, 'name', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                            placeholder="Street Name *"
                            aria-label={`Phone call street ${index + 1} name`}
                          />
                          {errors[`phone_call_street_${index}_name`] && (
                            <p className="text-red-600 text-sm mt-1 font-medium">
                              {errors[`phone_call_street_${index}_name`]}
                            </p>
                          )}
                        </div>
                        <input
                          type="text"
                          value={street.why}
                          onChange={(e) => updateStreet('phone_call', street.id, 'why', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                          placeholder="Why this street?"
                          aria-label={`Phone call street ${index + 1} reason`}
                        />
                        <div>
                          <input
                            type="number"
                            value={street.target_calls}
                            onChange={(e) => updateStreet('phone_call', street.id, 'target_calls', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                            placeholder="Target Calls *"
                            min="1"
                            aria-label={`Phone call street ${index + 1} target calls`}
                          />
                          {errors[`phone_call_street_${index}_target_calls`] && (
                            <p className="text-red-600 text-sm mt-1 font-medium">
                              {errors[`phone_call_street_${index}_target_calls`]}
                            </p>
                          )}
                        </div>
                        <div>
                          <input
                            type="number"
                            value={street.target_connects}
                            onChange={(e) => updateStreet('phone_call', street.id, 'target_connects', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                            placeholder="Target Connects *"
                            min="0"
                            aria-label={`Phone call street ${index + 1} target connects`}
                          />
                          {errors[`phone_call_street_${index}_target_connects`] && (
                            <p className="text-red-600 text-sm mt-1 font-medium">
                              {errors[`phone_call_street_${index}_target_connects`]}
                            </p>
                          )}
                        </div>
                      </div>
                      <motion.button
                        onClick={() => removeStreet('phone_call', street.id)}
                        className="mt-4 flex items-center text-red-600 hover:text-red-800 font-medium transition-colors duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={`Remove phone call street ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Street
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}

              {(selectedActivity === 'all' || selectedActivity === 'vault_to_do') && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                      <List className="w-5 h-5 mr-2 text-indigo-600" />
                      Vault To-Do List
                    </h3>
                    <motion.button
                      onClick={() => addStreet('vault_to_do')}
                      className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-full hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      title="Add vault to-do street"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Street
                    </motion.button>
                  </div>
                  {(marketingPlan.vault_to_do_streets || []).map((street, index) => (
                    <motion.div
                      key={street.id}
                      className="border border-gray-200 p-4 mb-4 rounded-lg bg-gray-50 hover:shadow-md transition-shadow duration-200"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <input
                            type="text"
                            value={street.name}
                            onChange={(e) => updateStreet('vault_to_do', street.id, 'name', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                            placeholder="Street Name *"
                            aria-label={`Vault to-do street ${index + 1} name`}
                          />
                          {errors[`vault_to_do_street_${index}_name`] && (
                            <p className="text-red-600 text-sm mt-1 font-medium">
                              {errors[`vault_to_do_street_${index}_name`]}
                            </p>
                          )}
                        </div>
                        <input
                          type="text"
                          value={street.why}
                          onChange={(e) => updateStreet('vault_to_do', street.id, 'why', e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                          placeholder="Why this street?"
                          aria-label={`Vault to-do street ${index + 1} reason`}
                        />
                        <div>
                          <input
                            type="number"
                            value={street.target_actions}
                            onChange={(e) => updateStreet('vault_to_do', street.id, 'target_actions', e.target.value)}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                            placeholder="Target Actions *"
                            min="1"
                            aria-label={`Vault to-do street ${index + 1} target actions`}
                          />
                          {errors[`vault_to_do_street_${index}_target_actions`] && (
                            <p className="text-red-600 text-sm mt-1 font-medium">
                              {errors[`vault_to_do_street_${index}_target_actions`]}
                            </p>
                          )}
                        </div>
                      </div>
                      <motion.button
                        onClick={() => removeStreet('vault_to_do', street.id)}
                        className="mt-4 flex items-center text-red-600 hover:text-red-800 font-medium transition-colors duration-200"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title={`Remove vault to-do street ${index + 1}`}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove Street
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Appraisals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <input
                      type="number"
                      value={marketingPlan.desktop_appraisals}
                      onChange={(e) =>
                        setMarketingPlan({ ...marketingPlan, desktop_appraisals: e.target.value })
                      }
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                      placeholder="Desktop Appraisals *"
                      min="0"
                      aria-label="Desktop appraisals"
                    />
                    {errors.desktop_appraisals && (
                      <p className="text-red-600 text-sm mt-1 font-medium">{errors.desktop_appraisals}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="number"
                      value={marketingPlan.face_to_face_appraisals}
                      onChange={(e) =>
                        setMarketingPlan({ ...marketingPlan, face_to_face_appraisals: e.target.value })
                      }
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50"
                      placeholder="Face-to-Face Appraisals *"
                      min="0"
                      aria-label="Face-to-face appraisals"
                    />
                    {errors.face_to_face_appraisals && (
                      <p className="text-red-600 text-sm mt-1 font-medium">{errors.face_to_face_appraisals}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <motion.button
                onClick={saveMarketingPlan}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-full hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md disabled:opacity-50"
                disabled={isSaving}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Save marketing plan"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                )}
                {isSaving ? 'Saving...' : 'Save Marketing Plan'}
              </motion.button>
              <motion.button
                onClick={() => navigate('/vault-to-do-list')}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full hover:from-purple-700 hover:to-purple-800 transition-all shadow-md"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="View to-do list"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View To-Do List
              </motion.button>
              <motion.button
                onClick={() => navigate('/progress-report')}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full hover:from-purple-700 hover:to-purple-800 transition-all shadow-md"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="View progress report"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View Progress Report
              </motion.button>
            </div>
            <p className="text-sm text-gray-500 mt-2">* Required field</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}