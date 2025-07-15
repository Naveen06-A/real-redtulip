import { useState, useCallback, useMemo, useEffect } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ArcElement,
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
import { utils, writeFile } from 'xlsx';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Star,
  MapPin,
  ChevronDown,
  ChevronUp,
  Pencil,
  ArrowLeft,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

// Register ChartJS components and plugins
ChartJS.register(BarElement, CategoryScale, LinearScale, ArcElement, Tooltip, Legend, ChartDataLabels);

// Interfaces (unchanged)
interface User {
  id: string;
  email?: string;
  agent_name?: string;
  agency_name?: string;
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
  agencyPropertyCounts: Record<string, number>;
  topStreet: { street: string; listedCount: number; commission: number };
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
  propertyTypes: string[];
  agents: AgentTotal[];
}

interface AgentTotal {
  name: string;
  totalCommission: number;
  propertiesListed: number;
  propertiesSold: number;
  commissionRate?: number;
  suburbs: string[];
  propertyTypes: string[];
}

interface CommissionEditState {
  isOpen: boolean;
  agency: string | null;
  newCommission: string;
}

interface AgentCommissionEditState {
  isOpen: boolean;
  agency: string | null;
  agent: string | null;
  newCommission: string;
}

interface AgentCommission {
  id?: string;
  property_id: string;
  agent_name: string;
  commission_rate: number;

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
}

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
  // Split by spaces or hyphens, capitalize first letter of each word, join back
  return name
    .trim()
    .toUpperCase()
    .split(/[\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
const calculateCommission = (
  property: PropertyDetails,
  agentCommissions: AgentCommission[]
): { commissionEarned: number; commissionRate: number } => {
  // Default values
  let commissionEarned = 0;
  let commissionRate = property.commission || 0;

  // Determine the price to use (sold_price for sold properties, price for listed)
  const price = property.sold_price && (property.contract_status === 'sold' || property.sold_date)
    ? property.sold_price
    : property.price || 0;

  // Find agent-specific commission rate if available
  const agentCommission = agentCommissions.find(
    (ac) => ac.property_id === property.id && ac.agent_name === property.agent_name
  );
  if (agentCommission?.commission_rate) {
    commissionRate = agentCommission.commission_rate;
  }

  // Calculate commission if price and commission rate are valid
  if (price > 0 && commissionRate > 0) {
    commissionEarned = price * (commissionRate / 100);
  }

  return {
    commissionEarned: isNaN(commissionEarned) ? 0 : commissionEarned,
    commissionRate: isNaN(commissionRate) ? 0 : commissionRate,
  };
};

// ... (Imports, interfaces, and helper functions remain unchanged as provided in the original code)

// CollapsibleSection and ProgressBar components remain unchanged
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

const ProgressBar: React.FC<{ value: number; label: string; maxValue: number }> = ({ value, label, maxValue }) => {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span>{formatCurrency(value)}</span>
      </div>
      <motion.div
        className="w-full bg-gray-200 rounded-full h-2.5"
        initial={{ width: 0 }}
        animate={{ width: '100%' }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        <motion.div
          className="bg-indigo-600 h-2.5 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </motion.div>
    </div>
  );
};

function CommissionByAgency() {
  // State declarations (unchanged, including agentCurrentPage from previous fix)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'listed' | 'sold'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'last30' | 'last90'>('all');
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [internalCommissionData, setInternalCommissionData] = useState<Record<string, Record<string, number>> | null>(null);
  const [internalAgentData, setInternalAgentData] = useState<Record<string, { commission: number; listed: number; sold: number; commissionRate?: number }>>({});
  const [internalProperties, setInternalProperties] = useState<PropertyDetails[]>([]);
  const [agentCommissions, setAgentCommissions] = useState<AgentCommission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [agencyCurrentPage, setAgencyCurrentPage] = useState(1);
  const [suburbCurrentPage, setSuburbCurrentPage] = useState(1);
  const [agentCurrentPage, setAgentCurrentPage] = useState(1);
  const [openSections, setOpenSections] = useState({
    summary: true,
    ourPerformance: true,
    agencies: true,
    agents: true,
    streets: true,
    suburbs: true,
  });
  const [commissionEdit, setCommissionEdit] = useState<CommissionEditState>({
    isOpen: false,
    agency: null,
    newCommission: '',
  });
  const [agentCommissionEdit, setAgentCommissionEdit] = useState<AgentCommissionEditState>({
    isOpen: false,
    agency: null,
    agent: null,
    newCommission: '',
  });
  const itemsPerPage = 10;
  const ourAgencyName = 'Harcourts Success';
  const ourAgentName = 'John Smith';
  const { user } = useAuthStore((state: { user: User | null }) => ({ user: state.user }));
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();

  // useEffect and calculateSummary remain unchanged
  useEffect(() => {
    const fetchCommissionData = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('properties')
          .select('id, agency_name, property_type, commission, price, sold_price, suburb, street_name, street_number, agent_name, postcode, category, listed_date, sale_type, expected_price, features, flood_risk, bushfire_risk, contract_status, same_street_sales, past_records, sold_date');

        if (propertiesError) throw propertiesError;

        const { data: agentCommissionsData, error: agentCommissionsError } = await supabase
          .from('agent_commissions')
          .select('id, property_id, agent_name, commission_rate');

        if (agentCommissionsError) throw agentCommissionsError;

        const fetchedProperties = (propertiesData as PropertyDetails[]) || [];
        const fetchedAgentCommissions = (agentCommissionsData as AgentCommission[]) || [];

        setInternalProperties(fetchedProperties);
        setAgentCommissions(fetchedAgentCommissions);

        const newCommissionMap: Record<string, Record<string, number>> = {};
        const newAgentMap: Record<string, { commission: number; listed: number; sold: number; commissionRate?: number }> = {};

        fetchedProperties.forEach((property) => {
          const agency = normalizeAgencyName(property.agency_name);
          const agent = normalizeAgentName(property.agent_name);
          const propertyType = property.property_type || 'Unknown';
          const { commissionEarned, commissionRate } = calculateCommission(property, fetchedAgentCommissions);
          const isSold = property.contract_status === 'sold' || !!property.sold_date;

          if (agency && !isNaN(commissionEarned)) {
            newCommissionMap[agency] = newCommissionMap[agency] || {};
            newCommissionMap[agency][propertyType] = (newCommissionMap[agency][propertyType] || 0) + commissionEarned;
          }

          if (agent) {
            newAgentMap[agent] = newAgentMap[agent] || { commission: 0, listed: 0, sold: 0, commissionRate: undefined };
            newAgentMap[agent].listed += 1;
            newAgentMap[agent].sold += isSold ? 1 : 0;
            newAgentMap[agent].commission += isNaN(commissionEarned) ? 0 : commissionEarned;
            if (!newAgentMap[agent].commissionRate) {
              const agentPropertyCommission = fetchedAgentCommissions.find(
                (ac) => ac.property_id === property.id && ac.agent_name === agent
              );
              newAgentMap[agent].commissionRate = agentPropertyCommission?.commission_rate;
            }
          }
        });

        setInternalCommissionData(newCommissionMap);
        setInternalAgentData(newAgentMap);
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
    let maxCommission = 0;
    let topAgent = { name: 'Unknown', commission: 0, propertyCount: 0 };
    const agencyPropertyCounts: Record<string, number> = {};
    const streetMap: Record<string, { listedCount: number; commission: number }> = {};
    const suburbMap: Record<string, {
      listedCommissionTotal: number;
      listedPropertyCount: number;
      soldCommissionTotal: number;
      soldPropertyCount: number;
      listedCommissionRates: number[];
      soldCommissionRates: number[];
    }> = {};

    if (!internalCommissionData || !internalProperties) {
      console.warn('Missing commission data or properties:', { internalCommissionData, internalProperties });
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
        agencyPropertyCounts,
        topStreet: { street: 'None', listedCount: 0, commission: 0 },
        suburbCommissions: [],
      };
    }

    console.log('Processing properties for summary:', internalProperties.length);

    internalProperties.forEach((property) => {
      const agency = normalizeAgencyName(property.agency_name);
      const agent = normalizeAgentName(property.agent_name);
      const suburb = normalizeSuburbName(property.suburb);
      const { commissionEarned, commissionRate } = calculateCommission(property, agentCommissions);
      const street = `${property.street_name || 'Unknown'}, ${suburb}`;
      const isSold = property.contract_status === 'sold' || !!property.sold_date;

      if (agency && !isNaN(commissionEarned)) {
        agencyPropertyCounts[agency] = (agencyPropertyCounts[agency] || 0) + 1;
        totalProperties += 1;
        if (isSold) {
          totalSold += 1;
          totalSoldCommission += commissionEarned;
        } else {
          totalListed += 1;
          totalListedCommission += commissionEarned;
        }
        if (commissionEarned > 0) {
          totalCommission += commissionEarned;
          if (internalAgentData[agent]?.commission > topAgent.commission) {
            topAgent = { name: agent, commission: internalAgentData[agent].commission, propertyCount: internalAgentData[agent].listed };
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

      streetMap[street] = streetMap[street] || { listedCount: 0, commission: 0 };
      streetMap[street].listedCount += 1;
      streetMap[street].commission += isNaN(commissionEarned) ? 0 : commissionEarned;
    });

    console.log('Suburb map:', suburbMap);

    Object.entries(internalCommissionData).forEach(([agency, types]) => {
      const agencyTotal = Object.values(types).reduce((sum, val) => sum + (isNaN(val) ? 0 : val), 0);
      const agencyProperties = internalProperties.filter((p) => normalizeAgencyName(p.agency_name) === agency);
      const propertyCount = agencyProperties.length;
      const validCommissions = agencyProperties
        .map((p) => p.commission)
        .filter((c): c is number => c !== undefined && c !== null && !isNaN(c));
      const commissionRate = validCommissions.length > 0 
        ? validCommissions.reduce((sum, c) => sum + c, 0) / validCommissions.length 
        : 0;

      if (agencyTotal > maxCommission && !isNaN(agencyTotal) && agencyTotal > 0) {
        maxCommission = agencyTotal;
        topAgency = agency;
        topAgencyTotalCommission = agencyTotal;
        topAgencyPropertyCount = propertyCount;
        topAgencyCommissionRate = commissionRate;
      }
    });

    const topStreet = Object.entries(streetMap).reduce(
      (max, [street, data]) => 
        data.listedCount > max.listedCount || 
        (data.listedCount === max.listedCount && data.commission > max.commission) 
          ? { street, ...data } 
          : max,
      { street: 'None', listedCount: 0, commission: 0 }
    );

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

    console.log('Suburb commissions:', suburbCommissions);

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
      agencyPropertyCounts,
      topStreet,
      suburbCommissions,
    };
  }, [internalCommissionData, internalProperties, internalAgentData, agentCommissions]);

  const summary = calculateSummary();

  // Memoized values (updated to include filteredAgencyTotals)
  const agencyTotals = useMemo<AgencyTotal[]>(() => {
    if (!internalCommissionData) return [];
    const agencySuburbsMap: Record<string, Set<string>> = {};
    const agencyPropertyTypesMap: Record<string, Set<string>> = {};
    const agencyAgentsMap: Record<string, AgentTotal[]> = {};
    const agentSuburbsMap: Record<string, Set<string>> = {};
    const agentPropertyTypesMap: Record<string, Set<string>> = {};

    internalProperties.forEach((property) => {
      const agency = normalizeAgencyName(property.agency_name);
      const agent = normalizeAgentName(property.agent_name);
      const suburb = normalizeSuburbName(property.suburb);
      const propertyType = property.property_type || 'Unknown';
      const isSold = property.contract_status === 'sold' || !!property.sold_date;

      if (agency && suburb !== 'Unknown') {
        agencySuburbsMap[agency] = agencySuburbsMap[agency] || new Set();
        agencySuburbsMap[agency].add(suburb);
      }
      if (agency && propertyType !== 'Unknown') {
        agencyPropertyTypesMap[agency] = agencyPropertyTypesMap[agency] || new Set();
        agencyPropertyTypesMap[agency].add(propertyType);
      }
      if (agency && agent) {
        agencyAgentsMap[agency] = agencyAgentsMap[agency] || [];
        agentSuburbsMap[agent] = agentSuburbsMap[agent] || new Set();
        agentSuburbsMap[agent].add(suburb);
        agentPropertyTypesMap[agent] = agentPropertyTypesMap[agent] || new Set();
        agentPropertyTypesMap[agent].add(propertyType);

        const agentData = internalAgentData[agent] || { commission: 0, listed: 0, sold: 0, commissionRate: undefined };
        if (!agencyAgentsMap[agency].some((a) => a.name === agent)) {
          agencyAgentsMap[agency].push({
            name: agent,
            totalCommission: agentData.commission,
            propertiesListed: agentData.listed,
            propertiesSold: agentData.sold,
            commissionRate: agentData.commissionRate,
            suburbs: Array.from(agentSuburbsMap[agent] || []),
            propertyTypes: Array.from(agentPropertyTypesMap[agent] || []),
          });
        }
      }
    });

    return Object.entries(internalCommissionData)
      .map(([agency, types]) => {
        const properties = internalProperties.filter((p) => normalizeAgencyName(p.agency_name) === agency);
        const listedCommission = properties
          .filter((p) => !(p.contract_status === 'sold' || !!p.sold_date))
          .reduce((sum, p) => {
            const { commissionEarned } = calculateCommission(p, agentCommissions);
            return sum + (isNaN(commissionEarned) ? 0 : commissionEarned);
          }, 0);
        const soldCommission = properties
          .filter((p) => p.contract_status === 'sold' || !!p.sold_date)
          .reduce((sum, p) => {
            const { commissionEarned } = calculateCommission(p, agentCommissions);
            return sum + (isNaN(commissionEarned) ? 0 : commissionEarned);
          }, 0);
        const validCommissions = properties
          .map((p) => p.commission)
          .filter((c): c is number => c !== undefined && c !== null && !isNaN(c));
        const commissionRate = validCommissions.length > 0 
          ? validCommissions.reduce((sum, c) => sum + c, 0) / validCommissions.length 
          : 0;

        return {
          agency,
          totalCommission: Object.values(types).reduce((sum, val) => sum + (isNaN(val) ? 0 : val), 0),
          listedCommission,
          soldCommission,
          commissionRate,
          propertyCount: properties.length,
          listedCount: properties.filter((p) => !(p.contract_status === 'sold' || !!p.sold_date)).length,
          soldCount: properties.filter((p) => p.contract_status === 'sold' || !!p.sold_date).length,
          suburbs: Array.from(agencySuburbsMap[agency] || []),
          propertyTypes: Array.from(agencyPropertyTypesMap[agency] || []),
          agents: agencyAgentsMap[agency] || [],
        };
      })
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [internalCommissionData, internalProperties, internalAgentData, agentCommissions]);

  // New: Define filteredAgencyTotals
  const filteredAgencyTotals = useMemo(() => {
    let filtered = agencyTotals;
    if (searchQuery) {
      filtered = filtered.filter((row) =>
        row.agency.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.suburbs.some((suburb) => suburb.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((row) => {
        const properties = internalProperties.filter((p) => normalizeAgencyName(p.agency_name) === row.agency);
        return properties.some((p) =>
          statusFilter === 'sold' ? p.contract_status === 'sold' || !!p.sold_date : !(p.contract_status === 'sold' || !!p.sold_date)
        );
      });
    }
    if (dateRange !== 'all') {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (dateRange === 'last30' ? 30 : 90));
      filtered = filtered.filter((row) => {
        const properties = internalProperties.filter((p) => normalizeAgencyName(p.agency_name) === row.agency);
        return properties.some((p) => (p.listed_date ? new Date(p.listed_date) >= cutoffDate : false));
      });
    }
    console.log('Filtered agency totals:', filtered);
    return filtered;
  }, [agencyTotals, searchQuery, statusFilter, dateRange, internalProperties]);

  const ourAgency = useMemo(() => {
    const agency = agencyTotals.find((a) => a.agency.toLowerCase() === ourAgencyName.toLowerCase());
    if (!agency) {
      console.warn(`No data found for agency: ${ourAgencyName}`);
      return null;
    }
    return agency;
  }, [agencyTotals, ourAgencyName]);

  const ourAgent = useMemo(() => {
    if (!ourAgency) return null;
    return ourAgency.agents.find((a) => a.name === ourAgentName) || null;
  }, [ourAgency, ourAgentName]);

  const topFiveAgencies = useMemo(() => agencyTotals.slice(0, 5).map((row) => row.agency), [agencyTotals]);
  const topFiveAgents = useMemo(
    () =>
      Object.entries(internalAgentData)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.commission - a.commission)
        .slice(0, 5),
    [internalAgentData]
  );

  const topFiveSuburbs = useMemo(
    () => summary.suburbCommissions.slice(0, 5).map((row) => row.suburb),
    [summary.suburbCommissions]
  );

  const handleAgencyPageChange = (page: number) => {
    setAgencyCurrentPage(page);
  };

  const handleSuburbPageChange = (page: number) => {
    setSuburbCurrentPage(page);
  };

  const handleAgentPageChange = (page: number) => {
    setAgentCurrentPage(page);
  };

  const propertyTypes = useMemo(
    () =>
      Array.from(
        new Set(topFiveAgencies.flatMap((agency) => (internalCommissionData ? Object.keys(internalCommissionData[agency]) : [])))
      ),
    [topFiveAgencies, internalCommissionData]
  );

  // Chart data and options (unchanged)
  const agencyChartData = useMemo(
    () => ({
      labels: topFiveAgencies,
      datasets: propertyTypes.map((type, index) => ({
        label: type,
        data: topFiveAgencies.map((agency) => internalCommissionData?.[agency]?.[type] || 0),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'][index % 5],
        borderColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'][index % 5],
        borderWidth: 2,
        stack: 'Stack 0',
      })),
    }),
    [topFiveAgencies, propertyTypes, internalCommissionData]
  );

  const agencyChartOptions: ChartOptions<'bar'> = {
    plugins: {
      legend: { position: 'top', labels: { font: { size: 14, family: 'Inter' } } },
      title: { display: true, text: 'Top 5 Agencies by Commission', font: { size: 18, weight: 'bold', family: 'Inter' } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const agency = context.label;
            const type = context.dataset.label;
            return `${type} in ${agency}: ${formatCurrency(value)}`;
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
      x: { stacked: true, ticks: { font: { size: 12, family: 'Inter' } }, grid: { display: false } },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { callback: (value) => formatCurrency(value as number), font: { size: 12, family: 'Inter' } },
        title: { display: true, text: 'Commission (AUD)', font: { size: 14, family: 'Inter' } },
      },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  const agentChartData = useMemo(
    () => ({
      labels: topFiveAgents.map((agent) => agent.name),
      datasets: [
        {
          label: 'Agent Commission',
          data: topFiveAgents.map((agent) => agent.commission),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
        },
      ],
    }),
    [topFiveAgents]
  );

  const agentChartOptions: ChartOptions<'doughnut'> = {
    plugins: {
      legend: { position: 'top', labels: { font: { size: 14, family: 'Inter' } } },
      title: { display: true, text: 'Top 5 Agents by Commission', font: { size: 18, weight: 'bold', family: 'Inter' } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            const agent = context.label;
            const agentData = topFiveAgents.find((a) => a.name === agent);
            return `${agent}: ${formatCurrency(value)}\nListed: ${agentData?.listed || 0}, Sold: ${agentData?.sold || 0}`;
          },
        },
      },
    },
  };

  const filteredAgentData = useMemo(() => {
    let filtered = Object.entries(internalAgentData).map(([name, data]) => ({ name, ...data }));
    if (selectedAgency) {
      filtered = filtered.filter((agent) => {
        const properties = internalProperties.filter((p) => normalizeAgentName(p.agent_name) === agent.name);
        return properties.some((p) => normalizeAgencyName(p.agency_name) === selectedAgency);
      });
    }
    console.log('Filtered agent data:', filtered);
    return filtered;
  }, [internalAgentData, selectedAgency, internalProperties]);

  const paginatedFilteredAgentData = useMemo(() => {
    return filteredAgentData.slice(
      (agentCurrentPage - 1) * itemsPerPage,
      agentCurrentPage * itemsPerPage
    );
  }, [filteredAgentData, agentCurrentPage]);

  const agentTotalPages = Math.ceil(filteredAgentData.length / itemsPerPage);

  const agentPropertyTypeChartData = useMemo(() => {
    const selectedAgents = selectedAgency
      ? filteredAgentData.filter((agent) => agencyTotals.find((a) => a.agency === selectedAgency)?.agents.some((ag) => ag.name === agent.name))
      : topFiveAgents;
    const propertyTypesSet = new Set<string>();
    internalProperties.forEach((p) => {
      if (p.property_type && selectedAgents.some((a) => a.name === normalizeAgentName(p.agent_name))) {
        propertyTypesSet.add(p.property_type);
      }
    });
    const propertyTypes = Array.from(propertyTypesSet);

    return {
      labels: selectedAgents.map((agent) => agent.name),
      datasets: propertyTypes.map((type, index) => ({
        label: type,
        data: selectedAgents.map((agent) => {
          const properties = internalProperties.filter(
            (p) => normalizeAgentName(p.agent_name) === agent.name && p.property_type === type
          );
          return properties.length;
        }),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'][index % 5],
        borderColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'][index % 5],
        borderWidth: 2,
        stack: 'Stack 0',
      })),
    };
  }, [internalProperties, selectedAgency, filteredAgentData, topFiveAgents]);

  const agentPropertyTypeChartOptions: ChartOptions<'bar'> = {
    plugins: {
      legend: { position: 'top', labels: { font: { size: 14, family: 'Inter' } } },
      title: { display: true, text: 'Agent Property Type Distribution', font: { size: 18, weight: 'bold', family: 'Inter' } },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            const agent = context.label;
            const type = context.dataset.label;
            return `${type} by ${agent}: ${value} properties`;
          },
        },
      },
      datalabels: {
        display: (context) => context.dataset.data[context.dataIndex] > 0,
        formatter: (value: number) => value,
        color: '#fff',
        font: { size: 10, family: 'Inter', weight: 'bold' },
        anchor: 'end',
        align: 'top',
        offset: 5,
      },
    },
    scales: {
      x: { stacked: true, ticks: { font: { size: 12, family: 'Inter' } }, grid: { display: false } },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { font: { size: 12, family: 'Inter' } },
        title: { display: true, text: 'Number of Properties', font: { size: 14, family: 'Inter' } },
      },
    },
    maintainAspectRatio: false,
    responsive: true,
  };

  const suburbChartData = useMemo(() => {
    const data = {
      labels: topFiveSuburbs,
      datasets: [
        {
          label: 'Avg Listed Commission',
          data: topFiveSuburbs.map((suburb) => {
            const data = summary.suburbCommissions.find((s) => s.suburb === suburb);
            return data ? data.listedCommissionTotal / (data.listedPropertyCount || 1) : 0;
          }),
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: '#36A2EB',
          borderWidth: 2,
        },
        {
          label: 'Avg Sold Commission',
          data: topFiveSuburbs.map((suburb) => {
            const data = summary.suburbCommissions.find((s) => s.suburb === suburb);
            return data ? data.soldCommissionTotal / (data.soldPropertyCount || 1) : 0;
          }),
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          borderColor: '#FF6384',
          borderWidth: 2,
        },
      ],
    };
    console.log('Suburb chart data:', data);
    return data;
  }, [topFiveSuburbs, summary.suburbCommissions]);

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
            const data = summary.suburbCommissions.find((s) => s.suburb === suburb);
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

  const filteredSuburbCommissions = useMemo(() => {
    let filtered = summary.suburbCommissions;
    if (searchQuery) {
      filtered = filtered.filter((row) => row.suburb.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter((row) => {
        const properties = internalProperties.filter((p) => normalizeSuburbName(p.suburb) === row.suburb);
        return properties.some((p) => (statusFilter === 'sold' ? p.contract_status === 'sold' || !!p.sold_date : !(p.contract_status === 'sold' || !!p.sold_date)));
      });
    }
    if (dateRange !== 'all') {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (dateRange === 'last30' ? 30 : 90));
      filtered = filtered.filter((row) => {
        const properties = internalProperties.filter((p) => normalizeSuburbName(p.suburb) === row.suburb);
        return properties.some((p) => (p.listed_date ? new Date(p.listed_date) >= cutoffDate : false));
      });
    }
    console.log('Filtered suburb commissions:', filtered);
    return filtered;
  }, [summary.suburbCommissions, searchQuery, statusFilter, dateRange, internalProperties]);

  // Updated: Define paginatedFilteredAgencyTotals using filteredAgencyTotals
  const paginatedFilteredAgencyTotals = useMemo(() => {
    return filteredAgencyTotals.slice(
      (agencyCurrentPage - 1) * itemsPerPage,
      agencyCurrentPage * itemsPerPage
    );
  }, [filteredAgencyTotals, agencyCurrentPage]);

  const paginatedFilteredSuburbCommissions = filteredSuburbCommissions.slice(
    (suburbCurrentPage - 1) * itemsPerPage,
    suburbCurrentPage * itemsPerPage
  );

  const agencyTotalPages = Math.ceil(filteredAgencyTotals.length / itemsPerPage);
  const suburbTotalPages = Math.ceil(filteredSuburbCommissions.length / itemsPerPage);

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
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;

      // Title
      doc.setFontSize(18);
      doc.text('Commission Dashboard Report', margin, 20);

      // Summary Section
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
          ['Top Agency', `${summary.topAgency} (${formatCurrency(summary.topAgencyTotalCommission)}, ${summary.topAgencyCommissionRate.toFixed(2)}%)`],
          ['Top Agent', `${summary.topAgent.name} (${formatCurrency(summary.topAgent.commission)})`],
        ],
        theme: 'striped',
        margin: { left: margin, right: margin },
      });

      // Agency Performance Section
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

      // Suburb Performance Section
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

      // Save the PDF
      doc.save('Commission_Dashboard_Report.pdf');
      toast.success('PDF exported successfully!');
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF.');
    }
  };
  const exportCommissionCSV = () => {
    try {
      let csvContent = 'data:text/csv;charset=utf-8,';

      // Summary Section
      csvContent += 'Performance Summary\n';
      csvContent += 'Metric,Value\n';
      csvContent += `Total Commission,${formatCurrency(summary.totalCommission)}\n`;
      csvContent += `Listed Commission,${formatCurrency(summary.totalListedCommission)}\n`;
      csvContent += `Sold Commission,${formatCurrency(summary.totalSoldCommission)}\n`;
      csvContent += `Total Properties,${summary.totalProperties}\n`;
      csvContent += `Top Agency,"${summary.topAgency} (${formatCurrency(summary.topAgencyTotalCommission)}, ${summary.topAgencyCommissionRate.toFixed(2)}%)"\n`;
      csvContent += `Top Agent,"${summary.topAgent.name} (${formatCurrency(summary.topAgent.commission)})"\n`;
      csvContent += '\n';

      // Agency Performance Section
      csvContent += 'Agency Performance\n';
      csvContent += 'Agency,Commission Rate,Total Commission,Listed,Sold,Suburbs\n';
      filteredAgencyTotals.forEach((row) => {
        csvContent += `"${row.agency.replace(/"/g, '""')}",${row.commissionRate.toFixed(2)}%,${formatCurrency(row.totalCommission)},${row.listedCount},${row.soldCount},"${row.suburbs.join(', ').replace(/"/g, '""') || 'None'}"\n`;
      });
      csvContent += '\n';

      // Suburb Performance Section
      csvContent += 'Suburb Performance\n';
      csvContent += 'Suburb,Avg Listed Rate,Listed Commission,Listed Properties,Avg Sold Rate,Sold Commission,Sold Properties\n';
      filteredSuburbCommissions.forEach((row) => {
        csvContent += `"${row.suburb.replace(/"/g, '""')}",${row.avgListedCommissionRate.toFixed(2)}%,${formatCurrency(row.listedCommissionTotal)},${row.listedPropertyCount},${row.avgSoldCommissionRate.toFixed(2)}%,${formatCurrency(row.soldCommissionTotal)},${row.soldPropertyCount}\n`;
      });

      // Encode and trigger download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', 'Commission_Dashboard_Report.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV exported successfully!');
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      toast.error('Failed to export CSV.');
    }
  };

  // JSX Return Statement (unchanged, as the error was in the memoized values)
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
          <h1 className="text-3xl font-bold text-gray-800">Commission Dashboard</h1>
          <motion.button
            onClick={() => navigate('/reports')}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Commission Management
          </motion.button>
        </motion.div>

        <motion.div
          className="bg-white p-4 rounded-xl shadow-lg flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative w-full sm:w-64 group">
            <input
              type="text"
              placeholder="Search agencies or suburbs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          </div>
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
        </motion.div>

        {isLoading ? (
          <motion.div
            className="space-y-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="h-32 bg-gray-200 rounded-xl animate-pulse" />
            <div className="h-20 bg-gray-200 rounded-xl animate-pulse" />
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
              title="Our Performance"
              isOpen={openSections.ourPerformance}
              toggleOpen={() => setOpenSections({ ...openSections, ourPerformance: !openSections.ourPerformance })}
            >
              {ourAgency ? (
                <div className="space-y-6">
                  <div className="mb-6 h-96">
                    <Bar data={agencyChartData} options={agencyChartOptions} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-indigo-50 p-4 rounded-lg">
                      <h3 className="text-lg font-semibold text-gray-800">Our Agency: {ourAgency.agency}</h3>
                      <p>Total Commission: {formatCurrency(ourAgency.totalCommission)}</p>
                      <p>Commission Rate: {ourAgency.commissionRate.toFixed(2)}%</p>
                      <p>Properties: {ourAgency.propertyCount}</p>
                      <p>Listed: {ourAgency.listedCount}</p>
                      <p>Sold: {ourAgency.soldCount}</p>
                    </div>
                    {ourAgent && (
                      <div className="bg-indigo-50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold text-gray-800">Our Agent: {ourAgent.name}</h3>
                        <p>Total Commission: {formatCurrency(ourAgent.totalCommission)}</p>
                        <p>Commission Rate: {ourAgent.commissionRate ? `${ourAgent.commissionRate.toFixed(2)}%` : 'Agency Default'}</p>
                        <p>Properties Listed: {ourAgent.propertiesListed}</p>
                        <p>Properties Sold: {ourAgent.propertiesSold}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-gray-600">No data available for {ourAgencyName}.</p>
              )}
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
                        <th className="p-3 text-sm font-semibold text-gray-800">Property Types</th>
                        {isAdmin && <th className="p-3 text-sm font-semibold text-gray-800">Edit</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFilteredAgencyTotals.map((row) => (
                        <tr key={row.agency} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm text-gray-700">{row.agency}</td>
                          <td className="p-3 text-sm text-gray-700">{row.commissionRate.toFixed(2)}%</td>
                          <td className="p-3 text-sm text-gray-700">{formatCurrency(row.totalCommission)}</td>
                          <td className="p-3 text-sm text-gray-700">{formatCurrency(row.listedCommission)}</td>
                          <td className="p-3 text-sm text-gray-700">{formatCurrency(row.soldCommission)}</td>
                          <td className="p-3 text-sm text-gray-700">{row.propertyCount}</td>
                          <td className="p-3 text-sm text-gray-700">{row.listedCount}</td>
                          <td className="p-3 text-sm text-gray-700">{row.soldCount}</td>
                          <td className="p-3 text-sm text-gray-700">{row.suburbs.join(', ') || 'None'}</td>
                          <td className="p-3 text-sm text-gray-700">{row.propertyTypes.join(', ') || 'None'}</td>
                          {isAdmin && (
                            <td className="p-3 text-sm">
                              <button
                                onClick={() => setCommissionEdit({ isOpen: true, agency: row.agency, newCommission: row.commissionRate.toString() })}
                                className="text-indigo-600 hover:text-indigo-800"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredAgencyTotals.length > itemsPerPage && renderPagination(agencyCurrentPage, agencyTotalPages, handleAgencyPageChange)}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Agent Performance"
              isOpen={openSections.agents}
              toggleOpen={() => setOpenSections({ ...openSections, agents: !openSections.agents })}
            >
              <div className="space-y-6">
                <div className="mb-6">
                  <select
                    value={selectedAgency || ''}
                    onChange={(e) => setSelectedAgency(e.target.value || null)}
                    className="p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">All Agencies</option>
                    {agencyTotals.map((agency) => (
                      <option key={agency.agency} value={agency.agency}>
                        {agency.agency}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-6 h-96">
                  <Bar data={agentPropertyTypeChartData} options={agentPropertyTypeChartOptions} />
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
                        <th className="p-3 text-sm font-semibold text-gray-800">Property Types</th>
                        {isAdmin && <th className="p-3 text-sm font-semibold text-gray-800">Edit</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedFilteredAgentData.length > 0 ? (
                        paginatedFilteredAgentData.map((agent) => {
                          const agentDetails = agencyTotals
                            .flatMap((a) => a.agents)
                            .find((a) => a.name === agent.name);
                          return (
                            <tr key={agent.name} className="border-b hover:bg-gray-50">
                              <td className="p-3 text-sm text-gray-700">{agent.name}</td>
                              <td className="p-3 text-sm text-gray-700">
                                {agent.commissionRate ? `${agent.commissionRate.toFixed(2)}%` : 'Agency Default'}
                              </td>
                              <td className="p-3 text-sm text-gray-700">{formatCurrency(agent.commission)}</td>
                              <td className="p-3 text-sm text-gray-700">{agent.listed}</td>
                              <td className="p-3 text-sm text-gray-700">{agent.sold}</td>
                              <td className="p-3 text-sm text-gray-700">{agentDetails?.suburbs.join(', ') || 'None'}</td>
                              <td className="p-3 text-sm text-gray-700">{agentDetails?.propertyTypes.join(', ') || 'None'}</td>
                              {isAdmin && (
                                <td className="p-3 text-sm">
                                  <button
                                    onClick={() =>
                                      setAgentCommissionEdit({
                                        isOpen: true,
                                        agency: agencyTotals.find((a) => a.agents.some((ag) => ag.name === agent.name))?.agency || null,
                                        agent: agent.name,
                                        newCommission: agent.commissionRate?.toString() || '',
                                      })
                                    }
                                    className="text-indigo-600 hover:text-indigo-800"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={isAdmin ? 8 : 7} className="p-3 text-sm text-gray-700 text-center">
                            No agent data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {filteredAgentData.length > itemsPerPage && renderPagination(agentCurrentPage, agentTotalPages, handleAgentPageChange)}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection
              title="Top Streets"
              isOpen={openSections.streets}
              toggleOpen={() => setOpenSections({ ...openSections, streets: !openSections.streets })}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-indigo-100">
                      <th className="p-3 text-sm font-semibold text-gray-800">Street</th>
                      <th className="p-3 text-sm font-semibold text-gray-800">Listed Properties</th>
                      <th className="p-3 text-sm font-semibold text-gray-800">Total Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.topStreet.street !== 'None' ? (
                      <tr className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-700">{summary.topStreet.street}</td>
                        <td className="p-3 text-sm text-gray-700">{summary.topStreet.listedCount}</td>
                        <td className="p-3 text-sm text-gray-700">{formatCurrency(summary.topStreet.commission)}</td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-3 text-sm text-gray-700 text-center">
                          No street data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                      {filteredSuburbCommissions.length > itemsPerPage && renderPagination(suburbCurrentPage, suburbTotalPages, handleSuburbPageChange)}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-600 text-center">No suburb data available. Try adjusting the filters.</p>
                )}
              </div>
            </CollapsibleSection>

            {commissionEdit.isOpen && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
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

            {agentCommissionEdit.isOpen && (
              <motion.div
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="bg-white p-6 rounded-xl shadow-lg">
                  <h3 className="text-lg font-semibold">Edit Commission Rate for {agentCommissionEdit.agent} ({agentCommissionEdit.agency})</h3>
                  <input
                    type="number"
                    value={agentCommissionEdit.newCommission}
                    onChange={(e) => setAgentCommissionEdit({ ...agentCommissionEdit, newCommission: e.target.value })}
                    placeholder="Enter new commission rate (%)"
                    className="mt-2 p-2 border border-gray-200 rounded-lg w-full"
                  />
                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={() => setAgentCommissionEdit({ isOpen: false, agency: null, agent: null, newCommission: '' })}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={updateAgentCommission}
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

export default CommissionByAgency;