import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, MapPin, DollarSign, X, Video } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import EnquiryForm from './EnquiryForm'; // Adjust path as needed

interface Property {
  id: string;
  name: string;
  street_number: string; // Changed to required
  street_name: string; // Changed to required for consistency
  suburb: string;
  postcode: string;
  city: string;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  car_garage: number;
  sqm: number;
  landsize: number;
  price: number;
  expected_price: number;
  commission: number;
  features: string[];
  user_id: string;
  created_at: string;
  listed_date: string;
  sold_date?: string | null;
  sale_date?: string | null; // Kept for EnquiryForm compatibility
  category: 'Listing' | 'Sold' | 'Under Offer';
  sale_type: 'Private Treaty' | 'Auction' | 'EOI';
  flood_risk?: 'Low' | 'Medium' | 'High';
  bushfire_risk?: 'Low' | 'Medium' | 'High';
  flood_notes?: string;
  bushfire_notes?: string;
  contract_status?: 'None' | 'Under Offer' | 'Under Contract';
  same_street_sales?: Array<{ address: string; sale_price: number; sale_date: string; property_type: string }>;
  days_on_market?: number;
  past_records?: Array<{
    suburb: string;
    postcode: string;
    property_type: string;
    price: string;
    bedrooms: string;
    bathrooms: string;
    car_garage: string;
    sqm: string;
    landsize: string;
    listing_date?: string;
    sale_date?: string;
    status?: 'Sold' | 'Listed' | 'Withdrawn';
    notes?: string;
    address?: string;
  }>;
  agent_name: string;
  agency_name: string;
  sold_price?: number;
}

interface TourState {
  step: 'welcome' | 'preferences' | 'tour' | 'summary';
  preferences: { budget?: number; bedrooms?: number; suburb?: string };
  selectedProperties: Property[];
  currentPropertyIndex: number;
  favorites: string[];
}

