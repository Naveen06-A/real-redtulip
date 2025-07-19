
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, 
  DollarSign, 
  FileText, 
  Save,
  RotateCcw,
  BarChart3,
  Download,
  Eye,
  X,
  Users,
  PieChart,
  ArrowRight,
  Settings,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface AgentFinancials {
  name: string;
  commission_amount: number | null;
  franchise_amount: number | null;
  marketing_expenses: number | null;
  super_amount: number | null;
  business_commission_percentage: number | null;
  agent_commission_percentage: number | null;
  franchise_fee: number | null;
}

interface AdminBusinessPlan {
  id?: string;
  agent_id: string;
  agents: AgentFinancials[];
  business_expenses_percentage: number | null;
  agent_expenses_percentage: number | null;
  rent: number | null;
  staff_salary: number | null;
  internet: number | null;
  fuel: number | null;
  other_expenses: number | null;
  created_at?: string;
  updated_at?: string;
}

interface AgentBusinessPlan {
  id?: string;
  agent_id: string;
  business_commission_percentage: number | null;
  agent_commission_percentage: number | null;
  franchise_percentage: number | null;
  created_at?: string;
  updated_at?: string;
}

interface AgentData {
  name: string;
  business_commission: number | null;
  agent_commission: number | null;
  business_expenses: number | null;
  agent_expenses: number | null;
  business_earnings: number | null;
  agent_earnings: number | null;
  franchise_fee: number | null;
  business_commission_percentage: number | null;
  agent_commission_percentage: number | null;
}

interface RatioSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  suffix: string;
  tooltip: string;
}

interface RatioInputProps {
  label: string;
  value: number | string;
  onChange: (value: number | null) => void;
  min: number;
  step: number;
  suffix: string;
  tooltip: string;
  disabled?: boolean;
}

const RatioSlider: React.FC<RatioSliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  tooltip
}) => (
  <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200 relative group">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-blue-800">{label}</span>
      <span className="text-sm text-blue-600">{value}{suffix}</span>
    </div>
    <div className="flex items-center space-x-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-3/4 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((value - min) / (max - min)) * 100}%, #BFDBFE ${((value - min) / (max - min)) * 100}%, #BFDBFE 100%)`
        }}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-1/4 px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800"
      />
    </div>
    <div className="flex justify-between text-xs text-blue-500 mt-1">
      <span>{min}{suffix}</span>
      <span>{max}{suffix}</span>
    </div>
    <div className="absolute z-10 hidden group-hover:block bg-blue-800 text-white text-xs rounded py-2 px-4 -top-10 left-1/2 transform -translate-x-1/2 w-64">
      {tooltip}
    </div>
  </div>
);

