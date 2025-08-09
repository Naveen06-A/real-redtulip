import React, { useState, useEffect, useRef } from 'react';
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
import { v4 as uuidv4 } from 'uuid';

interface AgentFinancials {
  name: string;
  agent_id: string;
  commission_amount: number | null;
  franchise_amount: number | null;
  marketing_expenses: number | null;
  super_amount: number | null;
}

interface AdminBusinessPlan {
  id?: string;
  agent_id: string;
  agents: AgentFinancials[];
  business_commission_percentage: number | null;
  agent_commission_percentage: number | null;
  franchise_fee: number | null;
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
  business_amount: number | null;
  agent_amount: number | null;
  franchise_percentage: number | null;
  created_at?: string;
  updated_at?: string;
  agent_name: string;
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
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value) || null)}
      disabled={disabled}
      className={`w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    />
    <div className="absolute z-10 hidden group-hover:block bg-blue-800 text-white text-xs rounded py-2 px-4 -top-10 left-1/2 transform -translate-x-1/2 w-64">
      {tooltip}
    </div>
  </div>
);

export function AdminBusinessPlan() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<AdminBusinessPlan>({
    agent_id: '',
    agents: [],
    business_commission_percentage: null,
    agent_commission_percentage: null,
    franchise_fee: null,
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
  const [availableAgents, setAvailableAgents] = useState<{ id: string; name: string }[]>([]);
  const [showAgentSuggestions, setShowAgentSuggestions] = useState(false);
  const [savedPlans, setSavedPlans] = useState<AgentBusinessPlan[]>([]);
  const [showSavedPlans, setShowSavedPlans] = useState(false);
  const agentInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.id) {
      fetchAvailableAgents();
      fetchSavedAgentPlans();
    }
  }, [user?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        agentInputRef.current &&
        !agentInputRef.current.contains(event.target as Node)
      ) {
        setShowAgentSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAvailableAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'agent')
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableAgents(data || []);
    } catch (error: any) {
      console.error('Error fetching agents:', error);
      toast.error('Failed to load available agents');
    }
  };

  const fetchSavedAgentPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_business_plans')
        .select('id, agent_id, business_commission_percentage, agent_commission_percentage, franchise_percentage, business_amount, agent_amount, created_at, updated_at, agent_name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      console.log('Fetched saved agent plans:', data); // Enhanced debug log
      if (data) {
        data.forEach((plan, index) => {
          console.log(`Plan ${index + 1}:`, {
            agent_name: plan.agent_name,
            business_amount: plan.business_amount,
            agent_amount: plan.agent_amount
          });
        });
      }
      setSavedPlans(data || []);
    } catch (error: any) {
      console.error('Error fetching saved agent plans:', error);
      toast.error('Failed to load saved agent plans');
    }
  };

  const fetchAgentBusinessPlan = async (agentId: string, agentName: string) => {
    if (!agentId || !agentName) {
      toast.error('Please select or enter a valid agent name');
      return;
    }

    setLoading(true);
    try {
      const { data: planData, error: planError } = await supabase
        .from('agent_business_plans')
        .select('id, agent_id, business_commission_percentage, agent_commission_percentage, franchise_percentage, business_amount, agent_amount, agent_name')
        .eq('agent_id', agentId)
        .eq('agent_name', agentName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planError && planError.code !== 'PGRST116') {
        throw planError;
      }

      if (planData) {
        console.log('Fetched agent plan:', planData); // Debug log
        setPlan(prev => ({
          ...prev,
          agent_id: agentId,
          agents: prev.agents.some(agent => agent.agent_id === agentId && agent.name === agentName)
            ? prev.agents
            : [...prev.agents, { 
                name: agentName, 
                agent_id: agentId, 
                commission_amount: null, 
                franchise_amount: null, 
                marketing_expenses: null, 
                super_amount: null 
              }],
          business_commission_percentage: planData.business_commission_percentage != null ? Math.round(planData.business_commission_percentage) : 0,
          agent_commission_percentage: planData.agent_commission_percentage != null ? Math.round(planData.agent_commission_percentage) : 0,
          franchise_fee: planData.franchise_percentage != null ? Math.round(planData.franchise_percentage) : 0,
          business_amount: planData.business_amount != null ? Math.round(planData.business_amount) : null,
          agent_amount: planData.agent_amount != null ? Math.round(planData.agent_amount) : null
        }));
        setNewAgentName(agentName);
        setSelectedAgent(agentName);
        setShowInputs(true);
        toast.success(`Business plan loaded for "${agentName}"`);
      } else {
        setPlan(prev => ({
          ...prev,
          agent_id: agentId,
          agents: prev.agents.some(agent => agent.agent_id === agentId && agent.name === agentName)
            ? prev.agents
            : [...prev.agents, { 
                name: agentName, 
                agent_id: agentId, 
                commission_amount: null, 
                franchise_amount: null, 
                marketing_expenses: null, 
                super_amount: null 
              }],
          business_commission_percentage: 0,
          agent_commission_percentage: 0,
          franchise_fee: 0,
          business_amount: null,
          agent_amount: null
        }));
        setNewAgentName(agentName);
        setSelectedAgent(agentName);
        setShowInputs(true);
        toast.info(`No existing plan found for "${agentName}". Starting with default values.`);
      }
    } catch (error: any) {
      console.error('Error fetching business plan:', error);
      toast.error('Failed to load business plan');
      setPlan(prev => ({
        ...prev,
        agent_id: agentId,
        agents: prev.agents.some(agent => agent.agent_id === agentId && agent.name === agentName)
          ? prev.agents
          : [...prev.agents, { 
              name: agentName, 
              agent_id: agentId, 
              commission_amount: null, 
              franchise_amount: null, 
              marketing_expenses: null, 
              super_amount: null 
            }],
        business_commission_percentage: 0,
        agent_commission_percentage: 0,
        franchise_fee: 0,
        business_amount: null,
        agent_amount: null
      }));
      setNewAgentName(agentName);
      setSelectedAgent(agentName);
      setShowInputs(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualAgentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewAgentName(value);
    setShowAgentSuggestions(true);

    if (value.trim()) {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('agent_business_plans')
          .select('agent_id, agent_name')
          .ilike('agent_name', `%${value.trim()}%`)
          .eq('role', 'agent')
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }

        if (profileData) {
          const agentId = profileData.agent_id;
          const agentName = profileData.agent_name;

          await fetchAgentBusinessPlan(agentId, agentName);
          setAvailableAgents(prev => 
            prev.some(agent => agent.id === agentId && agent.name === agentName) 
              ? prev 
              : [...prev, { id: agentId, name: agentName }]
          );
        } else {
          setPlan(prev => ({
            ...prev,
            agent_id: '',
            business_commission_percentage: 0,
            agent_commission_percentage: 0,
            franchise_fee: 0,
            business_amount: null,
            agent_amount: null
          }));
          setSelectedAgent(value.trim());
          setShowInputs(true);
        }
      } catch (error: any) {
        console.error('Error handling manual agent change:', error);
        toast.error('Agent not found. You can continue with the entered name.');
        setPlan(prev => ({
          ...prev,
          agent_id: '',
          business_commission_percentage: 0,
          agent_commission_percentage: 0,
          franchise_fee: 0,
          business_amount: null,
          agent_amount: null
        }));
        setSelectedAgent(value.trim());
        setShowInputs(true);
      }
    } else {
      setPlan(prev => ({
        ...prev,
        agent_id: '',
        business_commission_percentage: 0,
        agent_commission_percentage: 0,
        franchise_fee: 0,
        business_amount: null,
        agent_amount: null
      }));
      setSelectedAgent(null);
      setShowInputs(false);
      setShowAgentSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, name: string, agentId: string) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      selectAgent(name, agentId);
    }
  };

  const selectAgent = async (name: string, agentId: string) => {
    setNewAgentName(name);
    setSelectedAgent(name);
    setShowAgentSuggestions(false);
    setShowInputs(true);
    await fetchAgentBusinessPlan(agentId, name);
  };

  const calculateAgentData = () => {
    const {
      agents,
      business_commission_percentage,
      agent_commission_percentage,
      franchise_fee,
      business_expenses_percentage,
      agent_expenses_percentage
    } = plan;

    const additionalExpenses = calculateAdditionalExpensesTotal();

    return agents.map((agent) => {
      const { name, commission_amount, franchise_amount, marketing_expenses, super_amount } = agent;

      const scaleFactor = timeFrame === 'monthly' ? 12 : timeFrame === 'weekly' ? 52 : 1;
      const scaledCommission = commission_amount != null ? commission_amount * scaleFactor : null;
      const scaledFranchise = franchise_amount != null ? franchise_amount * scaleFactor : null;
      const scaledMarketing = marketing_expenses != null ? marketing_expenses * scaleFactor : null;
      const scaledSuper = super_amount != null ? super_amount * scaleFactor : null;

      const calculatedFranchiseAmount = scaledCommission && franchise_fee != null
        ? Math.round(scaledCommission * (franchise_fee / 100))
        : scaledFranchise;

      const netCommission = scaledCommission != null && calculatedFranchiseAmount != null
        ? scaledCommission - calculatedFranchiseAmount
        : null;

      const businessCommission = netCommission != null && business_commission_percentage != null
        ? Math.round((netCommission * business_commission_percentage) / 100)
        : null;
      const agentCommission = netCommission != null && agent_commission_percentage != null
        ? Math.round((netCommission * agent_commission_percentage) / 100)
        : null;
      const businessExpenses = scaledMarketing != null && business_expenses_percentage != null
        ? Math.round((scaledMarketing * business_expenses_percentage) / 100)
        : null;
      const agentExpenses = scaledMarketing != null && agent_expenses_percentage != null
        ? Math.round((scaledMarketing * agent_expenses_percentage) / 100)
        : null;
      const businessEarnings = businessCommission != null && businessExpenses != null && scaledSuper != null && additionalExpenses != null
        ? Math.round(businessCommission - businessExpenses - scaledSuper - additionalExpenses)
        : null;
      const agentEarnings = agentCommission != null && scaledMarketing != null && scaledSuper != null
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
        franchise_fee: calculatedFranchiseAmount
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
      (rent != null ? rent * scaleFactor : 0) +
      (staff_salary != null ? staff_salary * scaleFactor : 0) +
      (internet != null ? internet * scaleFactor : 0) +
      (fuel != null ? fuel * scaleFactor : 0) +
      (other_expenses != null ? other_expenses * scaleFactor : 0)
    );
  };

  const calculateNetIncomeAndProfitLoss = () => {
    const additionalExpensesTotal = calculateAdditionalExpensesTotal();
    const totalBusinessAmount = savedPlans.reduce((sum, plan) => sum + (plan.business_amount || 0), 0);
    const totalAgentAmount = savedPlans.reduce((sum, plan) => sum + (plan.agent_amount || 0), 0);
    const netIncome = totalBusinessAmount + totalAgentAmount;
    const profitLoss = netIncome - additionalExpensesTotal;
    return { net_income: netIncome, profit_loss: profitLoss };
  };

  useEffect(() => {
    setAgentsData(calculateAgentData());
  }, [
    plan.agents,
    plan.business_commission_percentage,
    plan.agent_commission_percentage,
    plan.franchise_fee,
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
        agent_id: plan.agent_id || uuidv4(),
        updated_at: new Date().toISOString(),
        franchise_fee: plan.franchise_fee != null ? Math.round(plan.franchise_fee) : null,
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
        const { error } = await supabase
          .from('admin_business_plans')
          .update(planData)
          .eq('id', plan.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('admin_business_plans')
          .insert([{ ...planData, id: uuidv4(), created_at: new Date().toISOString() }])
          .select()
          .single();
        
        if (error) throw error;
        setPlan({
          ...data,
          agents: data.agents || [],
          franchise_fee: data.franchise_fee != null ? Math.round(data.franchise_fee) : null,
          rent: data.rent != null ? Math.round(data.rent) : null,
          staff_salary: data.staff_salary != null ? Math.round(data.staff_salary) : null,
          internet: data.internet != null ? Math.round(data.internet) : null,
          fuel: data.fuel != null ? Math.round(data.fuel) : null,
          other_expenses: data.other_expenses != null ? Math.round(data.other_expenses) : null
        });
      }

      const agentData = calculateAgentData();
      console.log('Calculated agent data for saving:', agentData); // Enhanced debug log
      for (const agent of plan.agents) {
        const agentCalc = agentData.find(a => a.name === agent.name);
        if (!agentCalc) {
          console.error(`No calculated data found for agent: ${agent.name}`);
          continue;
        }
        console.log(`Saving for agent ${agent.name}:`, {
          business_amount: agentCalc.business_commission,
          agent_amount: agentCalc.agent_commission
        });
        const { error } = await supabase
          .from('agent_business_plans')
          .upsert({
            agent_id: agent.agent_id,
            agent_name: agent.name,
            business_commission_percentage: plan.business_commission_percentage != null ? Math.round(plan.business_commission_percentage) : null,
            agent_commission_percentage: plan.agent_commission_percentage != null ? Math.round(plan.agent_commission_percentage) : null,
            franchise_percentage: plan.franchise_fee != null ? Math.round(plan.franchise_fee) : null,
            business_amount: agentCalc.business_commission != null ? Math.round(agentCalc.business_commission) : null,
            agent_amount: agentCalc.agent_commission != null ? Math.round(agentCalc.agent_commission) : null,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      toast.success('Business plan saved successfully!');
      await fetchSavedAgentPlans();
    } catch (error: any) {
      console.error('Error saving business plan:', error);
      toast.error('Failed to save business plan');
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
      const selectedAgentProfile = availableAgents.find(agent => agent.name === newAgentName.trim());
      const newAgent: AgentFinancials = {
        name: newAgentName.trim(),
        agent_id: selectedAgentProfile?.id || uuidv4(),
        commission_amount: null,
        franchise_amount: null,
        marketing_expenses: null,
        super_amount: null
      };
      setPlan({
        ...plan,
        agents: [...plan.agents, newAgent]
      });
      setSelectedAgent(newAgentName.trim());
      setNewAgentName('');
      setShowInputs(true);
      setShowAgentSuggestions(false);
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

  const updateAgentFinancials = (field: keyof AgentFinancials, value: number | null) => {
    if (!selectedAgent) return;
    const updatedAgents = plan.agents.map(agent => {
      if (agent.name === selectedAgent) {
        return { ...agent, [field]: value };
      }
      return agent;
    });
    setPlan({ ...plan, agents: updatedAgents });
  };

  const getSelectedAgent = () => {
    return plan.agents.find(agent => agent.name === selectedAgent) || {
      name: '',
      agent_id: '',
      commission_amount: null,
      franchise_amount: null,
      marketing_expenses: null,
      super_amount: null
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
        [agent.name, 'Commission Amount', agent.business_commission != null ? `$${Math.round(agent.business_commission).toLocaleString()}` : 'N/A'],
        ['', 'Franchise Fee', agent.franchise_fee != null ? `$${Math.round(agent.franchise_fee).toLocaleString()}` : 'N/A'],
        ['', 'Agent Commission', agent.agent_commission != null ? `$${Math.round(agent.agent_commission).toLocaleString()}` : 'N/A'],
        ['', 'Business Expenses', agent.business_expenses != null ? `$${Math.round(agent.business_expenses).toLocaleString()}` : 'N/A'],
        ['', 'Agent Expenses', agent.agent_expenses != null ? `$${Math.round(agent.agent_expenses).toLocaleString()}` : 'N/A'],
        ['', 'Business Earnings', agent.business_earnings != null ? `$${Math.round(agent.business_earnings).toLocaleString()}` : 'N/A'],
        ['', 'Agent Earnings', agent.agent_earnings != null ? `$${Math.round(agent.agent_earnings).toLocaleString()}` : 'N/A']
      ]).concat([
        ['Total', 'Business Commission', totals.business_commission ? `$${Math.round(totals.business_commission).toLocaleString()}` : 'N/A'],
        ['', 'Franchise Fee', totals.franchise_fee ? `$${Math.round(totals.franchise_fee).toLocaleString()}` : 'N/A'],
        ['', 'Agent Commission', totals.agent_commission ? `$${Math.round(totals.agent_commission).toLocaleString()}` : 'N/A'],
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

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
    doc.text('Additional Expenses', margin + 3, yOffset + 5);
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
    doc.text('Net Income and Profit/Loss', margin + 3, yOffset + 5);
    yOffset += 10;

    const netIncomeData = calculateNetIncomeAndProfitLoss();
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.autoTable({
      startY: yOffset,
      head: [['Metric', `${timeFrame ? timeFrame.charAt(0).toUpperCase() + timeFrame.slice(1) : 'Total'}`]],
      body: [
        ['Net Income', netIncomeData.net_income != null ? `$${Math.round(netIncomeData.net_income).toLocaleString()}` : 'N/A'],
        ['Profit/Loss', netIncomeData.profit_loss != null ? `$${Math.round(netIncomeData.profit_loss).toLocaleString()}` : 'N/A']
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
      agent_id: '',
      agents: [],
      business_commission_percentage: 0,
      agent_commission_percentage: 0,
      franchise_fee: 0,
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
    setShowAgentSuggestions(false);
  };

  const totals = calculateTotals();
  const additionalExpensesTotal = calculateAdditionalExpensesTotal();
  const netIncomeData = calculateNetIncomeAndProfitLoss();

  const pieChartData = [
    { name: 'Business Commission', value: plan.business_commission_percentage || 0, color: '#1E3A8A' },
    { name: 'Agent Commission', value: plan.agent_commission_percentage || 0, color: '#3B82F6' },
    { name: 'Franchise Fee', value: plan.franchise_fee || 0, color: '#1D4ED8' },
    { name: 'Business Expenses', value: plan.business_expenses_percentage || 0, color: '#2563EB' },
    { name: 'Agent Expenses', value: plan.agent_expenses_percentage || 0, color: '#60A5FA' }
  ];

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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-blue-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Agent Names
              </h2>
              <button
                onClick={() => setShowInputs(!showInputs)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                {showInputs ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </button>
            </div>
            {showInputs && (
              <div className="relative">
                <input
                  ref={agentInputRef}
                  type="text"
                  value={newAgentName}
                  onChange={handleManualAgentChange}
                  onFocus={() => setShowAgentSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addAgent();
                    }
                  }}
                  placeholder="Enter or select agent name"
                  className="w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-white text-blue-800"
                  aria-label="Agent name input"
                />
                {showAgentSuggestions && newAgentName && availableAgents.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-10 w-full mt-1 bg-white border border-blue-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    {availableAgents
                      .filter(agent => agent.name.toLowerCase().includes(newAgentName.toLowerCase()))
                      .map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => selectAgent(agent.name, agent.id)}
                          onKeyDown={(e) => handleKeyDown(e, agent.name, agent.id)}
                          className="w-full text-left px-4 py-2 text-blue-800 hover:bg-blue-100 focus:bg-blue-100 focus:outline-none"
                          tabIndex={0}
                        >
                          {agent.name}
                        </button>
                      ))}
                  </div>
                )}
                <button
                  onClick={addAgent}
                  className="mt-2 flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Agent
                </button>
              </div>
            )}
            <div className="max-h-24 overflow-y-auto mt-4">
              {plan.agents.map((agent) => (
                <div key={agent.agent_id} className="flex justify-between items-center p-2 bg-blue-100 rounded mb-1">
                  <button
                    onClick={() => selectAgent(agent.name, agent.agent_id)}
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

        {timeFrame && savedPlans.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-blue-900 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-blue-600" />
                Saved Agent Business Plans
              </h2>
              <button
                onClick={() => setShowSavedPlans(!showSavedPlans)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                {showSavedPlans ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </button>
            </div>
            {showSavedPlans && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="p-3 border-b text-blue-700 w-[20%] text-center">Agent Name</th>
                      <th className="p-3 border-b text-blue-700 w-[15%] text-center">Business Commission %</th>
                      <th className="p-3 border-b text-blue-700 w-[15%] text-center">Agent Commission %</th>
                      <th className="p-3 border-b text-blue-700 w-[15%] text-center">Franchise Fee %</th>
                      <th className="p-3 border-b text-blue-700 w-[15%] text-center">Business Amount</th>
                      <th className="p-3 border-b text-blue-700 w-[15%] text-center">Agent Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedPlans.map(plan => (
                      <tr key={plan.id} className="border-b hover:bg-blue-50 cursor-pointer" onClick={() => selectAgent(plan.agent_name, plan.agent_id)}>
                        <td className="p-3 text-blue-700 text-center">{plan.agent_name || 'Unknown'}</td>
                        <td className="p-3 text-blue-600 text-center">{plan.business_commission_percentage != null ? `${Math.round(plan.business_commission_percentage)}%` : 'N/A'}</td>
                        <td className="p-3 text-blue-600 text-center">{plan.agent_commission_percentage != null ? `${Math.round(plan.agent_commission_percentage)}%` : 'N/A'}</td>
                        <td className="p-3 text-blue-600 text-center">{plan.franchise_percentage != null ? `${Math.round(plan.franchise_percentage)}%` : 'N/A'}</td>
                        <td className="p-3 text-blue-600 text-center">{plan.business_amount != null && !isNaN(plan.business_amount) ? `$${Math.round(plan.business_amount).toLocaleString()}` : 'N/A'}</td>
                        <td className="p-3 text-blue-600 text-center">{plan.agent_amount != null && !isNaN(plan.agent_amount) ? `$${Math.round(plan.agent_amount).toLocaleString()}` : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {showSavedPlans && (
              <div className="mt-6">
                <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
                  Net Income and Profit/Loss ({timeFrame})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-blue-100">
                        <th className="p-3 border-b text-blue-700 w-[50%] text-center">Net Income</th>
                        <th className="p-3 border-b text-blue-700 w-[50%] text-center">Profit/Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b hover:bg-blue-50">
                        <td className="p-3 text-blue-600 text-center">{netIncomeData.net_income != null && !isNaN(netIncomeData.net_income) ? `$${Math.round(netIncomeData.net_income).toLocaleString()}` : 'N/A'}</td>
                        <td className="p-3 text-blue-600 text-center">{netIncomeData.profit_loss != null && !isNaN(netIncomeData.profit_loss) ? `$${Math.round(netIncomeData.profit_loss).toLocaleString()}` : 'N/A'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
                      <td className="p-3 text-blue-600 text-center">{agent.business_expenses != null ? `$${Math.round(agent.business_expenses).toLocaleString()}` : 'N/A'}</td>
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