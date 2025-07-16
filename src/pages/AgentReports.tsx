import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Target, Phone, Home, DollarSign, Download, CheckCircle, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Agent {
  id: string;
  name: string;
  email?: string;
}

interface MarketingPlan {
  id: string;
  agent: string;
  suburb: string;
  start_date: string;
  end_date: string;
  door_knock_streets: {
    id: string;
    name: string;
    why: string;
    house_count: string;
    target_knocks: string;
    target_connects: string;
    desktop_appraisals: string;
    face_to_face_appraisals: string;
  }[];
  phone_call_streets: {
    id: string;
    name: string;
    why: string;
    target_calls: string;
    target_connects: string;
    desktop_appraisals: string;
    face_to_face_appraisals: string;
  }[];
}

interface Activity {
  id: string;
  agent_id: string;
  activity_type: 'door_knock' | 'phone_call';
  activity_date: string;
  street_name: string;
  suburb: string;
  notes: string;
  status: 'Completed' | 'pending' | 'cancelled';
  calls_connected?: number;
  calls_answered?: number;
  knocks_made?: number;
  knocks_answered?: number;
  desktop_appraisals?: number;
  face_to_face_appraisals?: number;
}

interface Property {
  id: string;
  agent_id: string;
  street_number: string;
  street_name: string;
  suburb: string;
  price: number;
  sold_price?: number;
  category: string;
  property_type: string;
  agent_name: string;
  listed_date: string;
  sold_date?: string;
  commission?: number;
}

interface ProgressMetrics {
  agentName: string;
  totalActivities: number;
  completedActivities: number;
  totalCalls: number;
  connectedCalls: number;
  totalKnocks: number;
  answeredKnocks: number;
  totalAppraisals: number;
  totalListings: number;
  totalSales: number;
  totalCommission: number;
  conversionRate: number;
  doorKnockProgress: number;
  phoneCallProgress: number;
  appraisalProgress: number;
}

