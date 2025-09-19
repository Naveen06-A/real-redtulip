import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { Loader2, Trash2, Edit, Download, FileText, BarChart, X, ArrowLeft, Plus, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { generatePdf } from '../utils/pdfUtils';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement);

interface Activity {
  id: string;
  activity_type: 'door_knock' | 'phone_call';
  activity_date: string;
  street_name: string;
  suburb: string;
  knocks_made?: number;
  knocks_answered?: number;
  calls_made?: number;
  calls_answered?: number;
  desktop_appraisals?: number;
  face_to_face_appraisals?: number;
  notes: string;
}

interface StreetProgress {
  name: string;
  completedKnocks?: number;
  targetKnocks?: number;
  completedCalls?: number;
  targetCalls?: number;
  completedConnects?: number;
  targetConnects?: number;
  desktopAppraisals: number;
  faceToFaceAppraisals: number;
}

interface MarketingPlan {
  id: string;
  suburb: string;
  start_date: string;
  end_date: string;
  door_knock_streets: Array<{
    id: string;
    name: string;
    why: string;
    target_knocks: string;
  }>;
  phone_call_streets: Array<{
    id: string;
    name: string;
    why: string;
    target_calls: string;
    target_connects: string;
  }>;
  target_connects: string;
  desktop_appraisals: string;
  face_to_face_appraisals: string;
}

interface ProgressData {
  doorKnocks: {
    completed: number;
    target: number;
    streets: StreetProgress[];
  };
  phoneCalls: {
    completed: number;
    target: number;
    streets: StreetProgress[];
  };
  connects: {
    completed: number;
    target: number;
  };
  desktopAppraisals: {
    completed: number;
    target: number;
  };
  faceToFaceAppraisals: {
    completed: number;
    target: number;
  };
}

