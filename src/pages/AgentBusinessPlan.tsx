import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Target, 
  DollarSign, 
  CheckCircle, 
  TrendingUp, 
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
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { Disclosure } from '@headlessui/react';

interface BusinessPlanTargets {
  id?: string;
  agent_id: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  working_days: number | null;
  appraisals_target: number | null;
  listings_target: number | null;
  written_sales_target: number | null;
  settled_sales_target: number | null;
  net_commission_target: number | null;
  connects_for_appraisals: number | null;
  phone_calls_to_achieve_appraisals: number | null;
  appraisal_to_listing_ratio: number | null;
  listing_to_written_ratio: number | null;
  fall_over_rate: number | null;
  avg_commission_per_sale: number | null;
  connects_for_appraisal: number | null;
  calls_for_connect: number | null;
  created_at?: string;
  updated_at?: string;
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
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((value - min) / (max - min)) * 100}%, #BFDBFE ${((value - min) / (max - min)) * 100}%, #BFDBFE 100%)`
      }}
    />
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
  tooltip
}) => (
  <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200 relative group">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-blue-800">{label}</span>
      <span className="text-sm text-blue-600">{value}{suffix}</span>
    </div>
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || null)}
      className="w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800"
    />
    <div className="absolute z-10 hidden group-hover:block bg-blue-800 text-white text-xs rounded py-2 px-4 -top-10 left-1/2 transform -translate-x-1/2 w-64">
      {tooltip}
    </div>
  </div>
);

