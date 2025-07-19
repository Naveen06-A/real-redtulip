import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Target, 
  DollarSign, 
  CheckCircle, 
  FileText, 
  Home, 
  Phone, 
  Calendar,
  Settings,
  Save,
  RotateCcw,
  BarChart3,
  Download,
  Eye,
  X,
  Trash2,
  List
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { Disclosure } from '@headlessui/react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';


interface BusinessPlanTargets {
  id?: string;
  agent_id: string;
  agent_name?: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  appraisals_target: number | null;
  listings_target: number | null;
  settled_sales_target: number | null;
  gross_commission_target: number | null;
  connects_for_appraisals: number | null;
  phone_calls_to_achieve_appraisals: number | null;
  appraisal_to_listing_ratio: number | null;
  listing_to_written_ratio: number | null;
  fall_over_rate: number | null;
  avg_commission_per_sale: number | null;
  connects_for_appraisal: number | null;
  calls_for_connect: number | null;
  no_of_working_days_per_year: number | null;
  calls_per_day: number | null;
  calls_per_person: number | null;
  no_of_people_required: number | null;
  salary_per_hour: number | null;
  salary_per_day: number | null;
  marketing_expenses: number | null;
  persons_salary: number | null;
  net_commission: number | null;
  cost_per_third_party_call: number | null;
  how_many_calls: number | null;
  how_many_appraisals: number | null;
  total_third_party_calls: number | null;
  total_cost_appraisals: number | null;
  avg_commission_price_per_property: number | null;
  franchise_fee: number | null;
  commission_average: number | null;
  agent_percentage: number | null;
  business_percentage: number | null;
  agent_commission: number | null;
  business_commission: number | null;
  created_at?: string;
  updated_at?: string;
}

interface Agent {
  id: string;
  name: string;
}

interface RatioInputProps {
  label: string;
  value: number | string;
  onChange: (value: number | null) => void;
  min: number;
  step: number;
  suffix: string;
  tooltip: string;
}

const RatioInput: React.FC<RatioInputProps> = ({
  label,
  value,
  onChange,
  min,
  step,
  suffix,
  tooltip
}) => (
  <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200 relative group">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-blue-800">{label}</span>
      <span className="text-sm text-blue-600">{value ? `${suffix === '%' ? Math.round(Number(value)) : Math.round(Number(value)).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })} ${suffix}` : 'N/A'}</span>
    </div>
    <div className="relative">
      <input
        type="number"
        min={min}
        step={step}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Math.round(parseFloat(e.target.value)))}
        className="w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-100 text-blue-800 pr-8"
      />
      {suffix === '%' && (
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600">%</span>
      )}
    </div>
    <div className="absolute z-10 hidden group-hover:block bg-blue-800 text-white text-xs rounded py-2 px-4 -top-10 left-1/2 transform -translate-x-1/2 w-64">
      {tooltip}
    </div>
  </div>
);

