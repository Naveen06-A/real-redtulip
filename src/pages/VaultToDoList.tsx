import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { Loader2, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';

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

interface MarketingPlan {
  id: string;
  agent: string;
  suburb: string;
  start_date: string;
  end_date: string;
  door_knock_streets: DoorKnockStreet[];
  phone_call_streets: PhoneCallStreet[];
  desktop_appraisals: string;
  face_to_face_appraisals: string;
  created_at?: string;
  updated_at?: string;
}

interface ActivityLog {
  id: string;
  agent_id: string;
  activity_type: 'phone_call' | 'door_knock';
  activity_date: string;
  street_name: string;
  suburb: string;
  notes: string | null;
  status: string;
  calls_made?: number;
  calls_answered?: number;
  knocks_made?: number;
  knocks_answered?: number;
  desktop_appraisals?: number;
  face_to_face_appraisals?: number;
}

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

export function VaultToDoList() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [marketingPlan, setMarketingPlan] = useState<MarketingPlan>({
    id: uuidv4(),
    agent: '',
    suburb: '',
    start_date: '',
    end_date: '',
    door_knock_streets: [],
    phone_call_streets: [],
    desktop_appraisals: '',
    face_to_face_appraisals: '',
  });
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [savedPlans, setSavedPlans] = useState<MarketingPlan[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string>('');

  useEffect(() => {
    const initialize = async () => {
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
          await loadMarketingPlan(user.id);
          await loadSavedPlans(user.id);
        } catch (error) {
          toast.error('Failed to load data');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        navigate('/agent-login');
      }
    };

    initialize();
  }, [user, profile, navigate]);

  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  useEffect(() => {
    if (marketingPlan.id && marketingPlan.suburb && marketingPlan.start_date && marketingPlan.end_date) {
      checkReminders();
    }
  }, [marketingPlan, activities]);

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
        const mappedPlan = mapPlanData(data);
        setMarketingPlan(mappedPlan);
        setCurrentPlanId(mappedPlan.id);
        // Load activities for this specific plan
        await loadActivitiesForPlan(mappedPlan);
      } else {
        const defaultPlan = getDefaultPlan(agentId);
        setMarketingPlan(defaultPlan);
        setCurrentPlanId(defaultPlan.id);
      }
    } catch (error) {
      console.error('Error loading marketing plan:', error);
      const defaultPlan = getDefaultPlan(agentId);
      setMarketingPlan(defaultPlan);
      setCurrentPlanId(defaultPlan.id);
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

      setSavedPlans((data || []).map(mapPlanData));
    } catch (error) {
      console.error('Error loading saved plans:', error);
    }
  };

  const loadActivitiesForPlan = async (plan: MarketingPlan) => {
    try {
      let query = supabase
        .from('agent_activities')
        .select('*')
        .eq('agent_id', plan.agent);

      // Only add filters if we have valid values
      if (plan.suburb) {
        query = query.eq('suburb', plan.suburb);
      }
      
      if (plan.start_date) {
        query = query.gte('activity_date', plan.start_date);
      }
      
      if (plan.end_date) {
        query = query.lte('activity_date', plan.end_date);
      }

      const { data, error } = await query.order('activity_date', { ascending: false });

      if (error) {
        throw error;
      }

      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
      toast.error('Failed to load activity data');
    }
  };

  const mapPlanData = (data: any): MarketingPlan => ({
    id: data.id || uuidv4(),
    agent: data.agent || '',
    suburb: toTitleCase(data.suburb || ''),
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
    desktop_appraisals: data.desktop_appraisals || '',
    face_to_face_appraisals: data.face_to_face_appraisals || '',
    created_at: data.created_at || undefined,
    updated_at: data.updated_at || undefined,
  });

  const getDefaultPlan = (agentId: string): MarketingPlan => ({
    id: uuidv4(),
    agent: agentId,
    suburb: '',
    start_date: '',
    end_date: '',
    door_knock_streets: [],
    phone_call_streets: [],
    desktop_appraisals: '',
    face_to_face_appraisals: '',
  });

  const viewPlan = async (plan: MarketingPlan) => {
    setMarketingPlan(plan);
    setCurrentPlanId(plan.id);
    setShowPlansModal(false);
    // Load activities specifically for this plan
    await loadActivitiesForPlan(plan);
    checkReminders();
  };

  const calculateRemaining = (target: string, actual: number) => {
    const t = parseInt(target) || 0;
    return Math.max(t - actual, 0);
  };

  const getStatus = (remaining: number) => (remaining <= 0 ? 'Completed' : 'Ongoing');

  const checkReminders = () => {
    const newReminders: string[] = [];
    const currentDate = new Date();
    const endDate = new Date(marketingPlan.end_date);

    if (currentDate > endDate) {
      newReminders.push(`Plan for ${marketingPlan.suburb} is past due date (${new Date(marketingPlan.end_date).toLocaleDateString()}).`);
    }

    marketingPlan.door_knock_streets.forEach((street) => {
      const streetKnocksMade = activities
        .filter((a) => a.activity_type === 'door_knock' && a.street_name.toLowerCase() === street.name.toLowerCase())
        .reduce((sum, a) => sum + (a.knocks_made || 0), 0);
      const remaining = calculateRemaining(street.target_knocks, streetKnocksMade);
      if (remaining > 0) {
        newReminders.push(`Remaining door knocks on ${street.name}: ${remaining}`);
      }
    });

    marketingPlan.phone_call_streets.forEach((street) => {
      const streetCallsMade = activities
        .filter((a) => a.activity_type === 'phone_call' && a.street_name.toLowerCase() === street.name.toLowerCase())
        .reduce((sum, a) => sum + (a.calls_made || 0), 0);
      const streetConnectsMade = activities
        .filter((a) => a.activity_type === 'phone_call' && a.street_name.toLowerCase() === street.name.toLowerCase())
        .reduce((sum, a) => sum + (a.calls_answered || 0), 0);
      const remainingCalls = calculateRemaining(street.target_calls, streetCallsMade);
      const remainingConnects = calculateRemaining(street.target_connects, streetConnectsMade);
      if (remainingCalls > 0) {
        newReminders.push(`Remaining phone calls on ${street.name}: ${remainingCalls}`);
      }
      if (remainingConnects > 0) {
        newReminders.push(`Remaining connects on ${street.name}: ${remainingConnects}`);
      }
    });

    const remainingDesktop = calculateRemaining(marketingPlan.desktop_appraisals, totalDesktopAppraisals);
    const remainingFaceToFace = calculateRemaining(marketingPlan.face_to_face_appraisals, totalFaceToFaceAppraisals);
    if (remainingDesktop > 0) {
      newReminders.push(`Remaining desktop appraisals: ${remainingDesktop}`);
    }
    if (remainingFaceToFace > 0) {
      newReminders.push(`Remaining face-to-face appraisals: ${remainingFaceToFace}`);
    }

    setReminders(newReminders);
  };

  const totalKnocksMade = activities
    .filter((a) => a.activity_type === 'door_knock')
    .reduce((sum, a) => sum + (a.knocks_made || 0), 0);
  const totalKnocksTarget = marketingPlan.door_knock_streets.reduce(
    (sum, street) => sum + (parseInt(street.target_knocks || '0') || 0),
    0
  );
  const totalCallsMade = activities
    .filter((a) => a.activity_type === 'phone_call')
    .reduce((sum, a) => sum + (a.calls_made || 0), 0);
  const totalCallsTarget = marketingPlan.phone_call_streets.reduce(
    (sum, street) => sum + (parseInt(street.target_calls || '0') || 0),
    0
  );
  const totalConnectsMade = activities
    .filter((a) => a.activity_type === 'phone_call')
    .reduce((sum, a) => sum + (a.calls_answered || 0), 0);
  const totalConnectsTarget = marketingPlan.phone_call_streets.reduce(
    (sum, street) => sum + (parseInt(street.target_connects || '0') || 0),
    0
  );
  const totalDesktopAppraisals = activities.reduce((sum, a) => sum + (a.desktop_appraisals || 0), 0);
  const totalFaceToFaceAppraisals = activities.reduce((sum, a) => sum + (a.face_to_face_appraisals || 0), 0);

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

  const handleRefreshData = async () => {
    if (user && marketingPlan.suburb && marketingPlan.start_date && marketingPlan.end_date) {
      await loadActivitiesForPlan(marketingPlan);
      setSaveSuccess(true);
    } else {
      toast.error('Cannot refresh data: Plan information is incomplete');
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
              d="M9 19v-6a2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"
            />
          </svg>
          Vault To-Do List
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
            onClick={() => navigate('/marketing-plan')}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full hover:from-blue-700 hover:to-blue-800 transition-all shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Back to marketing plan"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
              />
            </svg>
            Back to Marketing Plan
          </motion.button>
          <motion.button
            onClick={() => setShowPlansModal(true)}
            className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full hover:from-purple-700 hover:to-purple-800 transition-all shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="View other plans"
            disabled={savedPlans.length <= 1}
          >
            <Eye className="w-4 h-4 mr-2" />
            View Other Plans ({savedPlans.length})
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
                    <div key={plan.id} className={`border p-4 rounded-lg ${currentPlanId === plan.id ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50'}`}>
                      <p><strong>Suburb:</strong> {plan.suburb}</p>
                      <p><strong>Start Date:</strong> {new Date(plan.start_date).toLocaleDateString()}</p>
                      <p><strong>End Date:</strong> {new Date(plan.end_date).toLocaleDateString()}</p>
                      <p><strong>Status:</strong> {currentPlanId === plan.id ? 'Currently Viewing' : 'Click to view'}</p>
                      <motion.button
                        onClick={() => viewPlan(plan)}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={currentPlanId === plan.id}
                      >
                        {currentPlanId === plan.id ? 'Currently Viewing' : 'View To-Do List'}
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
              Data refreshed successfully
            </div>
          )}

          {reminders.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
                Reminders / Due Tasks
              </h3>
              <ul className="list-disc pl-5 space-y-1">
                {reminders.map((reminder, index) => (
                  <li key={index} className="text-yellow-800">{reminder}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-600">Total Door Knocks Made</p>
                <p className="text-2xl font-bold">{totalKnocksMade} / {totalKnocksTarget}</p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-600">Total Calls Made</p>
                <p className="text-2xl font-bold">{totalCallsMade} / {totalCallsTarget}</p>
              </div>
              <div className="p-4 bg-indigo-50 rounded-lg">
                <p className="text-sm text-indigo-600">Total Connects Made</p>
                <p className="text-2xl font-bold">{totalConnectsMade} / {totalConnectsTarget}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Plan Details</h3>
              <p><strong>Suburb:</strong> {marketingPlan.suburb}</p>
              <p><strong>Start Date:</strong> {new Date(marketingPlan.start_date).toLocaleDateString()}</p>
              <p><strong>End Date:</strong> {new Date(marketingPlan.end_date).toLocaleDateString()}</p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                Door Knocks
              </h3>
              {marketingPlan.door_knock_streets.length === 0 ? (
                <p className="text-gray-600">No door knock streets in this plan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-indigo-600 text-white text-sm">
                        <th className="p-2 text-left">Street Name</th>
                        <th className="p-2 text-left">Target Knocks</th>
                        <th className="p-2 text-left">Actual Knocks</th>
                        <th className="p-2 text-left">Remaining</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketingPlan.door_knock_streets.map((street) => {
                        const streetKnocksMade = activities
                          .filter((a) => a.activity_type === 'door_knock' && a.street_name.toLowerCase() === street.name.toLowerCase())
                          .reduce((sum, a) => sum + (a.knocks_made || 0), 0);
                        const remaining = calculateRemaining(street.target_knocks, streetKnocksMade);
                        const status = getStatus(remaining);
                        return (
                          <tr key={street.id} className="border-b border-gray-200 hover:bg-gray-100">
                            <td className="p-2">{street.name}</td>
                            <td className="p-2">{street.target_knocks}</td>
                            <td className="p-2">{streetKnocksMade}</td>
                            <td className="p-2">{remaining}</td>
                            <td className="p-2">
                              {status === 'Completed' ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-yellow-600" />
                              )}
                              {status}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                Phone Calls
              </h3>
              {marketingPlan.phone_call_streets.length === 0 ? (
                <p className="text-gray-600">No phone call streets in this plan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-indigo-600 text-white text-sm">
                        <th className="p-2 text-left">Street Name</th>
                        <th className="p-2 text-left">Target Calls</th>
                        <th className="p-2 text-left">Actual Calls</th>
                        <th className="p-2 text-left">Remaining Calls</th>
                        <th className="p-2 text-left">Target Connects</th>
                        <th className="p-2 text-left">Actual Connects</th>
                        <th className="p-2 text-left">Remaining Connects</th>
                        <th className="p-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marketingPlan.phone_call_streets.map((street) => {
                        const streetCallsMade = activities
                          .filter((a) => a.activity_type === 'phone_call' && a.street_name.toLowerCase() === street.name.toLowerCase())
                          .reduce((sum, a) => sum + (a.calls_made || 0), 0);
                        const streetConnectsMade = activities
                          .filter((a) => a.activity_type === 'phone_call' && a.street_name.toLowerCase() === street.name.toLowerCase())
                          .reduce((sum, a) => sum + (a.calls_answered || 0), 0);
                        const remainingCalls = calculateRemaining(street.target_calls, streetCallsMade);
                        const remainingConnects = calculateRemaining(street.target_connects, streetConnectsMade);
                        const status = getStatus(remainingCalls + remainingConnects);
                        return (
                          <tr key={street.id} className="border-b border-gray-200 hover:bg-gray-100">
                            <td className="p-2">{street.name}</td>
                            <td className="p-2">{street.target_calls}</td>
                            <td className="p-2">{streetCallsMade}</td>
                            <td className="p-2">{remainingCalls}</td>
                            <td className="p-2">{street.target_connects}</td>
                            <td className="p-2">{streetConnectsMade}</td>
                            <td className="p-2">{remainingConnects}</td>
                            <td className="p-2">
                              {status === 'Completed' ? (
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-yellow-600" />
                              )}
                              {status}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                Appraisals
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="font-medium">Desktop Appraisals</p>
                  <p>Target: {marketingPlan.desktop_appraisals}</p>
                  <p>Actual: {totalDesktopAppraisals}</p>
                  <p>Remaining: {calculateRemaining(marketingPlan.desktop_appraisals, totalDesktopAppraisals)}</p>
                  <p>Status: {getStatus(calculateRemaining(marketingPlan.desktop_appraisals, totalDesktopAppraisals))}</p>
                </div>
                <div>
                  <p className="font-medium">Face-to-Face Appraisals</p>
                  <p>Target: {marketingPlan.face_to_face_appraisals}</p>
                  <p>Actual: {totalFaceToFaceAppraisals}</p>
                  <p>Remaining: {calculateRemaining(marketingPlan.face_to_face_appraisals, totalFaceToFaceAppraisals)}</p>
                  <p>Status: {getStatus(calculateRemaining(marketingPlan.face_to_face_appraisals, totalFaceToFaceAppraisals))}</p>
                </div>
              </div>
            </div>
          </div>

          <motion.button
            onClick={handleRefreshData}
            className="mt-8 flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-full hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Refresh data"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh Data
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}