export function AgentBusinessPlan() {
  const { user } = useAuthStore();
  const [targets, setTargets] = useState<BusinessPlanTargets>({
    agent_id: user?.id || '',
    period_type: 'monthly',
    working_days: null,
    appraisals_target: null,
    listings_target: null,
    written_sales_target: null,
    settled_sales_target: null,
    net_commission_target: null,
    connects_for_appraisals: null,
    phone_calls_to_achieve_appraisals: null,
    appraisal_to_listing_ratio: null,
    listing_to_written_ratio: null,
    fall_over_rate: null,
    avg_commission_per_sale: null,
    connects_for_appraisal: null,
    calls_for_connect: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchBusinessPlan();
    }
  }, [user?.id]);

  useEffect(() => {
    const { 
      net_commission_target, 
      avg_commission_per_sale,
      fall_over_rate, 
      listing_to_written_ratio, 
      appraisal_to_listing_ratio,
      connects_for_appraisal,
      calls_for_connect,
      period_type,
      working_days 
    } = targets;

    let settled_sales_target: number | null = null;
    let written_sales_target: number | null = null;
    let listings_target: number | null = null;
    let appraisals_target: number | null = null;
    let connects_for_appraisals: number | null = null;
    let phone_calls_to_achieve_appraisals: number | null = null;

    // Calculate settled_sales_target if both inputs are provided
    if (net_commission_target != null && avg_commission_per_sale != null && avg_commission_per_sale > 0) {
      settled_sales_target = Math.ceil(net_commission_target / avg_commission_per_sale);
    }

    // Calculate written_sales_target if fall_over_rate is provided
    if (settled_sales_target != null && fall_over_rate != null && fall_over_rate < 100) {
      written_sales_target = Math.ceil(settled_sales_target / (1 - fall_over_rate / 100));
    }

    // Calculate listings_target if listing_to_written_ratio is provided
    if (written_sales_target != null && listing_to_written_ratio != null && listing_to_written_ratio > 0) {
      listings_target = Math.ceil(written_sales_target / (listing_to_written_ratio / 100));
    }

    // Calculate appraisals_target if appraisal_to_listing_ratio is provided
    if (listings_target != null && appraisal_to_listing_ratio != null && appraisal_to_listing_ratio > 0) {
      appraisals_target = Math.ceil(listings_target / (appraisal_to_listing_ratio / 100));
    }

    // Calculate connects_for_appraisals if connects_for_appraisal is provided
    if (appraisals_target != null && connects_for_appraisal != null) {
      connects_for_appraisals = Math.round(appraisals_target * connects_for_appraisal);
    }

    // Calculate phone_calls_to_achieve_appraisals if calls_for_connect is provided
    if (connects_for_appraisals != null && calls_for_connect != null) {
      phone_calls_to_achieve_appraisals = Math.round(connects_for_appraisals * calls_for_connect);
    }

    // Apply period multiplier for non-daily periods
    const multiplier = period_type === 'daily' ? 1 :
                      working_days != null ? working_days : 1;

    setTargets(prev => ({
      ...prev,
      settled_sales_target: settled_sales_target != null ? Math.round(settled_sales_target * (period_type === 'daily' ? 1 : multiplier)) : null,
      written_sales_target: written_sales_target != null ? Math.round(written_sales_target * (period_type === 'daily' ? 1 : multiplier)) : null,
      listings_target: listings_target != null ? Math.round(listings_target * (period_type === 'daily' ? 1 : multiplier)) : null,
      appraisals_target: appraisals_target != null ? Math.round(appraisals_target * (period_type === 'daily' ? 1 : multiplier)) : null,
      connects_for_appraisals: connects_for_appraisals != null ? Math.round(connects_for_appraisals * (period_type === 'daily' ? 1 : multiplier)) : null,
      phone_calls_to_achieve_appraisals: phone_calls_to_achieve_appraisals != null ? Math.round(phone_calls_to_achieve_appraisals * (period_type === 'daily' ? 1 : multiplier)) : null
    }));
  }, [
    targets.net_commission_target,
    targets.avg_commission_per_sale,
    targets.fall_over_rate,
    targets.listing_to_written_ratio,
    targets.appraisal_to_listing_ratio,
    targets.connects_for_appraisal,
    targets.calls_for_connect,
    targets.period_type,
    targets.working_days
  ]);

  const fetchBusinessPlan = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_business_plans')
        .select('*')
        .eq('agent_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setTargets(data);
      }
    } catch (error: any) {
      console.error('Error fetching business plan:', error);
      toast.error('Failed to load business plan');
    } finally {
      setLoading(false);
    }
  };

  const saveBusinessPlan = async () => {
    if (!user?.id) return;

    setSaving(true);
    try {
      const planData = {
        ...targets,
        agent_id: user.id,
        updated_at: new Date().toISOString()
      };

      if (targets.id) {
        const { error } = await supabase
          .from('agent_business_plans')
          .update(planData)
          .eq('id', targets.id);
        
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('agent_business_plans')
          .insert([{ ...planData, created_at: new Date().toISOString() }])
          .select()
          .single();
        
        if (error) throw error;
        setTargets(data);
      }

      toast.success('Business plan saved successfully!');
    } catch (error: any) {
      console.error('Error saving business plan:', error);
      toast.error('Failed to save business plan');
    } finally {
      setSaving(false);
    }
  };

  const downloadPlan = () => {
    setDownloading(true);
    const defaultWorkingDays = targets.period_type === 'weekly' ? 5 :
                             targets.period_type === 'monthly' ? 20 : 240;
    const workingDaysDisplay = targets.working_days != null ? targets.working_days : `Default (${defaultWorkingDays})`;

    const latexContent = `
\\documentclass[a4paper,12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage{geometry}
\\usepackage{booktabs}
\\usepackage{fancyhdr}
\\usepackage{lastpage}
\\usepackage{enumitem}
\\geometry{margin=1in}
\\pagestyle{fancy}
\\fancyhf{}
\\lhead{\\textbf{Agent Business Plan}}
\\rhead{Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
\\cfoot{Page \\thepage\\ of \\pageref{LastPage}}

\\begin{document}

\\begin{center}
  \\vspace*{1cm}
  \\Huge \\textbf{Agent Business Plan} \\\\
  \\large Generated for Agent ID: ${targets.agent_id || 'N/A'} \\\\
  \\vspace{0.5cm}
  \\normalsize Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
\\end{center}

\\vspace{1cm}

\\section*{Period Configuration}
\\begin{description}[leftmargin=0cm]
  \\item[Type:] ${targets.period_type.charAt(0).toUpperCase() + targets.period_type.slice(1)}
  \\item[Working Days:] ${workingDaysDisplay}
\\end{description}

\\section*{Targets}
\\begin{tabular}{l r}
  \\toprule
  \\textbf{Target} & \\textbf{Value} \\\\
  \\midrule
  Net Commission & ${targets.net_commission_target != null ? '\\$' + targets.net_commission_target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'} \\\\
  Average Commission per Sale & ${targets.avg_commission_per_sale != null ? '\\$' + targets.avg_commission_per_sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'} \\\\
  Settled Sales & ${targets.settled_sales_target != null ? targets.settled_sales_target.toLocaleString() : 'N/A'} ${targets.settled_sales_target != null ? '(Auto-calculated: \\$' + targets.net_commission_target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' / \\$' + targets.avg_commission_per_sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ')' : ''} \\\\
  Written Sales & ${targets.written_sales_target != null ? targets.written_sales_target.toLocaleString() : 'N/A'} ${targets.written_sales_target != null ? '(Auto-calculated: ' + targets.settled_sales_target + ' / ' + (1 - targets.fall_over_rate / 100).toFixed(2) + ')' : ''} \\\\
  Listings & ${targets.listings_target != null ? targets.listings_target.toLocaleString() : 'N/A'} ${targets.listings_target != null ? '(Auto-calculated: ' + targets.written_sales_target + ' / ' + (targets.listing_to_written_ratio / 100).toFixed(2) + ')' : ''} \\\\
  Appraisals & ${targets.appraisals_target != null ? targets.appraisals_target.toLocaleString() : 'N/A'} ${targets.appraisals_target != null ? '(Auto-calculated: ' + targets.listings_target + ' / ' + (targets.appraisal_to_listing_ratio / 100).toFixed(2) + ')' : ''} \\\\
  Connects for Appraisals & ${targets.connects_for_appraisals != null ? targets.connects_for_appraisals.toLocaleString() : 'N/A'} ${targets.connects_for_appraisals != null ? '(Auto-calculated: ' + targets.appraisals_target + ' × ' + targets.connects_for_appraisal + ')' : ''} \\\\
  Phone Calls to Achieve Appraisals & ${targets.phone_calls_to_achieve_appraisals != null ? targets.phone_calls_to_achieve_appraisals.toLocaleString() : 'N/A'} ${targets.phone_calls_to_achieve_appraisals != null ? '(Auto-calculated: ' + targets.connects_for_appraisals + ' × ' + targets.calls_for_connect + ')' : ''} \\\\
  \\bottomrule
\\end{tabular}

\\section*{Daily Targets}
\\begin{tabular}{l r}
  \\toprule
  \\textbf{Target} & \\textbf{Daily Value} \\\\
  \\midrule
  Net Commission & ${dailyTargets.commission != null ? '\\$' + dailyTargets.commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'} \\\\
  Average Commission per Sale & ${dailyTargets.avg_commission_per_sale != null ? '\\$' + dailyTargets.avg_commission_per_sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'} \\\\
  Settled Sales & ${dailyTargets.settled_sales != null ? dailyTargets.settled_sales.toLocaleString() : 'N/A'} \\\\
  Written Sales & ${dailyTargets.written_sales != null ? dailyTargets.written_sales.toLocaleString() : 'N/A'} \\\\
  Listings & ${dailyTargets.listings != null ? dailyTargets.listings.toLocaleString() : 'N/A'} \\\\
  Appraisals & ${dailyTargets.appraisals != null ? dailyTargets.appraisals.toLocaleString() : 'N/A'} \\\\
  Connects for Appraisals & ${dailyTargets.connects_for_appraisals != null ? dailyTargets.connects_for_appraisals.toLocaleString() : 'N/A'} \\\\
  Phone Calls to Achieve Appraisals & ${dailyTargets.phone_calls_to_achieve_appraisals != null ? dailyTargets.phone_calls_to_achieve_appraisals.toLocaleString() : 'N/A'} ${dailyTargets.phone_calls_to_achieve_appraisals != null && targets.phone_calls_to_achieve_appraisals != null ? '(Daily calls needed to achieve ' + targets.phone_calls_to_achieve_appraisals.toLocaleString() + ' calls)' : ''} \\\\
  \\bottomrule
\\end{tabular}

\\section*{Performance Ratios}
\\begin{description}[leftmargin=0cm]
  \\item[Fall Over Rate:] ${targets.fall_over_rate != null ? targets.fall_over_rate + '\\%' : 'N/A'}
  \\item[Appraisal to Listing Ratio:] ${targets.appraisal_to_listing_ratio != null ? targets.appraisal_to_listing_ratio + '\\%' : 'N/A'}
  \\item[Listing to Written Ratio:] ${targets.listing_to_written_ratio != null ? targets.listing_to_written_ratio + '\\%' : 'N/A'}
  \\item[Connects for Appraisal:] ${targets.connects_for_appraisal != null ? targets.connects_for_appraisal : 'N/A'}
  \\item[Calls for Connect:] ${targets.calls_for_connect != null ? targets.calls_for_connect : 'N/A'}
\\end{description}

\\section*{Metadata}
\\begin{description}[leftmargin=0cm]
  \\item[Created At:] ${targets.created_at || 'N/A'}
  \\item[Updated At:] ${targets.updated_at || 'N/A'}
\\end{description}

\\end{document}
    `;

    setTimeout(() => {
      const blob = new Blob([latexContent], { type: 'application/x-tex' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `business_plan_${new Date().toISOString().split('T')[0]}.tex`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDownloading(false);
      toast.success('PDF plan downloaded (LaTeX file). Compile with latexmk to generate PDF.');
    }, 1000);
  };

  const resetToDefaults = () => {
    setTargets({
      agent_id: user?.id || '',
      period_type: 'monthly',
      working_days: null,
      appraisals_target: null,
      listings_target: null,
      written_sales_target: null,
      settled_sales_target: null,
      net_commission_target: null,
      connects_for_appraisals: null,
      phone_calls_to_achieve_appraisals: null,
      appraisal_to_listing_ratio: null,
      listing_to_written_ratio: null,
      fall_over_rate: null,
      avg_commission_per_sale: null,
      connects_for_appraisal: null,
      calls_for_connect: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  };

  const calculateDailyTargets = () => {
    const multiplier = targets.period_type === 'daily' ? 1 :
                      targets.working_days != null ? targets.working_days : 1;

    return {
      commission: targets.net_commission_target != null ? Number((targets.net_commission_target / multiplier).toFixed(2)) : null,
      avg_commission_per_sale: targets.avg_commission_per_sale != null ? Number(targets.avg_commission_per_sale.toFixed(2)) : null,
      settled_sales: targets.settled_sales_target != null ? Number((targets.settled_sales_target / multiplier).toFixed(2)) : null,
      written_sales: targets.written_sales_target != null ? Number((targets.written_sales_target / multiplier).toFixed(2)) : null,
      listings: targets.listings_target != null ? Number((targets.listings_target / multiplier).toFixed(2)) : null,
      appraisals: targets.appraisals_target != null ? Number((targets.appraisals_target / multiplier).toFixed(2)) : null,
      connects_for_appraisals: targets.connects_for_appraisals != null ? Number((targets.connects_for_appraisals / multiplier).toFixed(2)) : null,
      phone_calls_to_achieve_appraisals: targets.phone_calls_to_achieve_appraisals != null ? Number((targets.phone_calls_to_achieve_appraisals / multiplier).toFixed(2)) : null
    };
  };

  const dailyTargets = calculateDailyTargets();

  const chartData = [
    { name: 'Appraisals', value: targets.appraisals_target ?? 0, fill: '#1E3A8A' },
    { name: 'Listings', value: targets.listings_target ?? 0, fill: '#3B82F6' },
    { name: 'Written Sales', value: targets.written_sales_target ?? 0, fill: '#60A5FA' },
    { name: 'Settled Sales', value: targets.settled_sales_target ?? 0, fill: '#93C5FD' },
    { name: 'Connects for Appraisals', value: targets.connects_for_appraisals ?? 0, fill: '#BFDBFE' },
    { name: 'Phone Calls to Achieve Appraisals', value: targets.phone_calls_to_achieve_appraisals ?? 0, fill: '#DBEAFE' },
    { name: 'Commission ($)', value: targets.net_commission_target ?? 0, fill: '#2563EB' }
  ];

  const targetCards = [
    { 
      title: 'Net Commission Target', 
      value: targets.net_commission_target ?? '', 
      daily: dailyTargets.commission ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100', 
      isCurrency: true,
      field: 'net_commission_target',
      isReadOnly: false
    },
    { 
      title: 'Avg Commission Per Sale', 
      value: targets.avg_commission_per_sale ?? '', 
      daily: dailyTargets.avg_commission_per_sale ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-500', 
      bgColor: 'bg-blue-100', 
      isCurrency: true,
      field: 'avg_commission_per_sale',
      isReadOnly: false
    },
    { 
      title: 'Settled Sales Target', 
      value: targets.settled_sales_target ?? '', 
      daily: dailyTargets.settled_sales ?? '', 
      icon: CheckCircle, 
      color: 'bg-blue-700', 
      bgColor: 'bg-blue-100',
      field: 'settled_sales_target',
      isReadOnly: true
    },
    { 
      title: 'Written Sales Target', 
      value: targets.written_sales_target ?? '', 
      daily: dailyTargets.written_sales ?? '', 
      icon: TrendingUp, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'written_sales_target',
      isReadOnly: true
    },
    { 
      title: 'Listings Target', 
      value: targets.listings_target ?? '', 
      daily: dailyTargets.listings ?? '', 
      icon: FileText, 
      color: 'bg-blue-500', 
      bgColor: 'bg-blue-100',
      field: 'listings_target',
      isReadOnly: true
    },
    { 
      title: 'Appraisals Target', 
      value: targets.appraisals_target ?? '', 
      daily: dailyTargets.appraisals ?? '', 
      icon: Home, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'appraisals_target',
      isReadOnly: true
    },
    { 
      title: 'Connects for Appraisals', 
      value: targets.connects_for_appraisals ?? '', 
      daily: dailyTargets.connects_for_appraisals ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'connects_for_appraisals',
      isReadOnly: true
    },
    { 
      title: 'Phone Calls to Achieve Appraisals', 
      value: targets.phone_calls_to_achieve_appraisals ?? '', 
      daily: dailyTargets.phone_calls_to_achieve_appraisals ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'phone_calls_to_achieve_appraisals',
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
        {/* Header */}
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
              <p className="text-blue-600 mt-2">Configure your dynamic business targets</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={resetToDefaults}
                className="flex items-center px-4 py-2 bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 transition-colors"
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
                {saving ? 'Saving...' : 'Save Plan'}
              </button>
              <button
                onClick={downloadPlan}
                disabled={downloading}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-400"
              >
                <Download className="w-4 h-4 mr-2" />
                {downloading ? 'Generating PDF...' : 'Download PDF'}
              </button>
              <button
                onClick={() => setShowPlan(true)}
                className="flex items-center px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Plan
              </button>
            </div>
          </div>
        </motion.div>

        {/* View Plan Modal */}
        {showPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-blue-900 flex items-center">
                  <FileText className="w-6 h-6 mr-2 text-blue-600" />
                  Business Plan Details
                </h2>
                <button
                  onClick={() => setShowPlan(false)}
                  className="p-2 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="space-y-4">
                <Disclosure defaultOpen>
                  {({ open }) => (
                    <>
                      <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                        <span>Period Configuration</span>
                        <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </Disclosure.Button>
                      <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                        <p><strong>Type:</strong> {targets.period_type.charAt(0).toUpperCase() + targets.period_type.slice(1)}</p>
                        <p><strong>Working Days:</strong> {targets.working_days != null ? targets.working_days : `Default (${targets.period_type === 'weekly' ? 5 : targets.period_type === 'monthly' ? 20 : 240})`}</p>
                      </Disclosure.Panel>
                    </>
                  )}
                </Disclosure>
                <Disclosure defaultOpen>
                  {({ open }) => (
                    <>
                      <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                        <span>Targets</span>
                        <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </Disclosure.Button>
                      <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                        <p><strong>Net Commission:</strong> {targets.net_commission_target != null ? '$' + targets.net_commission_target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</p>
                        <p><strong>Avg Commission per Sale:</strong> {targets.avg_commission_per_sale != null ? '$' + targets.avg_commission_per_sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</p>
                        <p><strong>Settled Sales:</strong> {targets.settled_sales_target != null ? targets.settled_sales_target.toLocaleString() : 'N/A'} {targets.settled_sales_target != null ? `(Auto-calculated: $${targets.net_commission_target.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / $${targets.avg_commission_per_sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}</p>
                        <p><strong>Written Sales:</strong> {targets.written_sales_target != null ? targets.written_sales_target.toLocaleString() : 'N/A'} {targets.written_sales_target != null ? `(Auto-calculated: ${targets.settled_sales_target} / ${(1 - targets.fall_over_rate / 100).toFixed(2)})` : ''}</p>
                        <p><strong>Listings:</strong> {targets.listings_target != null ? targets.listings_target.toLocaleString() : 'N/A'} {targets.listings_target != null ? `(Auto-calculated: ${targets.written_sales_target} / ${(targets.listing_to_written_ratio / 100).toFixed(2)})` : ''}</p>
                        <p><strong>Appraisals:</strong> {targets.appraisals_target != null ? targets.appraisals_target.toLocaleString() : 'N/A'} {targets.appraisals_target != null ? `(Auto-calculated: ${targets.listings_target} / ${(targets.appraisal_to_listing_ratio / 100).toFixed(2)})` : ''}</p>
                        <p><strong>Connects for Appraisals:</strong> {targets.connects_for_appraisals != null ? targets.connects_for_appraisals.toLocaleString() : 'N/A'} {targets.connects_for_appraisals != null ? `(Auto-calculated: ${targets.appraisals_target} × ${targets.connects_for_appraisal})` : ''}</p>
                        <p><strong>Phone Calls to Achieve Appraisals:</strong> {targets.phone_calls_to_achieve_appraisals != null ? targets.phone_calls_to_achieve_appraisals.toLocaleString() : 'N/A'} {targets.phone_calls_to_achieve_appraisals != null ? `(Auto-calculated: ${targets.connects_for_appraisals} × ${targets.calls_for_connect})` : ''}</p>
                      </Disclosure.Panel>
                    </>
                  )}
                </Disclosure>
                <Disclosure defaultOpen>
                  {({ open }) => (
                    <>
                      <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                        <span>Daily Progress Targets</span>
                        <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </Disclosure.Button>
                      <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                        <p><strong>Net Commission:</strong> {dailyTargets.commission != null ? '$' + dailyTargets.commission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</p>
                        <p><strong>Avg Commission per Sale:</strong> {dailyTargets.avg_commission_per_sale != null ? '$' + dailyTargets.avg_commission_per_sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</p>
                        <p><strong>Settled Sales:</strong> {dailyTargets.settled_sales != null ? dailyTargets.settled_sales.toLocaleString() : 'N/A'}</p>
                        <p><strong>Written Sales:</strong> {dailyTargets.written_sales != null ? dailyTargets.written_sales.toLocaleString() : 'N/A'}</p>
                        <p><strong>Listings:</strong> {dailyTargets.listings != null ? dailyTargets.listings.toLocaleString() : 'N/A'}</p>
                        <p><strong>Appraisals:</strong> {dailyTargets.appraisals != null ? dailyTargets.appraisals.toLocaleString() : 'N/A'}</p>
                        <p><strong>Connects for Appraisals:</strong> {dailyTargets.connects_for_appraisals != null ? dailyTargets.connects_for_appraisals.toLocaleString() : 'N/A'}</p>
                        <p><strong>Phone Calls to Achieve Appraisals:</strong> {dailyTargets.phone_calls_to_achieve_appraisals != null ? dailyTargets.phone_calls_to_achieve_appraisals.toLocaleString() : 'N/A'} {dailyTargets.phone_calls_to_achieve_appraisals != null && targets.phone_calls_to_achieve_appraisals != null ? `(Daily calls needed to achieve ${targets.phone_calls_to_achieve_appraisals.toLocaleString()} calls)` : ''}</p>
                      </Disclosure.Panel>
                    </>
                  )}
                </Disclosure>
                <Disclosure defaultOpen>
                  {({ open }) => (
                    <>
                      <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                        <span>Ratios</span>
                        <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </Disclosure.Button>
                      <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                        <p><strong>Fall Over Rate:</strong> {targets.fall_over_rate != null ? targets.fall_over_rate + '%' : 'N/A'}</p>
                        <p><strong>Appraisal to Listing Ratio:</strong> {targets.appraisal_to_listing_ratio != null ? targets.appraisal_to_listing_ratio + '%' : 'N/A'}</p>
                        <p><strong>Listing to Written Ratio:</strong> {targets.listing_to_written_ratio != null ? targets.listing_to_written_ratio + '%' : 'N/A'}</p>
                        <p><strong>Connects for Appraisal:</strong> {targets.connects_for_appraisal != null ? targets.connects_for_appraisal : 'N/A'}</p>
                        <p><strong>Calls for Connect:</strong> {targets.calls_for_connect != null ? targets.calls_for_connect : 'N/A'}</p>
                      </Disclosure.Panel>
                    </>
                  )}
                </Disclosure>
                <Disclosure defaultOpen>
                  {({ open }) => (
                    <>
                      <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                        <span>Metadata</span>
                        <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </Disclosure.Button>
                      <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                        <p><strong>Created At:</strong> ${targets.created_at || 'N/A'}</p>
                        <p><strong>Updated At:</strong> ${targets.updated_at || 'N/A'}</p>
                      </Disclosure.Panel>
                    </>
                  )}
                </Disclosure>
              </div>
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={downloadPlan}
                  disabled={downloading}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {downloading ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => setShowPlan(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Period Selector and Working Days */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Period Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-blue-700 mb-2">Target Period</label>
              <select
                value={targets.period_type}
                onChange={(e) => setTargets({ ...targets, period_type: e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly' })}
                className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-blue-700 mb-2">Working Days</label>
              <input
                type="number"
                min="0"
                step="1"
                value={targets.working_days ?? ''}
                onChange={(e) => setTargets({ ...targets, working_days: parseFloat(e.target.value) || null })}
                className="w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800"
                placeholder="Enter working days"
              />
            </div>
          </div>
        </motion.div>

        {/* Targets Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            Targets
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-100">
                  <th className="p-3 border-b text-blue-700">Target</th>
                  <th className="p-3 border-b text-blue-700">Value</th>
                  <th className="p-3 border-b text-blue-700">Daily Progress</th>
                </tr>
              </thead>
              <tbody>
                {targetCards.map((card) => (
                  <tr key={card.title} className="border-b hover:bg-blue-50">
                    <td className="p-3 flex items-center">
                      <div className={`${card.color} p-2 rounded-lg text-white mr-2`}>
                        <card.icon className="w-5 h-5" />
                      </div>
                      <span className="text-blue-700">{card.title}</span>
                    </td>
                    <td className="p-3">
                      <input
                        type="number"
                        min="0"
                        step={card.isCurrency ? "0.01" : "1"}
                        value={card.value}
                        onChange={(e) => {
                          if (card.isReadOnly) return;
                          const value = parseFloat(e.target.value) || null;
                          setTargets(prev => ({
                            ...prev,
                            [card.field as keyof BusinessPlanTargets]: value
                          }));
                        }}
                        disabled={card.isReadOnly}
                        className="w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800 disabled:bg-blue-200 disabled:cursor-not-allowed"
                        placeholder={`Enter ${card.title.toLowerCase()}`}
                      />
                    </td>
                    <td className="p-3 text-blue-600">
                      <motion.span
                        key={card.daily}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        {card.isCurrency ? (card.daily != null ? `$${card.daily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '') : (card.daily != null ? card.daily.toLocaleString() : '')}
                        {card.field === 'phone_calls_to_achieve_appraisals' && card.daily != null && targets.phone_calls_to_achieve_appraisals != null ? ` (Daily calls needed to achieve ${targets.phone_calls_to_achieve_appraisals.toLocaleString()} calls)` : ''}
                      </motion.span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Daily Progress Highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
            <Target className="w-5 h-5 mr-2 text-blue-600" />
            Daily Progress Goals
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targetCards.map((card) => (
              <div key={card.title} className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                <div className="flex items-center mb-2">
                  <div className={`${card.color} p-2 rounded-lg text-white mr-2`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-blue-800">{card.title}</span>
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {card.isCurrency ? (card.daily != null ? `$${card.daily.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A') : (card.daily != null ? card.daily.toLocaleString() : 'N/A')}
                  {card.field === 'phone_calls_to_achieve_appraisals' && card.daily != null && targets.phone_calls_to_achieve_appraisals != null ? ` (Daily calls needed to achieve ${targets.phone_calls_to_achieve_appraisals.toLocaleString()} calls)` : ''}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Ratios Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200"
        >
          <h2 className="text-lg font-semibold mb-6 text-blue-900 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-blue-600" />
            Performance Ratios
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RatioSlider
              label="Fall Over Rate"
              value={targets.fall_over_rate ?? 0}
              onChange={(value) => setTargets({ ...targets, fall_over_rate: value })}
              min={0}
              max={50}
              step={0.5}
              suffix="%"
              tooltip="Percentage of written sales that don't settle (fall over)"
            />
            <RatioSlider
              label="Appraisal to Listing Ratio"
              value={targets.appraisal_to_listing_ratio ?? 0}
              onChange={(value) => setTargets({ ...targets, appraisal_to_listing_ratio: value })}
              min={0}
              max={100}
              step={1}
              suffix="%"
              tooltip="Percentage of appraisals that convert to listings"
            />
            <RatioSlider
              label="Listing to Written Ratio"
              value={targets.listing_to_written_ratio ?? 0}
              onChange={(value) => setTargets({ ...targets, listing_to_written_ratio: value })}
              min={0}
              max={100}
              step={1}
              suffix="%"
              tooltip="Percentage of listings that convert to written sales"
            />
            <RatioInput
              label="Connects for Appraisal"
              value={targets.connects_for_appraisal ?? ''}
              onChange={(value) => setTargets({ ...targets, connects_for_appraisal: value })}
              min={0}
              step={1}
              suffix=""
              tooltip="Number of connects required to achieve one appraisal"
            />
            <RatioInput
              label="Calls for Connect"
              value={targets.calls_for_connect ?? ''}
              onChange={(value) => setTargets({ ...targets, calls_for_connect: value })}
              min={0}
              step={1}
              suffix=""
              tooltip="Number of calls required to achieve one connect"
            />
          </div>
        </motion.div>

        {/* Chart Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            Target Visualization
          </h2>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#BFDBFE" />
                <XAxis dataKey="name" stroke="#1E3A8A" />
                <YAxis yAxisId="left" stroke="#1E3A8A" />
                <YAxis yAxisId="right" orientation="right" stroke="#2563EB" domain={[0, Math.max((targets.net_commission_target ?? 0) * 1.2, 1000)]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#EFF6FF', borderColor: '#3B82F6' }}
                  formatter={(value: number, name: string) => [
                    name === 'Commission ($)' ? `$${value.toLocaleString()}` : value.toLocaleString(),
                    name
                  ]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="value" name="Count Targets" fillOpacity={0.8}>
                  <LabelList dataKey="value" position="top" formatter={(value: number) => value.toLocaleString()} fill="#1E3A8A" />
                </Bar>
                <Bar yAxisId="right" dataKey={chartData[6].value} name="Commission ($)" fill="#2563EB">
                  <LabelList dataKey="value" position="top" formatter={(value: number) => `$${value.toLocaleString()}`} fill="#2563EB" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Summary Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 bg-gradient-to-r from-blue-100 to-blue-200 rounded-lg p-6 border border-blue-300"
        >
          <h2 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-blue-600" />
            Performance Summary
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.appraisals_target != null && targets.listings_target != null && targets.appraisals_target > 0 ? Math.round((targets.listings_target / targets.appraisals_target) * 100) : 'N/A'}%
              </div>
              <div className="text-sm text-blue-600">Listing Conversion Rate</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.avg_commission_per_sale != null ? '$' + targets.avg_commission_per_sale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Avg Commission per Sale</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.settled_sales_target != null && targets.net_commission_target != null && targets.settled_sales_target > 0 ? `$${Math.round(targets.net_commission_target / targets.settled_sales_target).toLocaleString()}` : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Net Commission per Settled Sale</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.working_days != null ? targets.working_days : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Working Days</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default AgentBusinessPlan;