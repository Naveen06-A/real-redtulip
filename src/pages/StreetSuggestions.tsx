import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { normalizeSuburb, formatCurrency } from '../reportsUtils';

interface Property {
  id: string;
  street_name: string | null;
  street_number: string | null;
  suburb: string;
  price: number | null;
  sold_price: number | null;
  sold_date: string | null;
  property_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  car_garage: number | null;
  sqm: number | null;
  landsize: number | null;
  status: 'Listed' | 'Sold';
}

interface StreetStats {
  street_name: string;
  listed_count: number;
  sold_count: number;
  total_properties: number;
  average_sold_price: number | null;
  properties: Property[];
}

interface StreetSuggestionsProps {
  suburb: string | null;
  soldPropertiesFilter: string;
  onSelectStreet: (street: { name: string }, type: 'door_knock' | 'phone_call') => void;
  existingDoorKnocks?: { name: string }[];
  existingPhoneCalls?: { name: string }[];
}

export function StreetSuggestions({ suburb, soldPropertiesFilter, onSelectStreet, existingDoorKnocks = [], existingPhoneCalls = [] }: StreetSuggestionsProps) {
  const [streetStats, setStreetStats] = useState<StreetStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFilter, setLocalFilter] = useState(soldPropertiesFilter);
  const [expandedStreet, setExpandedStreet] = useState<string | null>(null);
  const [addedStreets, setAddedStreets] = useState<{ [key: string]: { door_knock: number; phone_call: number } }>({});

  useEffect(() => {
    setLocalFilter(soldPropertiesFilter);
  }, [soldPropertiesFilter]);

  useEffect(() => {
    const fetchData = async () => {
      if (!suburb) {
        setStreetStats([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setStreetStats([]);
      setAddedStreets({});

      try {
        const normalizedInput = normalizeSuburb(suburb);
        const queryString = `%${normalizedInput.toLowerCase().split(' qld')[0]}%`;

        console.log('Fetching properties for suburb:', suburb, 'Normalized:', normalizedInput, 'Query:', queryString);

        const { data: propertiesData, error: propError } = await supabase
          .from('properties')
          .select('id, street_name, street_number, suburb, price, sold_price, sold_date, property_type, bedrooms, bathrooms, car_garage, sqm, landsize')
          .ilike('suburb', queryString);

        if (propError) throw new Error(`Failed to fetch properties: ${propError.message}`);

        if (!propertiesData || propertiesData.length === 0) {
          setError(`No properties found for ${suburb}. Please add properties to the database or check the suburb name format.`);
          setLoading(false);
          return;
        }

        console.log('Properties fetched:', propertiesData);

        let filteredProperties = propertiesData;
        if (localFilter !== 'all') {
          const now = new Date('2025-08-01T19:58:00+05:30'); // Current date: August 1, 2025, 7:58 PM IST
          let startDate: Date;
          switch (localFilter) {
            case '30_days':
              startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
              break;
            case '3_months':
              startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
              break;
            case '6_months':
              startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
              break;
            case '12_months':
              startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
              break;
            default:
              startDate = new Date(0);
          }
          console.log('Applying filter:', localFilter, 'Start date:', startDate.toISOString());
          filteredProperties = propertiesData.filter(
            (prop) => !prop.sold_date || new Date(prop.sold_date) >= startDate
          );
        }

        if (filteredProperties.length === 0) {
          setError(
            `No properties found for ${suburb} with filter "${localFilter.replace('_', ' ')}". Try a broader filter or ensure sold_date is populated.`
          );
          setLoading(false);
          return;
        }

        const combinedProperties: Property[] = filteredProperties.map((prop) => ({
          id: prop.id,
          street_name: prop.street_name,
          street_number: prop.street_number,
          suburb: prop.suburb,
          price: prop.price,
          sold_price: prop.sold_price || null,
          sold_date: prop.sold_date || null,
          property_type: prop.property_type,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          car_garage: prop.car_garage,
          sqm: prop.sqm,
          landsize: prop.landsize,
          status: (prop.sold_price || prop.sold_date) ? 'Sold' : 'Listed',
        }));

        const streetMap = new Map<
          string,
          { listed: number; sold: number; total: number; totalSoldPrice: number; properties: Property[] }
        >();
        combinedProperties.forEach((prop) => {
          const streetName = prop.street_name?.trim() || 'Unknown Street';
          const stats = streetMap.get(streetName) || { listed: 0, sold: 0, total: 0, totalSoldPrice: 0, properties: [] };
          stats.total += 1;
          if (prop.status === 'Listed') stats.listed += 1;
          if (prop.status === 'Sold') {
            stats.sold += 1;
            if (prop.sold_price) stats.totalSoldPrice += prop.sold_price;
          }
          stats.properties.push(prop);
          streetMap.set(streetName, stats);
        });

        const statsArray: StreetStats[] = Array.from(streetMap.entries()).map(
          ([street_name, stats]) => ({
            street_name,
            listed_count: stats.listed,
            sold_count: stats.sold,
            total_properties: stats.total,
            average_sold_price: stats.sold > 0 ? stats.totalSoldPrice / stats.sold : null,
            properties: stats.properties,
          })
        );

        statsArray.sort(
          (a, b) =>
            b.sold_count - a.sold_count ||
            b.total_properties - a.total_properties ||
            b.listed_count - a.listed_count
        );

        // Limit to 25 streets for 5x5 grid
        const limitedStatsArray = statsArray.slice(0, 25);

        console.log('Street stats:', limitedStatsArray);

        const newAddedStreets: { [key: string]: { door_knock: number; phone_call: number } } = {};
        limitedStatsArray.forEach((street) => {
          const streetName = street.street_name;
          const doorKnockCount = Array.isArray(existingDoorKnocks)
            ? existingDoorKnocks.filter((s) => s.name === streetName).length
            : 0;
          const phoneCallCount = Array.isArray(existingPhoneCalls)
            ? existingPhoneCalls.filter((s) => s.name === streetName).length
            : 0;
          newAddedStreets[streetName] = { door_knock: doorKnockCount, phone_call: phoneCallCount };
        });

        setAddedStreets(newAddedStreets);
        setStreetStats(limitedStatsArray);
      } catch (err: any) {
        setError(`Error fetching street suggestions for ${suburb}: ${err.message}`);
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [suburb, localFilter]);

  const handleSelectStreet = (street: StreetStats, type: 'door_knock' | 'phone_call') => {
    console.log(`handleSelectStreet called with street: ${street.street_name}, type: ${type}`);
    onSelectStreet({ name: street.street_name }, type);
    setAddedStreets((prev) => ({
      ...prev,
      [street.street_name]: {
        ...prev[street.street_name],
        [type]: (prev[street.street_name]?.[type] || 0) + 1,
      },
    }));
  };

  const toggleExpandStreet = (streetName: string) => {
    setExpandedStreet(expandedStreet === streetName ? null : streetName);
  };

  if (!suburb) {
    return (
      <motion.div
        className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-gray-600 text-center text-sm">Select a suburb to view streets</p>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div
        className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-center items-center py-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="text-xl"
          >
            🏠
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
        <span className="mr-2 text-indigo-600 text-xl">🏠</span>
        Streets in {suburb} ({localFilter.replace('_', ' ')})
      </h2>
      {error && (
        <div className="text-red-600 text-center py-2 bg-red-50 rounded-lg mb-4 text-sm">{error}</div>
      )}
      {streetStats.length === 0 && !error && (
        <p className="text-gray-600 text-center py-2 text-sm">No streets found for {suburb}</p>
      )}
      {streetStats.length > 0 && (
        <div className="space-y-4">
          <div>
            <label className="block text-gray-800 font-semibold mb-1 text-sm">Filter Sold</label>
            <select
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
              className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-sm"
              aria-label="Select sold properties filter"
            >
              <option value="all">All Time</option>
              <option value="30_days">Last 30 Days</option>
              <option value="3_months">Last 3 Months</option>
              <option value="6_months">Last 6 Months</option>
              <option value="12_months">Last 12 Months</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {streetStats.map((street, index) => (
              <motion.div
                key={street.street_name}
                className="bg-gray-50 p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <div className="flex justify-between items-center mb-1">
                  <h3
                    className="text-sm font-semibold text-gray-800 cursor-pointer hover:text-indigo-600 transition-colors truncate"
                    onClick={() => toggleExpandStreet(street.street_name)}
                  >
                    {street.street_name}
                  </h3>
                  <motion.button
                    onClick={() => toggleExpandStreet(street.street_name)}
                    className="text-gray-600 hover:text-indigo-600 flex-shrink-0"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {expandedStreet === street.street_name ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </motion.button>
                </div>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  <div className="flex items-center">
                    <span className="text-indigo-600 mr-1 text-sm">🏠</span>
                    <div>
                      <p className="text-xs text-gray-600">Total</p>
                      <p className="text-xs font-semibold text-gray-900">{street.total_properties}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-indigo-600 mr-1 text-sm">📋</span>
                    <div>
                      <p className="text-xs text-gray-600">List/Sold</p>
                      <p className="text-xs font-semibold text-gray-900">{street.listed_count}/{street.sold_count}</p>
                    </div>
                  </div>
                  <div className="flex items-center col-span-2">
                    <span className="text-indigo-600 mr-1 text-sm">💰</span>
                    <div>
                      <p className="text-xs text-gray-600">ASP</p>
                      <p className="text-xs font-semibold text-gray-900">
                        {street.average_sold_price ? formatCurrency(street.average_sold_price) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <motion.button
                    onClick={() => handleSelectStreet(street, 'door_knock')}
                    className={`flex-1 p-1 rounded-md text-white flex items-center justify-center relative ${
                      addedStreets[street.street_name]?.door_knock > 0
                        ? 'bg-green-300 hover:bg-green-400'
                        : 'bg-blue-300 hover:bg-blue-400'
                    } transition-all`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h6m4-14v10m-4-10v2a2 2 0 002 2h2m-4 4v2a2 2 0 002 2h2" />
                      <circle cx="10" cy="12" r="1" />
                    </svg>
                    {addedStreets[street.street_name]?.door_knock > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-3 w-3 flex items-center justify-center">
                        {addedStreets[street.street_name].door_knock}
                      </span>
                    )}
                  </motion.button>
                  <motion.button
                    onClick={() => handleSelectStreet(street, 'phone_call')}
                    className={`flex-1 p-1 rounded-md text-white flex items-center justify-center relative ${
                      addedStreets[street.street_name]?.phone_call > 0
                        ? 'bg-green-300 hover:bg-green-400'
                        : 'bg-blue-300 hover:bg-blue-400'
                    } transition-all`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                    {addedStreets[street.street_name]?.phone_call > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-3 w-3 flex items-center justify-center">
                        {addedStreets[street.street_name].phone_call}
                      </span>
                    )}
                  </motion.button>
                </div>
                <AnimatePresence>
                  {expandedStreet === street.street_name && (
                    <motion.div
                      className="mt-2 border-t border-gray-200 pt-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <h4 className="text-xs font-semibold text-gray-800 mb-1">Properties on {street.street_name}</h4>
                      {street.properties.length === 0 ? (
                        <p className="text-gray-600 text-xs">No properties found for {street.street_name}.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-indigo-600 text-white text-xs">
                                <th className="p-1 text-left">Street Number</th>
                                <th className="p-1 text-left">Street Name</th>
                                <th className="p-1 text-left">Suburb</th>
                                <th className="p-1 text-left">Property Type</th>
                                <th className="p-1 text-left">Bed</th>
                                <th className="p-1 text-left">Bath</th>
                                <th className="p-1 text-left">Car</th>
                                <th className="p-1 text-left">SQM</th>
                                <th className="p-1 text-left">Land</th>
                                <th className="p-1 text-left">List Price</th>
                                <th className="p-1 text-left">Sold Price</th>
                                <th className="p-1 text-left">Sold Date</th>
                                <th className="p-1 text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {street.properties.map((property) => (
                                <motion.tr
                                  key={property.id}
                                  className="border-b border-gray-200 hover:bg-gray-100"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  <td className="p-1">{property.street_number || 'N/A'}</td>
                                  <td className="p-1">{property.street_name || 'N/A'}</td>
                                  <td className="p-1">{normalizeSuburb(property.suburb)}</td>
                                  <td className="p-1">{property.property_type || 'N/A'}</td>
                                  <td className="p-1">{property.bedrooms ?? 'N/A'}</td>
                                  <td className="p-1">{property.bathrooms ?? 'N/A'}</td>
                                  <td className="p-1">{property.car_garage ?? 'N/A'}</td>
                                  <td className="p-1">{property.sqm ?? 'N/A'}</td>
                                  <td className="p-1">{property.landsize ?? 'N/A'}</td>
                                  <td className="p-1">{property.price ? formatCurrency(property.price) : 'N/A'}</td>
                                  <td className="p-1">{property.sold_price ? formatCurrency(property.sold_price) : 'N/A'}</td>
                                  <td className="p-1">{property.sold_date ? new Date(property.sold_date).toLocaleDateString() : 'N/A'}</td>
                                  <td className="p-1">{property.status}</td>
                                </motion.tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}