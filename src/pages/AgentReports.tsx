
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Target, Phone, Home, DollarSign, Download, CheckCircle, Activity, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
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

interface StreetProgress {
  streetName: string;
  suburb: string;
  totalActivities: number;
  completedActivities: number;
  totalKnocks: number;
  answeredKnocks: number;
  totalCalls: number;
  connectedCalls: number;
  totalDesktopAppraisals: number;
  totalFaceToFaceAppraisals: number;
  totalAppraisals: number;
  totalListings: number;
  totalSales: number;
  targetKnocks: number;
  targetCalls: number;
  targetAppraisals: number;
  knockProgress: number;
  callProgress: number;
  appraisalProgress: number;
}

interface SuburbProgress {
  suburb: string;
  totalActivities: number;
  completedActivities: number;
  totalKnocks: number;
  answeredKnocks: number;
  totalCalls: number;
  connectedCalls: number;
  totalDesktopAppraisals: number;
  totalFaceToFaceAppraisals: number;
  totalAppraisals: number;
  totalListings: number;
  totalSales: number;
  targetKnocks: number;
  targetCalls: number;
  targetAppraisals: number;
  knockProgress: number;
  callProgress: number;
  appraisalProgress: number;
}

interface ProgressMetrics {
  agentName: string;
  totalActivities: number;
  completedActivities: number;
  totalCalls: number;
  connectedCalls: number;
  totalKnocks: number;
  answeredKnocks: number;
  totalDesktopAppraisals: number;
  totalFaceToFaceAppraisals: number;
  totalAppraisals: number;
  totalListings: number;
  totalSales: number;
  totalCommission: number;
  conversionRate: number;
  doorKnockProgress: number;
  phoneCallProgress: number;
  appraisalProgress: number;
  streetProgress: StreetProgress[];
  suburbProgress: SuburbProgress[];
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
  const [expandedStreets, setExpandedStreets] = useState<string[]>([]);
  const [expandedSuburbs, setExpandedSuburbs] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchAgents().then(() => {
        if (selectedAgentId) {
          fetchAllData();
        }
      });
    } else {
      setError('No user logged in.');
      setLoading(false);
    }
  }, [user?.id, selectedPeriod, selectedAgentId]);

  const fetchAllData = async () => {
    if (!user?.id || !selectedAgentId) {
      setError('User ID or selected agent ID is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setMarketingPlans([]);
    setActivities([]);
    setProperties([]);
    setProgressMetrics(null);

    try {
      await Promise.all([
        fetchMarketingPlans(),
        fetchActivities(),
        fetchProperties(),
      ]);
      calculateProgressMetrics();
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
        setError('No agents found.');
        setAgents([]);
        setSelectedAgentId(null);
        return;
      }
      setAgents(data);
      if (!selectedAgentId) {
        const userAgent = data.find(agent => agent.email === user?.email) || data[0];
        setSelectedAgentId(userAgent.id);
      }
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
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(selectedPeriod));
      const { data, error } = await supabase
        .from('marketing_plans')
        .select('*')
        .eq('agent', selectedAgentId)
        .gte('start_date', startDate.toISOString())
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
    if (error) throw new Error(`Failed to fetch activities: ${error.message}`);
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
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(selectedPeriod));
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('agent_id', selectedAgentId)
        .gte('listed_date', startDate.toISOString())
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
    const agentProperties = properties.filter(p => p.agent_id === selectedAgentId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(selectedPeriod));

    let totalActivities = agentActivities.length;
    let completedActivities = agentActivities.filter(a => a.status === 'Completed').length;
    let totalCalls = 0;
    let connectedCalls = 0;
    let totalKnocks = 0;
    let answeredKnocks = 0;
    let totalDesktopAppraisals = 0;
    let totalFaceToFaceAppraisals = 0;
    let totalAppraisals = 0;

    const streetProgressMap: { [key: string]: StreetProgress } = {};
    const suburbProgressMap: { [key: string]: SuburbProgress } = {};

    agentActivities.forEach(a => {
      if (new Date(a.activity_date) >= startDate) {
        totalCalls += Number(a.calls_connected || 0);
        connectedCalls += Number(a.calls_answered || 0);
        totalKnocks += Number(a.knocks_made || 0);
        answeredKnocks += Number(a.knocks_answered || 0);
        totalDesktopAppraisals += Number(a.desktop_appraisals || 0);
        totalFaceToFaceAppraisals += Number(a.face_to_face_appraisals || 0);

        const streetKey = `${a.street_name}, ${a.suburb}`;
        if (!streetProgressMap[streetKey]) {
          streetProgressMap[streetKey] = {
            streetName: a.street_name,
            suburb: a.suburb,
            totalActivities: 0,
            completedActivities: 0,
            totalKnocks: 0,
            answeredKnocks: 0,
            totalCalls: 0,
            connectedCalls: 0,
            totalDesktopAppraisals: 0,
            totalFaceToFaceAppraisals: 0,
            totalAppraisals: 0,
            totalListings: 0,
            totalSales: 0,
            targetKnocks: 0,
            targetCalls: 0,
            targetAppraisals: 0,
            knockProgress: 0,
            callProgress: 0,
            appraisalProgress: 0,
          };
        }
        streetProgressMap[streetKey].totalActivities += 1;
        streetProgressMap[streetKey].completedActivities += a.status === 'Completed' ? 1 : 0;
        streetProgressMap[streetKey].totalKnocks += Number(a.knocks_made || 0);
        streetProgressMap[streetKey].answeredKnocks += Number(a.knocks_answered || 0);
        streetProgressMap[streetKey].totalCalls += Number(a.calls_connected || 0);
        streetProgressMap[streetKey].connectedCalls += Number(a.calls_answered || 0);
        streetProgressMap[streetKey].totalDesktopAppraisals += Number(a.desktop_appraisals || 0);
        streetProgressMap[streetKey].totalFaceToFaceAppraisals += Number(a.face_to_face_appraisals || 0);
        streetProgressMap[streetKey].totalAppraisals += Number(a.desktop_appraisals || 0) + Number(a.face_to_face_appraisals || 0);

        if (!suburbProgressMap[a.suburb]) {
          suburbProgressMap[a.suburb] = {
            suburb: a.suburb,
            totalActivities: 0,
            completedActivities: 0,
            totalKnocks: 0,
            answeredKnocks: 0,
            totalCalls: 0,
            connectedCalls: 0,
            totalDesktopAppraisals: 0,
            totalFaceToFaceAppraisals: 0,
            totalAppraisals: 0,
            totalListings: 0,
            totalSales: 0,
            targetKnocks: 0,
            targetCalls: 0,
            targetAppraisals: 0,
            knockProgress: 0,
            callProgress: 0,
            appraisalProgress: 0,
          };
        }
        suburbProgressMap[a.suburb].totalActivities += 1;
        suburbProgressMap[a.suburb].completedActivities += a.status === 'Completed' ? 1 : 0;
        suburbProgressMap[a.suburb].totalKnocks += Number(a.knocks_made || 0);
        suburbProgressMap[a.suburb].answeredKnocks += Number(a.knocks_answered || 0);
        suburbProgressMap[a.suburb].totalCalls += Number(a.calls_connected || 0);
        suburbProgressMap[a.suburb].connectedCalls += Number(a.calls_answered || 0);
        suburbProgressMap[a.suburb].totalDesktopAppraisals += Number(a.desktop_appraisals || 0);
        suburbProgressMap[a.suburb].totalFaceToFaceAppraisals += Number(a.face_to_face_appraisals || 0);
        suburbProgressMap[a.suburb].totalAppraisals += Number(a.desktop_appraisals || 0) + Number(a.face_to_face_appraisals || 0);
      }
    });

    totalAppraisals = totalDesktopAppraisals + totalFaceToFaceAppraisals;

    const totalListings = agentProperties.filter(p => p.category === 'Listing' && new Date(p.listed_date) >= startDate).length;
    const totalSales = agentProperties.filter(p => p.category === 'Sold' && new Date(p.sold_date || p.listed_date) >= startDate).length;
    const totalCommission = agentProperties
      .filter(p => new Date(p.listed_date) >= startDate)
      .reduce((sum, p) => sum + Number(p.commission || 0), 0);
    const conversionRate = totalAppraisals > 0 ? (totalListings / totalAppraisals) * 100 : 0;

    agentProperties.forEach(p => {
      if (new Date(p.listed_date) >= startDate) {
        const streetKey = `${p.street_name}, ${p.suburb}`;
        if (streetProgressMap[streetKey]) {
          streetProgressMap[streetKey].totalListings += p.category === 'Listing' ? 1 : 0;
          streetProgressMap[streetKey].totalSales += p.category === 'Sold' ? 1 : 0;
        }
        if (suburbProgressMap[p.suburb]) {
          suburbProgressMap[p.suburb].totalListings += p.category === 'Listing' ? 1 : 0;
          suburbProgressMap[p.suburb].totalSales += p.category === 'Sold' ? 1 : 0;
        }
      }
    });

    let totalTargetKnocks = 0;
    let totalTargetCalls = 0;
    let totalTargetDesktopAppraisals = 0;
    let totalTargetFaceToFaceAppraisals = 0;

    agentPlans.forEach(plan => {
      if (new Date(plan.start_date) >= startDate) {
        if (plan.door_knock_streets?.length) {
          plan.door_knock_streets.forEach(street => {
            const streetKey = `${street.name}, ${plan.suburb}`;
            if (!streetProgressMap[streetKey]) {
              streetProgressMap[streetKey] = {
                streetName: street.name,
                suburb: plan.suburb,
                totalActivities: 0,
                completedActivities: 0,
                totalKnocks: 0,
                answeredKnocks: 0,
                totalCalls: 0,
                connectedCalls: 0,
                totalDesktopAppraisals: 0,
                totalFaceToFaceAppraisals: 0,
                totalAppraisals: 0,
                totalListings: 0,
                totalSales: 0,
                targetKnocks: 0,
                targetCalls: 0,
                targetAppraisals: 0,
                knockProgress: 0,
                callProgress: 0,
                appraisalProgress: 0,
              };
            }
            streetProgressMap[streetKey].targetKnocks += Number(street.target_knocks || 0);
            streetProgressMap[streetKey].targetAppraisals += Number(street.desktop_appraisals || 0) + Number(street.face_to_face_appraisals || 0);
            totalTargetKnocks += Number(street.target_knocks || 0);
            totalTargetDesktopAppraisals += Number(street.desktop_appraisals || 0);
            totalTargetFaceToFaceAppraisals += Number(street.face_to_face_appraisals || 0);
          });
        }
        if (plan.phone_call_streets?.length) {
          plan.phone_call_streets.forEach(street => {
            const streetKey = `${street.name}, ${plan.suburb}`;
            if (!streetProgressMap[streetKey]) {
              streetProgressMap[streetKey] = {
                streetName: street.name,
                suburb: plan.suburb,
                totalActivities: 0,
                completedActivities: 0,
                totalKnocks: 0,
                answeredKnocks: 0,
                totalCalls: 0,
                connectedCalls: 0,
                totalDesktopAppraisals: 0,
                totalFaceToFaceAppraisals: 0,
                totalAppraisals: 0,
                totalListings: 0,
                totalSales: 0,
                targetKnocks: 0,
                targetCalls: 0,
                targetAppraisals: 0,
                knockProgress: 0,
                callProgress: 0,
                appraisalProgress: 0,
              };
            }
            streetProgressMap[streetKey].targetCalls += Number(street.target_calls || 0);
            streetProgressMap[streetKey].targetAppraisals += Number(street.desktop_appraisals || 0) + Number(street.face_to_face_appraisals || 0);
            totalTargetCalls += Number(street.target_calls || 0);
            totalTargetDesktopAppraisals += Number(street.desktop_appraisals || 0);
            totalTargetFaceToFaceAppraisals += Number(street.face_to_face_appraisals || 0);
          });
        }
        if (!suburbProgressMap[plan.suburb]) {
          suburbProgressMap[plan.suburb] = {
            suburb: plan.suburb,
            totalActivities: 0,
            completedActivities: 0,
            totalKnocks: 0,
            answeredKnocks: 0,
            totalCalls: 0,
            connectedCalls: 0,
            totalDesktopAppraisals: 0,
            totalFaceToFaceAppraisals: 0,
            totalAppraisals: 0,
            totalListings: 0,
            totalSales: 0,
            targetKnocks: 0,
            targetCalls: 0,
            targetAppraisals: 0,
            knockProgress: 0,
            callProgress: 0,
            appraisalProgress: 0,
          };
        }
        suburbProgressMap[plan.suburb].targetKnocks += (plan.door_knock_streets || []).reduce((sum, s) => sum + Number(s.target_knocks || 0), 0);
        suburbProgressMap[plan.suburb].targetCalls += (plan.phone_call_streets || []).reduce((sum, s) => sum + Number(s.target_calls || 0), 0);
        suburbProgressMap[plan.suburb].targetAppraisals += (plan.door_knock_streets || []).reduce(
          (sum, s) => sum + Number(s.desktop_appraisals || 0) + Number(s.face_to_face_appraisals || 0),
          0
        ) + (plan.phone_call_streets || []).reduce(
          (sum, s) => sum + Number(s.desktop_appraisals || 0) + Number(s.face_to_face_appraisals || 0),
          0
        );
      }
    });

    const totalTargetAppraisals = totalTargetDesktopAppraisals + totalTargetFaceToFaceAppraisals;
    const doorKnockProgress = totalTargetKnocks > 0 ? Math.min((totalKnocks / totalTargetKnocks) * 100, 100) : 0;
    const phoneCallProgress = totalTargetCalls > 0 ? Math.min((totalCalls / totalTargetCalls) * 100, 100) : 0;
    const appraisalProgress = totalTargetAppraisals > 0 ? Math.min((totalAppraisals / totalTargetAppraisals) * 100, 100) : 0;

    Object.values(streetProgressMap).forEach(street => {
      street.knockProgress = street.targetKnocks > 0 ? Math.min((street.totalKnocks / street.targetKnocks) * 100, 100) : 0;
      street.callProgress = street.targetCalls > 0 ? Math.min((street.totalCalls / street.targetCalls) * 100, 100) : 0;
      street.appraisalProgress = street.targetAppraisals > 0 ? Math.min((street.totalAppraisals / street.targetAppraisals) * 100, 100) : 0;
    });

    Object.values(suburbProgressMap).forEach(suburb => {
      suburb.knockProgress = suburb.targetKnocks > 0 ? Math.min((suburb.totalKnocks / suburb.targetKnocks) * 100, 100) : 0;
      suburb.callProgress = suburb.targetCalls > 0 ? Math.min((suburb.totalCalls / suburb.targetCalls) * 100, 100) : 0;
      suburb.appraisalProgress = suburb.targetAppraisals > 0 ? Math.min((suburb.totalAppraisals / suburb.targetAppraisals) * 100, 100) : 0;
    });

    const metrics: ProgressMetrics = {
      agentName: agent.name || 'Unknown Agent',
      totalActivities,
      completedActivities,
      totalCalls,
      connectedCalls,
      totalKnocks,
      answeredKnocks,
      totalDesktopAppraisals,
      totalFaceToFaceAppraisals,
      totalAppraisals,
      totalListings,
      totalSales,
      totalCommission,
      conversionRate: Number(conversionRate.toFixed(1)),
      doorKnockProgress: Number(doorKnockProgress.toFixed(1)),
      phoneCallProgress: Number(phoneCallProgress.toFixed(1)),
      appraisalProgress: Number(appraisalProgress.toFixed(1)),
      streetProgress: Object.values(streetProgressMap),
      suburbProgress: Object.values(suburbProgressMap),
    };

    setProgressMetrics(metrics);
  };

  const generateReport = async () => {
    toast.success('Report generation not implemented yet');
  };

  const barChartData = [
    {
      name: 'Calls Connected',
      value: progressMetrics?.totalCalls || 0,
      target: marketingPlans.reduce((sum, plan) => sum + (plan.phone_call_streets || []).reduce((s, street) => s + Number(street.target_calls || 0), 0), 0),
    },
    {
      name: 'Knocks Made',
      value: progressMetrics?.totalKnocks || 0,
      target: marketingPlans.reduce((sum, plan) => sum + (plan.door_knock_streets || []).reduce((s, street) => s + Number(street.target_knocks || 0), 0), 0),
    },
    {
      name: 'Desktop Appraisals',
      value: progressMetrics?.totalDesktopAppraisals || 0,
      target: marketingPlans.reduce(
        (sum, plan) =>
          sum +
          (plan.door_knock_streets || []).reduce((s, street) => s + Number(street.desktop_appraisals || 0), 0) +
          (plan.phone_call_streets || []).reduce((s, street) => s + Number(street.desktop_appraisals || 0), 0),
        0
      ),
    },
    {
      name: 'Face-to-Face Appraisals',
      value: progressMetrics?.totalFaceToFaceAppraisals || 0,
      target: marketingPlans.reduce(
        (sum, plan) =>
          sum +
          (plan.door_knock_streets || []).reduce((s, street) => s + Number(street.face_to_face_appraisals || 0), 0) +
          (plan.phone_call_streets || []).reduce((s, street) => s + Number(street.face_to_face_appraisals || 0), 0),
        0
      ),
    },
  ];

  const toggleStreet = (streetKey: string) => {
    setExpandedStreets(prev =>
      prev.includes(streetKey)
        ? prev.filter(key => key !== streetKey)
        : [...prev, streetKey]
    );
  };

  const toggleSuburb = (suburb: string) => {
    setExpandedSuburbs(prev =>
      prev.includes(suburb)
        ? prev.filter(s => s !== suburb)
        : [...prev, suburb]
    );
  };

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
                { id: 'properties', label: 'Properties', icon: Home },
                { id: 'progress', label: 'Progress', icon: MapPin },
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
                    { label: 'Conversion Rate', value: `${progressMetrics.conversionRate}%`, icon: Target, color: 'bg-orange-500' },
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                          <span className="font-medium">{progressMetrics.phoneCallProgress}%</span>
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
                          <span className="font-medium">{progressMetrics.doorKnockProgress}%</span>
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
                          <span className="text-gray-600">Desktop Appraisals:</span>
                          <span className="font-medium">{progressMetrics.totalDesktopAppraisals}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Face-to-Face Appraisals:</span>
                          <span className="font-medium">{progressMetrics.totalFaceToFaceAppraisals}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Appraisals:</span>
                          <span className="font-medium">{progressMetrics.totalAppraisals}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Progress:</span>
                          <span className="font-medium">{progressMetrics.appraisalProgress}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                        <DollarSign className="w-4 h-4 mr-2 text-orange-600" />
                        Sales Performance
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Listings:</span>
                          <span className="font-medium">{progressMetrics.totalListings}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Sales:</span>
                          <span className="font-medium">{progressMetrics.totalSales}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Commission:</span>
                          <span className="font-medium">${progressMetrics.totalCommission.toLocaleString()}</span>
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

          {activeTab === 'progress' && (
            <motion.div
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                  Street-Wise Progress for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}
                </h3>
                {progressMetrics?.streetProgress.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No street-wise progress data for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {progressMetrics?.streetProgress.map((street) => {
                      const streetKey = `${street.streetName}-${street.suburb}`;
                      const isExpanded = expandedStreets.includes(streetKey);
                      return (
                        <div key={streetKey} className="border border-gray-200 rounded-lg p-4">
                          <button
                            className="w-full flex justify-between items-center text-left"
                            onClick={() => toggleStreet(streetKey)}
                          >
                            <div>
                              <h4 className="font-semibold text-gray-900">{street.streetName}</h4>
                              <p className="text-sm text-gray-600">{street.suburb}</p>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mt-4 overflow-hidden"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">Door Knocks</p>
                                    <div className="mt-2">
                                      <div className="text-sm text-gray-600">Progress: {street.knockProgress.toFixed(1)}%</div>
                                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                        <motion.div
                                          className="bg-blue-600 h-2.5 rounded-full"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${street.knockProgress}%` }}
                                          transition={{ duration: 0.5 }}
                                          title={`Knocks: ${street.totalKnocks}/${street.targetKnocks}`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Phone Calls</p>
                                    <div className="mt-2">
                                      <div className="text-sm text-gray-600">Progress: {street.callProgress.toFixed(1)}%</div>
                                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                        <motion.div
                                          className="bg-green-600 h-2.5 rounded-full"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${street.callProgress}%` }}
                                          transition={{ duration: 0.5 }}
                                          title={`Calls: ${street.totalCalls}/${street.targetCalls}`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Appraisals</p>
                                    <div className="mt-2">
                                      <div className="text-sm text-gray-600">Progress: {street.appraisalProgress.toFixed(1)}%</div>
                                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                        <motion.div
                                          className="bg-purple-600 h-2.5 rounded-full"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${street.appraisalProgress}%` }}
                                          transition={{ duration: 0.5 }}
                                          title={`Appraisals: ${street.totalAppraisals}/${street.targetAppraisals}`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">Activities: {street.totalActivities} (Completed: {street.completedActivities})</p>
                                    <p className="text-sm text-gray-600">Listings: {street.totalListings}</p>
                                    <p className="text-sm text-gray-600">Sales: {street.totalSales}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Answered Knocks: {street.answeredKnocks}</p>
                                    <p className="text-sm text-gray-600">Connected Calls: {street.connectedCalls}</p>
                                    <p className="text-sm text-gray-600">Desktop/Face-to-Face Appraisals: {street.totalDesktopAppraisals}/{street.totalFaceToFaceAppraisals}</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border border-blue-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                  Suburb-Wise Progress for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}
                </h3>
                {progressMetrics?.suburbProgress.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No suburb-wise progress data for {agents.find(a => a.id === selectedAgentId)?.name || 'selected agent'}.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {progressMetrics?.suburbProgress.map((suburb) => {
                      const isExpanded = expandedSuburbs.includes(suburb.suburb);
                      return (
                        <div key={suburb.suburb} className="border border-gray-200 rounded-lg p-4">
                          <button
                            className="w-full flex justify-between items-center text-left"
                            onClick={() => toggleSuburb(suburb.suburb)}
                          >
                            <div>
                              <h4 className="font-semibold text-gray-900">{suburb.suburb}</h4>
                              <p className="text-sm text-gray-600">Total Activities: {suburb.totalActivities}</p>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </button>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="mt-4 overflow-hidden"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">Door Knocks</p>
                                    <div className="mt-2">
                                      <div className="text-sm text-gray-600">Progress: {suburb.knockProgress.toFixed(1)}%</div>
                                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                        <motion.div
                                          className="bg-blue-600 h-2.5 rounded-full"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${suburb.knockProgress}%` }}
                                          transition={{ duration: 0.5 }}
                                          title={`Knocks: ${suburb.totalKnocks}/${suburb.targetKnocks}`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Phone Calls</p>
                                    <div className="mt-2">
                                      <div className="text-sm text-gray-600">Progress: {suburb.callProgress.toFixed(1)}%</div>
                                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                        <motion.div
                                          className="bg-green-600 h-2.5 rounded-full"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${suburb.callProgress}%` }}
                                          transition={{ duration: 0.5 }}
                                          title={`Calls: ${suburb.totalCalls}/${suburb.targetCalls}`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Appraisals</p>
                                    <div className="mt-2">
                                      <div className="text-sm text-gray-600">Progress: {suburb.appraisalProgress.toFixed(1)}%</div>
                                      <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                                        <motion.div
                                          className="bg-purple-600 h-2.5 rounded-full"
                                          initial={{ width: 0 }}
                                          animate={{ width: `${suburb.appraisalProgress}%` }}
                                          transition={{ duration: 0.5 }}
                                          title={`Appraisals: ${suburb.totalAppraisals}/${suburb.targetAppraisals}`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-gray-600">Activities: {suburb.totalActivities} (Completed: {suburb.completedActivities})</p>
                                    <p className="text-sm text-gray-600">Listings: {suburb.totalListings}</p>
                                    <p className="text-sm text-gray-600">Sales: {suburb.totalSales}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-600">Answered Knocks: {suburb.answeredKnocks}</p>
                                    <p className="text-sm text-gray-600">Connected Calls: {suburb.connectedCalls}</p>
                                    <p className="text-sm text-gray-600">Desktop/Face-to-Face Appraisals: {suburb.totalDesktopAppraisals}/{suburb.totalFaceToFaceAppraisals}</p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
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