export function ProgressReportPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [marketingPlans, setMarketingPlans] = useState<MarketingPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<MarketingPlan | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [progressData, setProgressData] = useState<ProgressData>({
    doorKnocks: { completed: 0, target: 0, streets: [] },
    phoneCalls: { completed: 0, target: 0, streets: [] },
    connects: { completed: 0, target: 0 },
    desktopAppraisals: { completed: 0, target: 0 },
    faceToFaceAppraisals: { completed: 0, target: 0 }
  });
  const [viewMode, setViewMode] = useState<'suburb' | 'overall'>('suburb');
  const [notification, setNotification] = useState<string | null>(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Utility functions
  const calculatePercentage = (completed: number, target: number): number => {
    if (target === 0) return 0;
    return Math.min(Math.round((completed / target) * 100), 100);
  };

  const formatDate = (dateString: string): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Delete marketing plan
  const handleDeletePlan = useCallback(async () => {
    if (!selectedPlan) return;

    try {
      const { error } = await supabase
        .from('marketing_plans')
        .delete()
        .eq('id', selectedPlan.id);

      if (error) throw error;

      setMarketingPlans(prev => prev.filter(plan => plan.id !== selectedPlan.id));
      setSelectedPlan(marketingPlans[0] || null);
      setShowDeleteConfirm(false);
      setNotification('Marketing plan deleted successfully');
      toast.success('Marketing plan deleted successfully');
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Error deleting marketing plan:', err);
      toast.error('Failed to delete marketing plan');
    }
  }, [selectedPlan, marketingPlans]);

  // Data fetching
  const loadMarketingPlans = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      let query = supabase
        .from('marketing_plans')
        .select('id, suburb, start_date, end_date, door_knock_streets, phone_call_streets, target_connects, desktop_appraisals, face_to_face_appraisals')
        .order('created_at', { ascending: false });

      if (profile?.role === 'agent') {
        query = query.eq('agent', user.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error in loadMarketingPlans:', error);
        throw error;
      }

      console.log('Raw marketing plans data:', data); // Debug raw data

      const plans = data.map(plan => ({
        ...plan,
        suburb: plan.suburb || 'Unspecified',
        door_knock_streets: plan.door_knock_streets || [],
        phone_call_streets: plan.phone_call_streets || [],
        target_connects: String(plan.target_connects ?? '0'),
        desktop_appraisals: String(plan.desktop_appraisals ?? '0'),
        face_to_face_appraisals: String(plan.face_to_face_appraisals ?? '0'),
      }));

      console.log('Processed marketing plans:', plans); // Debug processed plans
      setMarketingPlans(plans);
      if (plans.length > 0 && !selectedPlan) {
        setSelectedPlan(plans[0]);
      }
    } catch (err) {
      console.error('Error loading marketing plans:', err);
      toast.error('Failed to load marketing plans');
    }
  }, [user, profile, selectedPlan]);

  const loadActivities = useCallback(async () => {
    if (!user?.id) return;

    try {
      let query = supabase
        .from('agent_activities')
        .select('id, activity_type, activity_date, street_name, suburb, knocks_made, knocks_answered, calls_made, calls_answered, desktop_appraisals, face_to_face_appraisals, notes')
        .eq('agent_id', user.id);

      if (startDate && endDate) {
        query = query
          .gte('activity_date', startDate.toISOString())
          .lte('activity_date', endDate.toISOString());
      } else if (selectedPlan?.start_date && selectedPlan?.end_date) {
        query = query
          .gte('activity_date', selectedPlan.start_date)
          .lte('activity_date', selectedPlan.end_date);
      }

      if (viewMode === 'suburb' && selectedPlan?.suburb) {
        query = query.eq('suburb', selectedPlan.suburb);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error in loadActivities:', error);
        throw error;
      }

      console.log('Loaded activities:', data); // Debug activities
      setActivities(data || []);
    } catch (err) {
      console.error('Error loading activities:', err);
      toast.error('Failed to load activities');
    }
  }, [user, selectedPlan, startDate, endDate, viewMode]);

  // Calculate progress data
  const calculateProgress = useCallback(() => {
    if (!selectedPlan) return;

    // Initialize street progress
    const doorKnockStreets: StreetProgress[] = selectedPlan.door_knock_streets.map(street => ({
      name: street.name,
      targetKnocks: parseInt(street.target_knocks || '0'),
      completedKnocks: 0,
      completedConnects: 0,
      targetConnects: 0,
      desktopAppraisals: 0,
      faceToFaceAppraisals: 0
    }));

    const phoneCallStreets: StreetProgress[] = selectedPlan.phone_call_streets.map(street => ({
      name: street.name,
      targetCalls: parseInt(street.target_calls || '0'),
      targetConnects: parseInt(street.target_connects || '0'),
      completedCalls: 0,
      completedConnects: 0,
      desktopAppraisals: 0,
      faceToFaceAppraisals: 0
    }));

    // Aggregate activity data
    let totalConnects = 0;
    let totalDesktopAppraisals = 0;
    let totalFaceToFaceAppraisals = 0;

    activities.forEach(activity => {
      if (activity.activity_type === 'door_knock') {
        const street = doorKnockStreets.find(s => s.name === activity.street_name);
        if (street) {
          street.completedKnocks = (street.completedKnocks || 0) + (activity.knocks_made || 0);
          street.completedConnects = (street.completedConnects || 0) + (activity.knocks_answered || 0);
          street.desktopAppraisals += activity.desktop_appraisals || 0;
          street.faceToFaceAppraisals += activity.face_to_face_appraisals || 0;
        }
        totalConnects += activity.knocks_answered || 0;
      } else if (activity.activity_type === 'phone_call') {
        const street = phoneCallStreets.find(s => s.name === activity.street_name);
        if (street) {
          street.completedCalls = (street.completedCalls || 0) + (activity.calls_made || 0);
          street.completedConnects = (street.completedConnects || 0) + (activity.calls_answered || 0);
          street.desktopAppraisals += activity.desktop_appraisals || 0;
          street.faceToFaceAppraisals += activity.face_to_face_appraisals || 0;
        }
        totalConnects += activity.calls_answered || 0;
      }

      totalDesktopAppraisals += activity.desktop_appraisals || 0;
      totalFaceToFaceAppraisals += activity.face_to_face_appraisals || 0;
    });

    // Calculate totals
    const totalDoorKnocks = doorKnockStreets.reduce((sum, street) => sum + (street.completedKnocks || 0), 0);
    const targetDoorKnocks = doorKnockStreets.reduce((sum, street) => sum + (street.targetKnocks || 0), 0);
    
    const totalPhoneCalls = phoneCallStreets.reduce((sum, street) => sum + (street.completedCalls || 0), 0);
    const targetPhoneCalls = phoneCallStreets.reduce((sum, street) => sum + (street.targetCalls || 0), 0);

    const targetConnects = selectedPlan.phone_call_streets.reduce(
      (sum, street) => sum + parseInt(street.target_connects || '0'),
      0
    );

    const newProgressData = {
      doorKnocks: {
        completed: totalDoorKnocks,
        target: targetDoorKnocks,
        streets: doorKnockStreets
      },
      phoneCalls: {
        completed: totalPhoneCalls,
        target: targetPhoneCalls,
        streets: phoneCallStreets
      },
      connects: {
        completed: totalConnects,
        target: targetConnects
      },
      desktopAppraisals: {
        completed: totalDesktopAppraisals,
        target: parseInt(selectedPlan.desktop_appraisals || '0')
      },
      faceToFaceAppraisals: {
        completed: totalFaceToFaceAppraisals,
        target: parseInt(selectedPlan.face_to_face_appraisals || '0')
      }
    };

    console.log('Calculated progress data:', newProgressData); // Debug progress data
    setProgressData(newProgressData);
  }, [selectedPlan, activities]);

  // Effects
  useEffect(() => {
    if (!user || !profile) {
      navigate('/login');
      return;
    }

    const initialize = async () => {
      await loadMarketingPlans();
      await loadActivities();
      setLoading(false);
    };

    initialize();

    // Set up real-time subscriptions
    const activitySubscription = supabase
      .channel('agent_activities_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_activities', filter: `agent_id=eq.${user.id}` },
        () => {
          loadActivities();
          setNotification('Activities updated in real-time');
          setTimeout(() => setNotification(null), 3000);
        }
      )
      .subscribe();

    const planSubscription = supabase
      .channel('marketing_plans_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_plans', filter: profile?.role === 'agent' ? `agent=eq.${user.id}` : undefined },
        () => {
          loadMarketingPlans();
          setNotification('Marketing plans updated in real-time');
          setTimeout(() => setNotification(null), 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activitySubscription);
      supabase.removeChannel(planSubscription);
    };
  }, [user, profile, navigate, loadMarketingPlans, loadActivities]);

  useEffect(() => {
    if (selectedPlan) {
      loadActivities();
    }
  }, [selectedPlan, startDate, endDate, viewMode, loadActivities]);

  useEffect(() => {
    calculateProgress();
  }, [calculateProgress]);

  // Chart data
  const progressChartData = useMemo(() => ({
    labels: ['Door Knocks', 'Phone Calls', 'Connects', 'Desktop Appraisals', 'F2F Appraisals'],
    datasets: [
      {
        label: 'Target',
        data: [
          progressData.doorKnocks.target,
          progressData.phoneCalls.target,
          progressData.connects.target,
          progressData.desktopAppraisals.target,
          progressData.faceToFaceAppraisals.target,
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Completed',
        data: [
          progressData.doorKnocks.completed,
          progressData.phoneCalls.completed,
          progressData.connects.completed,
          progressData.desktopAppraisals.completed,
          progressData.faceToFaceAppraisals.completed,
        ],
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
    ],
  }), [progressData]);

  const streetProgressData = useMemo(() => {
    const streetNames = [
      ...new Set([
        ...progressData.doorKnocks.streets.map(s => s.name),
        ...progressData.phoneCalls.streets.map(s => s.name),
      ]),
    ];

    return {
      labels: streetNames,
      datasets: [
        {
          label: 'Door Knocks Completed',
          data: streetNames.map(name => {
            const street = progressData.doorKnocks.streets.find(s => s.name === name);
            return street?.completedKnocks || 0;
          }),
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
        },
        {
          label: 'Phone Calls Completed',
          data: streetNames.map(name => {
            const street = progressData.phoneCalls.streets.find(s => s.name === name);
            return street?.completedCalls || 0;
          }),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
        },
      ],
    };
  }, [progressData]);

  // PDF Generation
  const generatePDF = useCallback(async (download = false) => {
    if (!selectedPlan) return;

    try {
      const head = [
        ['Metric', 'Target', 'Completed', 'Progress'],
      ];

      const body = [
        ['Door Knocks', progressData.doorKnocks.target, progressData.doorKnocks.completed, `${calculatePercentage(progressData.doorKnocks.completed, progressData.doorKnocks.target)}%`],
        ['Phone Calls', progressData.phoneCalls.target, progressData.phoneCalls.completed, `${calculatePercentage(progressData.phoneCalls.completed, progressData.phoneCalls.target)}%`],
        ['Connects', progressData.connects.target, progressData.connects.completed, `${calculatePercentage(progressData.connects.completed, progressData.connects.target)}%`],
        ['Desktop Appraisals', progressData.desktopAppraisals.target, progressData.desktopAppraisals.completed, `${calculatePercentage(progressData.desktopAppraisals.completed, progressData.desktopAppraisals.target)}%`],
        ['Face-to-Face Appraisals', progressData.faceToFaceAppraisals.target, progressData.faceToFaceAppraisals.completed, `${calculatePercentage(progressData.faceToFaceAppraisals.completed, progressData.faceToFaceAppraisals.target)}%`],
      ];

      const fileName = `Progress_Report_${selectedPlan.suburb}_${new Date().toISOString().split('T')[0]}.pdf`;

      if (download) {
        await generatePdf(`Progress Report - ${selectedPlan.suburb}`, head, body, fileName, 'save');
        setNotification('PDF downloaded successfully');
      } else {
        const blob = await generatePdf(`Progress Report - ${selectedPlan.suburb}`, head, body, fileName, 'blob') as Blob;
        if (blob instanceof Blob) {
          setPdfPreviewUrl(URL.createObjectURL(blob));
          setShowPDFPreview(true);
        }
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Failed to generate PDF');
    }
  }, [selectedPlan, progressData]);

  // UI Components
  const RadialProgress = ({ percentage, color, label, completed, target }: {
    percentage: number;
    color: string;
    label: string;
    completed: number;
    target: number;
  }) => (
    <div className="flex flex-col items-center p-4 bg-white rounded-lg shadow">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${percentage * 2.51} 251`}
            strokeDashoffset="0"
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{percentage}%</span>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium text-center">{label}</p>
      <p className="text-xs text-gray-500">{completed}/{target}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!marketingPlans.length) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">No Marketing Plans Found</h1>
          <p className="mb-6">You need to create a marketing plan first to track progress.</p>
          <button
            onClick={() => navigate('/marketing-plan')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Marketing Plan
          </button>
        </div>
      </div>
    );
  }

  const dashboardPath = profile?.role === 'admin' ? '/admin-dashboard' : '/agent-dashboard';

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Progress Report</h1>
          {selectedPlan && (
            <p className="text-gray-600">
              {selectedPlan.suburb} • {formatDate(selectedPlan.start_date)} - {formatDate(selectedPlan.end_date)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50"
            >
              <Filter size={16} />
              <span>Filter Dates</span>
            </button>
            
            {showDateFilter && (
              <div className="absolute z-10 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
                <DatePicker
                  selectsRange
                  startDate={startDate}
                  endDate={endDate}
                  onChange={update => setDateRange(update)}
                  isClearable
                  inline
                />
                <div className="flex justify-end mt-2 gap-2">
                  <button
                    onClick={() => {
                      setDateRange([null, null]);
                      setShowDateFilter(false);
                    }}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowDateFilter(false)}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setViewMode(viewMode === 'suburb' ? 'overall' : 'suburb')}
            className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50"
          >
            <BarChart size={16} />
            <span>{viewMode === 'suburb' ? 'Overall View' : 'Suburb View'}</span>
          </button>

          <button
            onClick={() => generatePDF(false)}
            className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-2 hover:bg-blue-700"
          >
            <FileText size={16} />
            <span>Preview PDF</span>
          </button>
          <button
            onClick={() => generatePDF(true)}
            className="flex items-center gap-2 bg-green-600 text-white rounded-lg px-3 py-2 hover:bg-green-700"
          >
            <Download size={16} />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Plan Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Select Marketing Plan</label>
        <div className="flex gap-2">
          <select
            value={selectedPlan?.id || ''}
            onChange={e => {
              const plan = marketingPlans.find(p => p.id === e.target.value);
              if (plan) setSelectedPlan(plan);
            }}
            className="flex-1 border border-gray-300 rounded-lg p-2"
          >
            {marketingPlans.map(plan => (
              <option key={plan.id} value={plan.id}>
                {plan.suburb} ({formatDate(plan.start_date)} - {formatDate(plan.end_date)})
              </option>
            ))}
          </select>
          <button
            onClick={() => navigate('/marketing-plan', { state: { plan: selectedPlan } })}
            className="bg-gray-200 hover:bg-gray-300 p-2 rounded-lg"
            title="Edit Plan"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="bg-red-600 hover:bg-red-700 p-2 rounded-lg text-white"
            title="Delete Plan"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
            >
              <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
              <p className="mb-6">
                Are you sure you want to delete the marketing plan for {selectedPlan?.suburb}? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeletePlan}
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <RadialProgress
          percentage={calculatePercentage(progressData.doorKnocks.completed, progressData.doorKnocks.target)}
          color="#3B82F6"
          label="Door Knocks"
          completed={progressData.doorKnocks.completed}
          target={progressData.doorKnocks.target}
        />
        <RadialProgress
          percentage={calculatePercentage(progressData.phoneCalls.completed, progressData.phoneCalls.target)}
          color="#10B981"
          label="Phone Calls"
          completed={progressData.phoneCalls.completed}
          target={progressData.phoneCalls.target}
        />
        <RadialProgress
          percentage={calculatePercentage(progressData.connects.completed, progressData.connects.target)}
          color="#8B5CF6"
          label="Connects"
          completed={progressData.connects.completed}
          target={progressData.connects.target}
        />
        <RadialProgress
          percentage={calculatePercentage(progressData.desktopAppraisals.completed, progressData.desktopAppraisals.target)}
          color="#F59E0B"
          label="Desktop Appraisals"
          completed={progressData.desktopAppraisals.completed}
          target={progressData.desktopAppraisals.target}
        />
        <RadialProgress
          percentage={calculatePercentage(progressData.faceToFaceAppraisals.completed, progressData.faceToFaceAppraisals.target)}
          color="#EF4444"
          label="F2F Appraisals"
          completed={progressData.faceToFaceAppraisals.completed}
          target={progressData.faceToFaceAppraisals.target}
        />
      </div>

      {/* Progress Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-4">Target vs Actual Progress</h3>
          <div className="h-64">
            <Bar
              data={progressChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true },
                },
              }}
            />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-4">Street Performance</h3>
          <div className="h-64">
            <Bar
              data={streetProgressData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true },
                  x: { stacked: true },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Door Knocks */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-4">Door Knock Progress</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Street</th>
                  <th className="p-2 text-right">Completed</th>
                  <th className="p-2 text-right">Target</th>
                  <th className="p-2 text-right">Connects</th>
                  <th className="p-2 text-right">Progress</th>
                </tr>
              </thead>
              <tbody>
                {progressData.doorKnocks.streets.map((street, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{street.name}</td>
                    <td className="p-2 text-right">{street.completedKnocks || 0}</td>
                    <td className="p-2 text-right">{street.targetKnocks || 0}</td>
                    <td className="p-2 text-right">{street.completedConnects || 0}</td>
                    <td className="p-2 text-right">
                      {calculatePercentage(street.completedKnocks || 0, street.targetKnocks || 0)}%
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-gray-50">
                  <td className="p-2">Total</td>
                  <td className="p-2 text-right">{progressData.doorKnocks.completed}</td>
                  <td className="p-2 text-right">{progressData.doorKnocks.target}</td>
                  <td className="p-2 text-right">{progressData.connects.completed}</td>
                  <td className="p-2 text-right">
                    {calculatePercentage(
                      progressData.doorKnocks.completed,
                      progressData.doorKnocks.target
                    )}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Phone Calls */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-4">Phone Call Progress</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Street</th>
                  <th className="p-2 text-right">Completed</th>
                  <th className="p-2 text-right">Target</th>
                  <th className="p-2 text-right">Connects Completed</th>
                  <th className="p-2 text-right">Connects Target</th>
                  <th className="p-2 text-right">Progress</th>
                </tr>
              </thead>
              <tbody>
                {progressData.phoneCalls.streets.map((street, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-2">{street.name}</td>
                    <td className="p-2 text-right">{street.completedCalls || 0}</td>
                    <td className="p-2 text-right">{street.targetCalls || 0}</td>
                    <td className="p-2 text-right">{street.completedConnects || 0}</td>
                    <td className="p-2 text-right">{street.targetConnects || 0}</td>
                    <td className="p-2 text-right">
                      {calculatePercentage(street.completedCalls || 0, street.targetCalls || 0)}%
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold bg-gray-50">
                  <td className="p-2">Total</td>
                  <td className="p-2 text-right">{progressData.phoneCalls.completed}</td>
                  <td className="p-2 text-right">{progressData.phoneCalls.target}</td>
                  <td className="p-2 text-right">{progressData.connects.completed}</td>
                  <td className="p-2 text-right">{progressData.connects.target}</td>
                  <td className="p-2 text-right">
                    {calculatePercentage(
                      progressData.phoneCalls.completed,
                      progressData.phoneCalls.target
                    )}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="mt-8 bg-white p-4 rounded-lg shadow">
        <h3 className="font-semibold mb-4">Recent Activities</h3>
        {activities.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Type</th>
                  <th className="p-2 text-left">Street</th>
                  <th className="p-2 text-right">Completed</th>
                  <th className="p-2 text-right">Connects</th>
                  <th className="p-2 text-right">Appraisals</th>
                </tr>
              </thead>
              <tbody>
                {activities.slice(0, 20).map((activity, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-2">{formatDate(activity.activity_date)}</td>
                    <td className="p-2 capitalize">{activity.activity_type.replace('_', ' ')}</td>
                    <td className="p-2">{activity.street_name}</td>
                    <td className="p-2 text-right">
                      {activity.activity_type === 'door_knock' 
                        ? `${activity.knocks_made || 0} knocks`
                        : `${activity.calls_made || 0} calls`}
                    </td>
                    <td className="p-2 text-right">
                      {activity.activity_type === 'door_knock' 
                        ? `${activity.knocks_answered || 0} answered`
                        : `${activity.calls_answered || 0} answered`}
                    </td>
                    <td className="p-2 text-right">
                      {activity.desktop_appraisals || 0} desktop / {activity.face_to_face_appraisals || 0} F2F
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 italic">No activities logged for this period.</p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate('/activity-logger')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={16} />
          <span>Log New Activity</span>
        </button>
        <button
          onClick={() => navigate(dashboardPath)}
          className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* PDF Preview Modal */}
      <AnimatePresence>
        {showPDFPreview && pdfPreviewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">PDF Preview</h3>
                <button
                  onClick={() => setShowPDFPreview(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1">
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              </div>
              <div className="flex justify-end p-4 border-t gap-2">
                <button
                  onClick={() => generatePDF(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setShowPDFPreview(false)}
                  className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-lg"
          >
            <p>{notification}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}