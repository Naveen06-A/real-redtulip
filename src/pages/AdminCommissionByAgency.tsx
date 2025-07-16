import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { PropertyDetails } from './Reports';
import { formatCurrency } from '../utils/formatters';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Pencil, RotateCcw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

// Register ChartJS components and plugins
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels);

// Interfaces
interface User {
  id: string;
  email?: string;
  role?: string;
}

interface SuburbCommission {
  suburb: string;
  listedCommissionTotal: number;
  listedPropertyCount: number;
  soldCommissionTotal: number;
  soldPropertyCount: number;
  avgListedCommissionRate: number;
  avgSoldCommissionRate: number;
}

interface CommissionSummary {
  totalCommission: number;
  totalListedCommission: number;
  totalSoldCommission: number;
  totalProperties: number;
  totalListed: number;
  totalSold: number;
  topAgency: string;
  topAgencyCommissionRate: number;
  topAgencyTotalCommission: number;
  topAgencyPropertyCount: number;
  topAgent: { name: string; commission: number; propertyCount: number };
  suburbCommissions: SuburbCommission[];
}

interface AgencyTotal {
  agency: string;
  totalCommission: number;
  listedCommission: number;
  soldCommission: number;
  commissionRate: number;
  propertyCount: number;
  listedCount: number;
  soldCount: number;
  suburbs: string[];
  agents: AgentTotal[];
}

interface AgentTotal {
  name: string;
  totalCommission: number;
  propertiesListed: number;
  propertiesSold: number;
  commissionRate?: number;
  suburbs: string[];
}

interface CommissionEditState {
  isOpen: boolean;
  agency: string | null;
  newCommission: string;
}

