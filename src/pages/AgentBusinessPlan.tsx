import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { Disclosure } from '@headlessui/react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
      <span className="text-sm text-blue-600">{value ? `${suffix === '%' ? Math.round(Number(value)) : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })} ${suffix}` : 'N/A'}</span>
    </div>
    <div className="relative">
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || null)}
        className="w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800 pr-8"
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
  const { user } = useAuthStore();
  const [targets, setTargets] = useState<BusinessPlanTargets>({
    agent_id: user?.id || '',
    agent_name: isAdmin ? '' : user?.name || '', // Default to user.name for agent dashboard
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
  const [showPlan, setShowPlan] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'details' | 'pdf'>('details');
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);

  useEffect(() => {
  // Only update agent_name if we're in agent mode and user.name exists
  if (!isAdmin && user?.name) {
    setTargets(prev => {
      // Only update if the name is different to prevent infinite loops
      if (prev.agent_name !== user.name) {
        return { ...prev, agent_name: user.name };
      }
      return prev;
    });
  }
}, [user?.name, isAdmin]);

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

    // Calculate commission average
    if (avg_commission_price_per_property != null && franchise_fee != null) {
      commission_average = Math.round(avg_commission_price_per_property * (1 - franchise_fee / 100));
    }

    // Calculate agent and business commissions
    if (commission_average != null && agent_percentage != null && business_percentage != null) {
      agent_commission = Math.round(commission_average * (agent_percentage / 100));
      business_commission = Math.round(commission_average * (business_percentage / 100));
    }

    // Set avg_commission_per_sale to agent_commission
    const avg_commission_per_sale_updated = agent_commission;

    // Calculate settled sales target
    if (gross_commission_target != null && avg_commission_per_sale_updated != null && avg_commission_per_sale_updated > 0) {
      settled_sales_target = Math.round(gross_commission_target / avg_commission_per_sale_updated);
    }

    

    // Calculate listings target (alternative)
    if (settled_sales_target != null && listing_to_written_ratio != null && listing_to_written_ratio > 0) {
      const fallOverFactor = fall_over_rate != null && fall_over_rate > 0 ? (1 + fall_over_rate / 100) : 1;
      listings_target = Math.round(settled_sales_target * fallOverFactor);
    }

    // Calculate appraisals target
    if (listings_target != null && appraisal_to_listing_ratio != null && appraisal_to_listing_ratio > 0) {
      const fallOverFactor = fall_over_rate != null && fall_over_rate > 0 ? (1 + fall_over_rate / 100) : 1;
      appraisals_target = Math.round(listings_target / (appraisal_to_listing_ratio / 100) * fallOverFactor);
    }

    // Calculate connects for appraisals
    if (appraisals_target != null && connects_for_appraisal != null) {
      connects_for_appraisals = Math.round(appraisals_target * connects_for_appraisal);
    }

    // Calculate phone calls to achieve appraisals
    if (connects_for_appraisals != null && calls_for_connect != null) {
      phone_calls_to_achieve_appraisals = Math.round(connects_for_appraisals * calls_for_connect);
    }

    // Calculate calls per day
    if (phone_calls_to_achieve_appraisals != null && no_of_working_days_per_year != null && no_of_working_days_per_year > 0) {
      calls_per_day = Math.round(phone_calls_to_achieve_appraisals / no_of_working_days_per_year);
    }

    // Calculate number of people required
    if (phone_calls_to_achieve_appraisals != null && calls_per_person != null && calls_per_person > 0 && no_of_working_days_per_year != null && no_of_working_days_per_year > 0) {
      no_of_people_required = Math.ceil(phone_calls_to_achieve_appraisals / (calls_per_person * no_of_working_days_per_year));
    }

    // Calculate salary per day
    if (salary_per_hour != null) {
      salary_per_day = Math.round(salary_per_hour * 8);
    }

    // Calculate persons salary (yearly, assuming 261 working days)
    if (salary_per_day != null && no_of_people_required != null) {
      persons_salary = Math.round(salary_per_day * no_of_people_required * 261);
    }

    // Calculate total third party calls
    if (cost_per_third_party_call != null && how_many_calls != null) {
      total_third_party_calls = Math.round(cost_per_third_party_call * how_many_calls);
    }

    // Calculate total cost for appraisals
    if (how_many_appraisals != null && how_many_appraisals > 0) {
      total_cost_appraisals = Math.round(how_many_appraisals * how_many_appraisals);
    }

    // Calculate net commission
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
        setTargets({
          ...data,
          
          agent_name: isAdmin ? data.agent_name || '' : user?.name || '',
          gross_commission_target: data.gross_commission_target != null ? Math.round(data.gross_commission_target) : null,
          avg_commission_per_sale: data.avg_commission_per_sale != null ? Math.round(data.avg_commission_per_sale) : null,
          salary_per_hour: data.salary_per_hour != null ? Math.round(data.salary_per_hour) : null,
          salary_per_day: data.salary_per_day != null ? Math.round(data.salary_per_day) : null,
          persons_salary: data.persons_salary != null ? Math.round(data.persons_salary) : null,
          marketing_expenses: data.marketing_expenses != null ? Math.round(data.marketing_expenses) : null,
          net_commission: data.net_commission != null ? Math.round(data.net_commission) : null,
          cost_per_third_party_call: data.cost_per_third_party_call != null ? Math.round(data.cost_per_third_party_call) : null,
          how_many_calls: data.how_many_calls != null ? Math.round(data.how_many_calls) : null,
          how_many_appraisals: data.how_many_appraisals != null ? Math.round(data.how_many_appraisals) : null,
          total_third_party_calls: data.total_third_party_calls != null ? Math.round(data.total_third_party_calls) : null,
          total_cost_appraisals: data.total_cost_appraisals != null ? Math.round(data.total_cost_appraisals) : null,
          avg_commission_price_per_property: data.avg_commission_price_per_property != null ? Math.round(data.avg_commission_price_per_property) : null,
          franchise_fee: data.franchise_fee != null ? Math.round(data.franchise_fee) : null,
          commission_average: data.commission_average != null ? Math.round(data.commission_average) : null,
          agent_percentage: data.agent_percentage != null ? Math.round(data.agent_percentage) : null,
          business_percentage: data.business_percentage != null ? Math.round(data.business_percentage) : null,
          agent_commission: data.agent_commission != null ? Math.round(data.agent_commission) : null,
          business_commission: data.business_commission != null ? Math.round(data.business_commission) : null
        });
      }else if (!isAdmin && user?.name) {
      // If no data exists, ensure agent name is set from user
      setTargets(prev => ({
        ...prev,
        agent_id: isAdmin ? prev.agent_id : user.id,
        agent_name: isAdmin ? prev.agent_name : user?.name || ''
        // agent_name: user.name
      }));
    }
    } catch (error) {
      console.error('Error fetching business plan:', error);
      toast.error('Failed to load business plan');
    } finally {
      setLoading(false);
    }
  };

  const saveBusinessPlan = async () => {
    if (!user?.id && !isAdmin) return;
    

    setSaving(true);
    try {
      const planData = {
        ...targets,
        agent_id: isAdmin ? targets.agent_id : user?.id,
        updated_at: new Date().toISOString(),
        gross_commission_target: targets.gross_commission_target != null ? Math.round(targets.gross_commission_target) : null,
        avg_commission_per_sale: targets.avg_commission_per_sale != null ? Math.round(targets.avg_commission_per_sale) : null,
        salary_per_hour: targets.salary_per_hour != null ? Math.round(targets.salary_per_hour) : null,
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
        setTargets({
          ...data,
          agent_name: isAdmin ? data.agent_name || '' : user?.name || 'Unknown Agent',
          gross_commission_target: data.gross_commission_target != null ? Math.round(data.gross_commission_target) : null,
          avg_commission_per_sale: data.avg_commission_per_sale != null ? Math.round(data.avg_commission_per_sale) : null,
          salary_per_hour: data.salary_per_hour != null ? Math.round(data.salary_per_hour) : null,
          salary_per_day: data.salary_per_day != null ? Math.round(data.salary_per_day) : null,
          persons_salary: data.persons_salary != null ? Math.round(data.persons_salary) : null,
          marketing_expenses: data.marketing_expenses != null ? Math.round(data.marketing_expenses) : null,
          net_commission: data.net_commission != null ? Math.round(data.net_commission) : null,
          cost_per_third_party_call: data.cost_per_third_party_call != null ? Math.round(data.cost_per_third_party_call) : null,
          how_many_calls: data.how_many_calls != null ? Math.round(data.how_many_calls) : null,
          how_many_appraisals: data.how_many_appraisals != null ? Math.round(data.how_many_appraisals) : null,
          total_third_party_calls: data.total_third_party_calls != null ? Math.round(data.total_third_party_calls) : null,
          total_cost_appraisals: data.total_cost_appraisals != null ? Math.round(data.total_cost_appraisals) : null,
          avg_commission_price_per_property: data.avg_commission_price_per_property != null ? Math.round(data.avg_commission_price_per_property) : null,
          franchise_fee: data.franchise_fee != null ? Math.round(data.franchise_fee) : null,
          commission_average: data.commission_average != null ? Math.round(data.commission_average) : null,
          agent_percentage: data.agent_percentage != null ? Math.round(data.agent_percentage) : null,
          business_percentage: data.business_percentage != null ? Math.round(data.business_percentage) : null,
          agent_commission: data.agent_commission != null ? Math.round(data.agent_commission) : null,
          business_commission: data.business_commission != null ? Math.round(data.business_commission) : null
        });
      }

      toast.success('Business plan saved successfully!');
    } catch (error) {
      console.error('Error saving business plan:', error);
      toast.error('Failed to save business plan');
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = (forView = false) => {
    setGenerating(true);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    let yOffset = margin;

    // Set fonts
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);

    // Header
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

    // Agent Information
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

    // Period Configuration
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 8, 'F');
    doc.text('Period Configuration', margin + 3, yOffset + 5);
    yOffset += 10;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    const defaultWorkingDays = targets.period_type === 'weekly' ? 5 :
                              targets.period_type === 'monthly' ? 21.5 : 261;
    doc.autoTable({
      startY: yOffset,
      head: [['Field', 'Value']],
      body: [
        ['Type', targets.period_type.charAt(0).toUpperCase() + targets.period_type.slice(1)],
        ['Working Days per Year', targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year).toLocaleString() : 'N/A']
      ],
      theme: 'striped',
      styles: { fontSize: 7, cellPadding: 2, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219], halign: 'center', valign: 'middle' },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 50, halign: 'left' }, 1: { cellWidth: 90, halign: 'center' } },
      margin: { left: margin, right: margin }
    });
    yOffset = doc.lastAutoTable.finalY + 10;

    // Commission Structure
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

    // Performance Ratios
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

    // Targets
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
        ['Salary per Hour', targets.salary_per_hour != null ? `$${Math.round(targets.salary_per_hour).toLocaleString()}` : 'N/A'],
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

    // Metadata
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

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(`Page 1 of 1`, pageWidth - margin - 15, pageHeight - margin);
    doc.text('Generated by RealRed', margin, pageHeight - margin);

    if (forView) {
      const pdfDataUri = doc.output('datauristring');
      setPdfDataUri(pdfDataUri);
      setGenerating(false);
      toast.success('PDF generated for viewing!');
    } else {
      doc.save(`business_plan_${new Date().toISOString().split('T')[0]}.pdf`);
      setGenerating(false);
      toast.success('PDF downloaded successfully!');
    }
  };

  const viewPlan = () => {
    setShowPlan(true);
    setViewMode('pdf');
    generatePDF(true);
  };

  const downloadPlan = () => {
    generatePDF(false);
  };

  const resetToDefaults = () => {
    setTargets({
      agent_id: user?.id || '',
      agent_name: isAdmin ? '' : user?.name || 'Unknown Agent',
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
  };

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
    { name: 'Agent Commission', value: targets.agent_commission, fill: '#10B981' },
    { name: 'Business Commission', value: targets.business_commission, fill: '#F59E0B' }
  ];

  const targetCards = [
    { 
      title: 'Gross Commission Target', 
      value: targets.gross_commission_target ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100', 
      isCurrency: true,
      field: 'gross_commission_target',
      isReadOnly: false
    },
    { 
      title: 'Average Commission Per Sale', 
      value: targets.avg_commission_per_sale ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-500', 
      bgColor: 'bg-blue-100', 
      isCurrency: true,
      field: 'avg_commission_per_sale',
      isReadOnly: true
    },
    { 
      title: 'Settled Sales Target', 
      value: targets.settled_sales_target ?? '', 
      icon: CheckCircle, 
      color: 'bg-blue-700', 
      bgColor: 'bg-blue-100',
      field: 'settled_sales_target',
      isReadOnly: true
    },
    { 
      title: 'Listings Target', 
      value: targets.listings_target ?? '', 
      icon: FileText, 
      color: 'bg-blue-500', 
      bgColor: 'bg-blue-100',
      field: 'listings_target',
      isReadOnly: true
    },
    { 
      title: 'Appraisals Target', 
      value: targets.appraisals_target ?? '', 
      icon: Home, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'appraisals_target',
      isReadOnly: true
    },
    { 
      title: 'Connects for Appraisals', 
      value: targets.connects_for_appraisals ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'connects_for_appraisals',
      isReadOnly: true
    },
    { 
      title: 'Phone Calls to Achieve Appraisals', 
      value: targets.phone_calls_to_achieve_appraisals ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'phone_calls_to_achieve_appraisals',
      isReadOnly: true
    },
    { 
      title: 'Calls per Day', 
      value: targets.calls_per_day ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'calls_per_day',
      isReadOnly: true
    },
    { 
      title: 'Calls per Person', 
      value: targets.calls_per_person ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'calls_per_person',
      isReadOnly: false
    },
    { 
      title: 'Number of People Required', 
      value: targets.no_of_people_required ?? '', 
      icon: Target, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'no_of_people_required',
      isReadOnly: true
    },
    { 
      title: 'Salary per Hour', 
      value: targets.salary_per_hour ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'salary_per_hour',
      isReadOnly: false
    },
    { 
      title: 'Salary per Day', 
      value: targets.salary_per_day ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'salary_per_day',
      isReadOnly: true
    },
    { 
      title: 'Persons Salary', 
      value: targets.persons_salary ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'persons_salary',
      isReadOnly: true
    },
    { 
      title: 'Marketing Expenses', 
      value: targets.marketing_expenses ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'marketing_expenses',
      isReadOnly: false
    },
    { 
      title: 'Cost per Third Party Call', 
      value: targets.cost_per_third_party_call ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'cost_per_third_party_call',
      isReadOnly: false
    },
    { 
      title: 'How Many Calls', 
      value: targets.how_many_calls ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'how_many_calls',
      isReadOnly: false
    },
    { 
      title: 'How Many Appraisals', 
      value: targets.how_many_appraisals ?? '', 
      icon: Home, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'how_many_appraisals',
      isReadOnly: false
    },
    { 
      title: 'Total Third Party Calls', 
      value: targets.total_third_party_calls ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'total_third_party_calls',
      isReadOnly: true
    },
    { 
      title: 'Total Cost for Appraisals', 
      value: targets.total_cost_appraisals ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'total_cost_appraisals',
      isReadOnly: true
    },
    { 
      title: 'Net Commission', 
      value: targets.net_commission ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
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
      bgColor: 'bg-blue-100', 
      isCurrency: true,
      field: 'avg_commission_price_per_property',
      isReadOnly: false
    },
    { 
      title: 'Franchise Fee', 
      value: targets.franchise_fee ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100', 
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
      bgColor: 'bg-blue-100', 
      isCurrency: true,
      field: 'commission_average',
      isReadOnly: true
    },
    { 
      title: 'Agent Percentage', 
      value: targets.agent_percentage ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100', 
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
      bgColor: 'bg-blue-100', 
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
      bgColor: 'bg-blue-100', 
      isCurrency: true,
      field: 'agent_commission',
      isReadOnly: true
    },
    { 
      title: 'Business Commission', 
      value: targets.business_commission ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100', 
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
                disabled={generating}
                className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-400"
              >
                <Download className="w-4 h-4 mr-2" />
                {generating ? 'Generating PDF...' : 'Download PDF'}
              </button>
              <button
                onClick={viewPlan}
                disabled={generating}
                className="flex items-center px-4 py-2 bg-blue-400 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:bg-blue-400"
              >
                <Eye className="w-4 h-4 mr-2" />
                {generating ? 'Generating PDF...' : 'View Plan'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* View Plan Modal */}
        {showPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-blue-900 flex items-center">
                  <FileText className="w-6 h-6 mr-2 text-blue-600" />
                  Business Plan {viewMode === 'pdf' ? 'Preview' : 'Details'}
                </h2>
                <div className="flex space-x-2">
                  {viewMode === 'pdf' && (
                    <button
                      onClick={() => setViewMode('details')}
                      className="px-3 py-1 bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 transition-colors"
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
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
              {viewMode === 'pdf' ? (
                <div className="h-[50vh]">
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
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Disclosure defaultOpen>
                    {({ open }) => (
                      <>
                        <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                          <span>Agent Information</span>
                          <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </Disclosure.Button>
                        <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                          <p><strong>Agent Name:</strong> {targets.agent_name || 'N/A'}</p>
                        </Disclosure.Panel>
                      </>
                    )}
                  </Disclosure>
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
                          <p><strong>Working Days per Year:</strong> {targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year).toLocaleString() : 'N/A'}</p>
                        </Disclosure.Panel>
                      </>
                    )}
                  </Disclosure>
                  <Disclosure defaultOpen>
                    {({ open }) => (
                      <>
                        <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                          <span>Commission Structure</span>
                          <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </Disclosure.Button>
                        <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
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
                        <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                          <span>Performance Ratios</span>
                          <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </Disclosure.Button>
                        <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                          <p><strong>Conversion Fall Over Rate:</strong> {targets.fall_over_rate != null ? `${Math.round(targets.fall_over_rate)}%` : 'N/A'}</p>
                          <p><strong>Appraisal to Listing Ratio:</strong> {targets.appraisal_to_listing_ratio != null ? `${Math.round(targets.appraisal_to_listing_ratio)}%` : 'N/A'}</p>
                          <p><strong>Listing to Written Ratio:</strong> {targets.listing_to_written_ratio != null ? `${Math.round(targets.listing_to_written_ratio)}%` : 'N/A'}</p>
                          <p><strong>Connects for Appraisal:</strong> {targets.connects_for_appraisal != null ? Math.round(targets.connects_for_appraisal).toLocaleString() : 'N/A'}</p>
                          <p><strong>Calls for Connect:</strong> {targets.calls_for_connect != null ? Math.round(targets.calls_for_connect).toLocaleString() : 'N/A'}</p>
                          <p><strong>Working Days per Year:</strong> {targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year).toLocaleString() : 'N/A'}</p>
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
                          <p><strong>Salary per Hour:</strong> {targets.salary_per_hour != null ? `$${Math.round(targets.salary_per_hour).toLocaleString()}` : 'N/A'}</p>
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
                        <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-sm font-medium text-left text-blue-900 bg-blue-100 rounded-lg hover:bg-blue-200 focus:outline-none">
                          <span>Metadata</span>
                          <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </Disclosure.Button>
                        <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                          <p><strong>Created At:</strong> {targets.created_at || 'N/A'}</p>
                          <p><strong>Updated At:</strong> {targets.updated_at || 'N/A'}</p>
                        </Disclosure.Panel>
                      </>
                    )}
                  </Disclosure>
                </div>
              )}
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={downloadPlan}
                  disabled={generating}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {generating ? 'Generating PDF...' : 'Download PDF'}
                </button>
                <button
                  onClick={() => {
                    setShowPlan(false);
                    setViewMode('details');
                    setPdfDataUri(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Agent Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-blue-600" />
            Agent Information
          </h2>
          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-semibold text-blue-700 mb-2">Agent Name</label>
              <input
                type="text"
                value={targets.agent_name || ''}
                onChange={(e) => setTargets({ ...targets, agent_name: e.target.value })}
                disabled={!isAdmin  && !!user?.name} // Only disabled in agent dashboard
                className={`w-full px-4 py-3 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800 ${!isAdmin ? 'bg-blue-200 cursor-not-allowed' : ''}`}
                placeholder="Enter agent name"
              />
            </div>
          </div>
        </motion.div>

        {/* Period Selector */}
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
          </div>
        </motion.div>

        {/* Commission Structure */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
            Commission Structure
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-blue-100">
                  <th className="p-3 border-b text-green-700">Commission Metric</th>
                  <th className="p-3 border-b text-green-700">Value</th>
                </tr>
              </thead>
              <tbody>
                {commissionCards.map((card) => (
                  <tr key={card.title} className="border-b hover:bg-green-50">
                    <td className="p-3 flex items-center">
                      <div className={`${card.color} p-2 rounded-lg text-white mr-2`}>
                        <card.icon className="w-5 h-5" />
                      </div>
                      <span className="text-green-700">{card.title}</span>
                    </td>
                    <td className="p-3">
                      {card.isReadOnly ? (
                        <span className="text-green-700">
                          {card.value != null 
                            ? `${card.isCurrency ? '$' : ''}${Math.round(Number(card.value)).toLocaleString()}${!card.isCurrency && card.title.includes('Percentage') ? '%' : ''}` 
                            : 'N/A'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step={card.isCurrency ? "100" : "1"}
                          value={card.value || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || null;
                            setTargets({ ...targets, [card.field]: value });
                          }}
                          className="w-full px-3 py-2 border border-green-300 rounded-lg focus:ring-green-500 focus:border-green-600 bg-green-50 text-green-800"
                          placeholder={`Enter ${card.title.toLowerCase()}`}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Period Selector */}
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
          </div>
        </motion.div>

        {/* Performance Ratios */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-6 text-blue-900 flex items-center">
            <Settings className="w-5 h-5 mr-2 text-blue-600" />
            Performance Ratios
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RatioInput
              label="Conversion Fall Over Rate"
              value={targets.fall_over_rate ?? ''}
              onChange={(value) => setTargets({ ...targets, fall_over_rate: value })}
              min={0}
              step={0.5}
              suffix="%"
              tooltip="Percentage of written sales that don't settle (fall over)"
            />
            <RatioInput
              label="Appraisal to Listing Ratio"
              value={targets.appraisal_to_listing_ratio ?? ''}
              onChange={(value) => setTargets({ ...targets, appraisal_to_listing_ratio: value })}
              min={0}
              step={1}
              suffix="%"
              tooltip="Percentage of appraisals that convert to listings"
            />
            <RatioInput
              label="Listing to Written Ratio"
              value={targets.listing_to_written_ratio ?? ''}
              onChange={(value) => setTargets({ ...targets, listing_to_written_ratio: value })}
              min={0}
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
            <RatioInput
              label="Working Days per Year"
              value={targets.no_of_working_days_per_year ?? ''}
              onChange={(value) => setTargets({ ...targets, no_of_working_days_per_year: value })}
              min={0}
              step={1}
              suffix=""
              tooltip="Number of working days in a year"
            />
          </div>
        </motion.div>

        {/* Targets Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
                      <div className="flex items-center">
                        {card.isCurrency && <span className="mr-1">$</span>}
                        <input
                          type="text" // Changed to text to support comma formatting
                          value={
                            card.value != null
                              ? card.isCurrency
                                ? Number(card.value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                : card.value
                              : ''
                          }
                          onChange={(e) => {
                            if (card.isReadOnly) return;
                            const rawValue = e.target.value.replace(/[^0-9]/g, ''); // Remove non-numeric characters (e.g., commas)
                            const parsedValue = rawValue ? parseFloat(rawValue) : null;
                            setTargets((prev) => ({
                              ...prev,
                              [card.field as keyof BusinessPlanTargets]: parsedValue,
                            }));
                          }}
                          disabled={card.isReadOnly}
                          className="w-full px-2 py-1 border border-blue-300 rounded-lg focus:ring-blue-500 focus:border-blue-600 bg-blue-50 text-blue-800 disabled:bg-blue-200 disabled:cursor-not-allowed"
                          placeholder={`Enter ${card.title.toLowerCase()}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Performance Goals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg p-6 shadow-sm border border-blue-200 mb-8"
        >
          <h2 className="text-lg font-semibold mb-4 text-blue-900 flex items-center">
            <Target className="w-5 h-5 mr-2 text-blue-600" />
            Performance Goals
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
                  {card.isCurrency ? (card.value != null ? `$${Math.round(card.value).toLocaleString()}` : 'N/A') : (card.value != null ? Math.round(card.value).toLocaleString() : 'N/A')}
                </div>
              </div>
            ))}
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
                  yAxisId="left" 
                  stroke="#1E3A8A" 
                  domain={[0, dataMax => Math.max(dataMax * 1.2, 100)]}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  stroke="#2563EB" 
                  domain={[0, dataMax => Math.max((targets.gross_commission_target ?? 0) * 1.3, (targets.net_commission ?? 0) * 1.3, (targets.persons_salary ?? 0) * 1.3, (targets.total_third_party_calls ?? 0) * 1.3, (targets.total_cost_appraisals ?? 0) * 1.3, 1000)]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderRadius: 4 }}
                  formatter={(value: number, name: string) => [
                    name === 'Gross Commission' || name === 'Persons Salary' || name === 'Net Commission' || name === 'Third Party Calls' || name === 'Total Cost Appraisals'
                      ? value != null ? `$${Math.round(value).toLocaleString()}` : 'N/A'
                      : value != null ? Math.round(value).toLocaleString() : 'N/A',
                    name
                  ]}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar yAxisId="left" dataKey="value" name="Count Targets" fillOpacity={0.8}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(value: number) => (value != null ? Math.round(value).toLocaleString() : 'N/A')} 
                    fill="#1E3A8A"
                    fontSize={10}
                    offset={8}
                  />
                </Bar>
                <Bar yAxisId="right" dataKey="value" name="Gross Commission" fill="#2563EB" data={chartData.filter(d => d.name === 'Gross Commission')}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(value: number) => (value != null ? `$${Math.round(value).toLocaleString()}` : 'N/A')} 
                    fill="#2563EB"
                    fontSize={10}
                    offset={8}
                  />
                </Bar>
                <Bar yAxisId="right" dataKey="value" name="Persons Salary" fill="#1D4ED8" data={chartData.filter(d => d.name === 'Persons Salary')}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(value: number) => (value != null ? `$${Math.round(value).toLocaleString()}` : 'N/A')} 
                    fill="#1D4ED8"
                    fontSize={10}
                    offset={8}
                  />
                </Bar>
                <Bar yAxisId="right" dataKey="value" name="Third Party Calls" fill="#1E90FF" data={chartData.filter(d => d.name === 'Third Party Calls')}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(value: number) => (value != null ? `$${Math.round(value).toLocaleString()}` : 'N/A')} 
                    fill="#1E90FF"
                    fontSize={10}
                    offset={8}
                  />
                </Bar>
                <Bar yAxisId="right" dataKey="value" name="Total Cost Appraisals" fill="#1D4ED8" data={chartData.filter(d => d.name === 'Total Cost Appraisals')}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(value: number) => (value != null ? `$${Math.round(value).toLocaleString()}` : 'N/A')} 
                    fill="#1D4ED8"
                    fontSize={10}
                    offset={8}
                  />
                </Bar>
                <Bar yAxisId="right" dataKey="value" name="Net Commission" fill="#3B82F6" data={chartData.filter(d => d.name === 'Net Commission')}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(value: number) => (value != null ? `$${Math.round(value).toLocaleString()}` : 'N/A')} 
                    fill="#3B82F6"
                    fontSize={10}
                    offset={8}
                  />
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
                {targets.appraisals_target != null && targets.listings_target != null && targets.appraisals_target > 0 ? `${Math.round((targets.listings_target / targets.appraisals_target) * 100)}%` : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Listing Conversion Rate</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.avg_commission_per_sale != null ? `$${Math.round(targets.avg_commission_per_sale).toLocaleString()}` : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Average Commission Per Sale</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.settled_sales_target != null && targets.gross_commission_target != null && targets.settled_sales_target > 0 ? `$${Math.round(targets.gross_commission_target / targets.settled_sales_target).toLocaleString()}` : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Gross Commission per Settled Sale</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.net_commission != null ? `$${Math.round(targets.net_commission).toLocaleString()}` : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Net Commission</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default AgentBusinessPlan;