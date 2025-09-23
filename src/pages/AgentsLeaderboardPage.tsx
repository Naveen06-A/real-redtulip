import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { Loader2, BarChart, ArrowLeft, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { supabase } from '../lib/supabase';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import isEqual from 'lodash.isequal';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Define specific types for Supabase data
interface Profile {
  id: string;
  name: string | null;
  role: string;
}

interface Activity {
  id: string;
  agent_id: string;
  activity_type: 'door_knock' | 'phone_call';
  activity_date: string;
  knocks_made?: number;
  knocks_answered?: number;
  calls_made?: number;
  calls_answered?: number;
  desktop_appraisals?: number;
  face_to_face_appraisals?: number;
}

interface MarketingPlan {
  id: string;
  agent: string;
}

interface NurturingContact {
  id: string;
  agent_id: string;
  status: string | null;
}

interface SupabaseError {
  code: string;
  message: string;
  details: string;
}

interface Agent {
  id: string;
  name: string;
}

interface AgentProgress {
  agent: Agent;
  marketingPlansCount: number;
  doorKnocks: number;
  phoneCalls: number;
  connects: number;
  desktopAppraisals: number;
  faceToFaceAppraisals: number;
  contactsListed: number;
  contactsClosed: number;
}

export function AgentsLeaderboardPage() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [marketingPlans, setMarketingPlans] = useState<MarketingPlan[]>([]);
  const [nurturingContacts, setNurturingContacts] = useState<NurturingContact[]>([]);
  const [agentProgresses, setAgentProgresses] = useState<AgentProgress[]>([]);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;
  const [showDateFilter, setShowDateFilter] = useState(false);

  // Ref to track initial load and re-renders
  const isInitialLoad = useRef(true);
  const renderCount = useRef(0);

  // Debug re-renders
  useEffect(() => {
    renderCount.current += 1;
    console.log(`Component re-rendered ${renderCount.current} times`);
  });

  // Debounce function
  const debounce = <F extends (...args: any[]) => any>(func: F, wait: number) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<F>): Promise<ReturnType<F>> => {
      clearTimeout(timeout);
      return new Promise(resolve => {
        timeout = setTimeout(() => resolve(func(...args)), wait);
      });
    };
  };

  // Data fetching
  const loadAgents = useCallback(async () => {
    try {
      console.log('Fetching agents from profiles table...');
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('role', 'agent')
        .order('name', { ascending: true });

      if (error) {
        console.error('Supabase error in loadAgents:', { code: error.code, message: error.message, details: error.details });
        throw new Error(`Supabase error: ${error.message} (Code: ${error.code}, Details: ${error.details})`);
      }

      console.log('Raw agents data from Supabase:', data);

      if (!data || data.length === 0) {
        console.warn('No agents found in profiles table');
        toast.warn('No agents found in the database');
        setAgents([]);
        return;
      }

      const processedAgents: Agent[] = (data as Profile[]).map(agent => ({
        id: agent.id,
        name: agent.name?.trim() || 'Unnamed Agent',
      }));

      console.log('Processed agents:', processedAgents);
      setAgents(prev => {
        if (!isEqual(prev, processedAgents)) {
          console.log('Updating agents state');
          return processedAgents;
        }
        console.log('No change in agents data, skipping state update');
        return prev;
      });
    } catch (err: unknown) {
      const error = err as SupabaseError;
      console.error('Error loading agents:', error);
      toast.error(`Failed to load agents: ${error.message || 'Unknown error'}`);
      setAgents([]);
    }
  }, []);

  const loadMarketingPlans = useCallback(async () => {
    try {
      console.log('Fetching marketing plans...');
      const { data, error } = await supabase
        .from('marketing_plans')
        .select('id, agent');

      if (error) {
        console.error('Supabase error in loadMarketingPlans:', { code: error.code, message: error.message, details: error.details });
        throw new Error(`Supabase error: ${error.message} (Code: ${error.code}, Details: ${error.details})`);
      }

      console.log('Raw marketing plans data from Supabase:', data);

      if (!data || data.length === 0) {
        console.warn('No marketing plans found');
        toast.warn('No marketing plans found');
        setMarketingPlans([]);
        return;
      }

      // Validate agent IDs
      const validAgents = new Set(agents.map(agent => agent.id));
      const invalidPlans = (data as MarketingPlan[]).filter(plan => !validAgents.has(plan.agent));
      if (invalidPlans.length > 0) {
        console.warn('Marketing plans with invalid agent IDs:', invalidPlans);
      }

      setMarketingPlans(prev => {
        if (!isEqual(prev, data)) {
          console.log('Updating marketing plans state');
          return data as MarketingPlan[];
        }
        console.log('No change in marketing plans data, skipping state update');
        return prev;
      });
    } catch (err: unknown) {
      const error = err as SupabaseError;
      console.error('Error loading marketing plans:', error);
      toast.error(`Failed to load marketing plans: ${error.message || 'Unknown error'}`);
      setMarketingPlans([]);
    }
  }, [agents]);

  const debouncedLoadMarketingPlans = useMemo(() => debounce(loadMarketingPlans, 500), [loadMarketingPlans]);

  const loadActivities = useCallback(async () => {
    try {
      console.log('Fetching all activities and nurturing contacts with date range:', { startDate, endDate });
      // Fetch agent activities
      let activityQuery = supabase
        .from('agent_activities')
        .select('*');

      // Fetch nurturing contacts
      let nurturingQuery = supabase
        .from('nurturing_list')
        .select('id, agent_id, status');

      // Apply date range filter to activities if set
      if (startDate && endDate) {
        activityQuery = activityQuery
          .gte('activity_date', startDate.toISOString())
          .lte('activity_date', endDate.toISOString());
      }

      const [{ data: activityData, error: activityError }, { data: nurturingData, error: nurturingError }] = await Promise.all([
        activityQuery,
        nurturingQuery,
      ]);

      if (activityError) {
        console.error('Supabase error in loadActivities (activities):', { code: activityError.code, message: activityError.message, details: activityError.details });
        throw new Error(`Supabase error (activities): ${activityError.message} (Code: ${activityError.code}, Details: ${activityError.details})`);
      }

      if (nurturingError) {
        console.error('Supabase error in loadActivities (nurturing):', { code: nurturingError.code, message: nurturingError.message, details: nurturingError.details });
        throw new Error(`Supabase error (nurturing): ${nurturingError.message} (Code: ${nurturingError.code}, Details: ${nurturingError.details})`);
      }

      console.log('Raw activities data from Supabase:', activityData);
      console.log('Raw nurturing contacts data from Supabase:', nurturingData);

      if (!activityData || activityData.length === 0) {
        console.warn('No activities found for the selected period');
        toast.warn('No activities found');
      }

      if (!nurturingData || nurturingData.length === 0) {
        console.warn('No nurturing contacts found');
        toast.warn('No nurturing contacts found');
      }

      // Validate agent IDs for activities
      const validAgents = new Set(agents.map(agent => agent.id));
      const invalidActivities = (activityData || []).filter(activity => !validAgents.has(activity.agent_id));
      if (invalidActivities.length > 0) {
        console.warn('Activities with invalid agent IDs:', invalidActivities);
      }

      // Validate agent IDs for nurturing contacts
      const invalidNurturing = (nurturingData || []).filter(contact => !validAgents.has(contact.agent_id));
      if (invalidNurturing.length > 0) {
        console.warn('Nurturing contacts with invalid agent IDs:', invalidNurturing);
      }

      setActivities(prev => {
        if (!isEqual(prev, activityData || [])) {
          console.log('Updating activities state with', activityData?.length || 0, 'activities');
          return activityData as Activity[] || [];
        }
        console.log('No change in activities data, skipping state update');
        return prev;
      });

      setNurturingContacts(prev => {
        if (!isEqual(prev, nurturingData || [])) {
          console.log('Updating nurturing contacts state with', nurturingData?.length || 0, 'contacts');
          return nurturingData as NurturingContact[] || [];
        }
        console.log('No change in nurturing contacts data, skipping state update');
        return prev;
      });
    } catch (err: unknown) {
      const error = err as SupabaseError;
      console.error('Error loading activities or nurturing contacts:', error);
      toast.error(`Failed to load data: ${error.message || 'Unknown error'}`);
      setActivities([]);
      setNurturingContacts([]);
    }
  }, [startDate, endDate, agents]);

  const debouncedLoadActivities = useMemo(() => debounce(loadActivities, 500), [loadActivities]);

  // Calculate agent progresses
  const calculateProgresses = useCallback(() => {
    console.log('Calculating progresses with agents:', agents);
    console.log('Activities:', activities);
    console.log('Marketing plans:', marketingPlans);
    console.log('Nurturing contacts:', nurturingContacts);

    // Calculate marketing plans count per agent
    const plansCount: { [agentId: string]: number } = {};
    marketingPlans.forEach(plan => {
      if (plan.agent) {
        plansCount[plan.agent] = (plansCount[plan.agent] || 0) + 1;
      } else {
        console.warn('Marketing plan missing agent:', plan);
      }
    });

    // Calculate activity aggregates per agent
    const activityAggregates: { [agentId: string]: Omit<AgentProgress, 'agent' | 'marketingPlansCount' | 'contactsListed' | 'contactsClosed'> } = {};
    activities.forEach(activity => {
      const agentId = activity.agent_id;
      if (!agentId) {
        console.warn('Activity missing agent_id:', activity);
        return;
      }

      if (!activityAggregates[agentId]) {
        activityAggregates[agentId] = {
          doorKnocks: 0,
          phoneCalls: 0,
          connects: 0,
          desktopAppraisals: 0,
          faceToFaceAppraisals: 0,
        };
      }

      const agg = activityAggregates[agentId];

      if (activity.activity_type === 'door_knock') {
        agg.doorKnocks += activity.knocks_made || 0;
        agg.connects += activity.knocks_answered || 0;
      } else if (activity.activity_type === 'phone_call') {
        agg.phoneCalls += activity.calls_made || 0;
        agg.connects += activity.calls_answered || 0;
      }

      agg.desktopAppraisals += activity.desktop_appraisals || 0;
      agg.faceToFaceAppraisals += activity.face_to_face_appraisals || 0;
    });

    // Calculate nurturing contacts per agent
    const nurturingAggregates: { [agentId: string]: { contactsListed: number; contactsClosed: number } } = {};
    nurturingContacts.forEach(contact => {
      const agentId = contact.agent_id;
      if (!agentId) {
        console.warn('Nurturing contact missing agent_id:', contact);
        return;
      }

      if (!nurturingAggregates[agentId]) {
        nurturingAggregates[agentId] = {
          contactsListed: 0,
          contactsClosed: 0,
        };
      }

      nurturingAggregates[agentId].contactsListed += 1;
      if (contact.status === 'Closed') {
        nurturingAggregates[agentId].contactsClosed += 1;
      }
    });

    // Ensure all agents are included, even those with no activities or contacts
    const progresses: AgentProgress[] = agents.map(agent => {
      const agg = activityAggregates[agent.id] || {
        doorKnocks: 0,
        phoneCalls: 0,
        connects: 0,
        desktopAppraisals: 0,
        faceToFaceAppraisals: 0,
      };
      const nurturing = nurturingAggregates[agent.id] || {
        contactsListed: 0,
        contactsClosed: 0,
      };
      return {
        agent,
        marketingPlansCount: plansCount[agent.id] || 0,
        doorKnocks: agg.doorKnocks,
        phoneCalls: agg.phoneCalls,
        connects: agg.connects,
        desktopAppraisals: agg.desktopAppraisals,
        faceToFaceAppraisals: agg.faceToFaceAppraisals,
        contactsListed: nurturing.contactsListed,
        contactsClosed: nurturing.contactsClosed,
      };
    });

    // Sort by connects descending
    progresses.sort((a, b) => b.connects - a.connects);

    console.log('Calculated agent progresses:', progresses);
    progresses.forEach(progress => {
      console.log(`Agent ${progress.agent.name} (ID: ${progress.agent.id}):`, {
        marketingPlansCount: progress.marketingPlansCount,
        doorKnocks: progress.doorKnocks,
        phoneCalls: progress.phoneCalls,
        connects: progress.connects,
        desktopAppraisals: progress.desktopAppraisals,
        faceToFaceAppraisals: progress.faceToFaceAppraisals,
        contactsListed: progress.contactsListed,
        contactsClosed: progress.contactsClosed,
      });
    });

    setAgentProgresses(prev => {
      if (!isEqual(prev, progresses)) {
        console.log('Updating agent progresses state');
        return progresses;
      }
      console.log('No change in agent progresses, skipping state update');
      return prev;
    });
  }, [agents, activities, marketingPlans, nurturingContacts]);

  // Check authentication
  useEffect(() => {
    console.log('Supabase client initialized:', supabase);
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error checking Supabase session:', error);
        toast.error('Authentication error: Unable to verify session');
      }
      console.log('Current session:', session);
      if (!session || !user || !profile) {
        console.warn('No active session or profile, redirecting to login');
        navigate('/login');
      }
    };
    checkSession();
  }, [navigate, user, profile]);

  // Initial data load
  useEffect(() => {
    if (!user || !profile) {
      console.warn('No user or profile, redirecting to login');
      navigate('/login');
      return;
    }

    const initialize = async () => {
      setLoading(true);
      try {
        await loadAgents();
        await Promise.all([loadMarketingPlans(), loadActivities()]);
      } catch (err: unknown) {
        const error = err as SupabaseError;
        console.error('Error during initialization:', error);
        toast.error(`Initialization failed: ${error.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
        isInitialLoad.current = false;
      }
    };

    initialize();

    // Temporarily disable real-time subscriptions to prevent blinking
    /*
    const activitySubscription = supabase
      .channel('agent_activities_changes_all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_activities' },
        () => {
          if (!isInitialLoad.current) {
            console.log('Agent activities changed, reloading...');
            debouncedLoadActivities();
          }
        }
      )
      .subscribe();

    const planSubscription = supabase
      .channel('marketing_plans_changes_all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'marketing_plans' },
        () => {
          if (!isInitialLoad.current) {
            console.log('Marketing plans changed, reloading...');
            debouncedLoadMarketingPlans();
          }
        }
      )
      .subscribe();

    const nurturingSubscription = supabase
      .channel('nurturing_list_changes_all')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nurturing_list' },
        () => {
          if (!isInitialLoad.current) {
            console.log('Nurturing contacts changed, reloading...');
            debouncedLoadActivities();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activitySubscription);
      supabase.removeChannel(planSubscription);
      supabase.removeChannel(nurturingSubscription);
    };
    */
  }, [user, profile, navigate, loadAgents, debouncedLoadActivities, debouncedLoadMarketingPlans]);

  // Calculate progresses when data changes
  useEffect(() => {
    if (!isInitialLoad.current) {
      calculateProgresses();
    }
  }, [calculateProgresses]);

  // Handle date range changes with debounce
  const handleDateRangeChange = useCallback(
    debounce((newRange: [Date | null, Date | null]) => {
      console.log('Date range changed:', { startDate: newRange[0], endDate: newRange[1] });
      setDateRange(prev => {
        if (!isEqual(prev, newRange)) {
          console.log('Updating date range state');
          return newRange;
        }
        console.log('No change in date range, skipping state update');
        return prev;
      });
      // Trigger activity and nurturing contacts reload after date range change
      debouncedLoadActivities();
    }, 500),
    [debouncedLoadActivities]
  );

  // Chart data
  const leaderboardChartData = useMemo(() => ({
    labels: agentProgresses.map(p => p.agent.name),
    datasets: [
      {
        label: 'Connects',
        data: agentProgresses.map(p => p.connects),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
      {
        label: 'Door Knocks',
        data: agentProgresses.map(p => p.doorKnocks),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      },
      {
        label: 'Phone Calls',
        data: agentProgresses.map(p => p.phoneCalls),
        backgroundColor: 'rgba(139, 92, 246, 0.7)',
        borderColor: 'rgb(139, 92, 246)',
        borderWidth: 1,
      },
      {
        label: 'Contacts Listed',
        data: agentProgresses.map(p => p.contactsListed),
        backgroundColor: 'rgba(255, 159, 64, 0.7)',
        borderColor: 'rgb(255, 159, 64)',
        borderWidth: 1,
      },
      {
        label: 'Contacts Closed',
        data: agentProgresses.map(p => p.contactsClosed),
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1,
      },
    ],
  }), [agentProgresses]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const dashboardPath = profile?.role === 'admin' ? '/admin-dashboard' : '/agent-dashboard';

  return (
    <div className="max-w-7xl mx-auto p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">Agents Progress Leaderboard</h1>
          <p className="text-gray-600">View progress across all agents, ranked by connects.</p>
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
                  onChange={handleDateRangeChange}
                  isClearable
                  inline
                />
                <div className="flex justify-end mt-2 gap-2">
                  <button
                    onClick={() => {
                      handleDateRangeChange([null, null]);
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
        </div>
      </div>

      {/* Leaderboard Chart */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <BarChart size={20} />
          Performance Comparison
        </h3>
        <div className="h-80">
          <Bar
            data={leaderboardChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { beginAtZero: true },
              },
              plugins: {
                legend: {
                  position: 'top',
                },
              },
            }}
          />
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white p-4 rounded-lg shadow overflow-x-auto">
        <h3 className="font-semibold mb-4">Detailed Leaderboard</h3>
        <table className="w-full text-sm min-w-max">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Rank</th>
              <th className="p-2 text-left">Agent</th>
              <th className="p-2 text-right">Marketing Plans</th>
              <th className="p-2 text-right">Door Knocks</th>
              <th className="p-2 text-right">Phone Calls</th>
              <th className="p-2 text-right">Connects</th>
              <th className="p-2 text-right">Desktop Appraisals</th>
              <th className="p-2 text-right">F2F Appraisals</th>
              <th className="p-2 text-right">Contacts Listed</th>
              <th className="p-2 text-right">Contacts Closed</th>
            </tr>
          </thead>
          <tbody>
            {agentProgresses.map((progress, index) => {
              const isCurrentUser = progress.agent.id === user?.id;
              return (
                <tr
                  key={progress.agent.id}
                  className={`border-b hover:bg-gray-50 ${isCurrentUser ? 'bg-blue-50 font-semibold' : ''}`}
                >
                  <td className="p-2">{index + 1}</td>
                  <td className="p-2">{progress.agent.name} {isCurrentUser ? '(You)' : ''}</td>
                  <td className="p-2 text-right">{progress.marketingPlansCount}</td>
                  <td className="p-2 text-right">{progress.doorKnocks}</td>
                  <td className="p-2 text-right">{progress.phoneCalls}</td>
                  <td className="p-2 text-right">{progress.connects}</td>
                  <td className="p-2 text-right">{progress.desktopAppraisals}</td>
                  <td className="p-2 text-right">{progress.faceToFaceAppraisals}</td>
                  <td className="p-2 text-right">{progress.contactsListed}</td>
                  <td className="p-2 text-right">{progress.contactsClosed}</td>
                </tr>
              );
            })}
            {!agentProgresses.length && (
              <tr>
                <td colSpan={10} className="p-4 text-center text-gray-500">
                  No data available for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={() => navigate(dashboardPath)}
          className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );
}