export function AgentBusinessPlan({ isAdmin = false }: { isAdmin?: boolean }) {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [targets, setTargets] = useState<BusinessPlanTargets>({
    agent_id: user?.id || '',
    agent_name: isAdmin ? '' : user?.user_metadata?.full_name || 'Unknown Agent',
    period_type: 'yearly',
    appraisals_target: null,
    listings_target: null,
    settled_sales_target: null,
    gross_commission_target: null,
    connects_for_appraisals: null,
    phone_calls_to_achieve_appraisals: null,
    appraisal_to_listing_ratio: null,
    listing_to_written_ratio: null,
    fall_over_rate: null,
    avg_commission_per_sale: null,
    connects_for_appraisal: null,
    calls_for_connect: null,
    no_of_working_days_per_year: null,
    calls_per_day: null,
    calls_per_person: null,
    no_of_people_required: null,
    salary_per_hour: null,
    salary_per_day: null,
    marketing_expenses: null,
    persons_salary: null,
    net_commission: null,
    cost_per_third_party_call: null,
    how_many_calls: null,
    how_many_appraisals: null,
    total_third_party_calls: null,
    total_cost_appraisals: null,
    avg_commission_price_per_property: null,
    franchise_fee: null,
    commission_average: null,
    agent_percentage: null,
    business_percentage: null,
    agent_commission: null,
    business_commission: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const [savedPlans, setSavedPlans] = useState<BusinessPlanTargets[]>([]);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'details' | 'pdf'>('details');
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  useEffect(() => {
    const initializeAgentData = async () => {
      if (isAdmin) {
        if (!targets.agent_id) {
          navigate('/admin-dashboard');
          return;
        }
        await fetchAgents();
      } else if (user?.id) {
        const agentName = user.user_metadata?.full_name || 'Unknown Agent';
        setTargets(prev => ({
          ...prev,
          agent_id: user.id,
          agent_name: agentName
        }));
        setAgentSearch(agentName);
        await fetchBusinessPlan(user.id);
      }
    };
    initializeAgentData();
  }, [user?.id, user?.user_metadata?.full_name, isAdmin, navigate]);

  useEffect(() => {
    const { 
      appraisal_to_listing_ratio,
      listing_to_written_ratio,
      gross_commission_target, 
      avg_commission_per_sale,
      fall_over_rate,
      connects_for_appraisal,
      calls_for_connect,
      no_of_working_days_per_year,
      calls_per_person,
      salary_per_hour,
      marketing_expenses,
      cost_per_third_party_call,
      how_many_calls,
      how_many_appraisals,
      avg_commission_price_per_property,
      franchise_fee,
      agent_percentage,
      business_percentage
    } = targets;

    let settled_sales_target: number | null = null;
    let listings_target: number | null = null;
    let appraisals_target: number | null = null;
    let connects_for_appraisals: number | null = null;
    let phone_calls_to_achieve_appraisals: number | null = null;
    let calls_per_day: number | null = null;
    let no_of_people_required: number | null = null;
    let salary_per_day: number | null = null;
    let persons_salary: number | null = null;
    let net_commission: number | null = null;
    let total_third_party_calls: number | null = null;
    let total_cost_appraisals: number | null = null;
    let commission_average: number | null = null;
    let agent_commission: number | null = null;
    let business_commission: number | null = null;

    if (avg_commission_price_per_property != null && franchise_fee != null) {
      commission_average = Math.round(avg_commission_price_per_property * (1 - franchise_fee / 100));
    }

    if (commission_average != null && agent_percentage != null && business_percentage != null && agent_percentage + business_percentage === 100) {
      agent_commission = Math.round(commission_average * (agent_percentage / 100));
      business_commission = Math.round(commission_average * (business_percentage / 100));
    }

    const avg_commission_per_sale_updated = agent_commission;

    if (gross_commission_target != null && avg_commission_per_sale_updated != null && avg_commission_per_sale_updated > 0) {
      settled_sales_target = Math.round(gross_commission_target / avg_commission_per_sale_updated);
    }

    if (settled_sales_target != null && listing_to_written_ratio != null && listing_to_written_ratio > 0) {
      const fallOverFactor = fall_over_rate != null && fall_over_rate > 0 ? (1 + fall_over_rate / 100) : 1;
      listings_target = Math.round(settled_sales_target * fallOverFactor);
    }

    if (listings_target != null && appraisal_to_listing_ratio != null && appraisal_to_listing_ratio > 0) {
      const fallOverFactor = fall_over_rate != null && fall_over_rate > 0 ? (1 + fall_over_rate / 100) : 1;
      appraisals_target = Math.round(listings_target / (appraisal_to_listing_ratio / 100) * fallOverFactor);
    }

    if (appraisals_target != null && connects_for_appraisal != null) {
      connects_for_appraisals = Math.round(appraisals_target * connects_for_appraisal);
    }

    if (connects_for_appraisals != null && calls_for_connect != null) {
      phone_calls_to_achieve_appraisals = Math.round(connects_for_appraisals * calls_for_connect);
    }

    if (phone_calls_to_achieve_appraisals != null && no_of_working_days_per_year != null && no_of_working_days_per_year > 0) {
      calls_per_day = Math.round(phone_calls_to_achieve_appraisals / no_of_working_days_per_year);
    }

    if (phone_calls_to_achieve_appraisals != null && calls_per_person != null && calls_per_person > 0 && no_of_working_days_per_year != null && no_of_working_days_per_year > 0) {
      no_of_people_required = Math.ceil(phone_calls_to_achieve_appraisals / (calls_per_person * no_of_working_days_per_year));
    }

    if (salary_per_hour != null) {
      salary_per_day = Math.round(salary_per_hour * 8);
    }

    if (salary_per_day != null && no_of_people_required != null && no_of_working_days_per_year != null) {
      persons_salary = Math.round(salary_per_day * no_of_people_required * no_of_working_days_per_year);
    }

    if (cost_per_third_party_call != null && how_many_calls != null) {
      total_third_party_calls = Math.round(cost_per_third_party_call * how_many_calls);
    }

    if (how_many_appraisals != null && how_many_appraisals > 0) {
      total_cost_appraisals = Math.round(how_many_appraisals * how_many_appraisals);
    }

    if (gross_commission_target != null && marketing_expenses != null && persons_salary != null) {
      net_commission = Math.round(gross_commission_target - marketing_expenses - persons_salary);
    }

    setTargets(prev => ({
      ...prev,
      settled_sales_target,
      listings_target,
      appraisals_target,
      connects_for_appraisals,
      phone_calls_to_achieve_appraisals,
      calls_per_day,
      no_of_people_required,
      salary_per_day,
      persons_salary,
      total_third_party_calls,
      total_cost_appraisals,
      net_commission,
      commission_average,
      agent_commission,
      business_commission,
      avg_commission_per_sale: avg_commission_per_sale_updated
    }));
  }, [
    targets.gross_commission_target,
    targets.avg_commission_per_sale,
    targets.fall_over_rate,
    targets.connects_for_appraisal,
    targets.calls_for_connect,
    targets.appraisal_to_listing_ratio,
    targets.listing_to_written_ratio,
    targets.no_of_working_days_per_year,
    targets.calls_per_person,
    targets.salary_per_hour,
    targets.marketing_expenses,
    targets.cost_per_third_party_call,
    targets.how_many_calls,
    targets.how_many_appraisals,
    targets.avg_commission_price_per_property,
    targets.franchise_fee,
    targets.agent_percentage,
    targets.business_percentage
  ]);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load agents');
    }
  };

  const fetchBusinessPlan = async (agentId: string) => {
    if (!agentId) {
      toast.error('No agent selected');
      return;
    }
    
    setLoading(true);
    try {
      // Verify the user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('No active session. Please log in.');
      }

      const { data: planData, error: planError } = await supabase
        .from('agent_business_plan')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (planError) {
        if (planError.code === 'PGRST116') { // No rows found
          let agentName = '';
          if (isAdmin) {
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('name')
              .eq('id', agentId)
              .single();
            if (userError) {
              console.error('Error fetching user data:', userError);
              agentName = 'Unknown Agent';
            } else {
              agentName = userData?.name || 'Unknown Agent';
            }
          } else {
            agentName = user?.user_metadata?.full_name   || admin.name|| agent.name || 'Unknown Agent';
          }
          setTargets(prev => ({
            ...prev,
            agent_id: agentId,
            agent_name: agentName
          }));
          setAgentSearch(agentName);
          return;
        }
        throw planError;
      }

      if (planData) {
        let agentName = planData.agent_name || 'Unknown Agent';
        if (isAdmin && !planData.agent_name) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('name')
            .eq('id', agentId)
            .single();
          if (userError) {
            console.error('Error fetching user data:', userError);
          } else {
            agentName = userData?.name || 'Unknown Agent';
          }
        } else if (!isAdmin) {
          agentName = user?.user_metadata?.full_name || user?.email || 'Unknown Agent';
        }
        
        setTargets({
          ...planData,
          agent_id: agentId,
          agent_name: agentName,
          gross_commission_target: planData.gross_commission_target != null ? Math.round(planData.gross_commission_target) : null,
          avg_commission_per_sale: planData.avg_commission_per_sale != null ? Math.round(planData.avg_commission_per_sale) : null,
          salary_per_hour: planData.salary_per_hour != null ? planData.salary_per_hour : null,
          salary_per_day: planData.salary_per_day != null ? Math.round(planData.salary_per_day) : null,
          persons_salary: planData.persons_salary != null ? Math.round(planData.persons_salary) : null,
          marketing_expenses: planData.marketing_expenses != null ? Math.round(planData.marketing_expenses) : null,
          net_commission: planData.net_commission != null ? Math.round(planData.net_commission) : null,
          cost_per_third_party_call: planData.cost_per_third_party_call != null ? Math.round(planData.cost_per_third_party_call) : null,
          how_many_calls: planData.how_many_calls != null ? Math.round(planData.how_many_calls) : null,
          how_many_appraisals: planData.how_many_appraisals != null ? Math.round(planData.how_many_appraisals) : null,
          total_third_party_calls: planData.total_third_party_calls != null ? Math.round(planData.total_third_party_calls) : null,
          total_cost_appraisals: planData.total_cost_appraisals != null ? Math.round(planData.total_cost_appraisals) : null,
          avg_commission_price_per_property: planData.avg_commission_price_per_property != null ? Math.round(planData.avg_commission_price_per_property) : null,
          franchise_fee: planData.franchise_fee != null ? Math.round(planData.franchise_fee) : null,
          commission_average: planData.commission_average != null ? Math.round(planData.commission_average) : null,
          agent_percentage: planData.agent_percentage != null ? Math.round(planData.agent_percentage) : null,
          business_percentage: planData.business_percentage != null ? Math.round(planData.business_percentage) : null,
          agent_commission: planData.agent_commission != null ? Math.round(planData.agent_commission) : null,
          business_commission: planData.business_commission != null ? Math.round(planData.business_commission) : null
        });
        setAgentSearch(agentName);
      }
    } catch (error) {
      console.error('Error fetching business plan:', error);
      toast.error('Failed to load business plan: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedPlans = async () => {
    if (!user?.id && !isAdmin) {
      toast.error('Please log in to view saved plans');
      return;
    }
    
    setPlansLoading(true);
    try {
      const agentId = isAdmin ? targets.agent_id : user?.id;
      if (!agentId) {
        toast.error('Please select an agent to view saved plans');
        return;
      }

      const { data, error } = await supabase
        .from('agent_business_plans')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const plansWithAgentNames = await Promise.all(
        data?.map(async (plan) => {
          const agentData = await supabase
            .from('users')
            .select('name')
            .eq('id', plan.agent_id)
            .single();
          return {
            ...plan,
            agent_name: agentData.data?.name || plan.agent_name || 'Unknown Agent'
          };
        }) || []
      );

      setSavedPlans(plansWithAgentNames);
      setShowSavedPlans(true);
      if (plansWithAgentNames.length === 0) {
        toast('No saved plans found. Create a new plan to get started.', { 
          icon: 'ℹ️',
          duration: 4000
        });
      }
    } catch (error) {
      console.error('Error fetching saved plans:', error);
      toast.error('Failed to load saved plans: ' + (error.message || 'Unknown error'));
    } finally {
      setPlansLoading(false);
    }
  };

  const loadPlan = (plan: BusinessPlanTargets) => {
    setTargets({
      ...plan,
      agent_name: isAdmin ? plan.agent_name || 'Unknown Agent' : user?.user_metadata?.full_name || user?.email || 'Unknown Agent',
      gross_commission_target: plan.gross_commission_target != null ? Math.round(plan.gross_commission_target) : null,
      avg_commission_per_sale: plan.avg_commission_per_sale != null ? Math.round(plan.avg_commission_per_sale) : null,
      salary_per_hour: plan.salary_per_hour != null ? plan.salary_per_hour : null,
      salary_per_day: plan.salary_per_day != null ? Math.round(plan.salary_per_day) : null,
      persons_salary: plan.persons_salary != null ? Math.round(plan.persons_salary) : null,
      marketing_expenses: plan.marketing_expenses != null ? Math.round(plan.marketing_expenses) : null,
      net_commission: plan.net_commission != null ? Math.round(plan.net_commission) : null,
      cost_per_third_party_call: plan.cost_per_third_party_call != null ? Math.round(plan.cost_per_third_party_call) : null,
      how_many_calls: plan.how_many_calls != null ? Math.round(plan.how_many_calls) : null,
      how_many_appraisals: plan.how_many_appraisals != null ? Math.round(plan.how_many_appraisals) : null,
      total_third_party_calls: plan.total_third_party_calls != null ? Math.round(plan.total_third_party_calls) : null,
      total_cost_appraisals: plan.total_cost_appraisals != null ? Math.round(plan.total_cost_appraisals) : null,
      avg_commission_price_per_property: plan.avg_commission_price_per_property != null ? Math.round(plan.avg_commission_price_per_property) : null,
      franchise_fee: plan.franchise_fee != null ? Math.round(plan.franchise_fee) : null,
      commission_average: plan.commission_average != null ? Math.round(plan.commission_average) : null,
      agent_percentage: plan.agent_percentage != null ? Math.round(plan.agent_percentage) : null,
      business_percentage: plan.business_percentage != null ? Math.round(plan.business_percentage) : null,
      agent_commission: plan.agent_commission != null ? Math.round(plan.agent_commission) : null,
      business_commission: plan.business_commission != null ? Math.round(plan.business_commission) : null
    });
    setAgentSearch(plan.agent_name || '');
    setShowSavedPlans(false);
    toast.success('Plan loaded for editing');
  };

  const saveBusinessPlan = async () => {
    if (!user?.id && !isAdmin) {
      toast.error('Please log in to save a plan');
      return;
    }
    
    if (isAdmin && !targets.agent_id) {
      toast.error('Please select an agent before saving the plan');
      return;
    }

    if (!targets.agent_name) {
      toast.error('Agent name is required');
      return;
    }

    // Validate required fields
    if (!targets.gross_commission_target || !targets.avg_commission_price_per_property) {
      toast.error('Please fill in Gross Commission Target and Average Commission Price per Property');
      return;
    }

    setSaving(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('No active session. Please log in.');
      }

      let agentIdToUse = targets.agent_id;
      if (isAdmin && !agentIdToUse) {
        // If no agent_id, try to find or create based on agent_name
        const { data: agentData, error: agentError } = await supabase
          .from('users')
          .select('id')
          .eq('name', targets.agent_name)
          .single();
        if (agentError && agentError.code !== 'PGRST116') {
          throw agentError;
        }
        agentIdToUse = agentData?.id || (await createNewAgent(targets.agent_name)).id;
      }


      const planData = {
        ...targets,
        agent_id: isAdmin ? targets.agent_id : user?.id,
        agent_name: targets.agent_name,
        updated_at: new Date().toISOString(),
        gross_commission_target: targets.gross_commission_target != null ? Math.round(targets.gross_commission_target) : null,
        avg_commission_per_sale: targets.avg_commission_per_sale != null ? Math.round(targets.avg_commission_per_sale) : null,
        salary_per_hour: targets.salary_per_hour != null ? targets.salary_per_hour : null,
        salary_per_day: targets.salary_per_day != null ? Math.round(targets.salary_per_day) : null,
        persons_salary: targets.persons_salary != null ? Math.round(targets.persons_salary) : null,
        marketing_expenses: targets.marketing_expenses != null ? Math.round(targets.marketing_expenses) : null,
        net_commission: targets.net_commission != null ? Math.round(targets.net_commission) : null,
        cost_per_third_party_call: targets.cost_per_third_party_call != null ? Math.round(targets.cost_per_third_party_call) : null,
        how_many_calls: targets.how_many_calls != null ? Math.round(targets.how_many_calls) : null,
        how_many_appraisals: targets.how_many_appraisals != null ? Math.round(targets.how_many_appraisals) : null,
        total_third_party_calls: targets.total_third_party_calls != null ? Math.round(targets.total_third_party_calls) : null,
        total_cost_appraisals: targets.total_cost_appraisals != null ? Math.round(targets.total_cost_appraisals) : null,
        avg_commission_price_per_property: targets.avg_commission_price_per_property != null ? Math.round(targets.avg_commission_price_per_property) : null,
        franchise_fee: targets.franchise_fee != null ? Math.round(targets.franchise_fee) : null,
        commission_average: targets.commission_average != null ? Math.round(targets.commission_average) : null,
        agent_percentage: targets.agent_percentage != null ? Math.round(targets.agent_percentage) : null,
        business_percentage: targets.business_percentage != null ? Math.round(targets.business_percentage) : null,
        agent_commission: targets.agent_commission != null ? Math.round(targets.agent_commission) : null,
        business_commission: targets.business_commission != null ? Math.round(targets.business_commission) : null
      };

      let savedPlan: BusinessPlanTargets | null = null;

      if (targets.id) {
        const { data, error } = await supabase
          .from('agent_business_plan')
          .update(planData)
          .eq('id', targets.id)
          .eq('agent_id', planData.agent_id)
          .select()
          .single();
        
        if (error) {
          throw new Error(`Failed to update plan: ${error.message}`);
        }
        savedPlan = data;
        toast.success('Business plan updated successfully!');
      } else {
        const { data, error } = await supabase
          .from('agent_business_plan')
          .insert([{ ...planData, created_at: new Date().toISOString() }])
          .select()
          .single();
        
        if (error) {
          throw new Error(`Failed to create plan: ${error.message}`);
        }
        savedPlan = data;
        toast.success('Business plan created successfully!');
      }

      if (savedPlan) {
        setTargets({
          ...savedPlan,
          agent_name: isAdmin ? savedPlan.agent_name || 'Unknown Agent' : user?.user_metadata?.full_name || user?.email || 'Unknown Agent',
          gross_commission_target: savedPlan.gross_commission_target != null ? Math.round(savedPlan.gross_commission_target) : null,
          avg_commission_per_sale: savedPlan.avg_commission_per_sale != null ? Math.round(savedPlan.avg_commission_per_sale) : null,
          salary_per_hour: savedPlan.salary_per_hour != null ? savedPlan.salary_per_hour : null,
          salary_per_day: savedPlan.salary_per_day != null ? Math.round(savedPlan.salary_per_day) : null,
          persons_salary: savedPlan.persons_salary != null ? Math.round(savedPlan.persons_salary) : null,
          marketing_expenses: savedPlan.marketing_expenses != null ? Math.round(savedPlan.marketing_expenses) : null,
          net_commission: savedPlan.net_commission != null ? Math.round(savedPlan.net_commission) : null,
          cost_per_third_party_call: savedPlan.cost_per_third_party_call != null ? Math.round(savedPlan.cost_per_third_party_call) : null,
          how_many_calls: savedPlan.how_many_calls != null ? Math.round(savedPlan.how_many_calls) : null,
          how_many_appraisals: savedPlan.how_many_appraisals != null ? Math.round(savedPlan.how_many_appraisals) : null,
          total_third_party_calls: savedPlan.total_third_party_calls != null ? Math.round(savedPlan.total_third_party_calls) : null,
          total_cost_appraisals: savedPlan.total_cost_appraisals != null ? Math.round(savedPlan.total_cost_appraisals) : null,
          avg_commission_price_per_property: savedPlan.avg_commission_price_per_property != null ? Math.round(savedPlan.avg_commission_price_per_property) : null,
          franchise_fee: savedPlan.franchise_fee != null ? Math.round(savedPlan.franchise_fee) : null,
          commission_average: savedPlan.commission_average != null ? Math.round(savedPlan.commission_average) : null,
          agent_percentage: savedPlan.agent_percentage != null ? Math.round(savedPlan.agent_percentage) : null,
          business_percentage: savedPlan.business_percentage != null ? Math.round(savedPlan.business_percentage) : null,
          agent_commission: savedPlan.agent_commission != null ? Math.round(savedPlan.agent_commission) : null,
          business_commission: savedPlan.business_commission != null ? Math.round(savedPlan.business_commission) : null
        });
        setAgentSearch(savedPlan.agent_name || '');
        setShowSaveConfirmation(true);
      }
    } catch (error) {
      console.error('Error saving business plan:', error);
      toast.error('Failed to save business plan: ' + (error.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };
  const createNewAgent = async (agentName: string) => {
    const { data, error } = await supabase
      .from('users')
      .insert([{ name: agentName, email: `${agentName.toLowerCase().replace(/ /g, '.')}@example.com` }])
      .select()
      .single();
    if (error) throw error;
    return data;
  };

  const deleteBusinessPlan = async () => {
    if (!targets.id || (!user?.id && !isAdmin)) {
      toast.error('No plan to delete');
      return;
    }
    
    setDeleting(true);
    try {
      const agentId = isAdmin ? targets.agent_id : user?.id;
      const { error } = await supabase
        .from('agent_business_plans')
        .delete()
        .eq('id', targets.id)
        .eq('agent_id', agentId);
      
      if (error) {
        throw new Error(`Failed to delete plan: ${error.message}`);
      }
      
      setTargets({
        agent_id: isAdmin ? '' : user?.id || '',
        agent_name: isAdmin ? '' : user?.user_metadata?.full_name || user?.email || 'Unknown Agent',
        period_type: 'yearly',
        appraisals_target: null,
        listings_target: null,
        settled_sales_target: null,
        gross_commission_target: null,
        connects_for_appraisals: null,
        phone_calls_to_achieve_appraisals: null,
        appraisal_to_listing_ratio: null,
        listing_to_written_ratio: null,
        fall_over_rate: null,
        avg_commission_per_sale: null,
        connects_for_appraisal: null,
        calls_for_connect: null,
        no_of_working_days_per_year: null,
        calls_per_day: null,
        calls_per_person: null,
        no_of_people_required: null,
        salary_per_hour: null,
        salary_per_day: null,
        marketing_expenses: null,
        persons_salary: null,
        net_commission: null,
        cost_per_third_party_call: null,
        how_many_calls: null,
        how_many_appraisals: null,
        total_third_party_calls: null,
        total_cost_appraisals: null,
        avg_commission_price_per_property: null,
        franchise_fee: null,
        commission_average: null,
        agent_percentage: null,
        business_percentage: null,
        agent_commission: null,
        business_commission: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      setAgentSearch('');
      toast.success('Business plan deleted successfully!');
    } catch (error) {
      console.error('Error deleting business plan:', error);
      toast.error('Failed to delete business plan: ' + (error.message || 'Unknown error'));
    } finally {
      setDeleting(false);
    }
  };

  const generatePDF = async (forView = false) => {
    setGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      let yOffset = margin;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);

      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('Helvetica', 'bold');
      doc.text('Agent Business Plan', margin, yOffset + 7);
      doc.setFontSize(7);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin - 45, yOffset + 7);
      yOffset += 25;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(219, 234, 254);
      doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
      doc.text('Agent Information', margin + 3, yOffset + 5);
      yOffset += 10;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.autoTable({
        startY: yOffset,
        head: [['Field', 'Value']],
        body: [
          ['Agent Name', targets.agent_name || 'N/A']
        ],
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 50, halign: 'left' }, 1: { cellWidth: 90, halign: 'center' } },
        margin: { left: margin, right: margin }
      });
      yOffset = doc.lastAutoTable.finalY + 10;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(219, 234, 254);
      doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
      doc.text('Commission Structure', margin + 3, yOffset + 5);
      yOffset += 10;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.autoTable({
        startY: yOffset,
        head: [['Field', 'Value']],
        body: [
          ['Average Commission Price per Property', targets.avg_commission_price_per_property != null ? `$${Math.round(targets.avg_commission_price_per_property).toLocaleString()}` : 'N/A'],
          ['Franchise Fee', targets.franchise_fee != null ? `${Math.round(targets.franchise_fee)}%` : 'N/A'],
          ['Commission Average', targets.commission_average != null ? `$${Math.round(targets.commission_average).toLocaleString()}` : 'N/A'],
          ['Agent Percentage', targets.agent_percentage != null ? `${Math.round(targets.agent_percentage)}%` : 'N/A'],
          ['Business Percentage', targets.business_percentage != null ? `${Math.round(targets.business_percentage)}%` : 'N/A'],
          ['Agent Commission', targets.agent_commission != null ? `$${Math.round(targets.agent_commission).toLocaleString()}` : 'N/A'],
          ['Business Commission', targets.business_commission != null ? `$${Math.round(targets.business_commission).toLocaleString()}` : 'N/A']
        ],
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 50, halign: 'left' }, 1: { cellWidth: 90, halign: 'center' } },
        margin: { left: margin, right: margin }
      });
      yOffset = doc.lastAutoTable.finalY + 10;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(219, 234, 254);
      doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
      doc.text('Targets', margin + 3, yOffset + 5);
      yOffset += 10;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.autoTable({
        startY: yOffset,
        head: [['Field', 'Value']],
        body: [
          ['Gross Commission Target', targets.gross_commission_target != null ? `$${Math.round(targets.gross_commission_target).toLocaleString()}` : 'N/A'],
          ['Average Commission Per Sale', targets.avg_commission_per_sale != null ? `$${Math.round(targets.avg_commission_per_sale).toLocaleString()}` : 'N/A'],
          ['Settled Sales', targets.settled_sales_target != null ? Math.round(targets.settled_sales_target).toLocaleString() : 'N/A'],
          ['Listings', targets.listings_target != null ? Math.round(targets.listings_target).toLocaleString() : 'N/A'],
          ['Appraisals', targets.appraisals_target != null ? Math.round(targets.appraisals_target).toLocaleString() : 'N/A'],
          ['Connects for Appraisals', targets.connects_for_appraisals != null ? Math.round(targets.connects_for_appraisals).toLocaleString() : 'N/A'],
          ['Phone Calls to Achieve Appraisals', targets.phone_calls_to_achieve_appraisals != null ? Math.round(targets.phone_calls_to_achieve_appraisals).toLocaleString() : 'N/A'],
          ['Calls per Day', targets.calls_per_day != null ? Math.round(targets.calls_per_day).toLocaleString() : 'N/A'],
          ['Working Days per Year', targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year).toLocaleString() : 'N/A'],
          ['Calls per Person', targets.calls_per_person != null ? Math.round(targets.calls_per_person).toLocaleString() : 'N/A'],
          ['Number of People Required', targets.no_of_people_required != null ? Math.round(targets.no_of_people_required).toLocaleString() : 'N/A'],
          ['Salary per Hour', targets.salary_per_hour != null ? `$${targets.salary_per_hour.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'],
          ['Salary per Day', targets.salary_per_day != null ? `$${Math.round(targets.salary_per_day).toLocaleString()}` : 'N/A'],
          ['Persons Salary', targets.persons_salary != null ? `$${Math.round(targets.persons_salary).toLocaleString()}` : 'N/A'],
          ['Marketing Expenses', targets.marketing_expenses != null ? `$${Math.round(targets.marketing_expenses).toLocaleString()}` : 'N/A'],
          ['Cost per Third Party Call', targets.cost_per_third_party_call != null ? `$${Math.round(targets.cost_per_third_party_call).toLocaleString()}` : 'N/A'],
          ['How Many Calls', targets.how_many_calls != null ? Math.round(targets.how_many_calls).toLocaleString() : 'N/A'],
          ['How Many Appraisals', targets.how_many_appraisals != null ? Math.round(targets.how_many_appraisals).toLocaleString() : 'N/A'],
          ['Total Third Party Calls', targets.total_third_party_calls != null ? `$${Math.round(targets.total_third_party_calls).toLocaleString()}` : 'N/A'],
          ['Total Cost for Appraisals', targets.total_cost_appraisals != null ? `$${Math.round(targets.total_cost_appraisals).toLocaleString()}` : 'N/A'],
          ['Net Commission', targets.net_commission != null ? `$${Math.round(targets.net_commission).toLocaleString()}` : 'N/A']
        ],
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 50, halign: 'left' }, 1: { cellWidth: 90, halign: 'center' } },
        margin: { left: margin, right: margin }
      });
      yOffset = doc.lastAutoTable.finalY + 10;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(219, 234, 254);
      doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
      doc.text('Performance Ratios', margin + 3, yOffset + 5);
      yOffset += 10;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.autoTable({
        startY: yOffset,
        head: [['Field', 'Value']],
        body: [
          ['Fall Over Rate', targets.fall_over_rate != null ? `${Math.round(targets.fall_over_rate)}%` : 'N/A'],
          ['Appraisal to Listing Ratio', targets.appraisal_to_listing_ratio != null ? `${Math.round(targets.appraisal_to_listing_ratio)}%` : 'N/A'],
          ['Listing to Written Ratio', targets.listing_to_written_ratio != null ? `${Math.round(targets.listing_to_written_ratio)}%` : 'N/A'],
          ['Connects for Appraisal', targets.connects_for_appraisal != null ? Math.round(targets.connects_for_appraisal).toLocaleString() : 'N/A'],
          ['Calls for Connect', targets.calls_for_connect != null ? Math.round(targets.calls_for_connect).toLocaleString() : 'N/A'],
          ['Working Days per Year', targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year).toLocaleString() : 'N/A']
        ],
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 50, halign: 'left' }, 1: { cellWidth: 90, halign: 'center' } },
        margin: { left: margin, right: margin }
      });
      yOffset = doc.lastAutoTable.finalY + 10;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setFillColor(219, 234, 254);
      doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
      doc.text('Metadata', margin + 3, yOffset + 5);
      yOffset += 10;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      doc.autoTable({
        startY: yOffset,
        head: [['Field', 'Value']],
        body: [
          ['Created At', targets.created_at || 'N/A'],
          ['Updated At', targets.updated_at || 'N/A']
        ],
        theme: 'striped',
        styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: 50, halign: 'left' }, 1: { cellWidth: 90, halign: 'center' } },
        margin: { left: margin, right: margin }
      });

      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page 1 of 1`, pageWidth - margin - 15, pageHeight - margin);
      doc.text('Generated by RealRed', margin, pageHeight - margin);

      if (forView) {
        const pdfDataUri = doc.output('datauristring');
        setPdfDataUri(pdfDataUri);
        toast.success('PDF generated for viewing!');
      } else {
        doc.save(`business_plan_${new Date().toISOString().split('T')[0]}_${targets.agent_name || 'agent'}.pdf`);
        toast.success('PDF downloaded successfully!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF: ' + (error.message || 'Unknown error'));
    } finally {
      setGenerating(false);
    }
  };

  const viewPlan = () => {
    if (!targets.agent_name || !targets.gross_commission_target) {
      toast.error('Please fill in Agent Name and Gross Commission Target to view the plan');
      return;
    }
    setShowPlan(true);
    setViewMode('pdf');
    generatePDF(true);
  };

  const downloadPlan = () => {
    if (!targets.agent_name || !targets.gross_commission_target) {
      toast.error('Please fill in Agent Name and Gross Commission Target to download the plan');
      return;
    }
    generatePDF(false);
  };

  const resetToDefaults = () => {
    setTargets({
      agent_id: isAdmin ? '' : user?.id || '',
      agent_name: isAdmin ? '' : user?.user_metadata?.full_name || user?.email || 'Unknown Agent',
      period_type: 'yearly',
      appraisals_target: null,
      listings_target: null,
      settled_sales_target: null,
      gross_commission_target: null,
      connects_for_appraisals: null,
      phone_calls_to_achieve_appraisals: null,
      appraisal_to_listing_ratio: null,
      listing_to_written_ratio: null,
      fall_over_rate: null,
      avg_commission_per_sale: null,
      connects_for_appraisal: null,
      calls_for_connect: null,
      no_of_working_days_per_year: null,
      calls_per_day: null,
      calls_per_person: null,
      no_of_people_required: null,
      salary_per_hour: null,
      salary_per_day: null,
      marketing_expenses: null,
      persons_salary: null,
      net_commission: null,
      cost_per_third_party_call: null,
      how_many_calls: null,
      how_many_appraisals: null,
      total_third_party_calls: null,
      total_cost_appraisals: null,
      avg_commission_price_per_property: null,
      franchise_fee: null,
      commission_average: null,
      agent_percentage: null,
      business_percentage: null,
      agent_commission: null,
      business_commission: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setAgentSearch('');
    toast.success('Form reset to defaults');
  };

  const handleAgentSelect = (agent: Agent) => {
    setTargets(prev => ({
      ...prev,
      agent_id: agent.id,
      agent_name: agent.name
    }));
    setAgentSearch(agent.name);
    setShowAgentSuggestions(false);
    fetchBusinessPlan(agent.id);
  };
   const handleManualAgentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAgentSearch(value);
    setTargets(prev => ({
      ...prev,
      agent_name: value
    }));
    setShowAgentSuggestions(true); // Show suggestions if they match
  };

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(agentSearch.toLowerCase())
  );

  const chartData = [
    { name: 'Appraisals', value: targets.appraisals_target, fill: '#1E3A8A' },
    { name: 'Listings', value: targets.listings_target, fill: '#3B82F6' },
    { name: 'Settled Sales', value: targets.settled_sales_target, fill: '#93C5FD' },
    { name: 'Connects', value: targets.connects_for_appraisals, fill: '#BFDBFE' },
    { name: 'Phone Calls', value: targets.phone_calls_to_achieve_appraisals, fill: '#DBEAFE' },
    { name: 'Calls/Day', value: targets.calls_per_day, fill: '#1E90FF' },
    { name: 'Gross Commission', value: targets.gross_commission_target, fill: '#2563EB' },
    { name: 'Working Days/Yr', value: targets.no_of_working_days_per_year, fill: '#1E40AF' },
    { name: 'Calls/Person', value: targets.calls_per_person, fill: '#1E90FF' },
    { name: 'Persons Salary', value: targets.persons_salary, fill: '#1D4ED8' },
    { name: 'Third Party Calls', value: targets.total_third_party_calls, fill: '#1E90FF' },
    { name: 'Total Cost Appraisals', value: targets.total_cost_appraisals, fill: '#1D4ED8' },
    { name: 'Net Commission', value: targets.net_commission, fill: '#3B82F6' },
    { name: 'Agent Commission', value: targets.agent_commission, fill: '#1E90FF' },
    { name: 'Business Commission', value: targets.business_commission, fill: '#2563EB' }
  ].filter(item => item.value != null);

  const progressData = [
    { 
      name: 'Gross Commission', 
      target: targets.gross_commission_target, 
      current: targets.gross_commission_target ? Math.round(targets.gross_commission_target * 0.5) : null, 
      isCurrency: true 
    },
    { 
      name: 'Settled Sales', 
      target: targets.settled_sales_target, 
      current: targets.settled_sales_target ? Math.round(targets.settled_sales_target * 0.5) : null, 
      isCurrency: false 
    },
    { 
      name: 'Listings', 
      target: targets.listings_target, 
      current: targets.listings_target ? Math.round(targets.listings_target * 0.5) : null, 
      isCurrency: false 
    },
    { 
      name: 'Appraisals', 
      target: targets.appraisals_target, 
      current: targets.appraisals_target ? Math.round(targets.appraisals_target * 0.5) : null, 
      isCurrency: false 
    }
  ].filter(item => item.target != null);

  const targetCards = [
    { 
      title: 'Gross Commission Target', 
      value: targets.gross_commission_target ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'gross_commission_target',
      isReadOnly: false
    },
    { 
      title: 'Average Commission Per Sale', 
      value: targets.avg_commission_per_sale ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50', 
      isCurrency: true,
      field: 'avg_commission_per_sale',
      isReadOnly: true
    },
    { 
      title: 'Settled Sales Target', 
      value: targets.settled_sales_target ?? '', 
      icon: CheckCircle, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'settled_sales_target',
      isReadOnly: true
    },
    { 
      title: 'Listings Target', 
      value: targets.listings_target ?? '', 
      icon: FileText, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'listings_target',
      isReadOnly: true
    },
    { 
      title: 'Appraisals Target', 
      value: targets.appraisals_target ?? '', 
      icon: Home, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'appraisals_target',
      isReadOnly: true
    },
    { 
      title: 'Connects for Appraisals', 
      value: targets.connects_for_appraisals ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'connects_for_appraisals',
      isReadOnly: true
    },
    { 
      title: 'Phone Calls to Achieve Appraisals', 
      value: targets.phone_calls_to_achieve_appraisals ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'phone_calls_to_achieve_appraisals',
      isReadOnly: true
    },
    { 
      title: 'Calls per Day', 
      value: targets.calls_per_day ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'calls_per_day',
      isReadOnly: true
    },
    { 
      title: 'Calls per Person', 
      value: targets.calls_per_person ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'calls_per_person',
      isReadOnly: false
    },
    { 
      title: 'Number of People Required', 
      value: targets.no_of_people_required ?? '', 
      icon: Target, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'no_of_people_required',
      isReadOnly: true
    },
    { 
      title: 'Salary per Hour', 
      value: targets.salary_per_hour ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'salary_per_hour',
      isReadOnly: false,
      isFloat: true,
      step: 0.5
    },
    { 
      title: 'Salary per Day', 
      value: targets.salary_per_day ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'salary_per_day',
      isReadOnly: true
    },
    { 
      title: 'Persons Salary', 
      value: targets.persons_salary ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'persons_salary',
      isReadOnly: true
    },
    { 
      title: 'Marketing Expenses', 
      value: targets.marketing_expenses ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'marketing_expenses',
      isReadOnly: false
    },
    { 
      title: 'Cost per Third Party Call', 
      value: targets.cost_per_third_party_call ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'cost_per_third_party_call',
      isReadOnly: false
    },
    { 
      title: 'How Many Calls', 
      value: targets.how_many_calls ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'how_many_calls',
      isReadOnly: false
    },
    { 
      title: 'How Many Appraisals', 
      value: targets.how_many_appraisals ?? '', 
      icon: Home, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      field: 'how_many_appraisals',
      isReadOnly: false
    },
    { 
      title: 'Total Third Party Calls', 
      value: targets.total_third_party_calls ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'total_third_party_calls',
      isReadOnly: true
    },
    { 
      title: 'Total Cost for Appraisals', 
      value: targets.total_cost_appraisals ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'total_cost_appraisals',
      isReadOnly: true
    },
    { 
      title: 'Net Commission', 
      value: targets.net_commission ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50',
      isCurrency: true,
      field: 'net_commission',
      isReadOnly: true
    }
  ];

  const commissionCards = [
    { 
      title: 'Average Commission Price per Property', 
      value: targets.avg_commission_price_per_property ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50', 
      isCurrency: true,
      field: 'avg_commission_price_per_property',
      isReadOnly: false
    },
    { 
      title: 'Franchise Fee', 
      value: targets.franchise_fee ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50', 
      isCurrency: false,
      field: 'franchise_fee',
      isReadOnly: false,
      isPercentage: true
    },
    { 
      title: 'Commission Average', 
      value: targets.commission_average ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50', 
      isCurrency: true,
      field: 'commission_average',
      isReadOnly: true
    },
    { 
      title: 'Agent Percentage', 
      value: targets.agent_percentage ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50', 
      isCurrency: false,
      field: 'agent_percentage',
      isReadOnly: false,
      isPercentage: true
    },
    { 
      title: 'Business Percentage', 
      value: targets.business_percentage ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50', 
      isCurrency: false,
      field: 'business_percentage',
      isReadOnly: false,
      isPercentage: true
    },
    { 
      title: 'Agent Commission', 
      value: targets.agent_commission ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50', 
      isCurrency: true,
      field: 'agent_commission',
      isReadOnly: true
    },
    { 
      title: 'Business Commission', 
      value: targets.business_commission ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-50', 
      isCurrency: true,
      field: 'business_commission',
      isReadOnly: true
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-blue-900 flex items-center">
                <Target className="w-8 h-8 mr-3 text-blue-600" />
                Agent Business Plan
              </h1>
              <p className="text-blue-600 mt-2">Configure and manage your dynamic business targets</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/admin-dashboard')}
                className="flex items-center px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                Back to Dashboard
              </button>
              <button
                onClick={resetToDefaults}
                className="flex items-center px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </button>
              <button
                onClick={saveBusinessPlan}
                disabled={saving}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : targets.id ? 'Update Plan' : 'Save Plan'}
              </button>
              <button
                onClick={deleteBusinessPlan}
                disabled={deleting || !targets.id}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {deleting ? 'Deleting...' : 'Delete Plan'}
              </button>
              <button
                onClick={downloadPlan}
                disabled={generating}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                <Download className="w-4 h-4 mr-2" />
                {generating ? 'Generating PDF...' : 'Download PDF'}
              </button>
              <button
                onClick={viewPlan}
                disabled={generating}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                <Eye className="w-4 h-4 mr-2" />
                {generating ? 'Generating PDF...' : 'View Plan'}
              </button>
              <button
                onClick={fetchSavedPlans}
                disabled={plansLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              >
                <List className="w-4 h-4 mr-2" />
                {plansLoading ? 'Loading Plans...' : 'Saved Plans'}
              </button>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {showSavedPlans && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-blue-900 flex items-center">
                    <List className="w-6 h-6 mr-2 text-blue-600" />
                    Saved Business Plans
                  </h2>
                  <button
                    onClick={() => setShowSavedPlans(false)}
                    className="p-2 rounded-full hover:bg-blue-100"
                  >
                    <X className="w-5 h-5 text-blue-600" />
                  </button>
                </div>
                {plansLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : savedPlans.length === 0 ? (
                  <div className="text-blue-600 text-center">
                    <p className="mb-4">No saved plans found.</p>
                    <p>Create a new plan using the form and click "Save Plan" to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedPlans.map((plan) => (
                      <div key={plan.id} className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200 flex justify-between items-center">
                        <div>
                          <p className="text-blue-800 font-medium">
                            Plan created on {new Date(plan.created_at || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                          <p className="text-blue-600">
                            Agent: {plan.agent_name || 'N/A'}
                          </p>
                          <p className="text-blue-600">
                            Gross Commission: {plan.gross_commission_target ? `$${Math.round(plan.gross_commission_target).toLocaleString()}` : 'N/A'}
                          </p>
                          <p className="text-blue-600">
                            Period: {plan.period_type.charAt(0).toUpperCase() + plan.period_type.slice(1)}
                          </p>
                        </div>
                        <button
                          onClick={() => loadPlan(plan)}
                          className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Edit Plan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSaveConfirmation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-blue-900 flex items-center">
                    <CheckCircle className="w-6 h-6 mr-2 text-blue-600" />
                    Plan Saved Successfully
                  </h2>
                  <button
                    onClick={() => setShowSaveConfirmation(false)}
                    className="p-2 rounded-full hover:bg-blue-100"
                  >
                    <X className="w-5 h-5 text-blue-600" />
                  </button>
                </div>
                <p className="text-blue-600 mb-4">
                  Your business plan has been {targets.id ? 'updated' : 'created'} successfully for {targets.agent_name}.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowSaveConfirmation(false);
                      viewPlan();
                    }}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Plan
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveConfirmation(false);
                      downloadPlan();
                    }}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPlan && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            >
              <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-blue-900 flex items-center">
                    <FileText className="w-6 h-6 mr-2 text-blue-600" />
                    Business Plan {viewMode === 'pdf' ? 'Preview' : 'Details'}
                  </h2>
                  <div className="flex space-x-2">
                    {viewMode === 'pdf' && (
                      <button
                        onClick={() => setViewMode('details')}
                        className="px-3 py-1 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        Back to Details
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowPlan(false);
                        setViewMode('details');
                        setPdfDataUri(null);
                      }}
                      className="p-2 rounded-full hover:bg-blue-100"
                    >
                      <X className="w-5 h-5 text-blue-600" />
                    </button>
                  </div>
                </div>
                {viewMode === 'pdf' ? (
                  <div className="h-[70vh]">
                    {pdfDataUri ? (
                      <embed
                        src={pdfDataUri}
                        type="application/pdf"
                        width="100%"
                        height="100%"
                        className="border border-blue-200 rounded-lg"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Disclosure defaultOpen>
                      {({ open }) => (
                        <>
                          <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none">
                            <span>Agent Information</span>
                            <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </Disclosure.Button>
                          <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-600">
                            <p><strong>Agent Name:</strong> {targets.agent_name || 'N/A'}</p>
                          </Disclosure.Panel>
                        </>
                      )}
                    </Disclosure>
                    <Disclosure defaultOpen>
                      {({ open }) => (
                        <>
                          <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none">
                            <span>Commission Structure</span>
                            <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </Disclosure.Button>
                          <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-600">
                            <p><strong>Average Commission Price per Property:</strong> {targets.avg_commission_price_per_property != null ? `$${Math.round(targets.avg_commission_price_per_property).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Franchise Fee:</strong> {targets.franchise_fee != null ? `${Math.round(targets.franchise_fee)}%` : 'N/A'}</p>
                            <p><strong>Commission Average:</strong> {targets.commission_average != null ? `$${Math.round(targets.commission_average).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Agent Percentage:</strong> {targets.agent_percentage != null ? `${Math.round(targets.agent_percentage)}%` : 'N/A'}</p>
                            <p><strong>Business Percentage:</strong> {targets.business_percentage != null ? `${Math.round(targets.business_percentage)}%` : 'N/A'}</p>
                            <p><strong>Agent Commission:</strong> {targets.agent_commission != null ? `$${Math.round(targets.agent_commission).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Business Commission:</strong> {targets.business_commission != null ? `$${Math.round(targets.business_commission).toLocaleString()}` : 'N/A'}</p>
                          </Disclosure.Panel>
                        </>
                      )}
                    </Disclosure>
                    <Disclosure defaultOpen>
                      {({ open }) => (
                        <>
                          <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none">
                            <span>Targets</span>
                            <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </Disclosure.Button>
                          <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-600">
                            <p><strong>Gross Commission Target:</strong> {targets.gross_commission_target != null ? `$${Math.round(targets.gross_commission_target).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Average Commission Per Sale:</strong> {targets.avg_commission_per_sale != null ? `$${Math.round(targets.avg_commission_per_sale).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Settled Sales:</strong> {targets.settled_sales_target != null ? Math.round(targets.settled_sales_target).toLocaleString() : 'N/A'}</p>
                            <p><strong>Listings:</strong> {targets.listings_target != null ? Math.round(targets.listings_target).toLocaleString() : 'N/A'}</p>
                            <p><strong>Appraisals:</strong> {targets.appraisals_target != null ? Math.round(targets.appraisals_target).toLocaleString() : 'N/A'}</p>
                            <p><strong>Connects for Appraisals:</strong> {targets.connects_for_appraisals != null ? Math.round(targets.connects_for_appraisals).toLocaleString() : 'N/A'}</p>
                            <p><strong>Phone Calls to Achieve Appraisals:</strong> {targets.phone_calls_to_achieve_appraisals != null ? Math.round(targets.phone_calls_to_achieve_appraisals).toLocaleString() : 'N/A'}</p>
                            <p><strong>Calls per Day:</strong> {targets.calls_per_day != null ? Math.round(targets.calls_per_day).toLocaleString() : 'N/A'}</p>
                            <p><strong>Working Days per Year:</strong> {targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year).toLocaleString() : 'N/A'}</p>
                            <p><strong>Calls per Person:</strong> {targets.calls_per_person != null ? Math.round(targets.calls_per_person).toLocaleString() : 'N/A'}</p>
                            <p><strong>Number of People Required:</strong> {targets.no_of_people_required != null ? Math.round(targets.no_of_people_required).toLocaleString() : 'N/A'}</p>
                            <p><strong>Salary per Hour:</strong> {targets.salary_per_hour != null ? `$${targets.salary_per_hour.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</p>
                            <p><strong>Salary per Day:</strong> {targets.salary_per_day != null ? `$${Math.round(targets.salary_per_day).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Persons Salary:</strong> {targets.persons_salary != null ? `$${Math.round(targets.persons_salary).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Marketing Expenses:</strong> {targets.marketing_expenses != null ? `$${Math.round(targets.marketing_expenses).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Cost per Third Party Call:</strong> {targets.cost_per_third_party_call != null ? `$${Math.round(targets.cost_per_third_party_call).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>How Many Calls:</strong> {targets.how_many_calls != null ? Math.round(targets.how_many_calls).toLocaleString() : 'N/A'}</p>
                            <p><strong>How Many Appraisals:</strong> {targets.how_many_appraisals != null ? Math.round(targets.how_many_appraisals).toLocaleString() : 'N/A'}</p>
                            <p><strong>Total Third Party Calls:</strong> {targets.total_third_party_calls != null ? `$${Math.round(targets.total_third_party_calls).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Total Cost for Appraisals:</strong> {targets.total_cost_appraisals != null ? `$${Math.round(targets.total_cost_appraisals).toLocaleString()}` : 'N/A'}</p>
                            <p><strong>Net Commission:</strong> {targets.net_commission != null ? `$${Math.round(targets.net_commission).toLocaleString()}` : 'N/A'}</p>
                          </Disclosure.Panel>
                        </>
                      )}
                    </Disclosure>
                    <Disclosure defaultOpen>
                      {({ open }) => (
                        <>
                          <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-50 rounded-lg hover:bg-blue-100 focus:outline-none">
                            <span>Chart</span>
                            <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-600`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </Disclosure.Button>
                          <Disclosure.Panel className="px-4 pt-4 pb-2">
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} />
                                  <YAxis />
                                  <Tooltip formatter={(value) => (value ? Number(value).toLocaleString() : 'N/A')} />
                                  <Legend />
                                  <Bar dataKey="value" name="Metrics">
                                    <LabelList dataKey="value" position="top" formatter={(value: number) => (value ? Number(value).toLocaleString() : 'N/A')} />
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </Disclosure.Panel>
                        </>
                      )}
                    </Disclosure>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
            <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
              <Settings className="w-5 h-5 mr-2 text-blue-600" />
              Agent Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-blue-700">Agent Name</label>
                {isAdmin ? (
                  <>
                    <input
                      type="text"
                      value={agentSearch}
                      // onChange={(e) => {
                      onChange={handleManualAgentChange}
                      onFocus={() => setShowAgentSuggestions(true)}
                      className="mt-1 w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-100 text-blue-800"
                      placeholder="Search for an agent"
                    />
                    {showAgentSuggestions && agentSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-blue-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredAgents.length > 0 ? (
                          filteredAgents.map(agent => (
                            <div
                              key={agent.id}
                              className="px-3 py-2 hover:bg-blue-100 cursor-pointer text-blue-800"
                              onClick={() => handleAgentSelect(agent)}
                            >
                              {agent.name}
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-blue-600">No agents found</div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    value={targets.agent_name || ''}
                    disabled
                    className="mt-1 w-full px-3 py-2 border border-blue-300 rounded-lg bg-blue-200 text-blue-800 cursor-not-allowed"
                    placeholder="Agent name"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-blue-700">Period Type</label>
                <select
                  value={targets.period_type}
                  onChange={(e) => setTargets({ ...targets, period_type: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' })}
                  className="mt-1 w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-100 text-blue-800"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
            <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
              Commission Structure
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {commissionCards.map((card, index) => (
                <div key={index} className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <card.icon className={`w-5 h-5 mr-2 text-blue-600`} />
                      <span className="text-sm font-medium text-blue-800">{card.title}</span>
                    </div>
                    <span className="text-sm text-blue-600">
                      {card.value != null
                        ? card.isCurrency
                          ? `$${Math.round(Number(card.value)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : card.isPercentage
                          ? `${Math.round(Number(card.value))}%`
                          : Math.round(Number(card.value)).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step={card.isPercentage ? 0.01 : 1}
                    value={card.value ?? ''}
                    onChange={(e) => {
                      if (card.isReadOnly) return;
                      const value = e.target.value === '' ? null : Math.round(parseFloat(e.target.value));
                      setTargets({ ...targets, [card.field]: value });
                    }}
                    disabled={card.isReadOnly}
                    className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-100 text-blue-800 disabled:bg-blue-200 disabled:cursor-not-allowed"
                    placeholder={`Enter ${card.title.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
            <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-blue-600" />
              Performance Ratios
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <RatioInput
                label="Fall Over Rate"
                value={targets.fall_over_rate ?? ''}
                onChange={(value) => setTargets({ ...targets, fall_over_rate: value })}
                min={0}
                step={1}
                suffix="%"
                tooltip="Percentage of listings that fail to convert to sales."
              />
              <RatioInput
                label="Appraisal to Listing Ratio"
                value={targets.appraisal_to_listing_ratio ?? ''}
                onChange={(value) => setTargets({ ...targets, appraisal_to_listing_ratio: value })}
                min={0}
                step={1}
                suffix="%"
                tooltip="Percentage of appraisals that result in listings."
              />
              <RatioInput
                label="Listing to Written Ratio"
                value={targets.listing_to_written_ratio ?? ''}
                onChange={(value) => setTargets({ ...targets, listing_to_written_ratio: value })}
                min={0}
                step={1}
                suffix="%"
                tooltip="Percentage of listings that convert to written sales."
              />
              <RatioInput
                label="Connects for Appraisal"
                value={targets.connects_for_appraisal ?? ''}
                onChange={(value) => setTargets({ ...targets, connects_for_appraisal: value })}
                min={0}
                step={1}
                suffix=""
                tooltip="Number of connects needed to secure one appraisal."
              />
              <RatioInput
                label="Calls for Connect"
                value={targets.calls_for_connect ?? ''}
                onChange={(value) => setTargets({ ...targets, calls_for_connect: value })}
                min={0}
                step={1}
                suffix=""
                tooltip="Number of calls needed to achieve one connect."
              />
              <RatioInput
                label="Working Days per Year"
                value={targets.no_of_working_days_per_year ?? ''}
                onChange={(value) => setTargets({ ...targets, no_of_working_days_per_year: value })}
                min={0}
                step={1}
                suffix=""
                tooltip="Total number of working days in a year."
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
            <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
              <Target className="w-5 h-5 mr-2 text-blue-600" />
              Targets
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {targetCards.map((card, index) => (
                <div key={index} className={`p-4 rounded-lg shadow-sm border border-blue-200 ${card.bgColor}`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      <card.icon className={`w-5 h-5 mr-2 text-blue-600`} />
                      <span className="text-sm font-medium text-blue-800">{card.title}</span>
                    </div>
                    <span className="text-sm text-blue-600">
                      {card.value != null
                        ? card.isCurrency
                          ? card.isFloat
                            ? `$${Number(card.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : `$${Math.round(Number(card.value)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : Math.round(Number(card.value)).toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  <input
                    type="number"
                    step={card.step || (card.isFloat ? 0.5 : 1)}
                    value={card.value ?? ''}
                    onChange={(e) => {
                      if (card.isReadOnly) return;
                      const value = e.target.value === '' ? null : card.isFloat ? parseFloat(e.target.value) : Math.round(parseFloat(e.target.value));
                      setTargets((prev) => ({
                        ...prev,
                        [card.field as keyof BusinessPlanTargets]: value,
                      }));
                    }}
                    disabled={card.isReadOnly}
                    className="w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-100 text-blue-800 disabled:bg-blue-200 disabled:cursor-not-allowed"
                    placeholder={`Enter ${card.title.toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-blue-200">
            <h2 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Performance Metrics
            </h2>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={60} />
                  <YAxis />
                  <Tooltip formatter={(value) => (value ? Number(value).toLocaleString() : 'N/A')} />
                  <Legend />
                  <Bar dataKey="value" name="Metrics">
                    <LabelList dataKey="value" position="top" formatter={(value: number) => (value ? Number(value).toLocaleString() : 'N/A')} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgentBusinessPlan;