
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, Check, Edit, Download, Search, Eye, Trash, Bell, Phone, Calendar } from 'lucide-react';
import { normalizeSuburb } from '../reportsUtils';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';

// Import autoTable function directly
import autoTable from 'jspdf-autotable';

// Extend jsPDF type definitions
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface NurturingContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  mobile: string | null;
  street_number: string | null;
  street_name: string | null;
  suburb: string | null;
  postcode: string | null;
  house_type: string | null;
  requirements: string | null;
  notes: string | null;
  call_back_date: string | null;
  needs_monthly_appraisals: boolean;
  status: string | null;
  agent_id: string;
}

interface BasicContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
}

export function NurturingList() {
  const [contacts, setContacts] = useState<NurturingContact[]>([]);
  const [availableContacts, setAvailableContacts] = useState<BasicContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [selectedContact, setSelectedContact] = useState<NurturingContact | null>(null);
  const [newContact, setNewContact] = useState<Partial<NurturingContact>>({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    mobile: '',
    street_number: '',
    street_name: '',
    suburb: '',
    postcode: '',
    house_type: '',
    requirements: '',
    notes: '',
    call_back_date: '',
    needs_monthly_appraisals: false,
    status: 'New',
  });
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const { profile, user } = useAuthStore();
  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAgentNotification, setShowAgentNotification] = useState(false);
  const [todaysTasks, setTodaysTasks] = useState<NurturingContact[]>([]);
  const [incompleteContacts, setIncompleteContacts] = useState<NurturingContact[]>([]);
  const [showIncompleteNotification, setShowIncompleteNotification] = useState(false);

  // House type options
  const houseTypeOptions = [
    { value: '', label: 'Select House Type' },
    { value: 'house', label: 'House' },
    { value: 'acreage', label: 'Acreage' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'land', label: 'Land' },
    { value: 'commercial', label: 'Commercial' }
  ];

  useEffect(() => {
    const fetchNurturingContacts = async () => {
      if (!user || !profile) {
        setError('User not authenticated');
        toast.error('User not authenticated');
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('nurturing_list')
          .select('id, first_name, last_name, email, phone_number, mobile, street_number, street_name, suburb, postcode, house_type, requirements, notes, call_back_date, needs_monthly_appraisals, status, agent_id');

        if (profile.role === 'agent') {
          query = query.eq('agent_id', user.id);
        }

        const { data, error } = await query;

        if (error) {
          throw new Error(`Failed to fetch nurturing contacts: ${error.message}`);
        }

        const fetchedContacts = data || [];
        console.log('Fetched nurturing contacts:', fetchedContacts);
        setContacts(fetchedContacts);
        
        if (profile.role === 'agent') {
          // Adjust for IST (UTC+5:30)
          const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const tasks = fetchedContacts.filter(contact => 
            contact.call_back_date === today || contact.status === 'New'
          );
          console.log('Today\'s tasks:', tasks);
          setTodaysTasks(tasks);

          // Identify incomplete contacts (missing any of phone_number, mobile, or call_back_date)
          const incomplete = fetchedContacts.filter(contact => 
            !contact.phone_number || !contact.mobile || !contact.call_back_date
          );
          console.log('Incomplete contacts:', incomplete);
          setIncompleteContacts(incomplete);

          // Trigger notifications
          setShowAgentNotification(tasks.length > 0);
          setShowIncompleteNotification(incomplete.length > 0);

          // Auto-hide notifications after 15 seconds
          if (tasks.length > 0) {
            setTimeout(() => setShowAgentNotification(false), 15000);
          }
          if (incomplete.length > 0) {
            setTimeout(() => setShowIncompleteNotification(false), 15000);
          }
        }
      } catch (err: any) {
        setError(`Error fetching nurturing contacts: ${err.message}`);
        console.error('Fetch error:', err);
        toast.error(`Error fetching contacts: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    const fetchAvailableContacts = async () => {
      if (!user || !profile) {
        setError('User not authenticated');
        toast.error('User not authenticated');
        return;
      }
      
      try {
        let query = supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone_number');

        // Remove created_by filter since it doesn't exist
        // If your contacts table has an agent_id column, uncomment and adjust:
        // if (profile.role === 'agent') {
        //   query = query.eq('agent_id', user.id);
        // }

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch available contacts: ${error.message}`);

        console.log('Fetched available contacts:', data);
        setAvailableContacts(data || []);
      } catch (err: any) {
        setError(`Error fetching available contacts: ${err.message}`);
        console.error('Fetch error for available contacts:', err);
        toast.error(`Error fetching available contacts: ${err.message}`);
      }
    };

    fetchNurturingContacts();
    fetchAvailableContacts();
  }, [profile, user]);

  const handleAddContact = async () => {
    if (!user) {
      setContactError('User not authenticated');
      toast.error('User not authenticated');
      return;
    }
    
    if (!newContact.first_name || !newContact.last_name || !newContact.email) {
      setContactError('First Name, Last Name, and Email are required');
      toast.error('First Name, Last Name, and Email are required');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nurturing_list')
        .insert([{
          first_name: newContact.first_name,
          last_name: newContact.last_name,
          email: newContact.email,
          phone_number: newContact.phone_number || null,
          mobile: newContact.mobile || null,
          street_number: newContact.street_number || null,
          street_name: newContact.street_name || null,
          suburb: newContact.suburb || null,
          postcode: newContact.postcode || null,
          house_type: newContact.house_type || null,
          requirements: newContact.requirements || null,
          notes: newContact.notes || null,
          call_back_date: newContact.call_back_date || null,
          needs_monthly_appraisals: newContact.needs_monthly_appraisals,
          status: newContact.status || 'New',
          agent_id: user.id,
        }])
        .select();

      if (error) throw new Error(`Failed to add contact: ${error.message}`);

      setContacts([...contacts, data[0]]);
      resetForm();
      setContactSuccess('Contact added successfully');
      toast.success('Contact added successfully');
      setContactError(null);
      setTimeout(() => setContactSuccess(null), 3000);
    } catch (err: any) {
      setContactError(`Error adding contact: ${err.message}`);
      toast.error(`Error adding contact: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditContact = async () => {
    if (!selectedContact || !newContact.first_name || !newContact.last_name || !newContact.email) {
      setContactError('First Name, Last Name, and Email are required');
      toast.error('First Name, Last Name, and Email are required');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nurturing_list')
        .update({
          first_name: newContact.first_name,
          last_name: newContact.last_name,
          email: newContact.email,
          phone_number: newContact.phone_number || null,
          mobile: newContact.mobile || null,
          street_number: newContact.street_number || null,
          street_name: newContact.street_name || null,
          suburb: newContact.suburb || null,
          postcode: newContact.postcode || null,
          house_type: newContact.house_type || null,
          requirements: newContact.requirements || null,
          notes: newContact.notes || null,
          call_back_date: newContact.call_back_date || null,
          needs_monthly_appraisals: newContact.needs_monthly_appraisals,
          status: newContact.status || 'New',
        })
        .eq('id', selectedContact.id)
        .eq('agent_id', user?.id);

      if (error) throw new Error(`Failed to update contact: ${error.message}`);

      setContacts(contacts.map((contact) => (contact.id === selectedContact.id ? {...contact, ...data[0]} : contact)));
      resetForm();
      setContactSuccess('Contact updated successfully');
      toast.success('Contact updated successfully');
      setContactError(null);
      setTimeout(() => setContactSuccess(null), 3000);
    } catch (err: any) {
      setContactError(`Error updating contact: ${err.message}`);
      toast.error(`Error updating contact: ${err.message}`);
    } finally {
      setLoading(false);
      setIsEditMode(false);
      setSelectedContact(null);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('nurturing_list')
        .delete()
        .eq('id', id)
        .eq('agent_id', user?.id);

      if (error) throw new Error(`Failed to delete contact: ${error.message}`);

      setContacts(contacts.filter((contact) => contact.id !== id));
      toast.success('Contact deleted successfully');
    } catch (err: any) {
      toast.error(`Error deleting contact: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContact = (contact: NurturingContact) => {
    setSelectedContact(contact);
    setIsViewMode(true);
  };

  const handleDownloadPDF = (contact: NurturingContact) => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(12);
      doc.text('Contact Details', 20, 20);
      
      const tableData = [
        ['First Name', contact.first_name],
        ['Last Name', contact.last_name],
        ['Email', contact.email],
        ['Phone Number', contact.phone_number || 'N/A'],
        ['Mobile', contact.mobile || 'N/A'],
        ['Street Number', contact.street_number || 'N/A'],
        ['Street Name', contact.street_name || 'N/A'],
        ['Suburb', contact.suburb || 'N/A'],
        ['Postcode', contact.postcode || 'N/A'],
        ['House Type', contact.house_type || 'N/A'],
        ['Requirements', contact.requirements || 'N/A'],
        ['Notes', contact.notes || 'N/A'],
        ['Call Back Date', contact.call_back_date ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'],
        ['Needs Monthly Appraisals', contact.needs_monthly_appraisals ? 'Yes' : 'No'],
        ['Status', contact.status || 'New']
      ];

      autoTable(doc, {
        startY: 30,
        head: [['Field', 'Value']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
      });

      doc.save(`${contact.first_name}_${contact.last_name}_contact.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  const handleImportAll = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }
    
    setLoading(true);
    try {
      const existingEmails = new Set(contacts.map(c => c.email.toLowerCase()));
      const toImport = availableContacts.filter(c => !existingEmails.has(c.email.toLowerCase()));

      if (toImport.length === 0) {
        toast.info('No new contacts to import');
        return;
      }

      const importData = toImport.map(c => ({
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone_number: c.phone_number || null,
        status: 'New',
        agent_id: user.id,
      }));

      const { data, error } = await supabase
        .from('nurturing_list')
        .insert(importData)
        .select();

      if (error) throw new Error(`Failed to import contacts: ${error.message}`);

      setContacts([...contacts, ...data]);
      toast.success(`${toImport.length} contacts imported successfully`);
    } catch (err: any) {
      toast.error(`Error importing contacts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setNewContact((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const selectBasicContact = (basic: BasicContact) => {
    setNewContact({
      ...newContact,
      first_name: basic.first_name,
      last_name: basic.last_name,
      email: basic.email,
      phone_number: basic.phone_number,
    });
    setMode('manual');
  };

  const resetForm = () => {
    setNewContact({
      id: '',
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      mobile: '',
      street_number: '',
      street_name: '',
      suburb: '',
      postcode: '',
      house_type: '',
      requirements: '',
      notes: '',
      call_back_date: '',
      needs_monthly_appraisals: false,
      status: 'New',
    });
    setMode('manual');
    setSearchQuery('');
    setIsEditMode(false);
    setIsViewMode(false);
    setSelectedContact(null);
  };

  const filteredAvailableContacts = availableContacts.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number?.includes(searchQuery)
  );

  const getStatusBadgeClass = (status: string | null) => {
    switch (status) {
      case 'New':
        return 'bg-blue-200 text-blue-800';
      case 'Contacted':
        return 'bg-yellow-200 text-yellow-800';
      case 'Followed Up':
        return 'bg-purple-200 text-purple-800';
      case 'Closed':
        return 'bg-green-200 text-green-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

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
      className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mt-4 relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Incomplete Contacts Notification */}
      <AnimatePresence>
        {showIncompleteNotification && profile?.role === 'agent' && (
          <motion.div
            className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-600 to-red-800 text-white shadow-lg"
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.4 }}
            role="alert"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between flex-wrap">
                <div className="flex items-center flex-1 w-0 min-w-0">
                  <span className="flex p-2 rounded-lg bg-red-900">
                    <Edit className="h-6 w-6" />
                  </span>
                  <div className="ml-3 font-medium">
                    <span className="md:hidden">Complete {incompleteContacts.length} contact{incompleteContacts.length !== 1 ? 's' : ''}!</span>
                    <span className="hidden md:inline">Action Required: Complete {incompleteContacts.length} incomplete contact{incompleteContacts.length !== 1 ? 's' : ''} in your nurturing list</span>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center justify-center px-3 py-1 rounded-md text-sm font-medium bg-red-900 hover:bg-red-950"
                      onClick={() => {
                        if (incompleteContacts.length > 0) {
                          const firstIncomplete = incompleteContacts[0];
                          setIsEditMode(true);
                          setSelectedContact(firstIncomplete);
                          setNewContact(firstIncomplete);
                          setMode('manual');
                          document.querySelector('.bg-gray-50')?.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                    >
                      <Edit className="w-4 h-4 mr-1" /> Complete Now
                    </motion.button>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="flex p-2 rounded-md hover:bg-red-900 focus:outline-none"
                    onClick={() => setShowIncompleteNotification(false)}
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
              <div className="mt-2 hidden md:block">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {incompleteContacts.slice(0, 3).map((contact, index) => (
                    <motion.div
                      key={index}
                      className="bg-red-700 bg-opacity-50 rounded p-2 text-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="font-semibold truncate">
                        {contact.first_name} {contact.last_name}
                      </div>
                      <div className="text-xs opacity-80">
                        Missing: 
                        {!contact.phone_number && 'Phone, '}
                        {!contact.mobile && 'Mobile, '}
                        {!contact.call_back_date && 'Call Back Date'}
                      </div>
                    </motion.div>
                  ))}
                  {incompleteContacts.length > 3 && (
                    <div className="text-xs font-semibold">...and {incompleteContacts.length - 3} more</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Agent Tasks Notification */}
      <AnimatePresence>
        {showAgentNotification && profile?.role === 'agent' && (
          <motion.div
            className={`fixed left-0 right-0 z-40 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg ${showIncompleteNotification ? 'top-16' : 'top-0'}`}
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.4 }}
            role="alert"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between flex-wrap">
                <div className="flex items-center flex-1 w-0 min-w-0">
                  <span className="flex p-2 rounded-lg bg-blue-800">
                    <Bell className="h-6 w-6" />
                  </span>
                  <div className="ml-3 font-medium">
                    <span className="md:hidden">You have {todaysTasks.length} task{todaysTasks.length !== 1 ? 's' : ''}!</span>
                    <span className="hidden md:inline">Today's Tasks: You have {todaysTasks.length} task{todaysTasks.length !== 1 ? 's' : ''} to complete{incompleteContacts.length > 0 ? ' and incomplete contacts to update' : ''}</span>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex space-x-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center justify-center px-3 py-1 rounded-md text-sm font-medium bg-blue-800 hover:bg-blue-900"
                      onClick={() => {
                        const firstTask = document.querySelector('tbody tr');
                        firstTask?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" /> View Tasks
                    </motion.button>
                    {incompleteContacts.length > 0 && (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center justify-center px-3 py-1 rounded-md text-sm font-medium bg-blue-800 hover:bg-blue-900"
                        onClick={() => {
                          if (incompleteContacts.length > 0) {
                            const firstIncomplete = incompleteContacts[0];
                            setIsEditMode(true);
                            setSelectedContact(firstIncomplete);
                            setNewContact(firstIncomplete);
                            setMode('manual');
                            document.querySelector('.bg-gray-50')?.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                      >
                        <Edit className="w-4 h-4 mr-1" /> Complete Contacts
                      </motion.button>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="flex p-2 rounded-md hover:bg-blue-800 focus:outline-none"
                    onClick={() => setShowAgentNotification(false)}
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
              <div className="mt-2 hidden md:block">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                  {todaysTasks.slice(0, 3).map((task, index) => (
                    <motion.div
                      key={index}
                      className="bg-blue-700 bg-opacity-50 rounded p-2 text-sm"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="font-semibold truncate">
                        {task.first_name} {task.last_name}
                      </div>
                      <div className="flex items-center text-xs mt-1">
                        {task.call_back_date ? (
                          <>
                            <Calendar className="w-3 h-3 mr-1" />
                            Call back: {new Date(task.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                          </>
                        ) : (
                          <>
                            <Phone className="w-3 h-3 mr-1" />
                            New contact to follow up
                          </>
                        )}
                      </div>
                      <div className="text-xs opacity-80 truncate">
                        {task.phone_number || task.mobile || 'No phone number'}
                      </div>
                    </motion.div>
                  ))}
                  {todaysTasks.length > 3 && (
                    <div className="text-xs font-semibold">...and {todaysTasks.length - 3} more</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <span className="mr-2 text-indigo-600">📋</span>
          Nurturing List
        </h2>
        {(profile?.role === 'agent' || profile?.role === 'admin') && (
          <motion.button
            onClick={handleImportAll}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={availableContacts.length === 0}
          >
            <Download className="w-5 h-5 mr-2" /> Import All from Contacts
          </motion.button>
        )}
      </div>
      {error && (
        <div className="text-red-600 text-center py-2 bg-red-50 rounded-lg mb-4 text-sm">{error}</div>
      )}
      {(profile?.role === 'agent' || profile?.role === 'admin') && (
        <motion.div
          className="mb-6 bg-gray-50 p-4 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex mb-4 space-x-4">
            <motion.button
              onClick={() => setMode('manual')}
              className={`flex-1 py-2 rounded-lg ${mode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'} transition-all`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Manual Entry
            </motion.button>
            <motion.button
              onClick={() => setMode('import')}
              className={`flex-1 py-2 rounded-lg ${mode === 'import' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-800'} transition-all`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Import from Contacts
            </motion.button>
          </div>
          {contactError && (
            <motion.div
              className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {contactError}
            </motion.div>
          )}
          {contactSuccess && (
            <motion.div
              className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm flex items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Check className="w-5 h-5 mr-2" /> {contactSuccess}
            </motion.div>
          )}
          {mode === 'import' && (
            <div className="mb-4">
              <div className="relative mb-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts..."
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm pl-10"
                  aria-label="Search Contacts"
                />
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredAvailableContacts.length === 0 ? (
                  <p className="text-gray-600 text-sm text-center py-2">No contacts found</p>
                ) : (
                  <ul className="space-y-2">
                    {filteredAvailableContacts.map((basic) => (
                      <motion.li
                        key={basic.id}
                        className="p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-all"
                        onClick={() => selectBasicContact(basic)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="font-semibold text-sm">{basic.first_name} {basic.last_name}</div>
                        <div className="text-xs text-gray-600">{basic.email}</div>
                        <div className="text-xs text-gray-600">{basic.phone_number || 'N/A'}</div>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {(mode === 'manual' || isEditMode || isViewMode) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="first_name"
                value={newContact.first_name}
                onChange={handleInputChange}
                placeholder="First Name"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="First Name"
                disabled={isViewMode}
              />
              <input
                type="text"
                name="last_name"
                value={newContact.last_name}
                onChange={handleInputChange}
                placeholder="Last Name"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Last Name"
                disabled={isViewMode}
              />
              <input
                type="email"
                name="email"
                value={newContact.email}
                onChange={handleInputChange}
                placeholder="Email"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Email"
                disabled={isViewMode}
              />
              <input
                type="tel"
                name="phone_number"
                value={newContact.phone_number || ''}
                onChange={handleInputChange}
                placeholder="Phone Number"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Phone Number"
                disabled={isViewMode}
              />
              <input
                type="tel"
                name="mobile"
                value={newContact.mobile || ''}
                onChange={handleInputChange}
                placeholder="Mobile"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Mobile"
                disabled={isViewMode}
              />
              <input
                type="text"
                name="street_number"
                value={newContact.street_number || ''}
                onChange={handleInputChange}
                placeholder="Street Number"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Street Number"
                disabled={isViewMode}
              />
              <input
                type="text"
                name="street_name"
                value={newContact.street_name || ''}
                onChange={handleInputChange}
                placeholder="Street Name"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Street Name"
                disabled={isViewMode}
              />
              <input
                type="text"
                name="suburb"
                value={newContact.suburb || ''}
                onChange={handleInputChange}
                placeholder="Suburb"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Suburb"
                disabled={isViewMode}
              />
              <input
                type="text"
                name="postcode"
                value={newContact.postcode || ''}
                onChange={handleInputChange}
                placeholder="Postcode"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Postcode"
                disabled={isViewMode}
              />
              <select
                name="house_type"
                value={newContact.house_type || ''}
                onChange={handleInputChange}
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="House Type"
                disabled={isViewMode}
              >
                {houseTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                name="status"
                value={newContact.status || 'New'}
                onChange={handleInputChange}
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Status"
                disabled={isViewMode}
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Followed Up">Followed Up</option>
                <option value="Closed">Closed</option>
              </select>
              <textarea
                name="requirements"
                value={newContact.requirements || ''}
                onChange={handleInputChange}
                placeholder="Requirements"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm md:col-span-2"
                rows={4}
                aria-label="Requirements"
                disabled={isViewMode}
              />
              <textarea
                name="notes"
                value={newContact.notes || ''}
                onChange={handleInputChange}
                placeholder="Notes"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm md:col-span-2"
                rows={4}
                aria-label="Notes"
                disabled={isViewMode}
              />
              <div className="md:col-span-2">
                <input
                  type="date"
                  name="call_back_date"
                  value={newContact.call_back_date || ''}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm w-full"
                  aria-label="Call Back Date"
                  disabled={isViewMode}
                />
              </div>
              <label className="flex items-center space-x-2 md:col-span-2">
                <input
                  type="checkbox"
                  name="needs_monthly_appraisals"
                  checked={newContact.needs_monthly_appraisals}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  aria-label="Needs Monthly Appraisals"
                  disabled={isViewMode}
                />
                <span className="text-sm text-gray-600">Needs Monthly Appraisals</span>
              </label>
              {!isViewMode && (
                <motion.button
                  onClick={isEditMode ? handleEditContact : handleAddContact}
                  disabled={loading}
                  className={`md:col-span-2 w-full flex items-center justify-center px-4 py-2 rounded-lg text-white ${
                    loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                  } transition-all duration-200`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <UserPlus className="w-5 h-5 mr-2" /> {isEditMode ? 'Update Contact' : 'Add Contact'}
                </motion.button>
              )}
              {(isEditMode || isViewMode) && (
                <motion.button
                  onClick={resetForm}
                  className="md:col-span-2 w-full flex items-center justify-center px-4 py-2 rounded-lg text-white bg-gray-600 hover:bg-gray-700 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5 mr-2" /> {isViewMode ? 'Close View' : 'Cancel Edit'}
                </motion.button>
              )}
            </div>
          )}
        </motion.div>
      )}
      {contacts.length === 0 && !error && (
        <p className="text-gray-600 text-center py-4 text-sm">No contacts found. Add a contact to start your nurturing list.</p>
      )}
      {contacts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-indigo-600 text-white">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Phone</th>
                <th className="p-2 text-left">Mobile</th>
                <th className="p-2 text-left">Address</th>
                <th className="p-2 text-left">Postcode</th>
                <th className="p-2 text-left">House Type</th>
                <th className="p-2 text-left">Requirements</th>
                <th className="p-2 text-left">Notes</th>
                <th className="p-2 text-left">Call Back Date</th>
                <th className="p-2 text-left">Monthly Appraisals</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <motion.tr
                  key={contact.id}
                  className="border-b border-gray-200 hover:bg-gray-100"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <td className="p-2">{`${contact.first_name} ${contact.last_name}`}</td>
                  <td className="p-2">{contact.email}</td>
                  <td className="p-2">{contact.phone_number || 'N/A'}</td>
                  <td className="p-2">{contact.mobile || 'N/A'}</td>
                  <td className="p-2">{contact.street_number && contact.street_name ? `${contact.street_number} ${contact.street_name}` : 'N/A'}</td>
                  <td className="p-2">{contact.postcode || 'N/A'}</td>
                  <td className="p-2">{contact.house_type || 'N/A'}</td>
                  <td className="p-2">{contact.requirements || 'N/A'}</td>
                  <td className="p-2">{contact.notes || 'N/A'}</td>
                  <td className="p-2">{contact.call_back_date ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}</td>
                  <td className="p-2">{contact.needs_monthly_appraisals ? 'Yes' : 'No'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeClass(contact.status)}`}>
                      {contact.status || 'New'}
                    </span>
                  </td>
                  <td className="p-2 flex space-x-2">
                    <motion.button
                      onClick={() => handleViewContact(contact)}
                      className="text-blue-600 hover:text-blue-800"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="View Contact"
                    >
                      <Eye className="w-4 h-4" />
                    </motion.button>
                    {(profile?.role === 'agent' || profile?.role === 'admin') && (
                      <>
                        <motion.button
                          onClick={() => {
                            setIsEditMode(true);
                            setSelectedContact(contact);
                            setNewContact(contact);
                            setMode('manual');
                          }}
                          className="text-indigo-600 hover:text-indigo-800"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Edit Contact"
                        >
                          <Edit className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-red-600 hover:text-red-800"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Delete Contact"
                        >
                          <Trash className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          onClick={() => handleDownloadPDF(contact)}
                          className="text-green-600 hover:text-green-800"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </motion.button>
                      </>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}
