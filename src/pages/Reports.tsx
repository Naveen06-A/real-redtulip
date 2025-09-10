import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  ChartOptions,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { motion } from 'framer-motion';
import { debounce } from 'lodash';
import { BarChart, Loader2, FileText, PieChart, Users, Map } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { ErrorBoundary } from 'react-error-boundary';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { AgentPropertyMap } from './AgentPropertyMap';
import { EditModal } from './EditModal';
import type { CommissionEarner, Agent, Agency } from '../types/types';
import { TopLister } from '../types/types';
import {
  formatCurrency,
  normalizeSuburb,
  predictFutureAvgPriceBySuburb,
  generatePropertyMetrics,
} from '../reportsUtils.ts';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

// Interfaces
interface User {
  id: string;
  email?: string;
}

const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="text-red-600 p-4" role="alert">
    <p>Error: {error.message}</p>
    <button
      onClick={resetErrorBoundary}
      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      aria-label="Reload page"
    >
      Try Again
    </button>
  </div>
);

export interface Filters {
  suburbs: string[];
  streetNames: string[];
  streetNumbers: string[];
  agents: string[];
  agency_names: string[];
}

export interface PropertyDetails {
  id: string;
  street_name: string | null;
  street_number: string | null;
  agent_name: string | null;
  suburb: string | null;
  postcode: string | null;
  price: number;
  sold_price: number | null;
  category: string | null;
  property_type: string | null;
  agency_name: string | null;
  commission: number | null;
  commission_earned: number | null;
  expected_price: number | null;
  sale_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  car_garage: number | null;
  sqm: number | null;
  landsize: number | null;
  listed_date: string | null;
  sold_date: string | null;
  flood_risk: string | null;
  bushfire_risk: string | null;
  contract_status: string | null;
  features: string[] | null;
  same_street_sales: any[] | null;
  past_records: any[] | null;
}

export interface PropertyMetrics {
  listingsBySuburb: Record<string, { listed: number; sold: number }>;
  listingsByStreetName: Record<string, { listed: number; sold: number }>;
  listingsByStreetNumber: Record<string, { listed: number; sold: number }>;
  listingsByAgent: Record<string, { listed: number; sold: number }>;
  listingsByAgency: Record<string, { listed: number; sold: number }>;
  avgSalePriceBySuburb: Record<string, number>;
  avgSalePriceByStreetName: Record<string, number>;
  avgSalePriceByStreetNumber: Record<string, number>;
  avgSalePriceByAgent: Record<string, number>;
  avgSalePriceByAgency: Record<string, number>;
  predictedAvgPriceBySuburb: Record<string, number>;
  predictedConfidenceBySuburb: Record<string, { lower: number; upper: number }>;
  priceTrendsBySuburb: Record<string, Record<string, number>>;
  commissionByAgency: Record<string, Record<string, number>>;
  propertyDetails: PropertyDetails[];
  totalListings: number;
  totalSales: number;
  overallAvgSalePrice: number;
  topListersBySuburb: Record<string, TopLister>;
  ourListingsBySuburb: Record<string, number>;
  topCommissionEarners: CommissionEarner[];
  ourCommission: number;
  topAgents: Agent[];
  ourAgentStats: Agent[];
  topAgencies: Agency[];
  ourAgencyStats: Agency[];
  [key: string]: unknown;
}

export function Reports() {
  const [properties, setProperties] = useState<PropertyDetails[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<PropertyDetails[]>([]);
  const [propertyMetrics, setPropertyMetrics] = useState<PropertyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    suburbs: [],
    streetNames: [],
    streetNumbers: [],
    agents: [],
    agency_names: [],
  });
  const [filterSuggestions, setFilterSuggestions] = useState({
    suburbs: [] as string[],
    streetNames: [] as string[],
    streetNumbers: [] as string[],
    agents: [] as string[],
    agency_names: [] as string[],
  });
  const [selectedMapProperty, setSelectedMapProperty] = useState<PropertyDetails | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyDetails | null>(null);
  const location = useLocation();
  const userProperty = location.state?.liveData as PropertyDetails | undefined;
  const { user } = useAuthStore((state) => ({
    user: state.user as User | null,
  }));
  const propertiesTableRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    console.log('Clearing localStorage reportFilters and resetting filters on mount');
    localStorage.removeItem('reportFilters');
    setFilters({ suburbs: [], streetNames: [], streetNumbers: [], agents: [], agency_names: [] });
  }, []);

  const updateFilterSuggestions = useMemo(() => {
    return (data: PropertyDetails[]) => {
      const uniqueSuburbs = [...new Set(data.map((p) => normalizeSuburb(p.suburb || '')).filter(Boolean))].sort();
      const newSuggestions = {
        suburbs: uniqueSuburbs,
        streetNames: [...new Set(data.map((p) => p.street_name || '').filter(Boolean))].sort(),
        streetNumbers: [...new Set(data.map((p) => p.street_number || '').filter(Boolean))].sort(),
        agents: [...new Set(data.map((p) => p.agent_name || '').filter(Boolean))].sort(),
        agency_names: [...new Set(data.map((p) => p.agency_name || 'UNKNOWN').filter(Boolean))].sort(),
      };
      console.log('Updated filter suggestions:', newSuggestions);
      setFilterSuggestions(newSuggestions);
    };
  }, []);

  useEffect(() => {
    setFilteredProperties(properties);
    updateFilterSuggestions(properties);
  }, [properties, updateFilterSuggestions]);

  const debouncedGenerateMetrics = useCallback(
    debounce((props: PropertyDetails[]) => {
      try {
        console.log('Generating metrics for properties:', props.length);
        const metrics = generatePropertyMetrics(props, predictFutureAvgPriceBySuburb);
        setPropertyMetrics(metrics);
      } catch (err) {
        console.error('Error generating metrics:', err);
        setError('Failed to generate property metrics');
      }
    }, 300),
    []
  );

  // Fetch basic property data first, then enrich in background
  const fetchBasicProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network.');
      }

      console.log('Fetching basic properties...');

      // Only select columns that actually exist in the database
      const { data: propData, error: propError } = await supabase
        .from('properties')
        .select('id, street_name, street_number, agent_name, suburb, postcode, price, sold_price, category, property_type, agency_name, commission, expected_price, sale_type, bedrooms, bathrooms, car_garage, sqm, landsize, listed_date, sold_date, flood_risk, bushfire_risk, contract_status, features')
        .order('created_at', { ascending: false })
        .limit(200);

      if (propError) {
        console.error('Supabase error:', propError);
        throw new Error(`Property fetch error: ${propError.message}`);
      }

      if (!propData || propData.length === 0) {
        setProperties([]);
        setFilteredProperties([]);
        setPropertyMetrics(null);
        setLoading(false);
        return;
      }

      const normalizedPropData = propData.map((prop) => ({
        ...prop,
        suburb: normalizeSuburb(prop.suburb || ''),
        commission_earned: prop.commission_earned || null, // Handle missing column
        same_street_sales: [],
        past_records: []
      }));

      const propertiesWithUserData = userProperty && location.state
        ? [...normalizedPropData, { 
            ...userProperty, 
            suburb: normalizeSuburb(userProperty.suburb || ''),
            commission_earned: userProperty.commission_earned || null
          }]
        : normalizedPropData;

      console.log('Basic properties loaded:', propertiesWithUserData.length);
      setProperties(propertiesWithUserData);
      setFilteredProperties(propertiesWithUserData);
      debouncedGenerateMetrics(propertiesWithUserData);
      
      // Start background enrichment process
      enrichPropertiesInBackground(propertiesWithUserData);
      
    } catch (err: unknown) {
      console.error('Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      
      // Handle specific column errors
      if (errorMessage.includes('commission_earned')) {
        setError('Database schema mismatch. Please check your table columns.');
      } else {
        setError(errorMessage);
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  // Enrich properties in background without blocking UI
  const enrichPropertiesInBackground = async (props: PropertyDetails[]) => {
    if (props.length === 0) return;
    
    console.log('Starting background property enrichment...');
    
    const MAX_PROPERTIES = 30; // Process even fewer properties for enrichment
    
    for (let i = 0; i < Math.min(props.length, MAX_PROPERTIES); i++) {
      const prop = props[i];
      
      try {
        // Process enrichment in small batches with delay
        if (i % 3 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 150));
        }

        // Fetch same street sales and past records in parallel
        const [sameStreetSalesResult, pastRecordsResult] = await Promise.allSettled([
          supabase
            .from('properties')
            .select('address, sale_price, property_type, sale_date, suburb')
            .eq('street_name', prop.street_name || '')
            .neq('id', prop.id)
            .limit(3),
          supabase
            .from('past_records')
            .select('suburb, postcode, property_type, price, listing_date, sale_date, status')
            .eq('property_id', prop.id)
            .limit(5)
        ]);

        const sameStreetSales = sameStreetSalesResult.status === 'fulfilled' && sameStreetSalesResult.value.data
          ? sameStreetSalesResult.value.data.map((sale: any) => ({
              ...sale,
              suburb: normalizeSuburb(sale.suburb || ''),
            }))
          : [];

        const pastRecords = pastRecordsResult.status === 'fulfilled' && pastRecordsResult.value.data
          ? pastRecordsResult.value.data.map((record: any) => ({
              ...record,
              suburb: normalizeSuburb(record.suburb || ''),
            }))
          : [];

        // Update the specific property with enriched data
        setProperties(prev => prev.map(p => 
          p.id === prop.id 
            ? { ...p, same_street_sales: sameStreetSales, past_records: pastRecords }
            : p
        ));

      } catch (err) {
        console.warn('Background enrichment failed for property:', prop.id, err);
        // Continue with next property
      }
    }
    
    console.log('Background enrichment completed');
  };

  const updateFilterPreview = useCallback(() => {
    try {
      const previewFiltered = properties.filter((prop) => {
        const suburbMatch =
          filters.suburbs.length === 0 ||
          filters.suburbs.some((suburb) => normalizeSuburb(prop.suburb || '') === normalizeSuburb(suburb));
        const streetNameMatch =
          filters.streetNames.length === 0 ||
          filters.streetNames.some((name) => (prop.street_name || '').toLowerCase() === name.toLowerCase());
        const streetNumberMatch =
          filters.streetNumbers.length === 0 ||
          filters.streetNumbers.some((num) => (prop.street_number || '').toLowerCase() === num.toLowerCase());
        const agentMatch =
          filters.agents.length === 0 ||
          filters.agents.some((agent) => (prop.agent_name || '').toLowerCase() === agent.toLowerCase());
        const agencyMatch =
          filters.agency_names.length === 0 ||
          filters.agency_names.some((agency) => (prop.agency_name || 'Unknown').toLowerCase() === agency.toLowerCase());

        return suburbMatch && streetNameMatch && streetNumberMatch && agentMatch && agencyMatch;
      });
      setFilteredProperties(previewFiltered);
      debouncedGenerateMetrics(previewFiltered);
    } catch (err) {
      console.error('Error in updateFilterPreview:', err);
      setError('Failed to apply filters');
    }
  }, [filters, properties, debouncedGenerateMetrics]);

  useEffect(() => {
    updateFilterPreview();
  }, [filters, properties, updateFilterPreview]);

  useEffect(() => {
    if (user) {
      console.log('User authenticated, fetching data');
      fetchBasicProperties();
      
      const subscription = supabase
        .channel('properties')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'properties' },
          debounce(() => {
            console.log('Properties table changed, refetching data');
            fetchBasicProperties();
          }, 1000)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } else {
      setError('Please log in to view reports');
      setLoading(false);
    }
  }, [user]);

  const renderGeneralCharts = () => {
    if (!propertyMetrics || Object.keys(propertyMetrics.avgSalePriceBySuburb).length === 0) {
      return (
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <p className="text-gray-500 text-center">No chart data available yet. Data is still loading...</p>
        </div>
      );
    }

    try {
      const suburbKeys = Object.keys(propertyMetrics.avgSalePriceBySuburb).slice(0, 8);
      
      const avgPriceBySuburbData = {
        labels: suburbKeys,
        datasets: [
          {
            label: 'Average Sale Price',
            data: suburbKeys.map(key => propertyMetrics.avgSalePriceBySuburb[key] || 0),
            backgroundColor: '#60A5FA',
          },
          {
            label: 'Predicted Average Price',
            data: suburbKeys.map(key => propertyMetrics.predictedAvgPriceBySuburb[key] || 0),
            backgroundColor: '#93C5FD',
          },
        ],
      };

      const avgPriceBySuburbOptions: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 12 } } },
          datalabels: { display: false },
          title: { display: true, text: 'Average Sale Price by Suburb', font: { size: 16, weight: 'bold' } },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (value) => formatCurrency(value as number), font: { size: 10 } },
          },
          x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
        },
      };

      return (
        <div className="space-y-6">
          <motion.div
            className="bg-white p-4 rounded-lg shadow-md border border-blue-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="text-xl font-semibold text-blue-800 mb-3 flex items-center">
              <BarChart className="w-5 h-5 mr-2 text-blue-600" />
              Average Sale Price by Suburb
            </h2>
            <div className="h-64">
              <Bar data={avgPriceBySuburbData} options={avgPriceBySuburbOptions} />
            </div>
          </motion.div>
        </div>
      );
    } catch (err) {
      console.error('Error rendering general charts:', err);
      return <p className="text-red-600 text-center">Failed to render charts</p>;
    }
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        setError(null);
        fetchBasicProperties();
      }}
    >
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-6 px-4 sm:px-6 lg:px-8">
        {loading && isInitialLoad ? (
          <div className="flex justify-center items-center h-64">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="flex flex-col items-center"
            >
              <Loader2 className="w-8 h-8 text-blue-600 mb-2" />
              <p className="text-blue-700 text-sm">Loading properties...</p>
            </motion.div>
          </div>
        ) : error ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-center max-w-md">
              <div className="w-12 h-12 mx-auto mb-3 text-red-600">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-red-700 mb-2">Error Loading Data</p>
              <p className="text-gray-600 mb-4 text-sm">{error}</p>
              <motion.button
                onClick={fetchBasicProperties}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Try Again
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            <motion.div
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-2xl sm:text-3xl font-bold text-blue-800 flex items-center">
                <BarChart className="w-6 h-6 mr-2 text-blue-600" />
                Property Reports
              </h1>
              <div className="flex flex-wrap gap-2">
                <motion.button
                  onClick={() => navigate('/property-report-page', { 
                    state: { propertyMetrics, filteredProperties, filters, filterSuggestions, currentPage } 
                  })}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Property Report
                </motion.button>
                <motion.button
                  onClick={() => navigate('/comparisons', { 
                    state: { propertyMetrics, filteredProperties, filters, filterSuggestions, currentPage } 
                  })}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  comaparsions
                </motion.button>
                <motion.button
                  onClick={() => navigate('/commission-by-agency', { state: { propertyMetrics } })}
                  className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm flex items-center disabled:opacity-50"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={!propertyMetrics}
                >
                  <PieChart className="w-4 h-4 mr-1" />
                  Commissions
                </motion.button>
              </div>
            </motion.div>

            <motion.section
              className="mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <h2 className="text-xl font-semibold text-blue-800 mb-4 flex items-center">
                <BarChart className="w-5 h-5 mr-2 text-blue-600" />
                Overview
              </h2>
              {renderGeneralCharts()}
            </motion.section>

            <motion.section
              className="mb-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="text-xl font-semibold text-blue-800 mb-4 flex items-center">
                <Map className="w-5 h-5 mr-2 text-blue-600" />
                Property Map
              </h2>
              {filteredProperties.length > 0 ? (
                <div className="h-96">
                  <AgentPropertyMap
                    properties={filteredProperties}
                    selectedProperty={selectedMapProperty}
                    onPropertySelect={setSelectedMapProperty}
                  />
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No properties available for map view</p>
              )}
            </motion.section>

            <EditModal
              showEditModal={showEditModal}
              setShowEditModal={setShowEditModal}
              selectedProperty={selectedProperty}
              setSelectedProperty={setSelectedProperty}
              properties={properties}
              setProperties={setProperties}
              filteredProperties={filteredProperties}
              setFilteredProperties={setFilteredProperties}
              debouncedGenerateMetrics={() => debouncedGenerateMetrics(properties)}
              propertiesTableRef={propertiesTableRef}
              pauseSubscription={() => {}}
              resumeSubscription={() => {}}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default Reports;