export function AgentReports() {
  const { user } = useAuthStore();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [marketingPlans, setMarketingPlans] = useState<MarketingPlan[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [progressMetrics, setProgressMetrics] = useState<ProgressMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchAllData();
    } else {
      setError('No user logged in. Check authentication in useAuthStore.');
      setLoading(false);
    }
  }, [user?.id, selectedPeriod, selectedAgentId]);

  const fetchAllData = async () => {
    if (!user?.id) {
      setError('User ID is missing. Verify useAuthStore setup.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Reset states
      setMarketingPlans([]);
      setActivities([]);
      setProperties([]);
      setProgressMetrics(null);

      await fetchAgents();
      if (selectedAgentId) {
        await Promise.all([
          fetchMarketingPlans(),
          fetchActivities(),
          fetchProperties(),
        ]);
        calculateProgressMetrics();
      }
    } catch (error: any) {
      setError(`Failed to load report data: ${error.message || 'Unknown error'}`);
      toast.error(`Failed to load report data: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('role', 'agent');
      if (error) throw new Error(`Failed to fetch agents: ${error.message}`);
      if (!data || data.length === 0) {
        setError('No agents found. Check profiles table.');
        setAgents([]);
        setSelectedAgentId(null);
        return;
      }
      setAgents(data);
      const userAgent = data.find(agent => agent.email === user?.email) || data[0];
      setSelectedAgentId(userAgent.id);
    } catch (err: any) {
      setError(`Failed to fetch agents: ${err.message}`);
      toast.error(`Failed to fetch agents: ${err.message}`);
      setAgents([]);
      setSelectedAgentId(null);
    }
  };

  const fetchMarketingPlans = async () => {
    if (!selectedAgentId) {
      setMarketingPlans([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('marketing_plans')
        .select('*')
        .eq('agent', selectedAgentId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to fetch marketing plans: ${error.message}`);
      const plans: MarketingPlan[] = data?.map(plan => ({
        ...plan,
        door_knock_streets: (plan.door_knock_streets || []).map((s: any) => ({
          ...s,
          id: s.id || crypto.randomUUID(),
          target_knocks: s.target_knocks || '0',
          target_connects: s.target_connects || '0',
          desktop_appraisals: s.desktop_appraisals || '0',
          face_to_face_appraisals: s.face_to_face_appraisals || '0',
        })),
        phone_call_streets: (plan.phone_call_streets || []).map((s: any) => ({
          ...s,
          id: s.id || crypto.randomUUID(),
          target_calls: s.target_calls || '0',
          target_connects: s.target_connects || '0',
          desktop_appraisals: s.desktop_appraisals || '0',
          face_to_face_appraisals: s.face_to_face_appraisals || '0',
        })),
      })) || [];
      setMarketingPlans(plans);
    } catch (err: any) {
      setError(`Failed to fetch marketing plans: ${err.message}`);
      toast.error(`Failed to fetch marketing plans: ${err.message}`);
      setMarketingPlans([]);
    }
  };

  const fetchActivities = async () => {
    if (!selectedAgentId) {
      setActivities([]);
      return;
    }
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(selectedPeriod));
      const { data, error } = await supabase
        .from('agent_activities')
        .select('id, agent_id, activity_type, activity_date, street_name, suburb, notes, status, calls_connected, calls_answered, knocks_made, knocks_answered, desktop_appraisals, face_to_face_appraisals')
        .eq('agent_id', selectedAgentId)
        .gte('activity_date', startDate.toISOString())
        .order('activity_date', { ascending: false });
      if (error) {
        if (error.code === '42883') {
          throw new Error('Type mismatch: Ensure agent_id is uuid in agent_activities');
        } else if (error.code === '42501') {
          throw new Error('Permission denied: Check RLS policy for agent_activities');
        }
        throw new Error(`Failed to fetch activities: ${error.message}`);
      }
      setActivities(data || []);
    } catch (err: any) {
      setError(`Failed to fetch activities: ${err.message}`);
      toast.error(`Failed to fetch activities: ${err.message}`);
      setActivities([]);
    }
  };

  const fetchProperties = async () => {
    if (!selectedAgentId) {
      setProperties([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('agent_id', selectedAgentId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Failed to fetch properties: ${error.message}`);
      setProperties(data || []);
    } catch (err: any) {
      setError(`Failed to fetch properties: ${err.message}`);
      toast.error(`Failed to fetch properties: ${err.message}`);
      setProperties([]);
    }
  };

  const calculateProgressMetrics = () => {
    if (!selectedAgentId || !agents.length) {
      setProgressMetrics(null);
      return;
    }
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) {
      setProgressMetrics(null);
      return;
    }

    const agentPlans = marketingPlans.filter(p => p.agent === selectedAgentId);
    const agentActivities = activities.filter(a => a.agent_id === selectedAgentId);

    // Initialize metrics
    let totalActivities = agentActivities.length;
    let completedActivities = agentActivities.filter(a => a.status === 'Completed').length;
    let totalCalls = 0;
    let connectedCalls = 0;
    let totalKnocks = 0;
    let answeredKnocks = 0;
    let totalAppraisals = 0;

    // Aggregate activity metrics
    agentActivities.forEach(a => {
      totalCalls += Number(a.calls_connected || 0);
      connectedCalls += Number(a.calls_answered || 0);
      totalKnocks += Number(a.knocks_made || 0);
      answeredKnocks += Number(a.knocks_answered || 0);
      totalAppraisals += Number(a.desktop_appraisals || 0) + Number(a.face_to_face_appraisals || 0);
    });

    // Property metrics
    const totalListings = properties.filter(p => p.agent_id === selectedAgentId && p.category === 'Listing').length;
    const totalSales = properties.filter(p => p.agent_id === selectedAgentId && p.category === 'Sold').length;
    const totalCommission = properties
      .filter(p => p.agent_id === selectedAgentId)
      .reduce((sum, p) => sum + Number(p.commission || 0), 0);
    const conversionRate = totalAppraisals > 0 ? (totalListings / totalAppraisals) * 100 : 0;

    // Calculate targets from marketing plans
    let totalTargetKnocks = 0;
    let totalTargetCalls = 0;
    let totalTargetAppraisals = 0;

    agentPlans.forEach(plan => {
      if (plan.door_knock_streets?.length) {
        plan.door_knock_streets.forEach(street => {
          totalTargetKnocks += Number(street.target_knocks || 0);
          totalTargetAppraisals += Number(street.desktop_appraisals || 0) + Number(street.face_to_face_appraisals || 0);
        });
      }
      if (plan.phone_call_streets?.length) {
        plan.phone_call_streets.forEach(street => {
          totalTargetCalls += Number(street.target_calls || 0);
          totalTargetAppraisals += Number(street.desktop_appraisals || 0) + Number(street.face_to_face_appraisals || 0);
        });
      }
    });

    // Calculate progress percentages
    const doorKnockProgress = totalTargetKnocks > 0 ? (totalKnocks / totalTargetKnocks) * 100 : 0;
    const phoneCallProgress = totalTargetCalls > 0 ? (totalCalls / totalTargetCalls) * 100 : 0;
    const appraisalProgress = totalTargetAppraisals > 0 ? (totalAppraisals / totalTargetAppraisals) * 100 : 0;

    const metrics: ProgressMetrics = {
      agentName: agent.name || 'Unknown Agent',
      totalActivities,
      completedActivities,
      totalCalls,
      connectedCalls,
      totalKnocks,
      answeredKnocks,
      totalAppraisals,
      totalListings,
      totalSales,
      totalCommission,
      conversionRate,
      doorKnockProgress,
      phoneCallProgress,
      appraisalProgress,
    };

    setProgressMetrics(metrics);
  };

  const generateReport = async () => {
    toast.success('Report generation not implemented yet');
  };

  const barChartData = [
    { name: 'Calls Connected', value: progressMetrics?.totalCalls || 0, target: marketingPlans.reduce((sum, plan) => sum + (plan.phone_call_streets || []).reduce((s, street) => s + Number(street.target_calls || 0), 0), 0) },
    { name: 'Knocks Made', value: progressMetrics?.totalKnocks || 0, target: marketingPlans.reduce((sum, plan) => sum + (plan.door_knock_streets || []).reduce((s, street) => s + Number(street.target_knocks || 0), 0), 0) },
    { name: 'Appraisals', value: progressMetrics?.totalAppraisals || 0, target: marketingPlans.reduce((sum, plan) => sum + (plan.door_knock_streets || []).reduce((s, street) => s + Number(street.desktop_appraisals || 0) + Number(street.face_to_face_appraisals || 0), 0) + (plan.phone_call_streets || []).reduce((s, street) => s + Number(street.desktop_appraisals || 0) + Number(street.face_to_face_appraisals || 0), 0), 0) }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            <strong className="font-bold">Error: </strong>
            <span>{error}</span>
            {error.includes('42883') && (
              <p className="mt-2 text-sm">
                Type mismatch error. Run: ALTER TABLE agent_activities ALTER COLUMN agent_id TYPE uuid USING (agent_id::uuid);
              </p>
            )}
            {error.includes('42501') && (
              <p className="mt-2 text-sm">
                Permission denied. Verify RLS policy: SELECT * FROM pg_policies WHERE tablename = 'agent_activities';
              </p>
            )}
          </div>
          <div className="mt-4 flex gap-4">
            <button
              onClick={fetchAllData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedAgentId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
            <h1 className="text-3xl font-bold text-blue-900 flex items-center">
              <BarChart3 className="w-8 h-8 mr-3 text-blue-600" />
              Agent Performance Report
            </h1>
            <p className="text-gray-700 font-medium mt-4">
              No agent selected. Please select an agent to view their performance report.
            </p>
            <div className="mt-4 flex gap-4">
              <select
                value={selectedAgentId || ''}
                onChange={(e) => setSelectedAgentId(e.target.value || null)}
                className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                aria-label="Select agent"
              >
                <option value="">Select an Agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-blue-900 flex items-center">
                <BarChart3 className="w-8 h-8 mr-3 text-blue-600" />
                {agents.find(a => a.id === selectedAgentId)?.name || 'Agent'} Performance Report
              </h1>
              <p className="text-blue-600 mt-2">
                Overview for {progressMetrics?.agentName || 'selected agent'}
              </p>
            </div>
            <div className="flex space-x-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                aria-label="Select time period"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 3 months</option>
                <option value="365">Last year</option>
              </select>
              <select
                value={selectedAgentId || ''}
                onChange={(e) => setSelectedAgentId(e.target.value || null)}
                className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                aria-label="Select agent"
              >
                <option value="">Select an Agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <button
                onClick={generateReport}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                aria-label="Export report as PDF"
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </button>
            </div>
          </div>
        </motion.div>

        <div className="mb-8">
          <div className="border-b border-blue-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'marketing', label: 'Marketing Plans', icon: Target },
                { id: 'activities', label: 'Activities', icon: Activity },
                { id: 'performance', label: 'Performance', icon: Target },
                { id: 'properties', label: 'Properties', icon: Home }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {!progressMetrics || (!marketingPlans.length && !activities.length) ? (
                <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                  <p className="text-gray-500 text-center py-8">
                    No data for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => window.location.href = '/marketing-plan'}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Create Marketing Plan
                    </button>
                    <button
                      onClick={() => window.location.href = '/activity-logger'}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700"
                    >
                      Log Activity
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Activities', value: progressMetrics.totalActivities, icon: Activity, color: 'bg-blue-500' },
                    { label: 'Completion Rate', value: `${Math.round((progressMetrics.completedActivities / (progressMetrics.totalActivities || 1)) * 100)}%`, icon: CheckCircle, color: 'bg-green-500' },
                    { label: 'Total Commission', value: `$${progressMetrics.totalCommission.toLocaleString()}`, icon: DollarSign, color: 'bg-purple-500' },
                    { label: 'Conversion Rate', value: `${progressMetrics.conversionRate.toFixed(1)}%`, icon: Target, color: 'bg-orange-500' }
                  ].map((metric, index) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white rounded-lg p-6 shadow-sm border border-blue-100"
                    >
                      <div className="flex items-center">
                        <div className={`${metric.color} p-3 rounded-lg`}>
                          <metric.icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">{metric.label}</p>
                          <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'marketing' && (
            <motion.div
              key="marketing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-blue-600" />
                  Marketing Plans for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}
                </h3>
                {marketingPlans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      No marketing plans for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}.
                    </p>
                    <button
                      onClick={() => window.location.href = '/marketing-plan'}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700"
                    >
                      Create Marketing Plan
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {marketingPlans.map((plan) => (
                      <div key={plan.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-gray-900">{plan.suburb}</h4>
                            <p className="text-sm text-gray-600">
                              {new Date(plan.start_date).toLocaleDateString()} -{' '}
                              {new Date(plan.end_date).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            Active
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Door Knock Streets</p>
                            <p className="font-medium">{plan.door_knock_streets?.length || 0} streets</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Phone Call Streets</p>
                            <p className="font-medium">{plan.phone_call_streets?.length || 0} streets</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Target Appraisals</p>
                            <p className="font-medium">
                              {(plan.door_knock_streets.reduce(
                                (sum, s) => sum + Number(s.desktop_appraisals || 0) + Number(s.face_to_face_appraisals || 0),
                                0
                              ) +
                                plan.phone_call_streets.reduce(
                                  (sum, s) => sum + Number(s.desktop_appraisals || 0) + Number(s.face_to_face_appraisals || 0),
                                  0
                                ))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'activities' && (
            <motion.div
              key="activities"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-blue-600" />
                  Activities for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}
                </h3>
                {activities.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      No activities for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}.
                    </p>
                    <button
                      onClick={() => window.location.href = '/activity-logger'}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700"
                    >
                      Log Activity
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${activity.activity_type === 'door_knock' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {activity.activity_type.replace('_', ' ').toUpperCase()}
                            </p>
                            <p className="text-sm text-gray-600">
                              {activity.street_name}, {activity.suburb}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            {new Date(activity.activity_date).toLocaleDateString()}
                          </p>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            activity.status === 'Completed' ? 'bg-green-100 text-green-800' :
                            activity.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {activity.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'performance' && (
            <motion.div
              key="performance"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {!progressMetrics || (!marketingPlans.length && !activities.length) ? (
                <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                  <p className="text-gray-500 text-center py-8">
                    No performance data for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}.
                  </p>
                  <button
                    onClick={() => window.location.href = '/activity-logger'}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700"
                  >
                    Log Activity
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <Phone className="w-4 h-4 mr-2 text-green-600" />
                        Phone Call Performance
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Calls Connected:</span>
                          <span className="font-medium">{progressMetrics.totalCalls}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Calls Answered:</span>
                          <span className="font-medium">{progressMetrics.connectedCalls}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Progress:</span>
                          <span className="font-medium">{progressMetrics.phoneCallProgress.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <Home className="w-4 h-4 mr-2 text-blue-600" />
                        Door Knock Performance
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Knocks Made:</span>
                          <span className="font-medium">{progressMetrics.totalKnocks}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Knocks Answered:</span>
                          <span className="font-medium">{progressMetrics.answeredKnocks}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Progress:</span>
                          <span className="font-medium">{progressMetrics.doorKnockProgress.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <Target className="w-4 h-4 mr-2 text-purple-600" />
                        Appraisal Performance
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Appraisals:</span>
                          <span className="font-medium">{progressMetrics.totalAppraisals}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Progress:</span>
                          <span className="font-medium">{progressMetrics.appraisalProgress.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Performance for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}
                    </h3>
                    {barChartData.every(item => item.value === 0 && item.target === 0) ? (
                      <p className="text-gray-500 text-center py-8">
                        No performance data for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}
                      </p>
                    ) : (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#3B82F6" name="Actual" />
                            <Bar dataKey="target" fill="#93C5FD" name="Target" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'properties' && (
            <motion.div
              key="properties"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Home className="w-5 h-5 mr-2 text-blue-600" />
                  Properties for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}
                </h3>
                {properties.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No properties for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Property
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Commission
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {properties.map((property) => (
                          <tr key={property.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {property.street_number} {property.street_name}
                                </div>
                                <div className="text-sm text-gray-500">{property.suburb}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {property.property_type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ${property.price?.toLocaleString() || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                property.category === 'Sold' ? 'bg-green-100 text-green-800' :
                                property.category === 'Listing' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {property.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ${property.commission?.toLocaleString() || '0'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AgentReports;