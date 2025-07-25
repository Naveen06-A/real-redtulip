import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Home, FileText, Activity, BarChart, Link as LinkIcon, Eye, Download, Trash2, FileTerminalIcon } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';
import { CreateAgentModal } from '../components/CreateAgentModal';
import { EnquiryPDFPreview } from './EnquiryPDFPreview';
import { Agent, Property, Enquiry } from '../types';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function AdminDashboard() {
  const { user, profile } = useAuthStore();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<'agent' | 'property' | null>(null);
  const [showPDFModal, setShowPDFModal] = useState<string | null>(null);
  const [propertyData, setPropertyData] = useState({
    street_number: '',
    street_name: '',
    suburb: '',
    property_type: '',
    price: '',
    bedrooms: '',
    bathrooms: '',
    car_garage: '',
    category: '',
    agent_id: '',
  });
  const [currentPage, setCurrentPage] = useState({ properties: 1, enquiries: 1 });
  const [itemsPerPage, setItemsPerPage] = useState({ properties: 5, enquiries: 5 });
  const [jumpToPage, setJumpToPage] = useState({ properties: '', enquiries: '' });

  // Debug showModal state changes
  useEffect(() => {
    console.log('showModal changed:', showModal);
  }, [showModal]);

  const dashboardLinks = [
    {
      name: 'Create New Agent',
      icon: UserPlus,
      action: () => {
        console.log('Create New Agent clicked, setting showModal to agent');
        setShowModal('agent');
      },
    },
    { name: 'Add Property', icon: Home, path:'/property-form' },
    { name: 'Job Enquiries', icon: FileText, path: '/enquiryjob' },
    { name: 'Create Marketing Plan', path: '/marketing-plan', icon: FileText },
    { name: 'Activity Log', path: '/activity-logger', icon: Activity },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Business Plan', path: '/agent-business-plan', icon: FileText },
    { name: 'AdminBusinessPlan', path: '/admin-business-plan', icon: FileText },
    {
      name: 'Agent Report',
      path: '/agent-reports',
      icon: FileText,
      action: () => {
        if (agents.length > 0) {
          navigate(`/agent-reports?agent_id=${agents[0].id}`);
        } else {
          toast.error('No agents available. Please create an agent first.');
        }
      },
    },
    { name: 'Admin Commission', path: '/admin-commission', icon: FileText },
  ];

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, phone, permissions')
        .eq('role', 'agent');
      if (error) throw error;
      console.log('Fetched agents:', data);
      data?.forEach((agent, index) => {
        if (!agent.permissions) {
          console.warn(`Agent at index ${index} has no permissions:`, agent);
          toast.error(`Agent ${agent.email} has no permissions set`);
        }
      });
      setAgents(data || []);
      setError(null);
      return data;
    } catch (error: any) {
      toast.error('Failed to fetch agents: ' + error.message);
      setError('Failed to fetch agents');
      return [];
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, street_number, street_name, suburb, property_type, price, bedrooms, bathrooms, car_garage, category, agent_id, agent_name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setProperties(data || []);
      setError(null);
    } catch (error: any) {
      toast.error('Failed to fetch properties: ' + error.message);
      setError('Failed to fetch properties');
    }
  };

  const fetchEnquiries = async () => {
    try {
      const { data, error } = await supabase
        .from('enquiry')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      setEnquiries(data || []);
      setError(null);
    } catch (error: any) {
      toast.error('Failed to fetch enquiries: ' + error.message);
      setError('Failed to fetch enquiries');
    }
  };

  const deleteEnquiry = async (enquiryId: string) => {
    if (!window.confirm('Are you sure you want to delete this enquiry?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('enquiry')
        .delete()
        .eq('id', enquiryId);

      if (error) throw error;

      toast.success('Enquiry deleted successfully!', {
        style: { background: '#BFDBFE', color: '#1E3A8A', borderRadius: '8px' },
      });

      await fetchEnquiries();
    } catch (error: any) {
      toast.error('Failed to delete enquiry: ' + error.message, {
        style: { background: '#FECACA', color: '#991B1B', borderRadius: '8px' },
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (enquiry: Enquiry) => {
    try {
      const doc = new jsPDF();

      doc.setProperties({
        title: `Enquiry_${enquiry.full_name}_${enquiry.id}`,
        author: 'Harcourts',
        creator: 'Harcourts Admin Dashboard',
      });

      doc.setFillColor(219, 234, 254);
      doc.rect(0, 0, 210, 297, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 138);
      doc.text('Harcourts Success', 105, 20, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(29, 78, 216);
      doc.text(`Submission ID: ${enquiry.id}`, 20, 30);
      doc.text(`Submitted: ${new Date(enquiry.submitted_at).toLocaleString()}`, 20, 38);

      const tableData = [
        ['Full Name', enquiry.full_name],
        ['Languages Known', enquiry.languages_known || 'N/A'],
        ['Full License', enquiry.do_you_hold_a_full_license ? 'Yes' : 'No'],
        ['License Details', enquiry.full_license_details || 'N/A'],
        ['Owns Car', enquiry.do_you_own_a_car ? 'Yes' : 'No'],
        ['Car Details', enquiry.car_details || 'N/A'],
        ['Driver’s License', enquiry.do_you_hold_a_drivers_license ? 'Yes' : 'No'],
        ['Driver’s License Details', enquiry.drivers_license_details || 'N/A'],
        ['Why Real Estate', enquiry.why_real_estate || 'N/A'],
        ['Bought/Sold in QLD', enquiry.have_you_bought_and_sold_in_qld ? 'Yes' : 'No'],
        ['Bought/Sold QLD Details', enquiry.bought_sold_qld_details || 'N/A'],
        ['Goal', enquiry.whats_your_goal || 'N/A'],
        ['Expected Earnings', enquiry.expected_earnings || 'N/A'],
        ['Agree to RITE Values', enquiry.agree_to_rite_values ? 'Yes' : 'No'],
        ['Why Harcourts', enquiry.why_us || 'N/A'],
        ['Expectations from Harcourts', enquiry.what_do_you_expect_from_us || 'N/A'],
        ['Financial Capability', enquiry.financial_capability ? 'Yes' : 'No'],
        ['Financial Capability Details', enquiry.financial_capability_details || 'N/A'],
        ['Team Contribution', enquiry.team_contribution || 'N/A'],
        ['Suburbs to Prospect', enquiry.suburbs_to_prospect || 'N/A'],
        ['Strengths', enquiry.strengths || 'N/A'],
        ['Weaknesses', enquiry.weaknesses || 'N/A'],
      ];

      (doc as any).autoTable({
        startY: 45,
        head: [['Field', 'Details']],
        body: tableData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 10, textColor: [17, 24, 39], cellPadding: 4, overflow: 'linebreak' },
        headStyles: { fillColor: [147, 197, 253], textColor: [30, 58, 138], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold', textColor: [29, 78, 216] }, 1: { cellWidth: 120 } },
        margin: { left: 20, right: 20 },
        didDrawPage: () => {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text('Generated by Harcourts Admin Dashboard', 105, 290, { align: 'center' });
        },
      });

      doc.save(`enquiry-${enquiry.full_name}-${enquiry.id}.pdf`);
      toast.success('PDF downloaded successfully!', {
        style: { background: '#BFDBFE', color: '#1E3A8A', borderRadius: '8px' },
      });
    } catch (error: any) {
      toast.error('Failed to generate PDF: ' + error.message, {
        style: { background: '#FECACA', color: '#991B1B', borderRadius: '8px' },
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchProperties(), fetchEnquiries()]);
      setLoading(false);
    };
    if (profile?.role === 'admin') {
      loadData();
    }
  }, [profile]);

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const price = parseFloat(propertyData.price);
      const bedrooms = parseInt(propertyData.bedrooms);
      const bathrooms = parseInt(propertyData.bathrooms);
      const carGarage = parseInt(propertyData.car_garage) || 0;

      if (isNaN(price) || price < 0) throw new Error('Invalid price');
      if (isNaN(bedrooms) || bedrooms < 0) throw new Error('Invalid number of bedrooms');
      if (isNaN(bathrooms) || bathrooms < 0) throw new Error('Invalid number of bathrooms');

      const { error } = await supabase
        .from('properties')
        .insert({
          id: uuidv4(),
          street_number: propertyData.street_number,
          street_name: propertyData.street_name,
          suburb: propertyData.suburb,
          property_type: propertyData.property_type,
          price,
          bedrooms,
          bathrooms,
          car_garage: carGarage,
          category: propertyData.category,
          agent_id: propertyData.agent_id || null,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success('Property added successfully!');
      setShowModal(null);
      setPropertyData({
        street_number: '',
        street_name: '',
        suburb: '',
        property_type: '',
        price: '',
        bedrooms: '',
        bathrooms: '',
        car_garage: '',
        category: '',
        agent_id: '',
      });
      await fetchProperties();
    } catch (error: any) {
      toast.error('Failed to add property: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getPageNumbers = (totalItems: number, itemsPerPage: number, currentPage: number) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const handlePageChange = (type: 'properties' | 'enquiries', page: number) => {
    const totalItems = type === 'properties' ? properties.length : enquiries.length;
    const itemsPerPageVal = itemsPerPage[type];
    const totalPages = Math.ceil(totalItems / itemsPerPageVal);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(prev => ({ ...prev, [type]: page }));
    }
  };

  const handleItemsPerPageChange = (type: 'properties' | 'enquiries', e: React.ChangeEvent<HTMLSelectElement>) => {
    setItemsPerPage(prev => ({ ...prev, [type]: parseInt(e.target.value) }));
    setCurrentPage(prev => ({ ...prev, [type]: 1 }));
  };

  const handleJumpToPage = (type: 'properties' | 'enquiries', e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(jumpToPage[type]);
    const totalItems = type === 'properties' ? properties.length : enquiries.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage[type]);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      setCurrentPage(prev => ({ ...prev, [type]: page }));
      setJumpToPage(prev => ({ ...prev, [type]: '' }));
    } else {
      toast.error('Invalid page number');
    }
  };

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-white p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>Only admins can access this dashboard.</p>
      </div>
    );
  }

  const currentProperties = properties.slice(
    (currentPage.properties - 1) * itemsPerPage.properties,
    currentPage.properties * itemsPerPage.properties
  );

  const currentEnquiries = enquiries.slice(
    (currentPage.enquiries - 1) * itemsPerPage.enquiries,
    currentPage.enquiries * itemsPerPage.enquiries
  );

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-blue-900">Admin Dashboard</h1>
        <motion.button
          onClick={() => navigate('/admin-dashboard')}
          className="flex items-center px-4 py-2 bg-blue-300 text-white rounded-full hover:bg-blue-400 transition-all shadow-md"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Back to Dashboard
        </motion.button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {dashboardLinks.map((link, index) => (
          <motion.div
            key={index}
            className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer border border-blue-200"
            whileHover={{ scale: 1.05 }}
            onClick={() => {
              if (link.action) {
                link.action();
              } else if (link.path) {
                navigate(link.path);
              }
            }}
          >
            <div className="flex items-center">
              <link.icon className="w-6 h-6 mr-2 text-blue-300" />
              <h2 className="text-xl font-semibold text-blue-900">{link.name}</h2>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        <CreateAgentModal
          isOpen={showModal === 'agent'}
          onClose={() => {
            console.log('Closing CreateAgentModal, setting showModal to null');
            setShowModal(null);
          }}
          fetchAgents={fetchAgents}
          fetchProperties={fetchProperties}
        />
      </AnimatePresence>

      {showModal === 'property' && (
        <div className="fixed inset-0 bg-blue-200/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full border border-blue-200">
            <h2 className="text-2xl font-semibold mb-4 text-blue-900">Add Property</h2>
            <form onSubmit={handleCreateProperty}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Street Number</label>
                <input
                  type="text"
                  value={propertyData.street_number}
                  onChange={(e) => setPropertyData({ ...propertyData, street_number: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Street Name</label>
                <input
                  type="text"
                  value={propertyData.street_name}
                  onChange={(e) => setPropertyData({ ...propertyData, street_name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Suburb</label>
                <input
                  type="text"
                  value={propertyData.suburb}
                  onChange={(e) => setPropertyData({ ...propertyData, suburb: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Property Type</label>
                <input
                  type="text"
                  value={propertyData.property_type}
                  onChange={(e) => setPropertyData({ ...propertyData, property_type: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Price</label>
                <input
                  type="number"
                  value={propertyData.price}
                  onChange={(e) => setPropertyData({ ...propertyData, price: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Bedrooms</label>
                <input
                  type="number"
                  value={propertyData.bedrooms}
                  onChange={(e) => setPropertyData({ ...propertyData, bedrooms: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Bathrooms</label>
                <input
                  type="number"
                  value={propertyData.bathrooms}
                  onChange={(e) => setPropertyData({ ...propertyData, bathrooms: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Car Garage</label>
                <input
                  type="number"
                  value={propertyData.car_garage}
                  onChange={(e) => setPropertyData({ ...propertyData, car_garage: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Category</label>
                <select
                  value={propertyData.category}
                  onChange={(e) => setPropertyData({ ...propertyData, category: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  required
                >
                  <option value="">Select Category</option>
                  <option value="Listing">Listing</option>
                  <option value="Sold">Sold</option>
                  <option value="Under Offer">Under Offer</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-900">Agent</label>
                <select
                  value={propertyData.agent_id}
                  onChange={(e) => setPropertyData({ ...propertyData, agent_id: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                >
                  <option value="">No Agent</option>
                  {agents
                    .filter(agent => agent && agent.permissions?.canRegisterProperties)
                    .map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.email}
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(null)}
                  className="px-4 py-2 text-blue-900 bg-blue-200 rounded-md hover:bg-blue-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Property'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showPDFModal && (
          <EnquiryPDFPreview
            enquiry={enquiries.find(e => e.id === showPDFModal)!}
            isOpen={!!showPDFModal}
            onClose={() => setShowPDFModal(null)}
            onDownload={generatePDF}
          />
        )}
      </AnimatePresence>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-blue-200">
        <h2 className="text-2xl font-semibold mb-4 flex items-center text-blue-900">
          <UserPlus className="w-6 h-6 mr-2 text-blue-300" /> Agents
        </h2>
        {loading ? (
          <div className="text-center text-blue-900">Loading agents...</div>
        ) : agents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-blue-200">
                  <th className="py-2 px-4 text-blue-900">Name</th>
                  <th className="py-2 px-4 text-blue-900">Email</th>
                  <th className="py-2 px-4 text-blue-900">Phone</th>
                </tr>
              </thead>
              <tbody>
                {agents
                  .filter(agent => agent && agent.permissions)
                  .map((agent) => (
                    <tr key={agent.id} className="border-b border-blue-200 hover:bg-blue-100">
                      <td className="py-2 px-4 text-blue-900">{agent.name || '-'}</td>
                      <td className="py-2 px-4 text-blue-900">{agent.email}</td>
                      <td className="py-2 px-4 text-blue-900">{agent.phone || '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-blue-900">No agents found.</p>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-blue-200">
        <h2 className="text-2xl font-semibold mb-4 flex items-center text-blue-900">
          <Home className="w-6 h-6 mr-2 text-blue-300" /> Properties
        </h2>
        {loading ? (
          <div className="text-center text-blue-900">Loading properties...</div>
        ) : properties.length > 0 ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage.properties}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="overflow-x-auto"
              >
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="py-2 px-4 text-blue-900">Address</th>
                      <th className="py-2 px-4 text-blue-900">Type</th>
                      <th className="py-2 px-4 text-blue-900">Price</th>
                      <th className="py-2 px-4 text-blue-900">Bedrooms</th>
                      <th className="py-2 px-4 text-blue-900">Bathrooms</th>
                      <th className="py-2 px-4 text-blue-900">Garage</th>
                      <th className="py-2 px-4 text-blue-900">Category</th>
                      <th className="py-2 px-4 text-blue-900">Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentProperties.map((property) => {
                      const agent = property.agent_id ? agents.find((a) => a.id === property.agent_id) : null;
                      return (
                        <motion.tr
                          key={property.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                          className="border-b border-blue-200 hover:bg-blue-100"
                        >
                          <td className="py-2 px-4 text-blue-900">{`${property.street_number} ${property.street_name}, ${property.suburb}`}</td>
                          <td className="py-2 px-4 text-blue-900">{property.property_type}</td>
                          <td className="py-2 px-4 text-blue-900">${property.price.toLocaleString()}</td>
                          <td className="py-2 px-4 text-blue-900">{property.bedrooms}</td>
                          <td className="py-2 px-4 text-blue-900">{property.bathrooms}</td>
                          <td className="py-2 px-4 text-blue-900">{property.car_garage}</td>
                          <td className="py-2 px-4 text-blue-900">{property.category}</td>
                          <td className="py-2 px-4 text-blue-900">
                            {property.agent_id ? (
                              agent ? (
                                agent.name || agent.email
                              ) : (
                                <span className="text-red-600">
                                  Invalid Agent ID
                                  <button
                                    onClick={() => fetchAgents()}
                                    className="ml-2 text-sm text-blue-300 underline"
                                  >
                                    Retry
                                  </button>
                                </span>
                              )
                            ) : (
                              'Unassigned'
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-blue-900">Items per page:</label>
                <select
                  value={itemsPerPage.properties}
                  onChange={(e) => handleItemsPerPageChange('properties', e)}
                  className="px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <motion.button
                  onClick={() => handlePageChange('properties', currentPage.properties - 1)}
                  disabled={currentPage.properties === 1}
                  className="px-4 py-2 bg-blue-300 text-white rounded-md disabled:opacity-50 hover:bg-blue-400"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Previous
                </motion.button>

                <div className="flex gap-2">
                  {getPageNumbers(properties.length, itemsPerPage.properties, currentPage.properties).map((page) => (
                    <motion.button
                      key={page}
                      onClick={() => handlePageChange('properties', page)}
                      className={`px-3 py-1 rounded-md ${
                        currentPage.properties === page ? 'bg-blue-300 text-white' : 'bg-blue-200 text-blue-900 hover:bg-blue-300'
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {page}
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  onClick={() => handlePageChange('properties', currentPage.properties + 1)}
                  disabled={currentPage.properties === Math.ceil(properties.length / itemsPerPage.properties)}
                  className="px-4 py-2 bg-blue-300 text-white rounded-md disabled:opacity-50 hover:bg-blue-400"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Next
                </motion.button>
              </div>

              <form onSubmit={(e) => handleJumpToPage('properties', e)} className="flex items-center gap-2">
                <label className="text-sm font-medium text-blue-900">Go to page:</label>
                <input
                  type="number"
                  value={jumpToPage.properties}
                  onChange={(e) => setJumpToPage(prev => ({ ...prev, properties: e.target.value }))}
                  className="w-16 px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  placeholder="Page"
                  min={1}
                  max={Math.ceil(properties.length / itemsPerPage.properties)}
                />
                <motion.button
                  type="submit"
                  className="px-3 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Go
                </motion.button>
              </form>
            </div>
            <p className="mt-2 text-sm text-blue-900">
              Showing {(currentPage.properties - 1) * itemsPerPage.properties + 1} to{' '}
              {Math.min(currentPage.properties * itemsPerPage.properties, properties.length)} of {properties.length} properties
            </p>
          </>
        ) : (
          <div className="text-blue-900">
            <p>No properties found.</p>
            <button
              onClick={() => setShowModal('property')}
              className="mt-2 px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
            >
              Add Property
            </button>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-blue-200">
        <h2 className="text-2xl font-semibold mb-4 flex items-center text-blue-900">
          <FileText className="w-6 h-6 mr-2 text-blue-300" /> Wanna Be Sales Agent
        </h2>
        {loading ? (
          <div className="text-center text-blue-900">Loading enquiries...</div>
        ) : enquiries.length > 0 ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage.enquiries}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="overflow-x-auto"
              >
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="py-2 px-4 text-blue-900">Full Name</th>
                      <th className="py-2 px-4 text-blue-900">Submission Date</th>
                      <th className="py-2 px-4 text-blue-900">Languages Known</th>
                      <th className="py-2 px-4 text-blue-900">Full License</th>
                      <th className="py-2 px-4 text-blue-900">Owns Car</th>
                      <th className="py-2 px-4 text-blue-900">Driver’s License</th>
                      <th className="py-2 px-4 text-blue-900">Bought/Sold QLD</th>
                      <th className="py-2 px-4 text-blue-900">Financial Capability</th>
                      <th className="py-2 px-4 text-blue-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentEnquiries.map((enquiry) => (
                      <motion.tr
                        key={enquiry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="border-b border-blue-200 hover:bg-blue-100"
                      >
                        <td className="py-2 px-4 text-blue-900">{enquiry.full_name}</td>
                        <td className="py-2 px-4 text-blue-900">{new Date(enquiry.submitted_at).toLocaleDateString()}</td>
                        <td className="py-2 px-4 text-blue-900">{enquiry.languages_known || '-'}</td>
                        <td className="py-2 px-4 text-blue-900">{enquiry.do_you_hold_a_full_license ? 'Yes' : 'No'}</td>
                        <td className="py-2 px-4 text-blue-900">{enquiry.do_you_own_a_car ? 'Yes' : 'No'}</td>
                        <td className="py-2 px-4 text-blue-900">{enquiry.do_you_hold_a_drivers_license ? 'Yes' : 'No'}</td>
                        <td className="py-2 px-4 text-blue-900">{enquiry.have_you_bought_and_sold_in_qld ? 'Yes' : 'No'}</td>
                        <td className="py-2 px-4 text-blue-900">{enquiry.financial_capability ? 'Yes' : 'No'}</td>
                        <td className="py-2 px-4 text-blue-900 flex gap-2">
                          <button
                            onClick={() => setShowPDFModal(enquiry.id)}
                            className="flex items-center text-blue-300 hover:text-blue-400 underline"
                          >
                            <Eye className="w-4 h-4 mr-1" /> View
                          </button>
                          <button
                            onClick={() => generatePDF(enquiry)}
                            className="flex items-center text-blue-300 hover:text-blue-400 underline"
                          >
                            <Download className="w-4 h-4 mr-1" /> Download
                          </button>
                          <button
                            onClick={() => deleteEnquiry(enquiry.id)}
                            className="flex items-center text-red-500 hover:text-red-600 underline"
                            disabled={loading}
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            </AnimatePresence>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-blue-900">Items per page:</label>
                <select
                  value={itemsPerPage.enquiries}
                  onChange={(e) => handleItemsPerPageChange('enquiries', e)}
                  className="px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <div className="flex items-center gap-4">
                <motion.button
                  onClick={() => handlePageChange('enquiries', currentPage.enquiries - 1)}
                  disabled={currentPage.enquiries === 1}
                  className="px-4 py-2 bg-blue-300 text-white rounded-md disabled:opacity-50 hover:bg-blue-400"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Previous
                </motion.button>

                <div className="flex gap-2">
                  {getPageNumbers(enquiries.length, itemsPerPage.enquiries, currentPage.enquiries).map((page) => (
                    <motion.button
                      key={page}
                      onClick={() => handlePageChange('enquiries', page)}
                      className={`px-3 py-1 rounded-md ${
                        currentPage.enquiries === page ? 'bg-blue-300 text-white' : 'bg-blue-200 text-blue-900 hover:bg-blue-300'
                      }`}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {page}
                    </motion.button>
                  ))}
                </div>

                <motion.button
                  onClick={() => handlePageChange('enquiries', currentPage.enquiries + 1)}
                  disabled={currentPage.enquiries === Math.ceil(enquiries.length / itemsPerPage.enquiries)}
                  className="px-4 py-2 bg-blue-300 text-white rounded-md disabled:opacity-50 hover:bg-blue-400"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Next
                </motion.button>
              </div>

              <form onSubmit={(e) => handleJumpToPage('enquiries', e)} className="flex items-center gap-2">
                <label className="text-sm font-medium text-blue-900">Go to page:</label>
                <input
                  type="number"
                  value={jumpToPage.enquiries}
                  onChange={(e) => setJumpToPage(prev => ({ ...prev, enquiries: e.target.value }))}
                  className="w-16 px-3 py-2 border border-blue-200 rounded-md focus:ring-blue-300 focus:border-blue-300"
                  placeholder="Page"
                  min={1}
                  max={Math.ceil(enquiries.length / itemsPerPage.enquiries)}
                />
                <motion.button
                  type="submit"
                  className="px-3 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Go
                </motion.button>
              </form>
            </div>
            <p className="mt-2 text-sm text-blue-900">
              Showing {(currentPage.enquiries - 1) * itemsPerPage.enquiries + 1} to{' '}
              {Math.min(currentPage.enquiries * itemsPerPage.enquiries, enquiries.length)} of {enquiries.length} enquiries
            </p>
          </>
        ) : (
          <div className="text-blue-900">
            <p>No enquiries found.</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-100 p-4 rounded-lg text-red-700 border border-red-200">
          <p>{error}</p>
          <button
            onClick={() => {
              fetchAgents();
              fetchProperties();
              fetchEnquiries();
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}