export function Home() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourState, setTourState] = useState<TourState>({
    step: 'welcome',
    preferences: {},
    selectedProperties: [],
    currentPropertyIndex: 0,
    favorites: [],
  });
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isEnquiryFormOpen, setIsEnquiryFormOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('category', 'Listing')
          .order('listed_date', { ascending: false });
        if (error) throw error;
        // Map properties to ensure EnquiryForm compatibility
        const mappedProperties = data.map((prop: any) => ({
          ...prop,
          name: prop.name || `${prop.street_number || ''} ${prop.street_name || ''}, ${prop.suburb}`,
          city: prop.city || prop.suburb,
          street_number: prop.street_number || '', // Provide default empty string
          street_name: prop.street_name || '', // Provide default empty string
          sale_date: prop.sold_date || null,
        }));
        setProperties(mappedProperties || []);
      } catch (err: any) {
        setError('Failed to load properties.');
      } finally {
        setLoading(false);
      }
    };
    fetchProperties();
  }, []);

  const handlePropertyClick = (property: Property) => {
    navigate(`/property-detail/${property.id}`);
  };

  const openEnquiryForm = (property: Property) => {
    setSelectedProperty(property);
    setIsEnquiryFormOpen(true);
  };

  const closeEnquiryForm = () => {
    setIsEnquiryFormOpen(false);
    setSelectedProperty(null);
  };

  const startTour = () => {
    setTourOpen(true);
    setTourState({
      step: 'welcome',
      preferences: {},
      selectedProperties: [],
      currentPropertyIndex: 0,
      favorites: [],
    });
  };

  const handleTourInput = (field: string, value: string | number) => {
    setTourState((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [field]: value },
    }));
  };

  const proceedToTour = () => {
    const { budget, bedrooms, suburb } = tourState.preferences;
    let filtered = properties;
    if (budget) {
      filtered = filtered.filter((p) => p.price <= budget);
    }
    if (bedrooms) {
      filtered = filtered.filter((p) => p.bedrooms >= bedrooms);
    }
    if (suburb) {
      filtered = filtered.filter((p) => p.suburb.toLowerCase().includes(suburb.toLowerCase()));
    }
    setTourState((prev) => ({
      ...prev,
      step: filtered.length ? 'tour' : 'summary',
      selectedProperties: filtered.slice(0, 3),
    }));
  };

  const toggleFavorite = (propertyId: string) => {
    setTourState((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(propertyId)
        ? prev.favorites.filter((id) => id !== propertyId)
        : [...prev.favorites, propertyId],
    }));
  };

  const nextProperty = () => {
    setTourState((prev) => ({
      ...prev,
      currentPropertyIndex: Math.min(prev.currentPropertyIndex + 1, prev.selectedProperties.length - 1),
    }));
  };

  const prevProperty = () => {
    setTourState((prev) => ({
      ...prev,
      currentPropertyIndex: Math.max(prev.currentPropertyIndex - 1, 0),
    }));
  };

  const endTour = () => {
    setTourState((prev) => ({
      ...prev,
      step: 'summary',
    }));
  };

  const closeTour = () => {
    setTourOpen(false);
  };

  const renderTourContent = () => {
    const { step, preferences, selectedProperties, currentPropertyIndex, favorites } = tourState;
    const currentProperty = selectedProperties[currentPropertyIndex];

    switch (step) {
      case 'welcome':
        return (
          <div className="p-6 animate-slide-in">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Your Virtual Property Tour!</h2>
            <p className="text-gray-600 mb-6">
              Let’s find your dream home. Answer a few questions to personalize your tour, and I’ll guide you through
              properties that match your needs!
            </p>
            <button
              onClick={() => setTourState((prev) => ({ ...prev, step: 'preferences' }))}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:animate-pulse-hover active:animate-bounce-click"
            >
              Start Tour
            </button>
          </div>
        );
      case 'preferences':
        return (
          <div className="p-6 animate-slide-in">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Tell Me About Your Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 mb-2">Budget (AUD)</label>
                <input
                  type="number"
                  value={preferences.budget || ''}
                  onChange={(e) => handleTourInput('budget', parseFloat(e.target.value) || 0)}
                  className="w-full p-3 border rounded-lg transition-all focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g., 800000"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Minimum Bedrooms</label>
                <input
                  type="number"
                  value={preferences.bedrooms || ''}
                  onChange={(e) => handleTourInput('bedrooms', parseInt(e.target.value) || 0)}
                  className="w-full p-3 border rounded-lg transition-all focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g., 3"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Preferred Suburb</label>
                <input
                  type="text"
                  value={preferences.suburb || ''}
                  onChange={(e) => handleTourInput('suburb', e.target.value)}
                  className="w-full p-3 border rounded-lg transition-all focus:ring-2 focus:ring-blue-600"
                  placeholder="e.g., Brisbane"
                />
              </div>
            </div>
            <button
              onClick={proceedToTour}
              className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg hover:animate-pulse-hover active:animate-bounce-click"
            >
              Find Properties
            </button>
          </div>
        );
      case 'tour':
        return (
          <div className="p-6 animate-slide-in" key={currentProperty?.id}>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Touring Property {currentPropertyIndex + 1} of {selectedProperties.length}
            </h2>
            {currentProperty ? (
              <div className="space-y-4">
                <div className="bg-gray-100 p-4 rounded-lg transition-all">
                  <h3 className="text-lg font-semibold">
                    {`${currentProperty.street_number} ${currentProperty.street_name}, ${currentProperty.suburb}`}
                  </h3>
                  <p className="text-gray-600">{formatCurrency(currentProperty.price)}</p>
                  <p className="text-gray-600">
                    {currentProperty.bedrooms} Beds, {currentProperty.bathrooms} Baths, {currentProperty.car_garage} Garage
                  </p>
                  <p className="text-gray-600">Features: {currentProperty.features.join(', ') || 'None'}</p>
                  <p className="text-gray-600">
                    Flood Risk: {currentProperty.flood_risk || 'Low'} | Bushfire Risk: {currentProperty.bushfire_risk || 'Low'}
                  </p>
                </div>
                <p className="text-gray-700 italic">
                  {currentPropertyIndex === 0
                    ? `Welcome to this ${currentProperty.property_type.toLowerCase()}! It’s a spacious ${currentProperty.sqm}sqm home with ${currentProperty.features[0] || 'great potential'}.`
                    : `Next, check out this ${currentProperty.property_type.toLowerCase()} with ${currentProperty.bedrooms} bedrooms and a ${currentProperty.flood_risk || 'low'} flood risk.`}
                </p>
                <button
                  onClick={() => toggleFavorite(currentProperty.id)}
                  className={`px-4 py-2 rounded-lg transition-all ${
                    favorites.includes(currentProperty.id) ? 'bg-yellow-400' : 'bg-gray-200'
                  } hover:animate-pulse-hover active:animate-bounce-click`}
                >
                  {favorites.includes(currentProperty.id) ? 'Remove from Favorites' : 'Add to Favorites'}
                </button>
                <button
                  onClick={() => openEnquiryForm(currentProperty)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:animate-pulse-hover active:animate-bounce-click transition-all"
                >
                  Enquire About This Property
                </button>
                <div className="flex justify-between mt-4">
                  <button
                    onClick={prevProperty}
                    disabled={currentPropertyIndex === 0}
                    className="px-4 py-2 bg-gray-300 rounded-lg disabled:opacity-50 hover:animate-pulse-hover active:animate-bounce-click transition-all"
                  >
                    Previous
                  </button>
                  <button
                    onClick={nextProperty}
                    disabled={currentPropertyIndex === selectedProperties.length - 1}
                    className="px-4 py-2 bg-gray-300 rounded-lg disabled:opacity-50 hover:animate-pulse-hover active:animate-bounce-click transition-all"
                  >
                    Next
                  </button>
                </div>
                <button
                  onClick={() => navigate(`/property-detail/${currentProperty.id}`)}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg hover:animate-pulse-hover active:animate-bounce-click transition-all"
                >
                  View Full Details
                </button>
              </div>
            ) : (
              <p>No properties match your criteria.</p>
            )}
            <button
              onClick={endTour}
              className="mt-4 text-blue-600 hover:underline hover:animate-pulse-hover transition-all"
            >
              End Tour
            </button>
          </div>
        );
      case 'summary':
        return (
          <div className="p-6 animate-slide-in">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Tour Complete!</h2>
            {favorites.length ? (
              <div>
                <p className="text-gray-600 mb-4">You liked these properties:</p>
                {favorites.map((id) => {
                  const prop = properties.find((p) => p.id === id);
                  return prop ? (
                    <div key={id} className="bg-gray-50 p-3 rounded-lg mb-2 transition-all">
                      <p>{`${prop.street_number} ${prop.street_name}, ${prop.suburb}`}</p>
                      <button
                        onClick={() => openEnquiryForm(prop)}
                        className="text-blue-600 hover:underline hover:animate-pulse-hover active:animate-bounce-click"
                      >
                        Enquire Now
                      </button>
                      <button
                        onClick={() => navigate(`/property-detail/${id}`)}
                        className="ml-4 text-blue-600 hover:underline hover:animate-pulse-hover active:animate-bounce-click"
                      >
                        View Details
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <p className="text-gray-600 mb-4">No favorites saved.</p>
            )}
            <p className="text-gray-600 mb-4">
              Want to see any of these in person? Contact an agent through our enquiry form!
            </p>
            <button
              onClick={closeTour}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:animate-pulse-hover active:animate-bounce-click transition-all"
            >
              Close Tour
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-12">
      <div className="bg-white p-8 rounded-lg shadow-lg mb-12 animate-fade-in">
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Featured Properties</h1>
        {loading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="ml-2 animate-pulse">Loading properties...</span>
          </div>
        ) : error ? (
          <p className="text-red-600 text-center animate-fade-in">{error}</p>
        ) : properties.length === 0 ? (
          <p className="text-gray-600 text-center animate-fade-in">No properties available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((property, index) => (
              <div
                key={property.id}
                className="bg-gray-50 p-4 rounded-lg hover:shadow-md hover:animate-scale-up transition-all cursor-pointer"
                style={{ animationDelay: `${index * 0.1}s`, animationFillMode: 'forwards' }}
              >
                <h3
                  className="text-lg font-semibold text-gray-900 transition-colors hover:text-blue-600"
                  onClick={() => handlePropertyClick(property)}
                >
                  {`${property.street_number} ${property.street_name}, ${property.suburb}`}
                </h3>
                <p className="text-gray-600 flex items-center mt-1">
                  <MapPin className="w-4 h-4 mr-1 transition-transform hover:scale-110" />
                  {property.suburb}, QLD {property.postcode}
                </p>
                <p className="text-gray-600 flex items-center mt-1">
                  <DollarSign className="w-4 h-4 mr-1 transition-transform hover:scale-110" />
                  {formatCurrency(property.price)}
                </p>
                <p className="text-sm text-gray-500 mt-1 transition-opacity hover:opacity-80">
                  {property.bedrooms} Beds, {property.bathrooms} Baths, {property.car_garage} Garage
                </p>
                <p className="text-sm text-blue-600 mt-1 transition-transform hover:translate-x-1">
                  {property.category}
                </p>
                <button
                  onClick={() => openEnquiryForm(property)}
                  className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg hover:animate-pulse-hover active:animate-bounce-click transition-all"
                >
                  Enquire Now
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-center mt-6">
          <button
            onClick={startTour}
            className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:animate-pulse-hover active:animate-bounce-click transition-all"
          >
            <Video className="w-5 h-5 mr-2 transition-transform group-hover:rotate-12" />
            Start Virtual Tour
          </button>
        </div>
      </div>

      {tourOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto relative">
            <button
              onClick={closeTour}
              className="absolute top-4 right-4 text-gray-600 hover:text-gray-900 hover:animate-scale-up transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            {renderTourContent()}
          </div>
        </div>
      )}

      {/* {isEnquiryFormOpen && selectedProperty && (
        <EnquiryForm property={selectedProperty} onClose={closeEnquiryForm} />
      )} */}
    </div>
  );
}