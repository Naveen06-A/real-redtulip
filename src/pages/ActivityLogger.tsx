import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Clock, Send, CheckCircle, ChevronLeft, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { ErrorBoundary } from 'react-error-boundary';
import { toast } from 'react-toastify';

// Define interfaces
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
}

interface ActivityLog {
  perform_phone_call: boolean;
  perform_door_knock: boolean;
  street_name_phone: string;
  street_name_door: string;
  suburb: string;
  calls_connected?: string;
  calls_answered?: string;
  knocks_made?: string;
  knocks_answered?: string;
  desktop_appraisals?: string;
  face_to_face_appraisals?: string;
  notes: string;
  date: string;
  submitting?: boolean;
}

interface UserProfile {
  id: string;
  role: string;
}

const ErrorFallback = ({ error }: { error: Error }) => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 py-12 px-4 sm:px-6 lg:px-8">
    <div className="max-w-5xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <svg className="w-20 h-20 mx-auto mb-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-2xl font-semibold text-red-600">{error.message}</p>
        <motion.button
          onClick={() => window.location.reload()}
          className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-xl"
          whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(0, 91, 234, 0.3)' }}
          whileTap={{ scale: 0.95 }}
        >
          Reload Page
        </motion.button>
      </motion.div>
    </div>
  </div>
);