const RatioInput: React.FC<RatioInputProps> = ({
  label,
  value,
  onChange,
  min,
  step,
  suffix,
  tooltip,
  disabled
}) => (
  <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200 relative group">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-blue-800">{label}</span>
      <span className="text-sm text-blue-600">{value ? `${suffix}${Math.round(Number(value)).toLocaleString()}` : 'N/A'}</span>
    </div>
    <input
      type="number"
      min={min}
      step={step}
      value={value ?? ''}
      onChange={(e) => onChange(parseFloat(e.target.value) || null)}
      disabled={disabled}
      className={`w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    />
    <div className="absolute z-10 hidden group-hover:block bg-blue-800 text-white text-xs rounded py-2 px-4 -top-10 left-1/2 transform -translate-x-1/2 w-64">
      {tooltip}
    </div>
  </div>
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function AdminBusinessPlan() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<AdminBusinessPlan>({
    agent_id: user?.id || '',
    agents: [],
    business_expenses_percentage: 0,
    agent_expenses_percentage: 0,
    rent: null,
    staff_salary: null,
    internet: null,
    fuel: null,
    other_expenses: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  const [newAgentName, setNewAgentName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [agentsData, setAgentsData] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
  const [showInputs, setShowInputs] = useState(false);
  const [showPercentages, setShowPercentages] = useState(false);
  const [timeFrame, setTimeFrame] = useState<'yearly' | 'monthly' | 'weekly' | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchBusinessPlan();
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && plan.agents.length > 0) {
      fetchAgentBusinessPlan();
    }
  }, [user?.id, plan.agents]);

  useEffect(() => {
    if (!user?.id || !plan.agents.length) return;

    const subscription = supabase
      .channel('agent_business_plans')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agent_business_plans', 
        filter: `agent_id=in.(${plan.agents.map(agent => agent.name).join(',')})` 
      }, (payload) => {
        console.log('Real-time update received:', payload);
        setPlan(prev => ({
          ...prev,
          agents: prev.agents.map(agent => {
            if (agent.name === payload.new.agent_id) {
              return {
                ...agent,
                business_commission_percentage: payload.new.business_commission_percentage ?? null,
                agent_commission_percentage: payload.new.agent_commission_percentage ?? null,
                franchise_fee: payload.new.franchise_percentage ?? null
              };
            }
            return agent;
          })
        }));
        toast.success(`Agent ${payload.new.agent_id} business plan updated`);
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id, plan.agents]);

  const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delayMs = 1000): Promise<T> => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        console.error(`Retry ${i + 1}/${retries} failed:`, error);
        if (i === retries - 1) throw error;
        await delay(delayMs * (i + 1));
      }
    }
    throw new Error('Max retries reached');
  };

  const fetchBusinessPlan = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await withRetry(() =>
        supabase
          .from('admin_business_plans')
          .select('*')
          .eq('agent_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
      );

      console.log('Admin Business Plan Data:', data);
      console.log('Admin Business Plan Error:', error);

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPlan({
          ...data,
          agents: data.agents || [],
          rent: data.rent != null ? Math.round(data.rent) : null,
          staff_salary: data.staff_salary != null ? Math.round(data.staff_salary) : null,
          internet: data.internet != null ? Math.round(data.internet) : null,
          fuel: data.fuel != null ? Math.round(data.fuel) : null,
          other_expenses: data.other_expenses != null ? Math.round(data.other_expenses) : null
        });
        if (data.agents.length > 0) {
          setSelectedAgent(data.agents[0].name);
          setShowInputs(true);
        }
        setTimeFrame('yearly');
      } else {
        console.log('No admin business plan found, using defaults');
      }
    } catch (error: any) {
      console.error('Error fetching business plan:', JSON.stringify(error, null, 2));
      if (error.code === '42P01') {
        toast.error('Admin business plan table not found. Please contact support.');
      } else {
        toast.error(`Failed to load business plan: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAgentBusinessPlan = async () => {
    if (!user?.id || !plan.agents.length) {
      console.log('No user ID or agents to fetch plans for');
      return;
    }

    setLoading(true);
    try {
      const agentIds = plan.agents.map(agent => agent.name);
      console.log('Fetching agent business plans for IDs:', agentIds);

      const { data, error } = await withRetry(() =>
        supabase
          .from('agent_business_plans')
          .select('agent_id, business_commission_percentage, agent_commission_percentage, franchise_percentage, created_at')
          .in('agent_id', agentIds)
          .order('created_at', { ascending: false })
      );

      console.log('Fetched Agent Business Plan Data:', data);
      console.log('Fetched Agent Business Plan Error:', error);

      if (error) throw error;

      // Create a map to store the most recent plan for each agent
      const agentPlansMap = new Map<string, AgentBusinessPlan>();
      data.forEach(plan => {
        if (!agentPlansMap.has(plan.agent_id) || new Date(plan.created_at) > new Date(agentPlansMap.get(plan.agent_id)!.created_at!)) {
          agentPlansMap.set(plan.agent_id, plan);
        }
      });

      console.log('Agent Plans Map:', Array.from(agentPlansMap.entries()));

      // Update plan.agents with fetched percentages
      setPlan(prev => {
        const updatedAgents = prev.agents.map(agent => {
          const agentPlan = agentPlansMap.get(agent.name);
          console.log(`Updating agent ${agent.name} with plan:`, agentPlan);
          return {
            ...agent,
            business_commission_percentage: agentPlan?.business_commission_percentage ?? null,
            agent_commission_percentage: agentPlan?.agent_commission_percentage ?? null,
            franchise_fee: agentPlan?.franchise_percentage ?? null
          };
        });
        console.log('Updated Agents State:', updatedAgents);
        return { ...prev, agents: updatedAgents };
      });

      if (data.length === 0) {
        toast.warn('No agent business plans found. Using default values.');
      }
    } catch (error: any) {
      console.error('Error fetching agent business plans:', JSON.stringify(error, null, 2));
      if (error.code === 'PGRST116') {
        toast.warn('No agent business plans found. Using default values.');
        setPlan(prev => ({
          ...prev,
          agents: prev.agents.map(agent => ({
            ...agent,
            business_commission_percentage: null,
            agent_commission_percentage: null,
            franchise_fee: null
          }))
        }));
      } else if (error.code === '42703') {
        toast.error('Agent business plan columns not found. Using default values.');
      } else {
        toast.error(`Failed to load agent business plan data: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateAgentData = () => {
    const { business_expenses_percentage, agent_expenses_percentage } = plan;
    const additionalExpensesTotal = calculateAdditionalExpensesTotal();

    return plan.agents.map((agent) => {
      const { 
        name, 
        commission_amount, 
        franchise_amount, 
        marketing_expenses, 
        super_amount,
        business_commission_percentage,
        agent_commission_percentage,
        franchise_fee
      } = agent;

      const scaleFactor = timeFrame === 'monthly' ? 12 : timeFrame === 'weekly' ? 52 : 1;
      const scaledCommission = commission_amount ? commission_amount * scaleFactor : null;
      const scaledFranchise = franchise_amount ? franchise_amount * scaleFactor : null;
      const scaledMarketing = marketing_expenses ? marketing_expenses * scaleFactor : null;
      const scaledSuper = super_amount ? super_amount * scaleFactor : null;

      const calculatedFranchiseAmount = scaledCommission && franchise_fee
        ? Math.round(scaledCommission * (franchise_fee / 100))
        : scaledFranchise;

      const netCommission = scaledCommission && calculatedFranchiseAmount
        ? scaledCommission - calculatedFranchiseAmount
        : null;

      const businessCommission = netCommission && business_commission_percentage
        ? Math.round((netCommission * business_commission_percentage) / 100)
        : null;
      const agentCommission = netCommission && agent_commission_percentage
        ? Math.round((netCommission * agent_commission_percentage) / 100)
        : null;
      const businessExpenses = scaledMarketing && business_expenses_percentage
        ? Math.round((scaledMarketing * business_expenses_percentage) / 100)
        : null;
      const agentExpenses = scaledMarketing && agent_expenses_percentage
        ? Math.round((scaledMarketing * agent_expenses_percentage) / 100)
        : null;
      const businessEarnings = businessCommission && businessExpenses && scaledSuper && additionalExpensesTotal
        ? Math.round(businessCommission - businessExpenses - scaledSuper - additionalExpensesTotal)
        : null;
      const agentEarnings = agentCommission && scaledMarketing && scaledSuper
        ? scaledMarketing > 0
          ? Math.round(agentCommission - (agentExpenses || 0) + scaledSuper)
          : 0
        : null;

      return {
        name,
        business_commission: businessCommission,
        agent_commission: agentCommission,
        business_expenses: businessExpenses,
        agent_expenses: agentExpenses,
        business_earnings: businessEarnings,
        agent_earnings: agentEarnings,
        franchise_fee: calculatedFranchiseAmount,
        business_commission_percentage,
        agent_commission_percentage
      };
    });
  };

  const calculateTotals = () => {
    return agentsData.reduce(
      (totals, agent) => ({
        business_commission: (totals.business_commission || 0) + (agent.business_commission || 0),
        agent_commission: (totals.agent_commission || 0) + (agent.agent_commission || 0),
        business_expenses: (totals.business_expenses || 0) + (agent.business_expenses || 0),
        agent_expenses: (totals.agent_expenses || 0) + (agent.agent_expenses || 0),
        business_earnings: (totals.business_earnings || 0) + (agent.business_earnings || 0),
        agent_earnings: (totals.agent_earnings || 0) + (agent.agent_earnings || 0),
        franchise_fee: (totals.franchise_fee || 0) + (agent.franchise_fee || 0)
      }),
      {
        business_commission: 0,
        agent_commission: 0,
        business_expenses: 0,
        agent_expenses: 0,
        business_earnings: 0,
        agent_earnings: 0,
        franchise_fee: 0
      }
    );
  };

  const calculateAdditionalExpensesTotal = () => {
    const { rent, staff_salary, internet, fuel, other_expenses } = plan;
    const scaleFactor = timeFrame === 'monthly' ? 12 : timeFrame === 'weekly' ? 52 : 1;
    return (
      (rent ? rent * scaleFactor : 0) +
      (staff_salary ? staff_salary * scaleFactor : 0) +
      (internet ? internet * scaleFactor : 0) +
      (fuel ? fuel * scaleFactor : 0) +
      (other_expenses ? other_expenses * scaleFactor : 0)
    );
  };

  useEffect(() => {
    const data = calculateAgentData();
    console.log('Calculated Agent Data:', data);
    setAgentsData(data);
  }, [
    plan.agents,
    plan.business_expenses_percentage,
    plan.agent_expenses_percentage,
    plan.rent,
    plan.staff_salary,
    plan.internet,
    plan.fuel,
    plan.other_expenses,
    timeFrame
  ]);

  const saveBusinessPlan = async () => {
    if (!user?.id) return;
    if (!timeFrame) {
      toast.error('Please select a time frame before saving the plan');
      return;
    }

    setSaving(true);
    try {
      const planData = {
        ...plan,
        agent_id: user.id,
        updated_at: new Date().toISOString(),
        rent: plan.rent != null ? Math.round(plan.rent) : null,
        staff_salary: plan.staff_salary != null ? Math.round(plan.staff_salary) : null,
        internet: plan.internet != null ? Math.round(plan.internet) : null,
        fuel: plan.fuel != null ? Math.round(plan.fuel) : null,
        other_expenses: plan.other_expenses != null ? Math.round(plan.other_expenses) : null,
        agents: plan.agents.map(agent => ({
          ...agent,
          commission_amount: agent.commission_amount != null ? Math.round(agent.commission_amount) : null,
          franchise_amount: agent.franchise_amount != null ? Math.round(agent.franchise_amount) : null,
          marketing_expenses: agent.marketing_expenses != null ? Math.round(agent.marketing_expenses) : null,
          super_amount: agent.super_amount != null ? Math.round(agent.super_amount) : null
        }))
      };

      if (plan.id) {
        const { error } = await withRetry(() =>
          supabase
            .from('admin_business_plans')
            .update(planData)
            .eq('id', plan.id)
        );
        if (error) throw error;
      } else {
        const { data, error } = await withRetry(() =>
          supabase
            .from('admin_business_plans')
            .insert([{ ...planData, created_at: new Date().toISOString() }])
            .select()
            .single()
        );
        if (error) throw error;
        setPlan({
          ...data,
          agents: data.agents || [],
          rent: data.rent != null ? Math.round(data.rent) : null,
          staff_salary: data.staff_salary != null ? Math.round(data.staff_salary) : null,
          internet: data.internet != null ? Math.round(data.internet) : null,
          fuel: data.fuel != null ? Math.round(data.fuel) : null,
          other_expenses: data.other_expenses != null ? Math.round(data.other_expenses) : null
        });
      }

      for (const agent of plan.agents) {
        const { error } = await withRetry(() =>
          supabase
            .from('agent_business_plans')
            .upsert({
              agent_id: agent.name,
              business_commission_percentage: agent.business_commission_percentage,
              agent_commission_percentage: agent.agent_commission_percentage,
              franchise_percentage: agent.franchise_fee,
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            })
        );
        if (error) throw error;
      }

      toast.success('Business plan and agent percentages saved successfully!');
    } catch (error: any) {
      console.error('Error saving business plan:', JSON.stringify(error, null, 2));
      toast.error(`Failed to save business plan or agent percentages: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const addAgent = () => {
    if (!timeFrame) {
      toast.error('Please select a time frame before adding an agent');
      return;
    }
    if (newAgentName.trim() && !plan.agents.some(agent => agent.name === newAgentName.trim())) {
      const newAgent: AgentFinancials = {
        name: newAgentName.trim(),
        commission_amount: null,
        franchise_amount: null,
        marketing_expenses: null,
        super_amount: null,
        business_commission_percentage: null,
        agent_commission_percentage: null,
        franchise_fee: null
      };
      setPlan({
        ...plan,
        agents: [...plan.agents, newAgent]
      });
      setSelectedAgent(newAgentName.trim());
      setNewAgentName('');
      setShowInputs(true);
      toast.success('New agent added. Please enter their financial details.');
    } else if (plan.agents.some(agent => agent.name === newAgentName.trim())) {
      toast.error('Agent name already exists');
    } else {
      toast.error('Please enter a valid agent name');
    }
  };

  const removeAgent = (name: string) => {
    const updatedAgents = plan.agents.filter((agent) => agent.name !== name);
    setPlan({ ...plan, agents: updatedAgents });
    if (selectedAgent === name) {
      setSelectedAgent(updatedAgents.length > 0 ? updatedAgents[0].name : null);
      setShowInputs(updatedAgents.length > 0);
    }
    if (updatedAgents.length === 0) {
      setShowInputs(false);
    }
  };

  const selectAgent = (name: string) => {
    setSelectedAgent(name);
    setShowInputs(true);
  };

  const updateAgentFinancials = (field: keyof AgentFinancials, value: number | null) => {
    if (!selectedAgent) return;

    if (value !== null && (value < 0 || value > 100) && ['business_commission_percentage', 'agent_commission_percentage', 'franchise_fee'].includes(field)) {
      toast.error(`${field.replace('_', ' ')} must be between 0% and 100%`);
      return;
    }

    const updatedAgents = plan.agents.map(agent => {
      if (agent.name === selectedAgent) {
        const updatedAgent = { ...agent, [field]: value };
        if (field === 'business_commission_percentage' || field === 'agent_commission_percentage') {
          const totalPercentage = (updatedAgent.business_commission_percentage || 0) + (updatedAgent.agent_commission_percentage || 0);
          if (totalPercentage > 100) {
            toast.error('Business and Agent Commission percentages cannot exceed 100%');
            return agent;
          }
        }
        return updatedAgent;
      }
      return agent;
    });
    setPlan({ ...plan, agents: updatedAgents });
  };

  const getSelectedAgent = () => {
    return plan.agents.find(agent => agent.name === selectedAgent) || {
      name: '',
      commission_amount: null,
      franchise_amount: null,
      marketing_expenses: null,
      super_amount: null,
      business_commission_percentage: null,
      agent_commission_percentage: null,
      franchise_fee: null
    };
  };

  const generatePDF = (forView = false) => {
    setGenerating(true);
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
    doc.text(`Admin Business Plan (${timeFrame ? timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1) : 'N/A'})`, margin, yOffset + 7);
    doc.setFontSize(7);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin - 45, yOffset + 7);
    yOffset += 25;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
    doc.text('Agent Financials', margin + 3, yOffset + 5);
    yOffset += 10;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.autoTable({
      startY: yOffset,
      head: [['Agent', 'Metric', `${timeFrame ? timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1) : 'Total'}`]],
      body: agentsData.flatMap(agent => [
        [agent.name, 'Business Commission %', agent.business_commission_percentage != null ? `${Math.round(agent.business_commission_percentage)}%` : 'N/A'],
        ['', 'Agent Commission %', agent.agent_commission_percentage != null ? `${Math.round(agent.agent_commission_percentage)}%` : 'N/A'],
        ['', 'Franchise Fee %', agent.franchise_fee != null ? `${Math.round(agent.franchise_fee)}%` : 'N/A'],
        ['', 'Commission Amount', agent.business_commission != null ? `$${Math.round(agent.business_commission).toLocaleString()}` : 'N/A'],
        ['', 'Franchise Fee', agent.franchise_fee != null ? `$${Math.round(agent.franchise_fee).toLocaleString()}` : 'N/A'],
        ['', 'Agent Commission', agent.agent_commission != null ? `$${Math.round(agent.agent_commission).toLocaleString()}` : 'N/A'],
        ['', 'Business Expenses', agent.business_expenses != null ? `$${Math.round(agent.business_expenses).toLocaleString()}` : 'N/A'],
        ['', 'Agent Expenses', agent.agent_expenses != null ? `$${Math.round(agent.agent_expenses).toLocaleString()}` : 'N/A'],
        ['', 'Business Earnings', agent.business_earnings != null ? `$${Math.round(agent.business_earnings).toLocaleString()}` : 'N/A'],
        ['', 'Agent Earnings', agent.agent_earnings != null ? `$${Math.round(agent.agent_earnings).toLocaleString()}` : 'N/A']
      ]).concat([
        ['Total', 'Business Commission', totals.business_commission ? `$${Math.round(totals.business_commission).toLocaleString()}` : 'N/A'],
        ['', 'Agent Commission', totals.agent_commission ? `$${Math.round(totals.agent_commission).toLocaleString()}` : 'N/A'],
        ['', 'Franchise Fee', totals.franchise_fee ? `$${Math.round(totals.franchise_fee).toLocaleString()}` : 'N/A'],
        ['', 'Business Expenses', totals.business_expenses ? `$${Math.round(totals.business_expenses).toLocaleString()}` : 'N/A'],
        ['', 'Agent Expenses', totals.agent_expenses ? `$${Math.round(totals.agent_expenses).toLocaleString()}` : 'N/A'],
        ['', 'Business Earnings', totals.business_earnings ? `$${Math.round(totals.business_earnings).toLocaleString()}` : 'N/A'],
        ['', 'Agent Earnings', totals.agent_earnings ? `$${Math.round(totals.agent_earnings).toLocaleString()}` : 'N/A']
      ]),
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
      columnStyles: { 
        0: { cellWidth: 50, halign: 'left' }, 
        1: { cellWidth: 50, halign: 'left' }, 
        2: { cellWidth: 50, halign: 'center' }
      },
      margin: { left: margin, right: margin }
    });
    yOffset = doc.lastAutoTable.finalY + 10;

    const additionalExpensesTotal = calculateAdditionalExpensesTotal();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
    doc.text('Additional Expenses', margin + 3, yOffset + 5);
  //  /locales/en-US.ts
    yOffset += 10;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.autoTable({
      startY: yOffset,
      head: [['Field', `${timeFrame ? timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1) : 'Total'}`]],
      body: [
        ['Rent', plan.rent ? `$${Math.round(plan.rent).toLocaleString()}` : 'N/A'],
        ['Staff Salary', plan.staff_salary ? `$${Math.round(plan.staff_salary).toLocaleString()}` : 'N/A'],
        ['Internet/Mobile', plan.internet ? `$${Math.round(plan.internet).toLocaleString()}` : 'N/A'],
        ['Fuel', plan.fuel ? `$${Math.round(plan.fuel).toLocaleString()}` : 'N/A'],
        ['Other Expenses', plan.other_expenses ? `$${Math.round(plan.other_expenses).toLocaleString()}` : 'N/A'],
        ['Total', additionalExpensesTotal ? `$${Math.round(additionalExpensesTotal).toLocaleString()}` : 'N/A']
      ],
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
      columnStyles: { 
        0: { cellWidth: 50, halign: 'left' }, 
        1: { cellWidth: 50, halign: 'center' }
      },
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
        ['Created At', plan.created_at || 'N/A'],
        ['Updated At', plan.updated_at || 'N/A'],
        ['Agent Names', plan.agents.map(agent => agent.name).join(', ') || 'N/A'],
        ['Time Frame', timeFrame ? timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1) : 'N/A']
      ],
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
      columnStyles: { 
        0: { cellWidth: 50, halign: 'left' }, 
        1: { cellWidth: 90, halign: 'center' } 
      },
      margin: { left: margin, right: margin }
    });

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page 1 of 1`, pageWidth - margin - 15, pageHeight - margin);
    doc.text('Generated by RealRed Enterprises', margin, pageHeight - margin);

    if (forView) {
      const pdfDataUri = doc.output('datauristring');
      setPdfDataUri(pdfDataUri);
      setGenerating(false);
      toast.success('PDF generated for viewing!');
    } else {
      doc.save(`admin_business_plan_${timeFrame || 'total'}_${new Date().toISOString().split('T')[0]}.pdf`);
      setGenerating(false);
      toast.success('PDF downloaded successfully!');
    }
  };

  const viewPlan = () => {
    if (!timeFrame) {
      toast.error('Please select a time frame before viewing the plan');
      return;
    }
    setShowPlan(true);
    setTimeout(() => {
      const pdfContainer = document.getElementById('pdf-viewer');
      if (pdfContainer) {
        pdfContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
    generatePDF(true);
  };

  const downloadPlan = () => {
    if (!timeFrame) {
      toast.error('Please select a time frame before downloading the plan');
      return;
    }
    generatePDF(false);
  };

  const resetToDefaults = () => {
    setPlan({
      agent_id: user?.id || '',
      agents: [],
      business_expenses_percentage: 0,
      agent_expenses_percentage: 0,
      rent: null,
      staff_salary: null,
      internet: null,
      fuel: null,
      other_expenses: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    setNewAgentName('');
    setSelectedAgent(null);
    setShowInputs(false);
    setShowPercentages(false);
    setTimeFrame(null);
  };

  const totals = calculateTotals();
  const additionalExpensesTotal = calculateAdditionalExpensesTotal();

  const pieChartData = selectedAgent ? [
    { name: 'Business Commission', value: getSelectedAgent().business_commission_percentage || 0, color: '#1E3A8A' },
    { name: 'Agent Commission', value: getSelectedAgent().agent_commission_percentage || 0, color: '#3B82F6' },
    { name: 'Franchise Fee', value: getSelectedAgent().franchise_fee || 0, color: '#1D4ED8' },
    { name: 'Business Expenses', value: plan.business_expenses_percentage || 0, color: '#2563EB' },
    { name: 'Agent Expenses', value: plan.agent_expenses_percentage || 0, color: '#60A5FA' }
  ] : [];

  const chartData = agentsData.map(agent => ({
    name: agent.name,
    business_commission: agent.business_commission ?? 0,
    agent_commission: agent.agent_commission ?? 0,
    franchise_fee: agent.franchise_fee ?? 0,
    business_expenses: agent.business_expenses ?? 0,
    agent_expenses: agent.agent_expenses ?? 0,
    business_earnings: agent.business_earnings ?? 0,
    agent_earnings: agent.agent_earnings ?? 0
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
        <p className="ml-4 text-blue-600">Loading agent business plans...</p>
      </div>
    );
  }

  const selectedAgentData = getSelectedAgent();

  return (
    <div className="min-h-screen bg-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-blue-900 flex items-center">
                <Target className="w-8 h-8 mr-3 text-blue-600" />
                Admin Business Plan
              </h1>
              <p className="text-blue-600 mt-2">Manage commission and expense allocations</p>
            </div>
            <div className="flex flex-wrap justify-end gap-3 w-full sm:w-auto">
              <button
                onClick={() => navigate('/agent-business-plan')}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors w-full sm:w-auto"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                View Agent Business Plan
              </button>
              <button
                onClick={resetToDefaults}
                className="flex items-center px-4 py-2 bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 transition-colors w-full sm:w-auto"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </button>
              <button
                onClick={saveBusinessPlan}
                disabled={saving || !timeFrame}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 w-full sm:w-auto"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Plan'}
              </button>
              <button
                onClick={downloadPlan}
                disabled={generating || !timeFrame}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-400 w-full sm:w-auto"
              >
                <Download className="w-4 h-4 mr-2" />
                {generating ? 'Generating PDF...' : 'Download PDF'}
              </button>
              <button
                onClick={viewPlan}
                disabled={generating || !timeFrame}
                className="flex items-center px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-400 w-full sm:w-auto"
              >
                <Eye className="w-4 h-4 mr-2" />
                {generating ? 'Generating PDF...' : 'View Plan'}
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-blue-600" />
            Select Plan Time Frame
          </h2>
          <div className="flex space-x-2">
            {['yearly', 'monthly', 'weekly'].map((frame) => (
              <button
                key={frame}
                onClick={() => setTimeFrame(frame as 'yearly' | 'monthly' | 'weekly')}
                className={`px-4 py-2 rounded-lg ${
                  timeFrame === frame
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-200 text-blue-700 hover:bg-blue-300'
                } transition-colors`}
              >
                {frame.charAt(0).toUpperCase() + frame.slice(1)}
              </button>
            ))}
          </div>
          {!timeFrame && (
            <p className="text-red-600 mt-2 text-sm">Please select a time frame to proceed with entering the plan.</p>
          )}
        </motion.div>

        {showPlan && (
          <motion.div
            id="pdf-viewer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-blue-900 flex items-center">
                <FileText className="w-6 h-6 mr-2 text-blue-600" />
                Admin Business Plan Preview
              </h2>
              <button
                onClick={() => {
                  setShowPlan(false);
                  setPdfDataUri(null);
                }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="relative h-[70vh] bg-gray-100 rounded-lg overflow-hidden">
              {pdfDataUri ? (
                <embed
                  src={pdfDataUri}
                  type="application/pdf"
                  width="100%"
                  height="100%"
                  className="border border-gray-200 rounded-lg"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-blue-600 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p>Generating PDF preview...</p>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={downloadPlan}
                disabled={generating}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
              >
                <Download className="w-4 h-4 mr-2" />
                {generating ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
          </motion.div>
        )}

        {timeFrame && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
          >
            <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              Agent Names
            </h2>
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="text"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="Enter agent name"
                className="w-3/4 px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800"
              />
              <button
                onClick={addAgent}
                className="w-1/4 px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mx-auto" />
              </button>
            </div>
            <div className="max-h-24 overflow-y-auto">
              {plan.agents.map((agent) => (
                <div key={agent.name} className="flex justify-between items-center p-2 bg-blue-100 rounded mb-1">
                  <button
                    onClick={() => selectAgent(agent.name)}
                    className={`text-sm text-blue-800 truncate hover:underline ${selectedAgent === agent.name ? 'font-bold' : ''}`}
                  >
                    {agent.name}
                  </button>
                  <button
                    onClick={() => removeAgent(agent.name)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {timeFrame && showInputs && selectedAgent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-blue-900 flex items-center">
                <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                Financial Inputs for {selectedAgent} ({timeFrame})
              </h2>
              <button
                onClick={() => setShowInputs(false)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                {showInputs ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </button>
            </div>
            {showInputs && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <RatioInput
                  label={`Commission Amount (${timeFrame})`}
                  value={selectedAgentData.commission_amount ?? ''}
                  onChange={(value) => updateAgentFinancials('commission_amount', value)}
                  min={0}
                  step={1}
                  suffix="$"
                  tooltip={`Total commission amount to be distributed (${timeFrame})`}
                />
                <RatioInput
                  label={`Marketing Expenses (${timeFrame})`}
                  value={selectedAgentData.marketing_expenses ?? ''}
                  onChange={(value) => updateAgentFinancials('marketing_expenses', value)}
                  min={0}
                  step={1}
                  suffix="$"
                  tooltip={`Total marketing expenses budget (${timeFrame})`}
                  disabled={!selectedAgentData.commission_amount}
                />
                <RatioInput
                  label={`Super Amount (${timeFrame})`}
                  value={selectedAgentData.super_amount ?? ''}
                  onChange={(value) => updateAgentFinancials('super_amount', value)}
                  min={0}
                  step={1}
                  suffix="$"
                  tooltip={`Super amount applied to marketing expenses for earnings (${timeFrame})`}
                  disabled={!selectedAgentData.commission_amount}
                />
              </div>
            )}
          </motion.div>
        )}

        {timeFrame && showInputs && selectedAgent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-blue-900 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-blue-600" />
                Percentage Configuration for {selectedAgent} ({timeFrame})
              </h2>
              <button
                onClick={() => setShowPercentages(!showPercentages)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                {showPercentages ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </button>
            </div>
            {showPercentages && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-8">
                  {[
                    { field: 'business_commission_percentage', label: 'Business Commission %', tooltip: 'Percentage of net commission allocated to business' },
                    { field: 'agent_commission_percentage', label: 'Agent Commission %', tooltip: 'Percentage of net commission allocated to agent' },
                    { field: 'franchise_fee', label: 'Franchise Fee %', tooltip: 'Percentage of commission deducted as franchise fee' }
                  ].map(({ field, label, tooltip }) => (
                    <RatioSlider
                      key={field}
                      label={label}
                      value={selectedAgentData[field as keyof AgentFinancials] ?? 0}
                      onChange={(value) => updateAgentFinancials(field as keyof AgentFinancials, value)}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      tooltip={tooltip}
                    />
                  ))}
                  {[
                    { field: 'business_expenses_percentage', label: 'Business Expenses %', tooltip: 'Percentage of marketing expenses allocated to business' },
                    { field: 'agent_expenses_percentage', label: 'Agent Expenses %', tooltip: 'Percentage of marketing expenses allocated to agents' }
                  ].map(({ field, label, tooltip }) => (
                    <RatioSlider
                      key={field}
                      label={label}
                      value={plan[field as keyof AdminBusinessPlan] ?? 0}
                      onChange={(value) => setPlan({ ...plan, [field]: value })}
                      min={0}
                      max={100}
                      step={1}
                      suffix="%"
                      tooltip={tooltip}
                    />
                  ))}
                </div>
                <div className="flex justify-center items-center">
                  <ResponsiveContainer width="100%" height={400}>
                    <RechartsPieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}%`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value}%`} />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {timeFrame && plan.agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
          >
            <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Agent Financials ({timeFrame})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="p-3 border-b text-blue-700 w-[15%] text-center">Agent</th>
                    <th className="p-3 border-b text-blue-700 w-[12%] text-center">Business Commission</th>
                    <th className="p-3 border-b text-blue-700 w-[12%] text-center">Agent Commission</th>
                    <th className="p-3 border-b text-blue-700 w-[12%] text-center">Franchise Fee</th>
                    <th className="p-3 border-b text-blue-700 w-[12%] text-center">Business Expenses</th>
                    <th className="p-3 border-b text-blue-700 w-[12%] text-center">Agent Expenses</th>
                    <th className="p-3 border-b text-blue-700 w-[12%] text-center">Business Earnings</th>
                    <th className="p-3 border-b text-blue-700 w-[15%] text-center">Agent Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {agentsData.map(agent => (
                    <tr key={agent.name} className="border-b hover:bg-blue-50">
                      <td className="p-3 text-blue-700 text-left">{agent.name}</td>
                      <td className="p-3 text-blue-600 text-center">{agent.business_commission != null ? `$${Math.round(agent.business_commission).toLocaleString()}` : 'N/A'}</td>
                      <td className="p-3 text-blue-600 text-center">{agent.agent_commission != null ? `$${Math.round(agent.agent_commission).toLocaleString()}` : 'N/A'}</td>
                      <td className="p-3 text-blue-600 text-center">{agent.franchise_fee != null ? `$${Math.round(agent.franchise_fee).toLocaleString()}` : 'N/A'}</td>
                      <td className="p-3 text-blue-600 text-center">{agent.business_expenses != null ? `$${Math.round(agent.business_expenses).toLocaleString()}` : 'N anthropogenic emissions N/A'}</td>
                      <td className="p-3 text-blue-600 text-center">{agent.agent_expenses != null ? `$${Math.round(agent.agent_expenses).toLocaleString()}` : 'N/A'}</td>
                      <td className="p-3 text-blue-600 text-center">{agent.business_earnings != null ? `$${Math.round(agent.business_earnings).toLocaleString()}` : 'N/A'}</td>
                      <td className="p-3 text-blue-600 text-center">{agent.agent_earnings != null ? `$${Math.round(agent.agent_earnings).toLocaleString()}` : 'N/A'}</td>
                    </tr>
                  ))}
                  <tr className="border-b bg-blue-100 font-semibold">
                    <td className="p-3 text-blue-700 text-left">Total</td>
                    <td className="p-3 text-blue-600 text-center">{totals.business_commission ? `$${Math.round(totals.business_commission).toLocaleString()}` : 'N/A'}</td>
                    <td className="p-3 text-blue-600 text-center">{totals.agent_commission ? `$${Math.round(totals.agent_commission).toLocaleString()}` : 'N/A'}</td>
                    <td className="p-3 text-blue-600 text-center">{totals.franchise_fee ? `$${Math.round(totals.franchise_fee).toLocaleString()}` : 'N/A'}</td>
                    <td className="p-3 text-blue-600 text-center">{totals.business_expenses ? `$${Math.round(totals.business_expenses).toLocaleString()}` : 'N/A'}</td>
                    <td className="p-3 text-blue-600 text-center">{totals.agent_expenses ? `$${Math.round(totals.agent_expenses).toLocaleString()}` : 'N/A'}</td>
                    <td className="p-3 text-blue-600 text-center">{totals.business_earnings ? `$${Math.round(totals.business_earnings).toLocaleString()}` : 'N/A'}</td>
                    <td className="p-3 text-blue-600 text-center">{totals.agent_earnings ? `$${Math.round(totals.agent_earnings).toLocaleString()}` : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {timeFrame && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
          >
            <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
              Additional Expenses ({timeFrame})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { field: 'rent', label: `Rent (${timeFrame})`, tooltip: `Total rent expenses (${timeFrame})` },
                { field: 'staff_salary', label: `Staff Salary (${timeFrame})`, tooltip: `Total staff salary expenses (${timeFrame})` },
                { field: 'internet', label: `Internet (${timeFrame})`, tooltip: `Total internet service expenses (${timeFrame})` },
                { field: 'fuel', label: `Fuel (${timeFrame})`, tooltip: `Total fuel expenses for operations (${timeFrame})` },
                { field: 'other_expenses', label: `Other Expenses (${timeFrame})`, tooltip: `Total miscellaneous business expenses (${timeFrame})` }
              ].map(({ field, label, tooltip }) => (
                <RatioInput
                  key={field}
                  label={label}
                  value={plan[field as keyof AdminBusinessPlan] ?? ''}
                  onChange={(value) => setPlan({ ...plan, [field]: value })}
                  min={0}
                  step={1}
                  suffix="$"
                  tooltip={tooltip}
                />
              ))}
              <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-800">Total Additional Expenses</span>
                  <span className="text-sm text-blue-600">${Math.round(additionalExpensesTotal).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {timeFrame && plan.agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
          >
            <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
              Financial Visualization ({timeFrame})
            </h2>
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  margin={{ top: 30, right: 40, left: 20, bottom: 20 }}
                  barCategoryGap="15%"
                  barGap={4}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#BFDBFE" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#1E3A8A" 
                    angle={-45} 
                    textAnchor="end" 
                    height={60}
                    interval={0}
                  />
                  <YAxis 
                    stroke="#1E3A8A" 
                    domain={[0, dataMax => Math.max(dataMax * 1.2, 1000)]}
                  />
                  <Tooltip 
                    formatter={(value: number) => `$${Math.round(value).toLocaleString()}`}
                    contentStyle={{ backgroundColor: '#fff', borderColor: '#BFDBFE' }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="business_commission" name="Business Commission" fill="#1E3A8A">
                    <LabelList dataKey="business_commission" position="top" formatter={(value: number) => value ? `$${Math.round(value).toLocaleString()}` : ''} />
                  </Bar>
                  <Bar dataKey="agent_commission" name="Agent Commission" fill="#3B82F6">
                    <LabelList dataKey="agent_commission" position="top" formatter={(value: number) => value ? `$${Math.round(value).toLocaleString()}` : ''} />
                  </Bar>
                  <Bar dataKey="franchise_fee" name="Franchise Fee" fill="#1D4ED8">
                    <LabelList dataKey="franchise_fee" position="top" formatter={(value: number) => value ? `$${Math.round(value).toLocaleString()}` : ''} />
                  </Bar>
                  <Bar dataKey="business_expenses" name="Business Expenses" fill="#2563EB">
                    <LabelList dataKey="business_expenses" position="top" formatter={(value: number) => value ? `$${Math.round(value).toLocaleString()}` : ''} />
                  </Bar>
                  <Bar dataKey="agent_expenses" name="Agent Expenses" fill="#60A5FA">
                    <LabelList dataKey="agent_expenses" position="top" formatter={(value: number) => value ? `$${Math.round(value).toLocaleString()}` : ''} />
                  </Bar>
                  <Bar dataKey="business_earnings" name="Business Earnings" fill="#1E40AF">
                    <LabelList dataKey="business_earnings" position="top" formatter={(value: number) => value ? `$${Math.round(value).toLocaleString()}` : ''} />
                  </Bar>
                  <Bar dataKey="agent_earnings" name="Agent Earnings" fill="#93C5FD">
                    <LabelList dataKey="agent_earnings" position="top" formatter={(value: number) => value ? `$${Math.round(value).toLocaleString()}` : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
