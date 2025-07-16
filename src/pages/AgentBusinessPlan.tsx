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
  period_type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  appraisals_target: number | null;
  listings_target: number | null;
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
  no_of_working_days_per_year: number | null;
  no_of_working_days_per_month: number | null;
  calls_per_person: number | null;
  no_of_people_required: number | null;
  salary_per_hour: number | null;
  salary_per_day: number | null;
  marketing_expenses: number | null;
  split_person: number | null;
  persons_salary: number | null;
  total_of_all: number | null;
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
      onChange={(e) => onChange(parseInt(e.target.value) || null)}
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
    appraisals_target: null,
    listings_target: null,
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
    no_of_working_days_per_year: null,
    no_of_working_days_per_month: null,
    calls_per_person: null,
    no_of_people_required: 2,
    salary_per_hour: 60,
    salary_per_day: null,
    marketing_expenses: 6000,
    split_person: null,
    persons_salary: null,
    total_of_all: null,
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
    if (user?.id) {
      fetchBusinessPlan();
    }
  }, [user?.id]);

  useEffect(() => {
    const { 
      net_commission_target, 
      avg_commission_per_sale,
      listing_to_written_ratio, 
      appraisal_to_listing_ratio,
      connects_for_appraisal,
      calls_for_connect,
      period_type,
      no_of_people_required,
      salary_per_hour,
      marketing_expenses
    } = targets;

    let settled_sales_target: number | null = null;
    let listings_target: number | null = null;
    let appraisals_target: number | null = null;
    let connects_for_appraisals: number | null = null;
    let no_of_working_days_per_year: number | null = null;
    let no_of_working_days_per_month: number | null = null;
    let calls_per_person: number | null = null;
    let salary_per_day: number | null = null;
    let split_person: number | null = null;
    let persons_salary: number | null = null;
    let total_of_all: number | null = null;

    if (net_commission_target != null && avg_commission_per_sale != null && avg_commission_per_sale > 0) {
      settled_sales_target = Math.round(net_commission_target / avg_commission_per_sale);
    }

    if (settled_sales_target != null && listing_to_written_ratio != null && listing_to_written_ratio > 0) {
      listings_target = Math.round(settled_sales_target / (listing_to_written_ratio / 100));
    }

    if (listings_target != null && appraisal_to_listing_ratio != null && appraisal_to_listing_ratio > 0) {
      appraisals_target = Math.round(listings_target / (appraisal_to_listing_ratio / 100));
    }

    if (appraisals_target != null && connects_for_appraisal != null) {
      connects_for_appraisals = Math.round(appraisals_target * connects_for_appraisal);
    }

    if (connects_for_appraisals != null && calls_for_connect != null) {
      targets.phone_calls_to_achieve_appraisals = Math.round(connects_for_appraisals * calls_for_connect);
    }

    if (targets.phone_calls_to_achieve_appraisals != null) {
      no_of_working_days_per_year = Math.round(targets.phone_calls_to_achieve_appraisals / 261);
      no_of_working_days_per_month = Math.round(targets.phone_calls_to_achieve_appraisals / 12);
      calls_per_person = Math.max(0, no_of_working_days_per_year - 224);
    }

    if (calls_per_person != null && no_of_people_required != null && no_of_people_required > 0) {
      split_person = Math.round(calls_per_person / no_of_people_required);
    }

    if (salary_per_hour != null) {
      salary_per_day = Math.round(salary_per_hour * 8);
    }

    if (no_of_people_required != null && salary_per_day != null) {
      persons_salary = Math.round(no_of_people_required * salary_per_day);
    }

    if (marketing_expenses != null && persons_salary != null) {
      total_of_all = Math.round(marketing_expenses + persons_salary);
    }

    const multiplier = period_type === 'daily' ? 1 : 
                      period_type === 'weekly' ? 5 :
                      period_type === 'monthly' ? 20 : 240;

    setTargets(prev => ({
      ...prev,
      settled_sales_target: settled_sales_target != null ? Math.round(settled_sales_target * multiplier) : null,
      listings_target: listings_target != null ? Math.round(listings_target * multiplier) : null,
      appraisals_target: appraisals_target != null ? Math.round(appraisals_target * multiplier) : null,
      connects_for_appraisals: connects_for_appraisals != null ? Math.round(connects_for_appraisals * multiplier) : null,
      phone_calls_to_achieve_appraisals: targets.phone_calls_to_achieve_appraisals != null ? Math.round(targets.phone_calls_to_achieve_appraisals * multiplier) : null,
      no_of_working_days_per_year,
      no_of_working_days_per_month,
      calls_per_person,
      salary_per_day,
      split_person,
      persons_salary,
      total_of_all
    }));
  }, [
    targets.net_commission_target,
    targets.avg_commission_per_sale,
    targets.listing_to_written_ratio,
    targets.appraisal_to_listing_ratio,
    targets.connects_for_appraisal,
    targets.calls_for_connect,
    targets.period_type,
    targets.phone_calls_to_achieve_appraisals,
    targets.no_of_people_required,
    targets.salary_per_hour,
    targets.marketing_expenses
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
          net_commission_target: data.net_commission_target != null ? Math.round(data.net_commission_target) : null,
          avg_commission_per_sale: data.avg_commission_per_sale != null ? Math.round(data.avg_commission_per_sale) : null,
          salary_per_hour: data.salary_per_hour != null ? Math.round(data.salary_per_hour) : null,
          salary_per_day: data.salary_per_day != null ? Math.round(data.salary_per_day) : null,
          persons_salary: data.persons_salary != null ? Math.round(data.persons_salary) : null,
          marketing_expenses: data.marketing_expenses != null ? Math.round(data.marketing_expenses) : null,
          total_of_all: data.total_of_all != null ? Math.round(data.total_of_all) : null
        });
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
        updated_at: new Date().toISOString(),
        net_commission_target: targets.net_commission_target != null ? Math.round(targets.net_commission_target) : null,
        avg_commission_per_sale: targets.avg_commission_per_sale != null ? Math.round(targets.avg_commission_per_sale) : null,
        salary_per_hour: targets.salary_per_hour != null ? Math.round(targets.salary_per_hour) : null,
        salary_per_day: targets.salary_per_day != null ? Math.round(targets.salary_per_day) : null,
        persons_salary: targets.persons_salary != null ? Math.round(targets.persons_salary) : null,
        marketing_expenses: targets.marketing_expenses != null ? Math.round(targets.marketing_expenses) : null,
        total_of_all: targets.total_of_all != null ? Math.round(targets.total_of_all) : null
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
          net_commission_target: data.net_commission_target != null ? Math.round(data.net_commission_target) : null,
          avg_commission_per_sale: data.avg_commission_per_sale != null ? Math.round(data.avg_commission_per_sale) : null,
          salary_per_hour: data.salary_per_hour != null ? Math.round(data.salary_per_hour) : null,
          salary_per_day: data.salary_per_day != null ? Math.round(data.salary_per_day) : null,
          persons_salary: data.persons_salary != null ? Math.round(data.persons_salary) : null,
          marketing_expenses: data.marketing_expenses != null ? Math.round(data.marketing_expenses) : null,
          total_of_all: data.total_of_all != null ? Math.round(data.total_of_all) : null
        });
      }

      toast.success('Business plan saved successfully!');
    } catch (error: any) {
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
    const margin = 15;
    let yOffset = margin;

    // Set fonts
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('Helvetica', 'bold');
    doc.text('Agent Business Plan', margin, yOffset + 10);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth - margin - 60, yOffset + 10);
    yOffset += 40;

    // Period Configuration
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 10, 'F');
    doc.text('Period Configuration', margin + 5, yOffset + 7);
    yOffset += 15;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    const defaultWorkingDays = targets.period_type === 'weekly' ? 5 :
                              targets.period_type === 'monthly' ? 20 : 240;
    doc.autoTable({
      startY: yOffset,
      head: [['Field', 'Value']],
      body: [
        ['Type', targets.period_type.charAt(0).toUpperCase() + targets.period_type.slice(1)],
        ['Working Days', defaultWorkingDays.toString()]
      ],
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219] },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 100 } },
      margin: { left: margin, right: margin }
    });
    yOffset = doc.lastAutoTable.finalY + 15;

    // Targets
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 10, 'F');
    doc.text('Targets', margin + 5, yOffset + 7);
    yOffset += 15;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.autoTable({
      startY: yOffset,
      head: [['Field', 'Value']],
      body: [
        ['Net Commission Target', targets.net_commission_target != null ? `$${Math.round(targets.net_commission_target).toLocaleString()}` : 'N/A'],
        ['Average Commission Per Sale', targets.avg_commission_per_sale != null ? `$${Math.round(targets.avg_commission_per_sale).toLocaleString()}` : 'N/A'],
        ['Settled Sales', targets.settled_sales_target != null ? Math.round(targets.settled_sales_target).toLocaleString() : 'N/A'],
        ['Listings', targets.listings_target != null ? Math.round(targets.listings_target).toLocaleString() : 'N/A'],
        ['Appraisals', targets.appraisals_target != null ? Math.round(targets.appraisals_target).toLocaleString() : 'N/A'],
        ['Connects for Appraisals', targets.connects_for_appraisals != null ? Math.round(targets.connects_for_appraisals).toLocaleString() : 'N/A'],
        ['Phone Calls to Achieve Appraisals', targets.phone_calls_to_achieve_appraisals != null ? Math.round(targets.phone_calls_to_achieve_appraisals).toLocaleString() : 'N/A'],
        ['Working Days per Year', targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year).toLocaleString() : 'N/A'],
        ['Working Days per Month', targets.no_of_working_days_per_month != null ? Math.round(targets.no_of_working_days_per_month).toLocaleString() : 'N/A'],
        ['Calls per Person', targets.calls_per_person != null ? Math.round(targets.calls_per_person).toLocaleString() : 'N/A'],
        ['Split Person', targets.split_person != null ? Math.round(targets.split_person).toLocaleString() : 'N/A'],
        ['Number of People Required', targets.no_of_people_required != null ? Math.round(targets.no_of_people_required).toLocaleString() : 'N/A'],
        ['Salary per Hour', targets.salary_per_hour != null ? `$${Math.round(targets.salary_per_hour).toLocaleString()}` : 'N/A'],
        ['Salary per Day', targets.salary_per_day != null ? `$${Math.round(targets.salary_per_day).toLocaleString()}` : 'N/A'],
        ['Persons Salary', targets.persons_salary != null ? `$${Math.round(targets.persons_salary).toLocaleString()}` : 'N/A'],
        ['Marketing Expenses', targets.marketing_expenses != null ? `$${Math.round(targets.marketing_expenses).toLocaleString()}` : 'N/A'],
        ['Total of All', targets.total_of_all != null ? `$${Math.round(targets.total_of_all).toLocaleString()}` : 'N/A']
      ],
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219] },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 100 } },
      margin: { left: margin, right: margin }
    });
    yOffset = doc.lastAutoTable.finalY + 15;

    // Daily Progress Targets
    const dailyTargets = calculateDailyTargets();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 10, 'F');
    doc.text('Daily Progress Targets', margin + 5, yOffset + 7);
    yOffset += 15;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.autoTable({
      startY: yOffset,
      head: [['Field', 'Value']],
      body: [
        ['Net Commission Target', dailyTargets.commission != null ? `$${Math.round(dailyTargets.commission).toLocaleString()}` : 'N/A'],
        ['Average Commission Per Sale', dailyTargets.avg_commission_per_sale != null ? `$${Math.round(dailyTargets.avg_commission_per_sale).toLocaleString()}` : 'N/A'],
        ['Settled Sales', dailyTargets.settled_sales != null ? Math.round(dailyTargets.settled_sales).toLocaleString() : 'N/A'],
        ['Listings', dailyTargets.listings != null ? Math.round(dailyTargets.listings).toLocaleString() : 'N/A'],
        ['Appraisals', dailyTargets.appraisals != null ? Math.round(dailyTargets.appraisals).toLocaleString() : 'N/A'],
        ['Connects for Appraisals', dailyTargets.connects_for_appraisals != null ? Math.round(dailyTargets.connects_for_appraisals).toLocaleString() : 'N/A'],
        ['Phone Calls to Achieve Appraisals', dailyTargets.phone_calls_to_achieve_appraisals != null ? Math.round(dailyTargets.phone_calls_to_achieve_appraisals).toLocaleString() : 'N/A'],
        ['Working Days per Year', dailyTargets.no_of_working_days_per_year != null ? Math.round(dailyTargets.no_of_working_days_per_year).toLocaleString() : 'N/A'],
        ['Working Days per Month', dailyTargets.no_of_working_days_per_month != null ? Math.round(dailyTargets.no_of_working_days_per_month).toLocaleString() : 'N/A'],
        ['Calls per Person', dailyTargets.calls_per_person != null ? Math.round(dailyTargets.calls_per_person).toLocaleString() : 'N/A'],
        ['Split Person', dailyTargets.split_person != null ? Math.round(dailyTargets.split_person).toLocaleString() : 'N/A'],
        ['Number of People Required', dailyTargets.no_of_people_required != null ? Math.round(dailyTargets.no_of_people_required).toLocaleString() : 'N/A'],
        ['Salary per Hour', dailyTargets.salary_per_hour != null ? `$${Math.round(dailyTargets.salary_per_hour).toLocaleString()}` : 'N/A'],
        ['Salary per Day', dailyTargets.salary_per_day != null ? `$${Math.round(dailyTargets.salary_per_day).toLocaleString()}` : 'N/A'],
        ['Persons Salary', dailyTargets.persons_salary != null ? `$${Math.round(dailyTargets.persons_salary).toLocaleString()}` : 'N/A'],
        ['Marketing Expenses', dailyTargets.marketing_expenses != null ? `$${Math.round(dailyTargets.marketing_expenses).toLocaleString()}` : 'N/A'],
        ['Total of All', dailyTargets.total_of_all != null ? `$${Math.round(dailyTargets.total_of_all).toLocaleString()}` : 'N/A']
      ],
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219] },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 100 } },
      margin: { left: margin, right: margin }
    });
    yOffset = doc.lastAutoTable.finalY + 15;

    // Performance Ratios
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 10, 'F');
    doc.text('Performance Ratios', margin + 5, yOffset + 7);
    yOffset += 15;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.autoTable({
      startY: yOffset,
      head: [['Field', 'Value']],
      body: [
        ['Fall Over Rate', targets.fall_over_rate != null ? `${targets.fall_over_rate}%` : 'N/A'],
        ['Appraisal to Listing Ratio', targets.appraisal_to_listing_ratio != null ? `${targets.appraisal_to_listing_ratio}%` : 'N/A'],
        ['Listing to Written Ratio', targets.listing_to_written_ratio != null ? `${targets.listing_to_written_ratio}%` : 'N/A'],
        ['Connects for Appraisal', targets.connects_for_appraisal != null ? targets.connects_for_appraisal.toString() : 'N/A'],
        ['Calls for Connect', targets.calls_for_connect != null ? targets.calls_for_connect.toString() : 'N/A']
      ],
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219] },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 100 } },
      margin: { left: margin, right: margin }
    });
    yOffset = doc.lastAutoTable.finalY + 15;

    // Metadata
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.setFillColor(219, 234, 254);
    doc.rect(margin, yOffset, pageWidth - 2 * margin, 10, 'F');
    doc.text('Metadata', margin + 5, yOffset + 7);
    yOffset += 15;

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.autoTable({
      startY: yOffset,
      head: [['Field', 'Value']],
      body: [
        ['Created At', targets.created_at || 'N/A'],
        ['Updated At', targets.updated_at || 'N/A']
      ],
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4, textColor: [17, 24, 39], fillColor: [243, 244, 246], lineWidth: 0.1, lineColor: [209, 213, 219] },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' },
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 100 } },
      margin: { left: margin, right: margin }
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 20, pageHeight - 10);
      doc.text('Generated by RealRed', margin, pageHeight - 10);
    }

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
      period_type: 'monthly',
      appraisals_target: null,
      listings_target: null,
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
      no_of_working_days_per_year: null,
      no_of_working_days_per_month: null,
      calls_per_person: null,
      no_of_people_required: 2,
      salary_per_hour: 60,
      salary_per_day: null,
      marketing_expenses: 6000,
      split_person: null,
      persons_salary: null,
      total_of_all: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  };

  const calculateDailyTargets = () => {
    const multiplier = targets.period_type === 'daily' ? 1 :
                      targets.period_type === 'weekly' ? 5 :
                      targets.period_type === 'monthly' ? 20 : 240;

    return {
      commission: targets.net_commission_target != null ? Math.round(targets.net_commission_target / multiplier) : null,
      avg_commission_per_sale: targets.avg_commission_per_sale != null ? Math.round(targets.avg_commission_per_sale) : null,
      settled_sales: targets.settled_sales_target != null ? Math.round(targets.settled_sales_target / multiplier) : null,
      listings: targets.listings_target != null ? Math.round(targets.listings_target / multiplier) : null,
      appraisals: targets.appraisals_target != null ? Math.round(targets.appraisals_target / multiplier) : null,
      connects_for_appraisals: targets.connects_for_appraisals != null ? Math.round(targets.connects_for_appraisals / multiplier) : null,
      phone_calls_to_achieve_appraisals: targets.phone_calls_to_achieve_appraisals != null ? Math.round(targets.phone_calls_to_achieve_appraisals / multiplier) : null,
      no_of_working_days_per_year: targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year / multiplier) : null,
      no_of_working_days_per_month: targets.no_of_working_days_per_month != null ? Math.round(targets.no_of_working_days_per_month / multiplier) : null,
      calls_per_person: targets.calls_per_person != null ? Math.round(targets.calls_per_person / multiplier) : null,
      split_person: targets.split_person != null ? Math.round(targets.split_person / multiplier) : null,
      no_of_people_required: targets.no_of_people_required != null ? Math.round(targets.no_of_people_required) : null,
      salary_per_hour: targets.salary_per_hour != null ? Math.round(targets.salary_per_hour) : null,
      salary_per_day: targets.salary_per_day != null ? Math.round(targets.salary_per_day) : null,
      persons_salary: targets.persons_salary != null ? Math.round(targets.persons_salary / multiplier) : null,
      marketing_expenses: targets.marketing_expenses != null ? Math.round(targets.marketing_expenses / multiplier) : null,
      total_of_all: targets.total_of_all != null ? Math.round(targets.total_of_all / multiplier) : null
    };
  };

  const dailyTargets = calculateDailyTargets();

  const chartData = [
    { name: 'Appraisals', value: targets.appraisals_target ?? 0, fill: '#1E3A8A' },
    { name: 'Listings', value: targets.listings_target ?? 0, fill: '#3B82F6' },
    { name: 'Settled Sales', value: targets.settled_sales_target ?? 0, fill: '#93C5FD' },
    { name: 'Connects', value: targets.connects_for_appraisals ?? 0, fill: '#BFDBFE' },
    { name: 'Phone Calls', value: targets.phone_calls_to_achieve_appraisals ?? 0, fill: '#DBEAFE' },
    { name: 'Commission', value: targets.net_commission_target ?? 0, fill: '#2563EB' },
    { name: 'Working Days/Yr', value: targets.no_of_working_days_per_year ?? 0, fill: '#1E40AF' },
    { name: 'Calls/Person', value: targets.calls_per_person ?? 0, fill: '#1E90FF' },
    { name: 'Split Person', value: targets.split_person ?? 0, fill: '#60A5FA' },
    { name: 'Persons Salary', value: targets.persons_salary ?? 0, fill: '#1D4ED8' },
    { name: 'Total Cost', value: targets.total_of_all ?? 0, fill: '#3B82F6' }
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
      title: 'Average Commission Per Sale', 
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
    },
    { 
      title: 'Working Days per Year', 
      value: targets.no_of_working_days_per_year ?? '', 
      daily: dailyTargets.no_of_working_days_per_year ?? '', 
      icon: Calendar, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'no_of_working_days_per_year',
      isReadOnly: true
    },
    { 
      title: 'Working Days per Month', 
      value: targets.no_of_working_days_per_month ?? '', 
      daily: dailyTargets.no_of_working_days_per_month ?? '', 
      icon: Calendar, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'no_of_working_days_per_month',
      isReadOnly: true
    },
    { 
      title: 'Calls per Person', 
      value: targets.calls_per_person ?? '', 
      daily: dailyTargets.calls_per_person ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'calls_per_person',
      isReadOnly: true
    },
    { 
      title: 'Split Person', 
      value: targets.split_person ?? '', 
      daily: dailyTargets.split_person ?? '', 
      icon: Phone, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'split_person',
      isReadOnly: true
    },
    { 
      title: 'Number of People Required', 
      value: targets.no_of_people_required ?? '', 
      daily: dailyTargets.no_of_people_required ?? '', 
      icon: Target, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      field: 'no_of_people_required',
      isReadOnly: false
    },
    { 
      title: 'Salary per Hour', 
      value: targets.salary_per_hour ?? '', 
      daily: dailyTargets.salary_per_hour ?? '', 
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
      daily: dailyTargets.salary_per_day ?? '', 
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
      daily: dailyTargets.persons_salary ?? '', 
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
      daily: dailyTargets.marketing_expenses ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'marketing_expenses',
      isReadOnly: false
    },
    { 
      title: 'Total of All', 
      value: targets.total_of_all ?? '', 
      daily: dailyTargets.total_of_all ?? '', 
      icon: DollarSign, 
      color: 'bg-blue-600', 
      bgColor: 'bg-blue-100',
      isCurrency: true,
      field: 'total_of_all',
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
                          <span>Period Configuration</span>
                          <svg className={`${open ? 'transform rotate-180' : ''} w-5 h-5 text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </Disclosure.Button>
                        <Disclosure.Panel className="px-4 pt-4 pb-2 text-sm text-blue-700">
                          <p><strong>Type:</strong> {targets.period_type.charAt(0).toUpperCase() + targets.period_type.slice(1)}</p>
                          <p><strong>Working Days:</strong> {targets.period_type === 'weekly' ? 5 : targets.period_type === 'monthly' ? 20 : 240}</p>
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
                          <p><strong>Net Commission Target:</strong> {targets.net_commission_target != null ? `$${Math.round(targets.net_commission_target).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Average Commission Per Sale:</strong> {targets.avg_commission_per_sale != null ? `$${Math.round(targets.avg_commission_per_sale).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Settled Sales:</strong> {targets.settled_sales_target != null ? Math.round(targets.settled_sales_target).toLocaleString() : 'N/A'}</p>
                          <p><strong>Listings:</strong> {targets.listings_target != null ? Math.round(targets.listings_target).toLocaleString() : 'N/A'}</p>
                          <p><strong>Appraisals:</strong> {targets.appraisals_target != null ? Math.round(targets.appraisals_target).toLocaleString() : 'N/A'}</p>
                          <p><strong>Connects for Appraisals:</strong> {targets.connects_for_appraisals != null ? Math.round(targets.connects_for_appraisals).toLocaleString() : 'N/A'}</p>
                          <p><strong>Phone Calls to Achieve Appraisals:</strong> {targets.phone_calls_to_achieve_appraisals != null ? Math.round(targets.phone_calls_to_achieve_appraisals).toLocaleString() : 'N/A'}</p>
                          <p><strong>Working Days per Year:</strong> {targets.no_of_working_days_per_year != null ? Math.round(targets.no_of_working_days_per_year).toLocaleString() : 'N/A'}</p>
                          <p><strong>Working Days per Month:</strong> {targets.no_of_working_days_per_month != null ? Math.round(targets.no_of_working_days_per_month).toLocaleString() : 'N/A'}</p>
                          <p><strong>Calls per Person:</strong> {targets.calls_per_person != null ? Math.round(targets.calls_per_person).toLocaleString() : 'N/A'}</p>
                          <p><strong>Split Person:</strong> {targets.split_person != null ? Math.round(targets.split_person).toLocaleString() : 'N/A'}</p>
                          <p><strong>Number of People Required:</strong> {targets.no_of_people_required != null ? Math.round(targets.no_of_people_required).toLocaleString() : 'N/A'}</p>
                          <p><strong>Salary per Hour:</strong> {targets.salary_per_hour != null ? `$${Math.round(targets.salary_per_hour).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Salary per Day:</strong> {targets.salary_per_day != null ? `$${Math.round(targets.salary_per_day).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Persons Salary:</strong> {targets.persons_salary != null ? `$${Math.round(targets.persons_salary).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Marketing Expenses:</strong> {targets.marketing_expenses != null ? `$${Math.round(targets.marketing_expenses).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Total of All:</strong> {targets.total_of_all != null ? `$${Math.round(targets.total_of_all).toLocaleString()}` : 'N/A'}</p>
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
                          <p><strong>Net Commission Target:</strong> {dailyTargets.commission != null ? `$${Math.round(dailyTargets.commission).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Average Commission Per Sale:</strong> {dailyTargets.avg_commission_per_sale != null ? `$${Math.round(dailyTargets.avg_commission_per_sale).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Settled Sales:</strong> {dailyTargets.settled_sales != null ? Math.round(dailyTargets.settled_sales).toLocaleString() : 'N/A'}</p>
                          <p><strong>Listings:</strong> {dailyTargets.listings != null ? Math.round(dailyTargets.listings).toLocaleString() : 'N/A'}</p>
                          <p><strong>Appraisals:</strong> {dailyTargets.appraisals != null ? Math.round(dailyTargets.appraisals).toLocaleString() : 'N/A'}</p>
                          <p><strong>Connects for Appraisals:</strong> {dailyTargets.connects_for_appraisals != null ? Math.round(dailyTargets.connects_for_appraisals).toLocaleString() : 'N/A'}</p>
                          <p><strong>Phone Calls to Achieve Appraisals:</strong> {dailyTargets.phone_calls_to_achieve_appraisals != null ? Math.round(dailyTargets.phone_calls_to_achieve_appraisals).toLocaleString() : 'N/A'}</p>
                          <p><strong>Working Days per Year:</strong> {dailyTargets.no_of_working_days_per_year != null ? Math.round(dailyTargets.no_of_working_days_per_year).toLocaleString() : 'N/A'}</p>
                          <p><strong>Working Days per Month:</strong> {dailyTargets.no_of_working_days_per_month != null ? Math.round(dailyTargets.no_of_working_days_per_month).toLocaleString() : 'N/A'}</p>
                          <p><strong>Calls per Person:</strong> {dailyTargets.calls_per_person != null ? Math.round(dailyTargets.calls_per_person).toLocaleString() : 'N/A'}</p>
                          <p><strong>Split Person:</strong> {dailyTargets.split_person != null ? Math.round(dailyTargets.split_person).toLocaleString() : 'N/A'}</p>
                          <p><strong>Number of People Required:</strong> {dailyTargets.no_of_people_required != null ? Math.round(dailyTargets.no_of_people_required).toLocaleString() : 'N/A'}</p>
                          <p><strong>Salary per Hour:</strong> {dailyTargets.salary_per_hour != null ? `$${Math.round(dailyTargets.salary_per_hour).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Salary per Day:</strong> {dailyTargets.salary_per_day != null ? `$${Math.round(dailyTargets.salary_per_day).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Persons Salary:</strong> {dailyTargets.persons_salary != null ? `$${Math.round(dailyTargets.persons_salary).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Marketing Expenses:</strong> {dailyTargets.marketing_expenses != null ? `$${Math.round(dailyTargets.marketing_expenses).toLocaleString()}` : 'N/A'}</p>
                          <p><strong>Total of All:</strong> {dailyTargets.total_of_all != null ? `$${Math.round(dailyTargets.total_of_all).toLocaleString()}` : 'N/A'}</p>
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
                          <p><strong>Fall Over Rate:</strong> {targets.fall_over_rate != null ? `${targets.fall_over_rate}%` : 'N/A'}</p>
                          <p><strong>Appraisal to Listing Ratio:</strong> {targets.appraisal_to_listing_ratio != null ? `${targets.appraisal_to_listing_ratio}%` : 'N/A'}</p>
                          <p><strong>Listing to Written Ratio:</strong> {targets.listing_to_written_ratio != null ? `${targets.listing_to_written_ratio}%` : 'N/A'}</p>
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
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400"
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
                        step={card.isCurrency ? "1" : "1"}
                        value={card.value}
                        onChange={(e) => {
                          if (card.isReadOnly) return;
                          const value = parseInt(e.target.value) || null;
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
                        {card.isCurrency ? (card.daily != null ? `$${Math.round(card.daily).toLocaleString()}` : 'N/A') : (card.daily != null ? Math.round(card.daily).toLocaleString() : 'N/A')}
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
                  {card.isCurrency ? (card.daily != null ? `$${Math.round(card.daily).toLocaleString()}` : 'N/A') : (card.daily != null ? Math.round(card.daily).toLocaleString() : 'N/A')}
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
                  domain={[0, dataMax => Math.max((targets.net_commission_target ?? 0) * 1.3, (targets.total_of_all ?? 0) * 1.3, (targets.persons_salary ?? 0) * 1.3, 1000)]}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#EFF6FF', borderColor: '#3B82F6', borderRadius: 4 }}
                  formatter={(value: number, name: string) => [
                    name === 'Commission' || name === 'Persons Salary' || name === 'Total Cost' 
                      ? `$${Math.round(value).toLocaleString()}` 
                      : Math.round(value).toLocaleString(),
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
                <Bar yAxisId="right" dataKey="value" name="Commission" fill="#2563EB" data={chartData.filter(d => d.name === 'Commission')}>
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
                <Bar yAxisId="right" dataKey="value" name="Total Cost" fill="#3B82F6" data={chartData.filter(d => d.name === 'Total Cost')}>
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(value: number) => (value != null ? `$${Math.round(value).toLocaleString()}` : 'N/A')} fill="#2563EB" />
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
                {targets.avg_commission_per_sale != null ? '$' + Math.round(targets.avg_commission_per_sale).toLocaleString() : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Average Commission Per Sale</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.settled_sales_target != null && targets.net_commission_target != null && targets.settled_sales_target > 0 ? `$${Math.round(targets.net_commission_target / targets.settled_sales_target).toLocaleString()}` : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Net Commission per Settled Sale</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-2xl font-bold text-blue-600">
                {targets.total_of_all != null ? '$' + Math.round(targets.total_of_all).toLocaleString() : 'N/A'}
              </div>
              <div className="text-sm text-blue-600">Total Cost</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default AgentBusinessPlan;