function ActivityLogReport({
  logs,
  planId,
  onBack,
  onDashboard,
  onProgressReport,
}: {
  logs: ActivityLog[];
  planId: string | null;
  onBack: () => void;
  onDashboard: () => void;
  onProgressReport: () => void;
}) {
  const formatDate = (date: string) => {
    const d = new Date(date);
    const weekday = d.toLocaleDateString('en-AU', { weekday: 'long' });
    const day = d.toLocaleDateString('en-AU', { day: 'numeric' });
    const month = d.toLocaleDateString('en-AU', { month: 'long' });
    const year = d.toLocaleDateString('en-AU', { year: 'numeric' });
    return `${weekday}, ${day} ${month} ${year}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <motion.h1
          className="text-5xl font-extrabold text-blue-800 mb-10 flex items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Clock className="w-10 h-10 mr-4 text-blue-600" />
          Activity Log Report
        </motion.h1>

        <motion.div
          className="mb-10 bg-blue-100/50 backdrop-blur-lg p-6 rounded-xl flex items-center shadow-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <CheckCircle className="w-8 h-8 mr-3 text-blue-600" />
          <p className="text-lg text-blue-700">Activities logged successfully!</p>
        </motion.div>

        <motion.div
          className="mb-10 flex flex-wrap gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <motion.button
            onClick={onBack}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-xl"
            whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(0, 91, 234, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            title="Log another activity"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Log Another Activity
          </motion.button>
          <motion.button
            onClick={onDashboard}
            className="flex items-center px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all shadow-xl"
            whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(0, 128, 0, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            title="Go to dashboard"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011 1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Go to Dashboard
          </motion.button>
          <motion.button
            onClick={onProgressReport}
            className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all shadow-xl"
            whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(128, 0, 128, 0.3)' }}
            whileTap={{ scale: 0.95 }}
            title="View progress report"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Progress Report
          </motion.button>
        </motion.div>

        {logs.map((log, index) => (
          <motion.div
            key={index}
            className="bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-blue-100 max-w-3xl mx-auto hover:shadow-2xl transition-all duration-300 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 + index * 0.2 }}
          >
            <h2 className="text-3xl font-semibold text-blue-800 mb-8 flex items-center">
              <svg className="w-8 h-8 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              {log.perform_phone_call && log.perform_door_knock
                ? 'Phone Call & Door Knock Details'
                : log.perform_phone_call
                ? 'Phone Call Details'
                : 'Door Knock Details'}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <p className="text-blue-700 font-semibold text-lg">Suburb:</p>
                <p className="text-blue-900 text-lg">{log.suburb}</p>
              </div>
              <div>
                <p className="text-blue-700 font-semibold text-lg">Date:</p>
                <p className="text-blue-900 text-lg">{formatDate(log.date)}</p>
              </div>
              {log.perform_phone_call && (
                <>
                  <div>
                    <p className="text-blue-700 font-semibold text-lg">Phone Call Street:</p>
                    <p className="text-blue-900 text-lg">{log.street_name_phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-semibold text-lg">Calls Connected:</p>
                    <p className="text-blue-900 text-lg">{log.calls_connected || '0'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-semibold text-lg">Calls Answered:</p>
                    <p className="text-blue-900 text-lg">{log.calls_answered || '0'}</p>
                  </div>
                </>
              )}
              {log.perform_door_knock && (
                <>
                  <div>
                    <p className="text-blue-700 font-semibold text-lg">Door Knock Street:</p>
                    <p className="text-blue-900 text-lg">{log.street_name_door || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-semibold text-lg">Knocks Made:</p>
                    <p className="text-blue-900 text-lg">{log.knocks_made || '0'}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 font-semibold text-lg">Knocks Answered:</p>
                    <p className="text-blue-900 text-lg">
                      {log.knocks_answered || '0'}{' '}
                      {log.knocks_made && log.knocks_answered
                        ? `(${((parseFloat(log.knocks_answered) / parseFloat(log.knocks_made)) * 100).toFixed(2)}% completion)`
                        : ''}
                    </p>
                    <div className="w-full h-3 bg-blue-200 rounded-full mt-3">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            (parseFloat(log.knocks_answered || '0') / parseFloat(log.knocks_made || '1')) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
              <div>
                <p className="text-blue-700 font-semibold text-lg">Desktop Appraisals:</p>
                <p className="text-blue-900 text-lg">{log.desktop_appraisals || '0'}</p>
              </div>
              <div>
                <p className="text-blue-700 font-semibold text-lg">Face-to-Face Appraisals:</p>
                <p className="text-blue-900 text-lg">{log.face_to_face_appraisals || '0'}</p>
              </div>
              <div className="lg:col-span-2">
                <p className="text-blue-700 font-semibold text-lg">Notes:</p>
                <p className="text-blue-900 text-lg">{log.notes || 'No notes provided'}</p>
              </div>
            </div>
          </motion.div>
        ))}
        <div className="mt-10 flex gap-6">
          <motion.button
            onClick={onBack}
            className="flex-1 flex items-center justify-center px-8 py-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-xl"
            whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(0, 91, 234, 0.3)' }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Log Another Activity
          </motion.button>
          <motion.button
            onClick={onProgressReport}
            className="flex-1 flex items-center justify-center px-8 py-4 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all shadow-xl"
            whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(128, 0, 128, 0.3)' }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Progress Report
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export function ActivityLogger() {
  const { user, profile, loading, initializeAuth } = useAuthStore();
  const navigate = useNavigate();

  const capitalizeFirstLetter = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const getCurrentUTCDate = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      .toISOString()
      .split('T')[0];
  };

  const [activityLog, setActivityLog] = useState<ActivityLog>({
    perform_phone_call: false,
    perform_door_knock: false,
    street_name_phone: 'Main Street',
    street_name_door: 'Main Street',
    suburb: '',
    calls_connected: '',
    calls_answered: '',
    knocks_made: '',
    knocks_answered: '',
    desktop_appraisals: '',
    face_to_face_appraisals: '',
    notes: '',
    date: getCurrentUTCDate(),
    submitting: false,
  });
  const [success, setSuccess] = useState<boolean>(false);
  const [showReport, setShowReport] = useState(false);
  const [marketingPlans, setMarketingPlans] = useState<MarketingPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isCustomStreetPhone, setIsCustomStreetPhone] = useState(true);
  const [isCustomStreetDoor, setIsCustomStreetDoor] = useState(true);
  const [recommendedStreetPhone, setRecommendedStreetPhone] = useState<string | null>(null);
  const [recommendedStreetDoor, setRecommendedStreetDoor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [showPhoneSection, setShowPhoneSection] = useState(false);
  const [showDoorSection, setShowDoorSection] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      initializeAuth().then(() => {
        const updatedUser = useAuthStore.getState().user;
        const updatedProfile = useAuthStore.getState().profile;
        if (!updatedUser || !updatedProfile || (updatedProfile.role !== 'agent' && updatedProfile.role !== 'admin')) {
          navigate('/agent-login');
        } else {
          loadMarketingPlans(updatedUser.id);
        }
      }).catch((err) => {
        setError('Failed to initialize authentication. Please try again.');
      });
    } else if (user && profile && (profile.role === 'agent' || profile.role === 'admin')) {
      loadMarketingPlans(user.id);
    } else {
      navigate('/agent-login');
    }
  }, [user, profile, loading, initializeAuth, navigate]);

  useEffect(() => {
    if (!selectedPlanId && marketingPlans.length > 0) {
      const firstPlan = marketingPlans[0];
      setSelectedPlanId(firstPlan.id);
      setActivityLog((prev) => ({
        ...prev,
        suburb: firstPlan.suburb,
      }));
    } else if (!selectedPlanId && !marketingPlans.length) {
      setActivityLog((prev) => ({
        ...prev,
        suburb: '',
      }));
    }
  }, [marketingPlans, selectedPlanId]);

  const dashboardPath = profile?.role === 'admin' ? '/admin-dashboard' : '/agent-dashboard';

  const loadMarketingPlans = async (userId: string) => {
    if (isLoadingPlans) return;
    setIsLoadingPlans(true);
    try {
      setError(null);
      let query = supabase
        .from('marketing_plans')
        .select('id, agent, suburb, start_date, end_date, door_knock_streets, phone_call_streets, desktop_appraisals, face_to_face_appraisals')
        .order('updated_at', { ascending: false });

      if (profile?.role === 'agent') {
        query = query.eq('agent', userId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch marketing plans: ${error.message}`);
      }

      const plans: MarketingPlan[] = data.map((plan) => ({
        id: plan.id,
        agent: plan.agent,
        suburb: plan.suburb || '',
        start_date: plan.start_date || '',
        end_date: plan.end_date || '',
        door_knock_streets: (plan.door_knock_streets || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          why: s.why,
          house_count: s.house_count,
          target_knocks: s.target_knocks,
        })),
        phone_call_streets: (plan.phone_call_streets || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          why: s.why,
          target_calls: s.target_calls,
          target_connects: s.target_connects || '0',
        })),
        desktop_appraisals: plan.desktop_appraisals || '0',
        face_to_face_appraisals: plan.face_to_face_appraisals || '0',
      }));

      setMarketingPlans(plans);
    } catch (err: any) {
      setError('Failed to load marketing plans. Please try again or create a new plan.');
      toast.error('Failed to load marketing plans');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    const selectedPlan = marketingPlans.find((plan) => plan.id === selectedPlanId);
    if (selectedPlan) {
      if (!isCustomStreetPhone) {
        const availablePhoneStreets = selectedPlan.phone_call_streets.map((street) => street.name);
        if (availablePhoneStreets.length > 0) {
          const randomStreet = availablePhoneStreets[Math.floor(Math.random() * availablePhoneStreets.length)];
          setRecommendedStreetPhone(randomStreet);
          setActivityLog((prev) => ({
            ...prev,
            street_name_phone: randomStreet,
            suburb: selectedPlan.suburb,
          }));
        } else {
          setRecommendedStreetPhone(null);
          setActivityLog((prev) => ({
            ...prev,
            street_name_phone: 'Main Street',
            suburb: selectedPlan.suburb,
          }));
        }
      }
      if (!isCustomStreetDoor) {
        const availableDoorStreets = selectedPlan.door_knock_streets.map((street) => street.name);
        if (availableDoorStreets.length > 0) {
          const randomStreet = availableDoorStreets[Math.floor(Math.random() * availableDoorStreets.length)];
          setRecommendedStreetDoor(randomStreet);
          setActivityLog((prev) => ({
            ...prev,
            street_name_door: randomStreet,
            suburb: selectedPlan.suburb,
          }));
        } else {
          setRecommendedStreetDoor(null);
          setActivityLog((prev) => ({
            ...prev,
            street_name_door: 'Main Street',
            suburb: selectedPlan.suburb,
          }));
        }
      }
      setActivityLog((prev) => ({
        ...prev,
        suburb: selectedPlan.suburb,
      }));
    }
  }, [selectedPlanId, marketingPlans, isCustomStreetPhone, isCustomStreetDoor]);

  const validateActivityForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!activityLog.perform_phone_call && !activityLog.perform_door_knock) {
      newErrors.activity_type = 'Please select at least one activity type (Phone Calls or Door Knocks)';
    }
    if (!activityLog.suburb.trim()) newErrors.suburb = 'Please select a suburb';
    if (activityLog.perform_phone_call && !activityLog.street_name_phone.trim()) {
      newErrors.street_name_phone = 'Please select or enter a street name for phone calls';
    }
    if (activityLog.perform_door_knock && !activityLog.street_name_door.trim()) {
      newErrors.street_name_door = 'Please select or enter a street name for door knocks';
    }

    const selectedDateStr = activityLog.date;
    const todayStr = getCurrentUTCDate();

    if (!activityLog.date) {
      newErrors.date = 'Please select a date';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDateStr)) {
      newErrors.date = 'Please enter a valid date (YYYY-MM-DD)';
    } else if (selectedDateStr > todayStr) {
      newErrors.date = `Please select today (${new Date(todayStr).toLocaleDateString('en-AU')}) or a past date`;
    }

    if (activityLog.perform_phone_call) {
      if (!activityLog.calls_connected || parseInt(activityLog.calls_connected) <= 0) {
        newErrors.calls_connected = 'Please enter at least 1 call connected';
      } else if (isNaN(parseInt(activityLog.calls_connected)) || parseInt(activityLog.calls_connected) < 0) {
        newErrors.calls_connected = 'Please enter a valid number (e.g., 1 or 5)';
      }
      if (
        activityLog.calls_answered &&
        (isNaN(parseInt(activityLog.calls_answered)) || parseInt(activityLog.calls_answered) < 0)
      ) {
        newErrors.calls_answered = 'Please enter a valid number (e.g., 0 or 3)';
      }
      if (
        activityLog.calls_connected &&
        activityLog.calls_answered &&
        parseInt(activityLog.calls_answered) > parseInt(activityLog.calls_connected)
      ) {
        newErrors.calls_answered = 'Cannot be more than calls connected';
      }
    }

    if (activityLog.perform_door_knock) {
      if (!activityLog.knocks_made || parseInt(activityLog.knocks_made) <= 0) {
        newErrors.knocks_made = 'Please enter at least 1 knock made';
      } else if (isNaN(parseInt(activityLog.knocks_made)) || parseInt(activityLog.knocks_made) < 0) {
        newErrors.knocks_made = 'Please enter a valid number (e.g., 1 or 15)';
      }
      if (
        activityLog.knocks_answered &&
        (isNaN(parseInt(activityLog.knocks_answered)) || parseInt(activityLog.knocks_answered) < 0)
      ) {
        newErrors.knocks_answered = 'Please enter a valid number (e.g., 0 or 5)';
      }
      if (
        activityLog.knocks_made &&
        activityLog.knocks_answered &&
        parseInt(activityLog.knocks_answered) > parseInt(activityLog.knocks_made)
      ) {
        newErrors.knocks_answered = 'Cannot be more than knocks made';
      }
    }

    if (
      activityLog.desktop_appraisals &&
      (isNaN(parseInt(activityLog.desktop_appraisals)) || parseInt(activityLog.desktop_appraisals) < 0)
    ) {
      newErrors.desktop_appraisals = 'Please enter a valid number (e.g., 0 or 2)';
    }
    if (
      activityLog.face_to_face_appraisals &&
      (isNaN(parseInt(activityLog.face_to_face_appraisals)) || parseInt(activityLog.face_to_face_appraisals) < 0)
    ) {
      newErrors.face_to_face_appraisals = 'Please enter a valid number (e.g., 0 or 1)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleActivitySubmit = async () => {
    if (!validateActivityForm()) {
      toast.error('Please fix the errors in the activity form before submitting.');
      return;
    }

    if (!user?.id) {
      toast.error('User not authenticated. Please log in.');
      navigate('/agent-login');
      return;
    }

    if (activityLog.submitting) {
      toast.error('Submission in progress. Please wait.');
      return;
    }

    setActivityLog({ ...activityLog, submitting: true });

    try {
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !supabaseUser) {
        throw new Error('Failed to verify authenticated user: ' + (authError?.message || 'No user found'));
      }

      if (user.id !== supabaseUser.id) {
        throw new Error('Mismatch between useAuthStore user ID and Supabase authenticated user ID');
      }

      const activities: any[] = [];
      const submittedLogs: ActivityLog[] = [];

      if (activityLog.perform_phone_call) {
        const phoneActivity = {
          agent_id: user.id,
          activity_type: 'phone_call',
          activity_date: new Date(activityLog.date).toISOString(),
          street_name: capitalizeFirstLetter(activityLog.street_name_phone.trim()),
          suburb: activityLog.suburb.trim(),
          notes: activityLog.notes.trim() || null,
          status: 'Completed',
          calls_connected: parseInt(activityLog.calls_connected || '0'),
          calls_answered: parseInt(activityLog.calls_answered || '0'),
          desktop_appraisals: parseInt(activityLog.desktop_appraisals || '0'),
          face_to_face_appraisals: parseInt(activityLog.face_to_face_appraisals || '0'),
        };
        activities.push(phoneActivity);
        submittedLogs.push({
          perform_phone_call: true,
          perform_door_knock: false,
          street_name_phone: capitalizeFirstLetter(activityLog.street_name_phone.trim()),
          street_name_door: '',
          suburb: activityLog.suburb.trim(),
          date: activityLog.date,
          calls_connected: activityLog.calls_connected,
          calls_answered: activityLog.calls_answered,
          knocks_made: '',
          knocks_answered: '',
          desktop_appraisals: activityLog.desktop_appraisals,
          face_to_face_appraisals: activityLog.face_to_face_appraisals,
          notes: activityLog.notes.trim() || 'No notes provided',
          submitting: false,
        });
      }

      if (activityLog.perform_door_knock) {
        const doorActivity = {
          agent_id: user.id,
          activity_type: 'door_knock',
          activity_date: new Date(activityLog.date).toISOString(),
          street_name: capitalizeFirstLetter(activityLog.street_name_door.trim()),
          suburb: activityLog.suburb.trim(),
          notes: activityLog.notes.trim() || null,
          status: 'Completed',
          knocks_made: parseInt(activityLog.knocks_made || '0'),
          knocks_answered: parseInt(activityLog.knocks_answered || '0'),
          desktop_appraisals: parseInt(activityLog.desktop_appraisals || '0'),
          face_to_face_appraisals: parseInt(activityLog.face_to_face_appraisals || '0'),
        };
        activities.push(doorActivity);
        submittedLogs.push({
          perform_phone_call: false,
          perform_door_knock: true,
          street_name_phone: '',
          street_name_door: capitalizeFirstLetter(activityLog.street_name_door.trim()),
          suburb: activityLog.suburb.trim(),
          date: activityLog.date,
          calls_connected: '',
          calls_answered: '',
          knocks_made: activityLog.knocks_made,
          knocks_answered: activityLog.knocks_answered,
          desktop_appraisals: activityLog.desktop_appraisals,
          face_to_face_appraisals: activityLog.face_to_face_appraisals,
          notes: activityLog.notes.trim() || 'No notes provided',
          submitting: false,
        });
      }

      const { error: activityError } = await supabase.from('agent_activities').insert(activities);

      if (activityError) {
        if (activityError.message.includes('violates row-level security policy')) {
          throw new Error('You do not have permission to log this activity. Please ensure your account is correctly set up or contact your administrator.');
        }
        throw new Error(`Failed to log activities: ${activityError.message}`);
      }

      const selectedPlan = marketingPlans.find((plan) => plan.id === selectedPlanId);
      if (selectedPlan) {
        const updateData = {
          desktop_appraisals: String(
            parseInt(selectedPlan.desktop_appraisals || '0') +
            parseInt(activityLog.desktop_appraisals || '0')
          ),
          face_to_face_appraisals: String(
            parseInt(selectedPlan.face_to_face_appraisals || '0') +
            parseInt(activityLog.face_to_face_appraisals || '0')
          ),
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('marketing_plans')
          .update(updateData)
          .eq('id', selectedPlan.id);

        if (updateError) {
          throw new Error(`Failed to update marketing plan: ${updateError.message}`);
        }

        setMarketingPlans((prev) =>
          prev.map((plan) =>
            plan.id === selectedPlan.id
              ? { ...plan, ...updateData }
              : plan
          )
        );
      }

      setSuccess(true);
      setShowReport(true);
      toast.success('Activities logged successfully!');

      setActivityLog({
        perform_phone_call: false,
        perform_door_knock: false,
        street_name_phone: 'Main Street',
        street_name_door: 'Main Street',
        suburb: marketingPlans.find((plan) => plan.id === selectedPlanId)?.suburb || '',
        calls_connected: '',
        calls_answered: '',
        knocks_made: '',
        knocks_answered: '',
        desktop_appraisals: '',
        face_to_face_appraisals: '',
        notes: '',
        date: getCurrentUTCDate(),
        submitting: false,
      });
      setErrors({});
      setIsCustomStreetPhone(true);
      setIsCustomStreetDoor(true);
      setShowPhoneSection(false);
      setShowDoorSection(false);

      setActivityLog(submittedLogs[0]); // For report display, use the first log as a base
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred while logging the activities.';
      toast.error(errorMessage);
      setError(errorMessage);
    } finally {
      setActivityLog((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleStreetSelectPhone = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const plan = marketingPlans.find((p) => p.id === selectedPlanId);
    if (value === 'custom') {
      setIsCustomStreetPhone(true);
      setActivityLog((prev) => ({ ...prev, street_name_phone: '' }));
    } else if (plan) {
      setIsCustomStreetPhone(false);
      const streetExists = plan.phone_call_streets.some((s) => s.name === value);
      if (streetExists) {
        setActivityLog((prev) => ({ ...prev, street_name_phone: value }));
      } else {
        toast.error('Selected street not found in marketing plan');
      }
    }
  };

  const handleStreetSelectDoor = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const plan = marketingPlans.find((p) => p.id === selectedPlanId);
    if (value === 'custom') {
      setIsCustomStreetDoor(true);
      setActivityLog((prev) => ({ ...prev, street_name_door: '' }));
    } else if (plan) {
      setIsCustomStreetDoor(false);
      const streetExists = plan.door_knock_streets.some((s) => s.name === value);
      if (streetExists) {
        setActivityLog((prev) => ({ ...prev, street_name_door: value }));
      } else {
        toast.error('Selected street not found in marketing plan');
      }
    }
  };

  const getAvailablePhoneStreets = () => {
    const selectedPlan = marketingPlans.find((plan) => plan.id === selectedPlanId);
    return selectedPlan ? selectedPlan.phone_call_streets.map((street) => street.name) : [];
  };

  const getAvailableDoorStreets = () => {
    const selectedPlan = marketingPlans.find((plan) => plan.id === selectedPlanId);
    return selectedPlan ? selectedPlan.door_knock_streets.map((street) => street.name) : [];
  };

  if (loading) {
    return <LoadingOverlay message="Loading activity logger..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <svg className="w-20 h-20 mx-auto mb-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-2xl font-semibold text-red-600">{error}</p>
            <motion.button
              onClick={() => navigate('/agent-login')}
              className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-xl"
              whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(0, 91, 234, 0.3)' }}
              whileTap={{ scale: 0.95 }}
            >
              Go to Login
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!profile || (profile.role !== 'agent' && profile.role !== 'admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <svg className="w-20 h-20 mx-auto mb-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-2xl font-semibold text-red-600">Access denied. Agents or Admins only.</p>
            <motion.button
              onClick={() => navigate('/agent-login')}
              className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-xl"
              whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(0, 91, 234, 0.3)' }}
              whileTap={{ scale: 0.95 }}
            >
              Go to Login
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!marketingPlans.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <svg className="w-20 h-20 mx-auto mb-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-2xl font-semibold text-yellow-600">
              No marketing plans found. Please create a marketing plan to log activities.
            </p>
            <motion.button
              onClick={() => navigate('/marketing-plan')}
              className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-xl"
              whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(0, 91, 234, 0.3)' }}
              whileTap={{ scale: 0.95 }}
            >
              Create Marketing Plan
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (showReport) {
    const logsToDisplay = [];
    if (activityLog.perform_phone_call) {
      logsToDisplay.push({
        ...activityLog,
        perform_door_knock: false,
        street_name_door: '',
        knocks_made: '',
        knocks_answered: '',
      });
    }
    if (activityLog.perform_door_knock) {
      logsToDisplay.push({
        ...activityLog,
        perform_phone_call: false,
        street_name_phone: '',
        calls_connected: '',
        calls_answered: '',
      });
    }
    return (
      <ActivityLogReport
        logs={logsToDisplay}
        planId={selectedPlanId}
        onBack={() => {
          setShowReport(false);
          setSuccess(false);
        }}
        onDashboard={() => navigate(dashboardPath)}
        onProgressReport={() => navigate('/progress-report')}
      />
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 py-12 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-5xl mx-auto">
          <motion.h1
            className="text-5xl font-extrabold text-blue-800 mb-10 flex items-center"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Clock className="w-10 h-10 mr-4 text-blue-600" />
            Activity Logger
          </motion.h1>

          <motion.div
            className="mb-10 flex flex-wrap gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <motion.button
              onClick={() => navigate(dashboardPath)}
              className="flex items-center px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-all shadow-xl"
              whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(0, 128, 0, 0.3)' }}
              whileTap={{ scale: 0.95 }}
              title="Back to dashboard"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Back to Dashboard
            </motion.button>
            <motion.button
              onClick={() => navigate('/progress-report')}
              className="flex items-center px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all shadow-xl"
              whileHover={{ scale: 1.05, boxShadow: '0 8px 24px rgba(128, 0, 128, 0.3)' }}
              whileTap={{ scale: 0.95 }}
              title="View progress report"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              View Progress Report
            </motion.button>
          </motion.div>

          {(recommendedStreetPhone || recommendedStreetDoor) && (!isCustomStreetPhone || !isCustomStreetDoor) && (
            <motion.div
              className="mb-10 p-6 bg-blue-100/50 backdrop-blur-lg rounded-xl flex flex-col gap-2 shadow-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {recommendedStreetPhone && !isCustomStreetPhone && (
                <p className="text-lg text-blue-600">
                  Recommended Phone Call Street: <strong>{recommendedStreetPhone}</strong> (Suburb:{' '}
                  {marketingPlans.find((plan) => plan.id === selectedPlanId)?.suburb})
                </p>
              )}
              {recommendedStreetDoor && !isCustomStreetDoor && (
                <p className="text-lg text-blue-600">
                  Recommended Door Knock Street: <strong>{recommendedStreetDoor}</strong> (Suburb:{' '}
                  {marketingPlans.find((plan) => plan.id === selectedPlanId)?.suburb})
                </p>
              )}
            </motion.div>
          )}

          <motion.div
            className="bg-white/70 backdrop-blur-lg p-8 rounded-2xl shadow-xl border border-blue-100 max-w-3xl mx-auto hover:shadow-2xl transition-all duration-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h2 className="text-3xl font-semibold text-blue-800 mb-8">Log Activity</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <label className="block text-blue-800 font-semibold text-lg mb-2">Select Marketing Plan *</label>
                <motion.select
                  value={selectedPlanId || ''}
                  onChange={(e) => {
                    const planId = e.target.value;
                    const plan = marketingPlans.find((p) => p.id === planId);
                    if (plan) {
                      setSelectedPlanId(plan.id);
                      setActivityLog((prev) => ({
                        ...prev,
                        suburb: plan.suburb,
                        street_name_phone: 'Main Street',
                        street_name_door: 'Main Street',
                      }));
                      setIsCustomStreetPhone(true);
                      setIsCustomStreetDoor(true);
                    } else {
                      setSelectedPlanId(null);
                      setActivityLog((prev) => ({
                        ...prev,
                        suburb: '',
                        street_name_phone: 'Main Street',
                        street_name_door: 'Main Street',
                      }));
                    }
                    validateActivityForm();
                  }}
                  className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                  aria-label="Select marketing plan"
                  whileHover={{ scale: 1.02 }}
                  whileFocus={{ scale: 1.02 }}
                >
                  <option value="">Select a marketing plan</option>
                  {marketingPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.suburb} ({new Date(plan.start_date).toLocaleDateString('en-AU')} -{' '}
                      {new Date(plan.end_date).toLocaleDateString('en-AU')})
                    </option>
                  ))}
                </motion.select>
                {errors.suburb && (
                  <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {errors.suburb}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-blue-800 font-semibold text-lg mb-2">Date *</label>
                <motion.input
                  type="date"
                  value={activityLog.date}
                  onChange={(e) => {
                    setActivityLog({ ...activityLog, date: e.target.value });
                    validateActivityForm();
                  }}
                  max={getCurrentUTCDate()}
                  min="2024-01-01"
                  className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                  placeholder="e.g., 2025-05-21"
                  aria-label="Select date"
                  whileHover={{ scale: 1.02 }}
                  whileFocus={{ scale: 1.02 }}
                />
                {errors.date && (
                  <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {errors.date}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-blue-800 font-semibold text-lg mb-2">Suburb *</label>
                <motion.input
                  type="text"
                  value={activityLog.suburb}
                  readOnly
                  className="w-full p-4 border border-blue-200 rounded-lg bg-blue-100 text-lg"
                  aria-label="Suburb (read-only)"
                />
                {errors.suburb && (
                  <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {errors.suburb}
                  </p>
                )}
              </div>
              <div className="lg:col-span-2">
                <label className="block text-blue-800 font-semibold text-lg mb-2">Activity Types *</label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={activityLog.perform_phone_call}
                      onChange={(e) => {
                        setActivityLog({ ...activityLog, perform_phone_call: e.target.checked });
                        setShowPhoneSection(e.target.checked);
                        validateActivityForm();
                      }}
                      className="mr-2 h-5 w-5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-blue-800 text-lg">Phone Calls</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={activityLog.perform_door_knock}
                      onChange={(e) => {
                        setActivityLog({ ...activityLog, perform_door_knock: e.target.checked });
                        setShowDoorSection(e.target.checked);
                        validateActivityForm();
                      }}
                      className="mr-2 h-5 w-5 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-blue-800 text-lg">Door Knocks</span>
                  </label>
                </div>
                {errors.activity_type && (
                  <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {errors.activity_type}
                  </p>
                )}
              </div>
              <AnimatePresence>
                {showPhoneSection && (
                  <motion.div
                    className="lg:col-span-2 bg-blue-50/50 p-6 rounded-lg border border-blue-200"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div
                      className="flex items-center cursor-pointer mb-4"
                      onClick={() => setShowPhoneSection(!showPhoneSection)}
                    >
                      <h3 className="text-xl font-semibold text-blue-800 flex-1">Phone Call Details</h3>
                      {showPhoneSection ? (
                        <ChevronUp className="w-6 h-6 text-blue-600" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <label className="block text-blue-800 font-semibold text-lg mb-2">Phone Call Street *</label>
                        <motion.select
                          value={isCustomStreetPhone ? 'custom' : activityLog.street_name_phone}
                          onChange={handleStreetSelectPhone}
                          className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                          aria-label="Select phone call street"
                          whileHover={{ scale: 1.02 }}
                          whileFocus={{ scale: 1.02 }}
                        >
                          <option value="">Select a street</option>
                          {getAvailablePhoneStreets().map((street) => (
                            <option key={street} value={street}>
                              {street}
                            </option>
                          ))}
                          <option value="custom">Custom Street</option>
                        </motion.select>
                        <AnimatePresence>
                          {isCustomStreetPhone && (
                            <motion.input
                              type="text"
                              value={activityLog.street_name_phone}
                              onChange={(e) => {
                                setActivityLog({
                                  ...activityLog,
                                  street_name_phone: capitalizeFirstLetter(e.target.value),
                                });
                                validateActivityForm();
                              }}
                              className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 mt-3 text-lg"
                              placeholder="e.g., Main Street"
                              aria-label="Enter custom phone call street name"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                            />
                          )}
                        </AnimatePresence>
                        {errors.street_name_phone && (
                          <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            {errors.street_name_phone}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-blue-800 font-semibold text-lg mb-2">Calls Connected *</label>
                        <motion.input
                          type="number"
                          value={activityLog.calls_connected}
                          onChange={(e) => {
                            setActivityLog({ ...activityLog, calls_connected: e.target.value });
                            validateActivityForm();
                          }}
                          className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                          placeholder="e.g., 3"
                          min="1"
                          step="1"
                          aria-label="Enter calls connected"
                          whileHover={{ scale: 1.02 }}
                          whileFocus={{ scale: 1.02 }}
                        />
                        {errors.calls_connected && (
                          <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            {errors.calls_connected}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-blue-800 font-semibold text-lg mb-2">Calls Answered</label>
                        <motion.input
                          type="number"
                          value={activityLog.calls_answered}
                          onChange={(e) => {
                            setActivityLog({ ...activityLog, calls_answered: e.target.value });
                            validateActivityForm();
                          }}
                          className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                          placeholder="e.g., 2"
                          min="0"
                          step="1"
                          aria-label="Enter calls answered"
                          whileHover={{ scale: 1.02 }}
                          whileFocus={{ scale: 1.02 }}
                        />
                        {errors.calls_answered && (
                          <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            {errors.calls_answered}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {showDoorSection && (
                  <motion.div
                    className="lg:col-span-2 bg-blue-50/50 p-6 rounded-lg border border-blue-200"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div
                      className="flex items-center cursor-pointer mb-4"
                      onClick={() => setShowDoorSection(!showDoorSection)}
                    >
                      <h3 className="text-xl font-semibold text-blue-800 flex-1">Door Knock Details</h3>
                      {showDoorSection ? (
                        <ChevronUp className="w-6 h-6 text-blue-600" />
                      ) : (
                        <ChevronDown className="w-6 h-6 text-blue-600" />
                      )}
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div>
                        <label className="block text-blue-800 font-semibold text-lg mb-2">Door Knock Street *</label>
                        <motion.select
                          value={isCustomStreetDoor ? 'custom' : activityLog.street_name_door}
                          onChange={handleStreetSelectDoor}
                          className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                          aria-label="Select door knock street"
                          whileHover={{ scale: 1.02 }}
                          whileFocus={{ scale: 1.02 }}
                        >
                          <option value="">Select a street</option>
                          {getAvailableDoorStreets().map((street) => (
                            <option key={street} value={street}>
                              {street}
                            </option>
                          ))}
                          <option value="custom">Custom Street</option>
                        </motion.select>
                        <AnimatePresence>
                          {isCustomStreetDoor && (
                            <motion.input
                              type="text"
                              value={activityLog.street_name_door}
                              onChange={(e) => {
                                setActivityLog({
                                  ...activityLog,
                                  street_name_door: capitalizeFirstLetter(e.target.value),
                                });
                                validateActivityForm();
                              }}
                              className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 mt-3 text-lg"
                              placeholder="e.g., Main Street"
                              aria-label="Enter custom door knock street name"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                            />
                          )}
                        </AnimatePresence>
                        {errors.street_name_door && (
                          <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            {errors.street_name_door}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-blue-800 font-semibold text-lg mb-2">Knocks Made *</label>
                        <motion.input
                          type="number"
                          value={activityLog.knocks_made}
                          onChange={(e) => {
                            setActivityLog({ ...activityLog, knocks_made: e.target.value });
                            validateActivityForm();
                          }}
                          className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                          placeholder="e.g., 15"
                          min="1"
                          step="1"
                          aria-label="Enter knocks made"
                          whileHover={{ scale: 1.02 }}
                          whileFocus={{ scale: 1.02 }}
                        />
                        {errors.knocks_made && (
                          <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            {errors.knocks_made}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-blue-800 font-semibold text-lg mb-2">Knocks Answered</label>
                        <motion.input
                          type="number"
                          value={activityLog.knocks_answered}
                          onChange={(e) => {
                            setActivityLog({ ...activityLog, knocks_answered: e.target.value });
                            validateActivityForm();
                          }}
                          className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                          placeholder="e.g., 5"
                          min="0"
                          step="1"
                          aria-label="Enter knocks answered"
                          whileHover={{ scale: 1.02 }}
                          whileFocus={{ scale: 1.02 }}
                        />
                        {errors.knocks_answered && (
                          <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            {errors.knocks_answered}
                          </p>
                        )}
                        {activityLog.knocks_made && (
                          <div className="w-full h-3 bg-blue-200 rounded-full mt-3">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  (parseFloat(activityLog.knocks_answered || '0') /
                                    parseFloat(activityLog.knocks_made || '1')) *
                                    100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div>
                <label className="block text-blue-800 font-semibold text-lg mb-2">Desktop Appraisals</label>
                <motion.input
                  type="number"
                  value={activityLog.desktop_appraisals}
                  onChange={(e) => {
                    setActivityLog({ ...activityLog, desktop_appraisals: e.target.value });
                    validateActivityForm();
                  }}
                  className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                  placeholder="e.g., 2"
                  min="0"
                  step="1"
                  aria-label="Enter desktop appraisals"
                  whileHover={{ scale: 1.02 }}
                  whileFocus={{ scale: 1.02 }}
                />
                {errors.desktop_appraisals && (
                  <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {errors.desktop_appraisals}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-blue-800 font-semibold text-lg mb-2">Face-to-Face Appraisals</label>
                <motion.input
                  type="number"
                  value={activityLog.face_to_face_appraisals}
                  onChange={(e) => {
                    setActivityLog({ ...activityLog, face_to_face_appraisals: e.target.value });
                    validateActivityForm();
                  }}
                  className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                  placeholder="e.g., 1"
                  min="0"
                  step="1"
                  aria-label="Enter face-to-face appraisals"
                  whileHover={{ scale: 1.02 }}
                  whileFocus={{ scale: 1.02 }}
                />
                {errors.face_to_face_appraisals && (
                  <p className="text-red-600 text-sm mt-2 font-medium flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    {errors.face_to_face_appraisals}
                  </p>
                )}
              </div>
              <div className="lg:col-span-2">
                <label className="block text-blue-800 font-semibold text-lg mb-2">Notes</label>
                <motion.textarea
                  value={activityLog.notes}
                  onChange={(e) => setActivityLog({ ...activityLog, notes: e.target.value })}
                  className="w-full p-4 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-blue-50 text-lg"
                  placeholder="e.g., Spoke to two homeowners"
                  rows={5}
                  aria-label="Enter notes"
                  whileHover={{ scale: 1.02 }}
                  whileFocus={{ scale: 1.02 }}
                />
              </div>
            </div>
          </motion.div>
        </div>
        <motion.button
          onClick={handleActivitySubmit}
          disabled={activityLog.submitting}
          className="fixed bottom-8 right-8 flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all shadow-2xl disabled:opacity-50 lg:w-20 lg:h-20"
          whileHover={{ scale: 1.1, boxShadow: '0 8px 24px rgba(0, 91, 234, 0.3)' }}
          whileTap={{ scale: 0.95 }}
          title="Log activity"
        >
          {activityLog.submitting ? (
            <svg
              className="w-6 h-6 animate-spin"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 12a8 8 0 1116 0 8 8 0 01-16 0zm8-8v2m0 12v2m8-8h-2m-12 0H2m15.364 5.364l-1.414-1.414M5.05 5.05l1.414 1.414m12.728 0l-1.414 1.414M5.05 18.95l1.414-1.414"
              />
            </svg>
          ) : (
            <Send className="w-6 h-6 lg:w-8 lg:h-8" />
          )}
          {success && (
            <motion.div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <CheckCircle className="w-12 h-12 text-green-500" />
            </motion.div>
          )}
        </motion.button>
      </div>
    </ErrorBoundary>
  );
}