// Normalization functions
const normalizeAgencyName = (name: string | null | undefined): string => {
  if (!name) return 'Unknown';
  return name
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const normalizeAgentName = (name: string | null | undefined): string => {
  if (!name) return 'Unknown';
  return name
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const normalizeSuburbName = (name: string | null | undefined): string => {
  if (!name) return 'Unknown';
  return name
    .trim()
    .toUpperCase()
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const calculateCommission = (
  property: PropertyDetails
): { commissionEarned: number; commissionRate: number } => {
  let commissionEarned = 0;
  let commissionRate = property.commission || 0;
  const price = property.sold_price && (property.contract_status === 'sold' || property.sold_date)
    ? property.sold_price
    : property.price || 0;

  if (price > 0 && commissionRate > 0) {
    commissionEarned = price * (commissionRate / 100);
  }

  return {
    commissionEarned: isNaN(commissionEarned) ? 0 : commissionEarned,
    commissionRate: isNaN(commissionRate) ? 0 : commissionRate,
  };
};

// CollapsibleSection component
const CollapsibleSection: React.FC<{
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  toggleOpen: () => void;
}> = ({ title, children, isOpen, toggleOpen }) => (
  <motion.div
    className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5 }}
  >
    <button
      onClick={toggleOpen}
      className="w-full flex justify-between items-center p-4 text-lg font-semibold text-gray-800 hover:bg-indigo-50 transition-colors"
    >
      {title}
      {isOpen ? <ChevronUp className="w-5 h-5 text-indigo-600" /> : <ChevronDown className="w-5 h-5 text-indigo-600" />}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="p-4"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

// AutocompleteInput component
const AutocompleteInput: React.FC<{
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
}> = ({ placeholder, value, onChange, suggestions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = useMemo(() => {
    return suggestions
      .filter((suggestion) => suggestion.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 10); // Limit to 10 suggestions for performance
  }, [suggestions, value]);

  return (
    <div className="relative w-full sm:w-64 group">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full bg-gray-50"
      />
      <svg
        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <AnimatePresence>
        {isOpen && filteredSuggestions.length > 0 && (
          <motion.ul
            className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg mt-1 max-h-60 overflow-auto shadow-lg"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {filteredSuggestions.map((suggestion) => (
              <li
                key={suggestion}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 cursor-pointer"
                onClick={() => {
                  onChange(suggestion);
                  setIsOpen(false);
                }}
              >
                {suggestion}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

function AdminCommissionDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [agencyFilter, setAgencyFilter] = useState('');
  const [suburbFilter, setSuburbFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'listed' | 'sold'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'last30' | 'last90'>('all');
  const [internalProperties, setInternalProperties] = useState<PropertyDetails[]>([]);
  const [agencies, setAgencies] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [suburbs, setSuburbs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [agencyCurrentPage, setAgencyCurrentPage] = useState(1);
  const [suburbCurrentPage, setSuburbCurrentPage] = useState(1);
  const [agentCurrentPage, setAgentCurrentPage] = useState(1);
  const [openSections, setOpenSections] = useState({
    summary: true,
    agencies: true,
    agents: true,
    suburbs: true,
  });
  const [commissionEdit, setCommissionEdit] = useState<CommissionEditState>({
    isOpen: false,
    agency: null,
    newCommission: '',
  });
  const itemsPerPage = 10;
  const { user } = useAuthStore((state: { user: User | null }) => ({ user: state.user }));
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCommissionData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('properties')
          .select('id, agency_name, agent_name, commission, price, sold_price, suburb, contract_status, sold_date, listed_date');

        if (propertiesError) throw propertiesError;

        const properties = (propertiesData as PropertyDetails[]) || [];
        setInternalProperties(properties);

        // Fetch unique agencies, agents, and suburbs for autocomplete
        const uniqueAgencies = [...new Set(properties.map((p) => normalizeAgencyName(p.agency_name)))].filter((a) => a !== 'Unknown').sort();
        const uniqueAgents = [...new Set(properties.map((p) => normalizeAgentName(p.agent_name)))].filter((a) => a !== 'Unknown').sort();
        const uniqueSuburbs = [...new Set(properties.map((p) => normalizeSuburbName(p.suburb)))].filter((s) => s !== 'Unknown').sort();

        setAgencies(uniqueAgencies);
        setAgents(uniqueAgents);
        setSuburbs(uniqueSuburbs);
      } catch (error: any) {
        console.error('Error fetching commission data:', error);
        setFetchError(error.message || 'Failed to fetch commission data.');
        toast.error(error.message || 'Failed to fetch commission data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchCommissionData();
  }, []);

  const resetFilters = () => {
    setSearchQuery('');
    setAgentFilter('');
    setAgencyFilter('');
    setSuburbFilter('');
    setStatusFilter('all');
    setDateRange('all');
    setAgencyCurrentPage(1);
    setSuburbCurrentPage(1);
    setAgentCurrentPage(1);
  };

  const calculateSummary = useCallback((): CommissionSummary => {
    let totalCommission = 0;
    let totalListedCommission = 0;
    let totalSoldCommission = 0;
    let totalProperties = 0;
    let totalListed = 0;
    let totalSold = 0;
    let topAgency = 'Unknown';
    let topAgencyCommissionRate = 0;
    let topAgencyTotalCommission = 0;
    let topAgencyPropertyCount = 0;
    let topAgent = { name: 'Unknown', commission: 0, propertyCount: 0 };
    let maxCommission = 0;
    const suburbMap: Record<string, {
      listedCommissionTotal: number;
      listedPropertyCount: number;
      soldCommissionTotal: number;
      soldPropertyCount: number;
      listedCommissionRates: number[];
      soldCommissionRates: number[];
    }> = {};
    const agentCommissionMap: Record<string, { commission: number; propertyCount: number }> = {};

    internalProperties.forEach((property) => {
      const agency = normalizeAgencyName(property.agency_name);
      const agent = normalizeAgentName(property.agent_name);
      const suburb = normalizeSuburbName(property.suburb);
      const { commissionEarned, commissionRate } = calculateCommission(property);
      const isSold = property.contract_status === 'sold' || !!property.sold_date;

      // Apply filters at the property level
      const cutoffDate = new Date();
      if (dateRange !== 'all') {
        cutoffDate.setDate(cutoffDate.getDate() - (dateRange === 'last30' ? 30 : 90));
      }

      if (
        (searchQuery === '' || agency.toLowerCase().includes(searchQuery.toLowerCase()) || agent.toLowerCase().includes(searchQuery.toLowerCase()) || suburb.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (agencyFilter === '' || agency.toLowerCase().includes(agencyFilter.toLowerCase())) &&
        (agentFilter === '' || agent.toLowerCase().includes(agentFilter.toLowerCase())) &&
        (suburbFilter === '' || suburb.toLowerCase().includes(suburbFilter.toLowerCase())) &&
        (statusFilter === 'all' || (statusFilter === 'sold' && isSold) || (statusFilter === 'listed' && !isSold)) &&
        (dateRange === 'all' || (property.listed_date && new Date(property.listed_date) >= cutoffDate))
      ) {
        if (agency && !isNaN(commissionEarned)) {
          totalProperties += 1;
          if (isSold) {
            totalSold += 1;
            totalSoldCommission += commissionEarned;
          } else {
            totalListed += 1;
            totalListedCommission += commissionEarned;
          }
          totalCommission += commissionEarned;

          if (agent) {
            agentCommissionMap[agent] = agentCommissionMap[agent] || { commission: 0, propertyCount: 0 };
            agentCommissionMap[agent].commission += commissionEarned;
            agentCommissionMap[agent].propertyCount += 1;
            if (agentCommissionMap[agent].commission > topAgent.commission) {
              topAgent = { name: agent, commission: agentCommissionMap[agent].commission, propertyCount: agentCommissionMap[agent].propertyCount };
            }
          }
        }

        if (suburb && suburb !== 'Unknown') {
          suburbMap[suburb] = suburbMap[suburb] || {
            listedCommissionTotal: 0,
            listedPropertyCount: 0,
            soldCommissionTotal: 0,
            soldPropertyCount: 0,
            listedCommissionRates: [],
            soldCommissionRates: [],
          };
          if (isSold) {
            suburbMap[suburb].soldCommissionTotal += commissionEarned;
            suburbMap[suburb].soldPropertyCount += 1;
            suburbMap[suburb].soldCommissionRates.push(commissionRate);
          } else {
            suburbMap[suburb].listedCommissionTotal += commissionEarned;
            suburbMap[suburb].listedPropertyCount += 1;
            suburbMap[suburb].listedCommissionRates.push(commissionRate);
          }
        }
      }
    });

    const agencyCommissionMap: Record<string, { total: number; count: number; rates: number[] }> = {};
    internalProperties.forEach((property) => {
      const agency = normalizeAgencyName(property.agency_name);
      const { commissionEarned, commissionRate } = calculateCommission(property);
      const isSold = property.contract_status === 'sold' || !!property.sold_date;

      const cutoffDate = new Date();
      if (dateRange !== 'all') {
        cutoffDate.setDate(cutoffDate.getDate() - (dateRange === 'last30' ? 30 : 90));
      }

      if (
        (searchQuery === '' || agency.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (agencyFilter === '' || agency.toLowerCase().includes(agencyFilter.toLowerCase())) &&
        (agentFilter === '' || normalizeAgentName(property.agent_name).toLowerCase().includes(agentFilter.toLowerCase())) &&
        (suburbFilter === '' || normalizeSuburbName(property.suburb).toLowerCase().includes(suburbFilter.toLowerCase())) &&
        (statusFilter === 'all' || (statusFilter === 'sold' && isSold) || (statusFilter === 'listed' && !isSold)) &&
        (dateRange === 'all' || (property.listed_date && new Date(property.listed_date) >= cutoffDate))
      ) {
        if (agency && !isNaN(commissionEarned)) {
          agencyCommissionMap[agency] = agencyCommissionMap[agency] || { total: 0, count: 0, rates: [] };
          agencyCommissionMap[agency].total += commissionEarned;
          agencyCommissionMap[agency].count += 1;
          agencyCommissionMap[agency].rates.push(commissionRate);
        }
      }
    });

    Object.entries(agencyCommissionMap).forEach(([agency, data]) => {
      if (data.total > maxCommission && !isNaN(data.total)) {
        maxCommission = data.total;
        topAgency = agency;
        topAgencyTotalCommission = data.total;
        topAgencyPropertyCount = data.count;
        topAgencyCommissionRate = data.rates.length > 0 ? data.rates.reduce((sum, rate) => sum + rate, 0) / data.rates.length : 0;
      }
    });

    const suburbCommissions: SuburbCommission[] = Object.entries(suburbMap).map(([suburb, data]) => ({
      suburb,
      listedCommissionTotal: data.listedCommissionTotal,
      listedPropertyCount: data.listedPropertyCount,
      soldCommissionTotal: data.soldCommissionTotal,
      soldPropertyCount: data.soldPropertyCount,
      avgListedCommissionRate: data.listedCommissionRates.length > 0
        ? data.listedCommissionRates.reduce((sum, rate) => sum + rate, 0) / data.listedCommissionRates.length
        : 0,
      avgSoldCommissionRate: data.soldCommissionRates.length > 0
        ? data.soldCommissionRates.reduce((sum, rate) => sum + rate, 0) / data.soldCommissionRates.length
        : 0,
    }));

    return {
      totalCommission,
      totalListedCommission,
      totalSoldCommission,
      totalProperties,
      totalListed,
      totalSold,
      topAgency,
      topAgencyCommissionRate,
      topAgencyTotalCommission,
      topAgencyPropertyCount,
      topAgent,
      suburbCommissions,
    };
  }, [internalProperties, searchQuery, agentFilter, agencyFilter, suburbFilter, statusFilter, dateRange]);

  const summary = calculateSummary();

  const agencyTotals = useMemo<AgencyTotal[]>(() => {
    const agencySuburbsMap: Record<string, Set<string>> = {};
    const agencyCommissionMap: Record<string, { total: number; listed: number; sold: number; count: number; rates: number[] }> = {};
    const agencyAgentsMap: Record<string, AgentTotal[]> = {};
    const agentSuburbsMap: Record<string, Set<string>> = {};

    internalProperties.forEach((property) => {
      const agency = normalizeAgencyName(property.agency_name);
      const agent = normalizeAgentName(property.agent_name);
      const suburb = normalizeSuburbName(property.suburb);
      const { commissionEarned, commissionRate } = calculateCommission(property);
      const isSold = property.contract_status === 'sold' || !!property.sold_date;

      const cutoffDate = new Date();
      if (dateRange !== 'all') {
        cutoffDate.setDate(cutoffDate.getDate() - (dateRange === 'last30' ? 30 : 90));
      }

      if (
        (searchQuery === '' || agency.toLowerCase().includes(searchQuery.toLowerCase()) || agent.toLowerCase().includes(searchQuery.toLowerCase()) || suburb.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (agencyFilter === '' || agency.toLowerCase().includes(agencyFilter.toLowerCase())) &&
        (agentFilter === '' || agent.toLowerCase().includes(agentFilter.toLowerCase())) &&
        (suburbFilter === '' || suburb.toLowerCase().includes(suburbFilter.toLowerCase())) &&
        (statusFilter === 'all' || (statusFilter === 'sold' && isSold) || (statusFilter === 'listed' && !isSold)) &&
        (dateRange === 'all' || (property.listed_date && new Date(property.listed_date) >= cutoffDate))
      ) {
        if (agency && suburb !== 'Unknown') {
          agencySuburbsMap[agency] = agencySuburbsMap[agency] || new Set();
          agencySuburbsMap[agency].add(suburb);
        }

        if (agency && agent) {
          agencyAgentsMap[agency] = agencyAgentsMap[agency] || [];
          agentSuburbsMap[agent] = agentSuburbsMap[agent] || new Set();
          agentSuburbsMap[agent].add(suburb);

          if (!agencyAgentsMap[agency].some((a) => a.name === agent)) {
            const agentProperties = internalProperties.filter((p) => 
              normalizeAgentName(p.agent_name) === agent &&
              (searchQuery === '' || normalizeAgencyName(p.agency_name).toLowerCase().includes(searchQuery.toLowerCase()) || agent.toLowerCase().includes(searchQuery.toLowerCase()) || normalizeSuburbName(p.suburb).toLowerCase().includes(searchQuery.toLowerCase())) &&
              (agencyFilter === '' || normalizeAgencyName(p.agency_name).toLowerCase().includes(agencyFilter.toLowerCase())) &&
              (agentFilter === '' || agent.toLowerCase().includes(agentFilter.toLowerCase())) &&
              (suburbFilter === '' || normalizeSuburbName(p.suburb).toLowerCase().includes(suburbFilter.toLowerCase())) &&
              (statusFilter === 'all' || (statusFilter === 'sold' && (p.contract_status === 'sold' || !!p.sold_date)) || (statusFilter === 'listed' && !(p.contract_status === 'sold' || !!p.sold_date))) &&
              (dateRange === 'all' || (p.listed_date && new Date(p.listed_date) >= cutoffDate))
            );
            const agentCommission = agentProperties.reduce((sum, p) => sum + calculateCommission(p).commissionEarned, 0);
            agencyAgentsMap[agency].push({
              name: agent,
              totalCommission: agentCommission,
              propertiesListed: agentProperties.filter((p) => !(p.contract_status === 'sold' || !!p.sold_date)).length,
              propertiesSold: agentProperties.filter((p) => p.contract_status === 'sold' || !!p.sold_date).length,
              commissionRate: agentProperties[0]?.commission,
              suburbs: Array.from(agentSuburbsMap[agent] || []),
            });
          }
        }

        if (agency && !isNaN(commissionEarned)) {
          agencyCommissionMap[agency] = agencyCommissionMap[agency] || { total: 0, listed: 0, sold: 0, count: 0, rates: [] };
          agencyCommissionMap[agency].total += commissionEarned;
          agencyCommissionMap[agency].count += 1;
          agencyCommissionMap[agency].rates.push(commissionRate);
          if (isSold) {
            agencyCommissionMap[agency].sold += commissionEarned;
          } else {
            agencyCommissionMap[agency].listed += commissionEarned;
          }
        }
      }
    });

    return Object.entries(agencyCommissionMap)
      .map(([agency, data]) => ({
        agency,
        totalCommission: data.total,
        listedCommission: data.listed,
        soldCommission: data.sold,
        commissionRate: data.rates.length > 0 ? data.rates.reduce((sum, rate) => sum + rate, 0) / data.rates.length : 0,
        propertyCount: data.count,
        listedCount: internalProperties.filter((p) => 
          normalizeAgencyName(p.agency_name) === agency && 
          !(p.contract_status === 'sold' || !!p.sold_date) &&
          (searchQuery === '' || agency.toLowerCase().includes(searchQuery.toLowerCase()) || normalizeAgentName(p.agent_name).toLowerCase().includes(searchQuery.toLowerCase()) || normalizeSuburbName(p.suburb).toLowerCase().includes(searchQuery.toLowerCase())) &&
          (agencyFilter === '' || agency.toLowerCase().includes(agencyFilter.toLowerCase())) &&
          (agentFilter === '' || normalizeAgentName(p.agent_name).toLowerCase().includes(agentFilter.toLowerCase())) &&
          (suburbFilter === '' || normalizeSuburbName(p.suburb).toLowerCase().includes(suburbFilter.toLowerCase())) &&
          (dateRange === 'all' || (p.listed_date && new Date(p.listed_date) >= new Date().setDate(new Date().getDate() - (dateRange === 'last30' ? 30 : 90))))
        ).length,
        soldCount: internalProperties.filter((p) => 
          normalizeAgencyName(p.agency_name) === agency && 
          (p.contract_status === 'sold' || !!p.sold_date) &&
          (searchQuery === '' || agency.toLowerCase().includes(searchQuery.toLowerCase()) || normalizeAgentName(p.agent_name).toLowerCase().includes(searchQuery.toLowerCase()) || normalizeSuburbName(p.suburb).toLowerCase().includes(searchQuery.toLowerCase())) &&
          (agencyFilter === '' || agency.toLowerCase().includes(agencyFilter.toLowerCase())) &&
          (agentFilter === '' || normalizeAgentName(p.agent_name).toLowerCase().includes(agentFilter.toLowerCase())) &&
          (suburbFilter === '' || normalizeSuburbName(p.suburb).toLowerCase().includes(suburbFilter.toLowerCase())) &&
          (dateRange === 'all' || (p.listed_date && new Date(p.listed_date) >= new Date().setDate(new Date().getDate() - (dateRange === 'last30' ? 30 : 90))))
        ).length,
        suburbs: Array.from(agencySuburbsMap[agency] || []),
        agents: agencyAgentsMap[agency] || [],
      }))
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [internalProperties, searchQuery, agencyFilter, agentFilter, suburbFilter, statusFilter, dateRange]);

  const filteredAgencyTotals = useMemo(() => {
    return agencyTotals;
  }, [agencyTotals]);

  const paginatedFilteredAgencyTotals = useMemo(() => {
    return filteredAgencyTotals.slice(
      (agencyCurrentPage - 1) * itemsPerPage,
      agencyCurrentPage * itemsPerPage
    );
  }, [filteredAgencyTotals, agencyCurrentPage]);

  const agencyTotalPages = Math.ceil(filteredAgencyTotals.length / itemsPerPage);

  const filteredAgentTotals = useMemo(() => {
    const agentMap: Record<string, AgentTotal> = {};
    internalProperties.forEach((property) => {
      const agent = normalizeAgentName(property.agent_name);
      const suburb = normalizeSuburbName(property.suburb);
      const agency = normalizeAgencyName(property.agency_name);
      const { commissionEarned, commissionRate } = calculateCommission(property);
      const isSold = property.contract_status === 'sold' || !!property.sold_date;

      const cutoffDate = new Date();
      if (dateRange !== 'all') {
        cutoffDate.setDate(cutoffDate.getDate() - (dateRange === 'last30' ? 30 : 90));
      }

      if (
        (searchQuery === '' || agent.toLowerCase().includes(searchQuery.toLowerCase()) || agency.toLowerCase().includes(searchQuery.toLowerCase()) || suburb.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (agentFilter === '' || agent.toLowerCase().includes(agentFilter.toLowerCase())) &&
        (agencyFilter === '' || agency.toLowerCase().includes(agencyFilter.toLowerCase())) &&
        (suburbFilter === '' || suburb.toLowerCase().includes(suburbFilter.toLowerCase())) &&
        (statusFilter === 'all' || (statusFilter === 'sold' && isSold) || (statusFilter === 'listed' && !isSold)) &&
        (dateRange === 'all' || (property.listed_date && new Date(property.listed_date) >= cutoffDate))
      ) {
        if (agent && !isNaN(commissionEarned)) {
          agentMap[agent] = agentMap[agent] || {
            name: agent,
            totalCommission: 0,
            propertiesListed: 0,
            propertiesSold: 0,
            commissionRate,
            suburbs: new Set(),
          };
          agentMap[agent].totalCommission += commissionEarned;
          agentMap[agent].propertiesListed += isSold ? 0 : 1;
          agentMap[agent].propertiesSold += isSold ? 1 : 0;
          if (suburb !== 'Unknown') {
            (agentMap[agent].suburbs as Set<string>).add(suburb);
          }
        }
      }
    });

    return Object.values(agentMap)
      .map((agent) => ({
        ...agent,
        suburbs: Array.from(agent.suburbs as Set<string>),
      }))
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [internalProperties, searchQuery, agentFilter, agencyFilter, suburbFilter, statusFilter, dateRange]);

  const paginatedFilteredAgentTotals = useMemo(() => {
    return filteredAgentTotals.slice(
      (agentCurrentPage - 1) * itemsPerPage,
      agentCurrentPage * itemsPerPage
    );
  }, [filteredAgentTotals, agentCurrentPage]);

  const agentTotalPages = Math.ceil(filteredAgentTotals.length / itemsPerPage);

  const filteredSuburbCommissions = useMemo(() => {
    return summary.suburbCommissions.filter((row) =>
      (searchQuery === '' || row.suburb.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (suburbFilter === '' || row.suburb.toLowerCase().includes(suburbFilter.toLowerCase())) &&
      (agentFilter === '' || internalProperties.some(
        (p) => normalizeSuburbName(p.suburb) === row.suburb && normalizeAgentName(p.agent_name).toLowerCase().includes(agentFilter.toLowerCase())
      )) &&
      (agencyFilter === '' || internalProperties.some(
        (p) => normalizeSuburbName(p.suburb) === row.suburb && normalizeAgencyName(p.agency_name).toLowerCase().includes(agencyFilter.toLowerCase())
      ))
    );
  }, [summary.suburbCommissions, searchQuery, agentFilter, agencyFilter, suburbFilter, internalProperties]);

  const paginatedFilteredSuburbCommissions = useMemo(() => {
    return filteredSuburbCommissions.slice(
      (suburbCurrentPage - 1) * itemsPerPage,
      suburbCurrentPage * itemsPerPage
    );
  }, [filteredSuburbCommissions, suburbCurrentPage]);

  const suburbTotalPages = Math.ceil(filteredSuburbCommissions.length / itemsPerPage);

  const topFiveAgencies = useMemo(() => filteredAgencyTotals.slice(0, 5).map((row) => row.agency), [filteredAgencyTotals]);
  const topFiveAgents = useMemo(() => filteredAgentTotals.slice(0, 5), [filteredAgentTotals]);
  const topFiveSuburbs = useMemo(() => filteredSuburbCommissions.slice(0, 5).map((row) => row.suburb), [filteredSuburbCommissions]);

  const agencyChartData = useMemo(() => ({
    labels: topFiveAgencies,
    datasets: [
      {
        label: 'Total Commission',
        data: topFiveAgencies.map((agency) => {
          const agencyData = filteredAgencyTotals.find((a) => a.agency === agency);
          return agencyData ? agencyData.totalCommission : 0;
        }),
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
        borderColor: '#4BC0C0',
        borderWidth: 2,
      },
    ],
  }), [topFiveAgencies, filteredAgencyTotals]);

  const agencyChartOptions: ChartOptions<'bar'> = {
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Top 5 Agencies by Commission', font: { size: 18, weight: 'bold', family: 'Inter' } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const agency = context.label;
            return `Commission in ${agency}: ${formatCurrency(value)}`;
          },
        },
      },
      datalabels: {
        display: (context) => context.dataset.data[context.dataIndex] > 0,
        formatter: (value: number) => formatCurrency(value),
        color: '#fff',
        font: { size: 10, family: 'Inter', weight: 'bold' },
        anchor: 'end',
        align: 'top',
        offset: 5,
      },
    },
    scales: {
      x: { ticks: { font: { size: 12, family: 'Inter' } }, grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => formatCurrency(value as number), font: { size: 12, family: 'Inter' } },
        title: { display: true, text: 'Commission (AUD)', font: { size: 14, family: 'Inter' } },
      },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  const agentChartData = useMemo(() => ({
    labels: topFiveAgents.map((agent) => agent.name),
    datasets: [
      {
        label: 'Agent Commission',
        data: topFiveAgents.map((agent) => agent.totalCommission),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
        borderColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
        borderWidth: 2,
      },
    ],
  }), [topFiveAgents]);

  const agentChartOptions: ChartOptions<'bar'> = {
    plugins: {
      legend: { display: false },
      title: { display: true, text: 'Top 5 Agents by Commission', font: { size: 18, weight: 'bold', family: 'Inter' } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const agent = context.label;
            const agentData = topFiveAgents.find((a) => a.name === agent);
            return `${agent}: ${formatCurrency(value)}\nListed: ${agentData?.propertiesListed || 0}, Sold: ${agentData?.propertiesSold || 0}`;
          },
        },
      },
      datalabels: {
        display: (context) => context.dataset.data[context.dataIndex] > 0,
        formatter: (value: number) => formatCurrency(value),
        color: '#fff',
        font: { size: 10, family: 'Inter', weight: 'bold' },
        anchor: 'end',
        align: 'top',
        offset: 5,
      },
    },
    scales: {
      x: { ticks: { font: { size: 12, family: 'Inter' } }, grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => formatCurrency(value as number), font: { size: 12, family: 'Inter' } },
        title: { display: true, text: 'Commission (AUD)', font: { size: 14, family: 'Inter' } },
      },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  const suburbChartData = useMemo(() => ({
    labels: topFiveSuburbs,
    datasets: [
      {
        label: 'Avg Listed Commission',
        data: topFiveSuburbs.map((suburb) => {
          const data = filteredSuburbCommissions.find((s) => s.suburb === suburb);
          return data ? data.listedCommissionTotal / (data.listedPropertyCount || 1) : 0;
        }),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
        borderColor: '#36A2EB',
        borderWidth: 2,
      },
      {
        label: 'Avg Sold Commission',
        data: topFiveSuburbs.map((suburb) => {
          const data = filteredSuburbCommissions.find((s) => s.suburb === suburb);
          return data ? data.soldCommissionTotal / (data.soldPropertyCount || 1) : 0;
        }),
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
        borderColor: '#FF6384',
        borderWidth: 2,
      },
    ],
  }), [topFiveSuburbs, filteredSuburbCommissions]);

  const suburbChartOptions: ChartOptions<'bar'> = {
    plugins: {
      legend: { position: 'top', labels: { font: { size: 14, family: 'Inter' } } },
      title: { display: true, text: 'Average Commission by Suburb', font: { size: 18, weight: 'bold', family: 'Inter' } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const suburb = context.label;
            const label = context.dataset.label;
            const data = filteredSuburbCommissions.find((s) => s.suburb === suburb);
            return `${label} in ${suburb}: ${formatCurrency(value)}\nProperties: ${label.includes('Listed') ? data?.listedPropertyCount || 0 : data?.soldPropertyCount || 0}`;
          },
        },
      },
      datalabels: {
        display: (context) => context.dataset.data[context.dataIndex] > 0,
        formatter: (value: number) => formatCurrency(value),
        color: '#fff',
        font: { size: 10, family: 'Inter', weight: 'bold' },
        anchor: 'end',
        align: 'top',
        offset: 5,
      },
    },
    scales: {
      x: { ticks: { font: { size: 12, family: 'Inter' } }, grid: { display: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (value) => formatCurrency(value as number), font: { size: 12, family: 'Inter' } },
        title: { display: true, text: 'Average Commission (AUD)', font: { size: 14, family: 'Inter' } },
      },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  const updateAgencyCommission = async () => {
    if (!commissionEdit.agency || !commissionEdit.newCommission) return;
    try {
      const newRate = parseFloat(commissionEdit.newCommission);
      if (isNaN(newRate) || newRate < 0) {
        toast.error('Invalid commission rate.');
        return;
      }
      await supabase
        .from('properties')
        .update({ commission: newRate })
        .eq('agency_name', commissionEdit.agency);
      setInternalProperties((prev) =>
        prev.map((p) =>
          normalizeAgencyName(p.agency_name) === commissionEdit.agency ? { ...p, commission: newRate } : p
        )
      );
      setCommissionEdit({ isOpen: false, agency: null, newCommission: '' });
      toast.success('Commission rate updated successfully.');
    } catch (error: any) {
      console.error('Error updating commission:', error);
      toast.error('Failed to update commission rate.');
    }
  };

  const renderPagination = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    const pages = [];
    const maxPagesToShow = 3;
    let startPage = Math.max(1, currentPage - 1);
    let endPage = Math.min(totalPages, currentPage + 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <motion.div
        className="mt-4 flex justify-center items-center space-x-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`px-3 py-1 rounded-full flex items-center text-sm ${
            currentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          whileHover={{ scale: currentPage === 1 ? 1 : 1.05 }}
          whileTap={{ scale: currentPage === 1 ? 1 : 0.95 }}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </motion.button>
        {pages.map((page) => (
          <motion.button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 rounded-full text-sm ${
              currentPage === page ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {page}
          </motion.button>
        ))}
        <motion.button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`px-3 py-1 rounded-full flex items-center text-sm ${
            currentPage === totalPages
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          whileHover={{ scale: currentPage === totalPages ? 1 : 1.05 }}
          whileTap={{ scale: currentPage === totalPages ? 1 : 0.95 }}
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </motion.button>
      </motion.div>
    );
  };

  const exportCommissionPDF = () => {
    try {
      const doc = new jsPDF();
      const margin = 10;

      doc.setFontSize(18);
      doc.text('Admin Commission Dashboard Report', margin, 20);

      doc.setFontSize(14);
      doc.text('Performance Summary', margin, 30);
      autoTable(doc, {
        startY: 35,
        head: [['Metric', 'Value']],
        body: [
          ['Total Commission', formatCurrency(summary.totalCommission)],
          ['Listed Commission', formatCurrency(summary.totalListedCommission)],
          ['Sold Commission', formatCurrency(summary.totalSoldCommission)],
          ['Total Properties', summary.totalProperties.toString()],
          ['Listed Properties', summary.totalListed.toString()],
          ['Sold Properties', summary.totalSold.toString()],
          ['Top Agency', `${summary.topAgency} (${formatCurrency(summary.topAgencyTotalCommission)}, ${summary.topAgencyCommissionRate.toFixed(2)}%)`],
          ['Top Agent', `${summary.topAgent.name} (${formatCurrency(summary.topAgent.commission)})`],
        ],
        theme: 'striped',
        margin: { left: margin, right: margin },
      });

      let finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text('Agency Performance', margin, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Agency', 'Commission Rate', 'Total Commission', 'Listed', 'Sold', 'Suburbs']],
        body: filteredAgencyTotals.map((row) => [
          row.agency,
          `${row.commissionRate.toFixed(2)}%`,
          formatCurrency(row.totalCommission),
          row.listedCount.toString(),
          row.soldCount.toString(),
          row.suburbs.join(', ') || 'None',
        ]),
        theme: 'striped',
        margin: { left: margin, right: margin },
      });

      finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text('Agent Performance', margin, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Agent', 'Commission Rate', 'Total Commission', 'Listed', 'Sold', 'Suburbs']],
        body: filteredAgentTotals.map((row) => [
          row.name,
          row.commissionRate ? `${row.commissionRate.toFixed(2)}%` : 'Agency Default',
          formatCurrency(row.totalCommission),
          row.propertiesListed.toString(),
          row.propertiesSold.toString(),
          row.suburbs.join(', ') || 'None',
        ]),
        theme: 'striped',
        margin: { left: margin, right: margin },
      });

      finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(14);
      doc.text('Suburb Performance', margin, finalY);
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Suburb', 'Avg Listed Rate', 'Listed Commission', 'Listed Properties', 'Avg Sold Rate', 'Sold Commission', 'Sold Properties']],
        body: filteredSuburbCommissions.map((row) => [
          row.suburb,
          `${row.avgListedCommissionRate.toFixed(2)}%`,
          formatCurrency(row.listedCommissionTotal),
          row.listedPropertyCount.toString(),
          `${row.avgSoldCommissionRate.toFixed(2)}%`,
          formatCurrency(row.soldCommissionTotal),
          row.soldPropertyCount.toString(),
        ]),
        theme: 'striped',
        margin: { left: margin, right: margin },
      });

      doc.save('Admin_Commission_Dashboard_Report.pdf');
      toast.success('PDF exported successfully!');
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF.');
    }
  };

  const exportCommissionCSV = () => {
    try {
      let csvContent = 'data:text/csv;charset=utf-8,';

      csvContent += 'Performance Summary\n';
      csvContent += 'Metric,Value\n';
      csvContent += `Total Commission,${formatCurrency(summary.totalCommission)}\n`;
      csvContent += `Listed Commission,${formatCurrency(summary.totalListedCommission)}\n`;
      csvContent += `Sold Commission,${formatCurrency(summary.totalSoldCommission)}\n`;
      csvContent += `Total Properties,${summary.totalProperties}\n`;
      csvContent += `Listed Properties,${summary.totalListed}\n`;
      csvContent += `Sold Properties,${summary.totalSold}\n`;
      csvContent += `Top Agency,"${summary.topAgency} (${formatCurrency(summary.topAgencyTotalCommission)}, ${summary.topAgencyCommissionRate.toFixed(2)}%)"\n`;
      csvContent += `Top Agent,"${summary.topAgent.name} (${formatCurrency(summary.topAgent.commission)})"\n`;
      csvContent += '\n';

      csvContent += 'Agency Performance\n';
      csvContent += 'Agency,Commission Rate,Total Commission,Listed,Sold,Suburbs\n';
      filteredAgencyTotals.forEach((row) => {
        csvContent += `"${row.agency.replace(/"/g, '""')}",${row.commissionRate.toFixed(2)}%,${formatCurrency(row.totalCommission)},${row.listedCount},${row.soldCount},"${row.suburbs.join(', ').replace(/"/g, '""') || 'None'}"\n`;
      });
      csvContent += '\n';

      csvContent += 'Agent Performance\n';
      csvContent += 'Agent,Commission Rate,Total Commission,Listed,Sold,Suburbs\n';
      filteredAgentTotals.forEach((row) => {
        csvContent += `"${row.name.replace(/"/g, '""')}",${row.commissionRate ? row.commissionRate.toFixed(2) : 'Agency Default'}%,${formatCurrency(row.totalCommission)},${row.propertiesListed},${row.propertiesSold},"${row.suburbs.join(', ').replace(/"/g, '""') || 'None'}"\n`;
      });
      csvContent += '\n';

      csvContent += 'Suburb Performance\n';
      csvContent += 'Suburb,Avg Listed Rate,Listed Commission,Listed Properties,Avg Sold Rate,Sold Commission,Sold Properties\n';
      filteredSuburbCommissions.forEach((row) => {
        csvContent += `"${row.suburb.replace(/"/g, '""')}",${row.avgListedCommissionRate.toFixed(2)}%,${formatCurrency(row.listedCommissionTotal)},${row.listedPropertyCount},${row.avgSoldCommissionRate.toFixed(2)}%,${formatCurrency(row.soldCommissionTotal)},${row.soldPropertyCount}\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'Admin_Commission_Dashboard_Report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV exported successfully!');
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV.');
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-50 p-4 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div
          className="flex justify-between items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-gray-800">Admin Commission Dashboard</h1>
          <motion.button
            onClick={() => navigate('/reports')}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </motion.button>
        </motion.div>

        <motion.div
          className="bg-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row gap-4 flex-wrap"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <AutocompleteInput
            placeholder="Search agencies, agents, or suburbs..."
            value={searchQuery}
            onChange={setSearchQuery}
            suggestions={[...agencies, ...agents, ...suburbs]}
          />
          <AutocompleteInput
            placeholder="Filter by agent..."
            value={agentFilter}
            onChange={setAgentFilter}
            suggestions={agents}
          />
          <AutocompleteInput
            placeholder="Filter by agency..."
            value={agencyFilter}
            onChange={setAgencyFilter}
            suggestions={agencies}
          />
          <AutocompleteInput
            placeholder="Filter by suburb..."
            value={suburbFilter}
            onChange={setSuburbFilter}
            suggestions={suburbs}
          />
          <div className="flex gap-2">
            {['all', 'listed', 'sold'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status as 'all' | 'listed' | 'sold')}
                className={`px-4 py-2 rounded-full text-sm capitalize ${
                  statusFilter === status ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'All Time' },
              { value: 'last30', label: 'Last 30 Days' },
              { value: 'last90', label: 'Last 90 Days' },
            ].map((range) => (
              <button
                key={range.value}
                onClick={() => setDateRange(range.value as 'all' | 'last30' | 'last90')}
                className={`px-4 py-2 rounded-full text-sm ${
                  dateRange === range.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <motion.button
            onClick={resetFilters}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Filters
          </motion.button>
        </motion.div>

        {isLoading ? (
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
          </motion.div>
        ) : fetchError ? (
          <motion.div
            className="text-center p-10 bg-white rounded-xl shadow-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-red-600 text-lg font-semibold">Error: {fetchError}</p>
          </motion.div>
        ) : (
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <CollapsibleSection
              title="Performance Summary"
              isOpen={openSections.summary}
              toggleOpen={() => setOpenSections({ ...openSections, summary: !openSections.summary })}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Total Commission</h3>
                  <p className="text-2xl font-bold text-indigo-600">{formatCurrency(summary.totalCommission)}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Listed Commission</h3>
                  <p className="text-2xl font-bold text-indigo-600">{formatCurrency(summary.totalListedCommission)}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Sold Commission</h3>
                  <p className="text-2xl font-bold text-indigo-600">{formatCurrency(summary.totalSoldCommission)}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Total Properties</h3>
                  <p className="text-2xl font-bold text-indigo-600">{summary.totalProperties}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Listed Properties</h3>
                  <p className="text-2xl font-bold text-indigo-600">{summary.totalListed}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Sold Properties</h3>
                  <p className="text-2xl font-bold text-indigo-600">{summary.totalSold}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Top Agency</h3>
                  <p className="text-lg font-medium text-gray-600">
                    {summary.topAgency} ({formatCurrency(summary.topAgencyTotalCommission)}, {summary.topAgencyCommissionRate.toFixed(2)}%)
                  </p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-800">Top Agent</h3>
                  <p className="text-lg font-medium text-gray-600">
                    {summary.topAgent.name} ({formatCurrency(summary.topAgent.commission)})
                  </p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Agency Performance"
              isOpen={openSections.agencies}
              toggleOpen={() => setOpenSections({ ...openSections, agencies: !openSections.agencies })}
            >
              <div className="space-y-6">
                <div className="mb-6 h-96">
                  <Bar data={agencyChartData} options={agencyChartOptions} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-indigo-100">
                        <th className="p-3 text-sm font-semibold text-gray-800">Agency</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Commission Rate</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Total Commission</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Listed Commission</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Sold Commission</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Total Properties</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Listed</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Sold</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Suburbs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFilteredAgencyTotals.map((row) => (
                        <tr key={row.agency} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm text-gray-700">{row.agency}</td>
                          <td className="p-3 text-sm text-gray-700">
                            <div className="flex items-center gap-2">
                              {row.commissionRate.toFixed(2)}%
                              {isAdmin && (
                                <button
                                  onClick={() => setCommissionEdit({ isOpen: true, agency: row.agency, newCommission: row.commissionRate.toString() })}
                                  className="text-indigo-600 hover:text-indigo-800"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-sm text-gray-700">{formatCurrency(row.totalCommission)}</td>
                          <td className="p-3 text-sm text-gray-700">{formatCurrency(row.listedCommission)}</td>
                          <td className="p-3 text-sm text-gray-700">{formatCurrency(row.soldCommission)}</td>
                          <td className="p-3 text-sm text-gray-700">{row.propertyCount}</td>
                          <td className="p-3 text-sm text-gray-700">{row.listedCount}</td>
                          <td className="p-3 text-sm text-gray-700">{row.soldCount}</td>
                          <td className="p-3 text-sm text-gray-700">{row.suburbs.join(', ') || 'None'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredAgencyTotals.length > itemsPerPage && renderPagination(agencyCurrentPage, agencyTotalPages, setAgencyCurrentPage)}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Agent Performance"
              isOpen={openSections.agents}
              toggleOpen={() => setOpenSections({ ...openSections, agents: !openSections.agents })}
            >
              <div className="space-y-6">
                <div className="mb-6 h-96">
                  <Bar data={agentChartData} options={agentChartOptions} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-indigo-100">
                        <th className="p-3 text-sm font-semibold text-gray-800">Agent</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Commission Rate</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Total Commission</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Properties Listed</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Properties Sold</th>
                        <th className="p-3 text-sm font-semibold text-gray-800">Suburbs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFilteredAgentTotals.map((row) => (
                        <tr key={row.name} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm text-gray-700">{row.name}</td>
                          <td className="p-3 text-sm text-gray-700">{row.commissionRate ? `${row.commissionRate.toFixed(2)}%` : 'Agency Default'}</td>
                          <td className="p-3 text-sm text-gray-700">{formatCurrency(row.totalCommission)}</td>
                          <td className="p-3 text-sm text-gray-700">{row.propertiesListed}</td>
                          <td className="p-3 text-sm text-gray-700">{row.propertiesSold}</td>
                          <td className="p-3 text-sm text-gray-700">{row.suburbs.join(', ') || 'None'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredAgentTotals.length > itemsPerPage && renderPagination(agentCurrentPage, agentTotalPages, setAgentCurrentPage)}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Suburb Performance"
              isOpen={openSections.suburbs}
              toggleOpen={() => setOpenSections({ ...openSections, suburbs: !openSections.suburbs })}
            >
              <div className="space-y-6">
                {filteredSuburbCommissions.length > 0 ? (
                  <>
                    <div className="mb-6 h-96">
                      <Bar data={suburbChartData} options={suburbChartOptions} />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-indigo-100">
                            <th className="p-3 text-sm font-semibold text-gray-800">Suburb</th>
                            <th className="p-3 text-sm font-semibold text-gray-800">Avg Listed Commission Rate</th>
                            <th className="p-3 text-sm font-semibold text-gray-800">Listed Commission</th>
                            <th className="p-3 text-sm font-semibold text-gray-800">Listed Properties</th>
                            <th className="p-3 text-sm font-semibold text-gray-800">Avg Sold Commission Rate</th>
                            <th className="p-3 text-sm font-semibold text-gray-800">Sold Commission</th>
                            <th className="p-3 text-sm font-semibold text-gray-800">Sold Properties</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedFilteredSuburbCommissions.map((row) => (
                            <tr key={row.suburb} className="border-b hover:bg-gray-50">
                              <td className="p-3 text-sm text-gray-700">{row.suburb}</td>
                              <td className="p-3 text-sm text-gray-700">{row.avgListedCommissionRate.toFixed(2)}%</td>
                              <td className="p-3 text-sm text-gray-700">{formatCurrency(row.listedCommissionTotal)}</td>
                              <td className="p-3 text-sm text-gray-700">{row.listedPropertyCount}</td>
                              <td className="p-3 text-sm text-gray-700">{row.avgSoldCommissionRate.toFixed(2)}%</td>
                              <td className="p-3 text-sm text-gray-700">{formatCurrency(row.soldCommissionTotal)}</td>
                              <td className="p-3 text-sm text-gray-700">{row.soldPropertyCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filteredSuburbCommissions.length > itemsPerPage && renderPagination(suburbCurrentPage, suburbTotalPages, setSuburbCurrentPage)}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-600 text-center">No suburb data available. Try adjusting the filters.</p>
                )}
              </div>
            </CollapsibleSection>

            {commissionEdit.isOpen && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white p-6 rounded-xl shadow-lg">
                  <h3 className="text-lg font-semibold">Edit Commission Rate for {commissionEdit.agency}</h3>
                  <input
                    type="number"
                    value={commissionEdit.newCommission}
                    onChange={(e) => setCommissionEdit({ ...commissionEdit, newCommission: e.target.value })}
                    placeholder="Enter new commission rate (%)"
                    className="mt-2 p-2 border border-gray-200 rounded-lg w-full"
                  />
                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={() => setCommissionEdit({ isOpen: false, agency: null, newCommission: '' })}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updateAgencyCommission}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              className="flex justify-end space-x-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <motion.button
                onClick={exportCommissionPDF}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </motion.button>
              <motion.button
                onClick={exportCommissionCSV}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default AdminCommissionDashboard;