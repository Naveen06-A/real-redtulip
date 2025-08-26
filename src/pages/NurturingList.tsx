
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, Check, Edit, Download, Search, Eye, Trash, Bell, Phone, Calendar, Clock } from 'lucide-react';
import { normalizeSuburb } from '../reportsUtils';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [hasPhoneNumber, setHasPhoneNumber] = useState<string>('No');
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const { profile, user } = useAuthStore();
  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAgentNotification, setShowAgentNotification] = useState(false);
  const [todaysTasks, setTodaysTasks] = useState<NurturingContact[]>([]);
  const [incompleteContacts, setIncompleteContacts] = useState<NurturingContact[]>([]);
  const [showIncompleteNotification, setShowIncompleteNotification] = useState(false);
  const [pendingTasks, setPendingTasks] = useState<NurturingContact[]>([]);
  const [showPendingNotification, setShowPendingNotification] = useState(false);

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
        setContacts(fetchedContacts);
        
        if (profile.role === 'agent') {
          const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

          const tasks = fetchedContacts.filter(contact => 
            contact.call_back_date === today || contact.status === 'New'
          );
          setTodaysTasks(tasks);

          const incomplete = fetchedContacts.filter(contact => 
            !contact.mobile || !contact.call_back_date
          );
          setIncompleteContacts(incomplete);

          const pending = fetchedContacts.filter(contact =>
            contact.status !== 'Closed' && contact.call_back_date &&
            (contact.call_back_date === today || contact.call_back_date === tomorrowStr || new Date(contact.call_back_date) < new Date())
          );
          setPendingTasks(pending);

          setShowAgentNotification(tasks.length > 0);
          setShowIncompleteNotification(incomplete.length > 0);
          setShowPendingNotification(pending.length > 0);

          if (tasks.length > 0) {
            setTimeout(() => setShowAgentNotification(false), 15000);
          }
          if (incomplete.length > 0) {
            setTimeout(() => setShowIncompleteNotification(false), 15000);
          }
          if (pending.length > 0) {
            setTimeout(() => setShowPendingNotification(false), 15000);
          }
        }
      } catch (err: any) {
        setError(`Error fetching nurturing contacts: ${err.message}`);
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

        const { data, error } = await query;

        if (error) throw new Error(`Failed to fetch available contacts: ${error.message}`);

        setAvailableContacts(data || []);
      } catch (err: any) {
        setError(`Error fetching available contacts: ${err.message}`);
        toast.error(`Error fetching available contacts: ${err.message}`);
      }
    };

    fetchNurturingContacts();
    fetchAvailableContacts();

    // Set up interval for periodic reminder checks
    const reminderInterval = setInterval(() => {
      if (profile?.role === 'agent') {
        fetchNurturingContacts();
      }
    }, 1000 * 60 * 60); // Check every hour

    return () => clearInterval(reminderInterval);
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
          phone_number: hasPhoneNumber === 'Yes' ? newContact.phone_number || '' : '',
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

    if (!user?.id) {
      setContactError('User not authenticated');
      toast.error('User not authenticated');
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
          phone_number: hasPhoneNumber === 'Yes' ? newContact.phone_number || '' : '',
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
        .eq('agent_id', user.id)
        .select();

      if (error) {
        throw new Error(`Failed to update contact: ${error.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('No contact was updated. Please check if the contact exists and you have permission to update it.');
      }

      setContacts(contacts.map((contact) =>
        contact.id === selectedContact.id ? { ...contact, ...data[0] } : contact
      ));
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
    setHasPhoneNumber(contact.phone_number ? 'Yes' : 'No');
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
        phone_number: c.phone_number || '',
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
    if (name === 'hasPhoneNumber') {
      setHasPhoneNumber(value);
      if (value === 'No') {
        setNewContact((prev) => ({ ...prev, phone_number: '' }));
      }
    } else {
      setNewContact((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const selectBasicContact = (basic: BasicContact) => {
    setNewContact({
      ...newContact,
      first_name: basic.first_name,
      last_name: basic.last_name,
      email: basic.email,
      phone_number: basic.phone_number || '',
    });
    setHasPhoneNumber(basic.phone_number ? 'Yes' : 'No');
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
    setHasPhoneNumber('No');
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
        return 'bg-blue-100 text-blue-800';
      case 'Contacted':
        return 'bg-yellow-100 text-yellow-800';
      case 'Followed Up':
        return 'bg-purple-100 text-purple-800';
      case 'Closed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <motion.div
        className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 mt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-center items-center py-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="text-2xl"
          >
            🏠
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="bg-gray-50 min-h-screen p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Pending Tasks Reminder Notification */}
      <AnimatePresence>
        {showPendingNotification && profile?.role === 'agent' && (
          <motion.div
            className={`fixed left-1/2 transform -translate-x-1/2 z-50 bg-white text-yellow-600 shadow-lg rounded-xl border border-yellow-200 max-w-lg w-full p-4 ${
              showIncompleteNotification && showAgentNotification ? 'top-44' :
              showIncompleteNotification || showAgentNotification ? 'top-24' : 'top-4'
            }`}
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            role="alert"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <motion.span
                  className="p-2 bg-yellow-100 rounded-full"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Clock className="h-5 w-5 text-yellow-600" />
                </motion.span>
                <p className="text-sm font-medium">
                  Reminder: {pendingTasks.length} pending task{pendingTasks.length !== 1 ? 's' : ''} need completion
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 rounded-full hover:bg-yellow-100"
                onClick={() => setShowPendingNotification(false)}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
            <div className="mt-3 space-y-2">
              {pendingTasks.slice(0, 3).map((task, index) => (
                <motion.div
                  key={index}
                  className="p-2 bg-yellow-50 rounded-lg text-xs cursor-pointer hover:bg-yellow-100"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => {
                    setIsEditMode(true);
                    setSelectedContact(task);
                    setNewContact(task);
                    setHasPhoneNumber(task.phone_number ? 'Yes' : 'No');
                    setMode('manual');
                    document.querySelector('.add-contact-form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <p className="font-medium">{task.first_name} {task.last_name}</p>
                  <div className="flex items-center text-gray-600">
                    {task.call_back_date ? (
                      <>
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(task.call_back_date) < new Date() ? 'Overdue' : 'Due'}: {new Date(task.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </>
                    ) : (
                      <>
                        <Phone className="w-3 h-3 mr-1" />
                        Status: {task.status}
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
              {pendingTasks.length > 3 && (
                <p className="text-xs text-center text-gray-600">
                  and {pendingTasks.length - 3} more...
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incomplete Contacts Notification */}
      <AnimatePresence>
        {showIncompleteNotification && profile?.role === 'agent' && (
          <motion.div
            className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white text-red-600 shadow-lg rounded-xl border border-red-200 max-w-lg w-full p-4 ${
              showAgentNotification || showPendingNotification ? 'top-24' : 'top-4'
            }`}
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            role="alert"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <motion.span
                  className="p-2 bg-red-100 rounded-full"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Edit className="h-5 w-5 text-red-600" />
                </motion.span>
                <p className="text-sm font-medium">
                  {incompleteContacts.length} incomplete contact{incompleteContacts.length !== 1 ? 's' : ''} need attention
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 rounded-full hover:bg-red-100"
                onClick={() => setShowIncompleteNotification(false)}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
            <div className="mt-3 space-y-2">
              {incompleteContacts.slice(0, 3).map((contact, index) => (
                <motion.div
                  key={index}
                  className="p-2 bg-red-50 rounded-lg text-xs cursor-pointer hover:bg-red-100"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => {
                    setIsEditMode(true);
                    setSelectedContact(contact);
                    setNewContact(contact);
                    setHasPhoneNumber(contact.phone_number ? 'Yes' : 'No');
                    setMode('manual');
                    document.querySelector('.add-contact-form')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  <p className="font-medium">{contact.first_name} {contact.last_name}</p>
                  <p className="text-gray-600">
                    Missing: {!contact.mobile && 'Mobile, '}{!contact.call_back_date && 'Call Back Date'}
                  </p>
                </motion.div>
              ))}
              {incompleteContacts.length > 3 && (
                <p className="text-xs text-center text-gray-600">
                  and {incompleteContacts.length - 3} more...
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's Tasks Notification */}
      <AnimatePresence>
        {showAgentNotification && profile?.role === 'agent' && (
          <motion.div
            className={`fixed left-1/2 transform -translate-x-1/2 z-40 bg-white text-blue-600 shadow-lg rounded-xl border border-blue-200 max-w-lg w-full p-4 ${
              showIncompleteNotification && showPendingNotification ? 'top-44' :
              showIncompleteNotification || showPendingNotification ? 'top-24' : 'top-4'
            }`}
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            role="alert"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <motion.span
                  className="p-2 bg-blue-100 rounded-full"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Bell className="h-5 w-5 text-blue-600" />
                </motion.span>
                <p className="text-sm font-medium">
                  Today's Tasks: {todaysTasks.length} task{todaysTasks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-1 rounded-full hover:bg-blue-100"
                onClick={() => setShowAgentNotification(false)}
              >
                <X className="h-4 w-4" />
              </motion.button>
            </div>
            <div className="mt-3 space-y-2">
              {todaysTasks.slice(0, 3).map((task, index) => (
                <motion.div
                  key={index}
                  className="p-2 bg-blue-50 rounded-lg text-xs"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <p className="font-medium">{task.first_name} {task.last_name}</p>
                  <div className="flex items-center text-gray-600">
                    {task.call_back_date ? (
                      <>
                        <Calendar className="w-3 h-3 mr-1" />
                        Call back: {new Date(task.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </>
                    ) : (
                      <>
                        <Phone className="w-3 h-3 mr-1" />
                        New contact
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
              {todaysTasks.length > 3 && (
                <p className="text-xs text-center text-gray-600">
                  and {todaysTasks.length - 3} more...
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 flex items-center">
            <span className="mr-2">📋</span> Nurturing List
          </h2>
          {(profile?.role === 'agent' || profile?.role === 'admin') && (
            <motion.button
              onClick={handleImportAll}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={availableContacts.length === 0}
            >
              <Download className="w-4 h-4 mr-2" /> Import All
            </motion.button>
          )}
        </div>

        {error && (
          <motion.div
            className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.div>
        )}

        {(profile?.role === 'agent' || profile?.role === 'admin') && (
          <motion.div
            className="mb-8 bg-white p-6 rounded-xl shadow-md border border-gray-100 add-contact-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex space-x-4 mb-4">
              <motion.button
                onClick={() => setMode('manual')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'manual' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'} hover:bg-indigo-500 hover:text-white transition-all`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Manual Entry
              </motion.button>
              <motion.button
                onClick={() => setMode('import')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'import' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'} hover:bg-indigo-500 hover:text-white transition-all`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Import Contacts
              </motion.button>
            </div>

            {contactError && (
              <motion.div
                className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <X className="w-4 h-4 mr-2" /> {contactError}
              </motion.div>
            )}
            {contactSuccess && (
              <motion.div
                className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm flex items-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Check className="w-4 h-4 mr-2" /> {contactSuccess}
              </motion.div>
            )}

            {mode === 'import' && (
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent pl-10"
                    aria-label="Search Contacts"
                  />
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  {filteredAvailableContacts.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-2">No contacts found</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredAvailableContacts.map((basic) => (
                        <motion.div
                          key={basic.id}
                          className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-all"
                          onClick={() => selectBasicContact(basic)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <p className="font-medium text-sm">{basic.first_name} {basic.last_name}</p>
                          <p className="text-xs text-gray-600">{basic.email}</p>
                          <p className="text-xs text-gray-600">{basic.phone_number || 'N/A'}</p>
                        </motion.div>
                      ))}
                    </div>
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
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="First Name"
                  disabled={isViewMode}
                />
                <input
                  type="text"
                  name="last_name"
                  value={newContact.last_name}
                  onChange={handleInputChange}
                  placeholder="Last Name"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Last Name"
                  disabled={isViewMode}
                />
                <input
                  type="email"
                  name="email"
                  value={newContact.email}
                  onChange={handleInputChange}
                  placeholder="Email"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Email"
                  disabled={isViewMode}
                />
                <select
                  name="hasPhoneNumber"
                  value={hasPhoneNumber}
                  onChange={handleInputChange}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Has Phone Number"
                  disabled={isViewMode}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
                {hasPhoneNumber === 'Yes' && (
                  <input
                    type="tel"
                    name="phone_number"
                    value={newContact.phone_number || ''}
                    onChange={handleInputChange}
                    placeholder="Phone Number (optional)"
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    aria-label="Phone Number"
                    disabled={isViewMode}
                  />
                )}
                <input
                  type="tel"
                  name="mobile"
                  value={newContact.mobile || ''}
                  onChange={handleInputChange}
                  placeholder="Mobile"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Mobile"
                  disabled={isViewMode}
                />
                <input
                  type="text"
                  name="street_number"
                  value={newContact.street_number || ''}
                  onChange={handleInputChange}
                  placeholder="Street Number"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Street Number"
                  disabled={isViewMode}
                />
                <input
                  type="text"
                  name="street_name"
                  value={newContact.street_name || ''}
                  onChange={handleInputChange}
                  placeholder="Street Name"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Street Name"
                  disabled={isViewMode}
                />
                <input
                  type="text"
                  name="suburb"
                  value={newContact.suburb || ''}
                  onChange={handleInputChange}
                  placeholder="Suburb"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Suburb"
                  disabled={isViewMode}
                />
                <input
                  type="text"
                  name="postcode"
                  value={newContact.postcode || ''}
                  onChange={handleInputChange}
                  placeholder="Postcode"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Postcode"
                  disabled={isViewMode}
                />
                <select
                  name="house_type"
                  value={newContact.house_type || ''}
                  onChange={handleInputChange}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent md:col-span-2"
                  rows={3}
                  aria-label="Requirements"
                  disabled={isViewMode}
                />
                <textarea
                  name="notes"
                  value={newContact.notes || ''}
                  onChange={handleInputChange}
                  placeholder="Notes"
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent md:col-span-2"
                  rows={3}
                  aria-label="Notes"
                  disabled={isViewMode}
                />
                <div className="md:col-span-2">
                  <input
                    type="date"
                    name="call_back_date"
                    value={newContact.call_back_date || ''}
                    onChange={handleInputChange}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full"
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
                    className={`md:col-span-2 py-3 px-4 rounded-lg text-white text-sm font-medium ${
                      loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                    } transition-all flex items-center justify-center`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <UserPlus className="w-4 h-4 mr-2" /> 
                    {isEditMode ? 'Update Task' : 'Add Task'}
                  </motion.button>
                )}
                {(isEditMode || isViewMode) && (
                  <motion.button
                    onClick={resetForm}
                    className="md:col-span-2 py-3 px-4 rounded-lg text-white bg-gray-500 hover:bg-gray-600 transition-all text-sm font-medium flex items-center justify-center"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-4 h-4 mr-2" /> 
                    {isViewMode ? 'Close View' : 'Cancel Edit'}
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {contacts.length === 0 && !error && (
          <p className="text-gray-500 text-center py-4 text-sm">No tasks found. Add a task to start your list.</p>
        )}

        {contacts.length > 0 && (
          <div className="space-y-4">
            {contacts.map((contact) => (
              <motion.div
                key={contact.id}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={contact.status === 'Closed'}
                      onChange={() => {
                        setIsEditMode(true);
                        setSelectedContact(contact);
                        setNewContact({
                          ...contact,
                          status: contact.status === 'Closed' ? 'New' : 'Closed'
                        });
                        setHasPhoneNumber(contact.phone_number ? 'Yes' : 'No');
                        setMode('manual');
                      }}
                      className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <div>
                      <p className="font-semibold text-gray-800">{contact.first_name} {contact.last_name}</p>
                      <p className="text-sm text-gray-600">{contact.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(contact.status)}`}>
                      {contact.status || 'New'}
                    </span>
                    <motion.button
                      onClick={() => handleViewContact(contact)}
                      className="p-1 text-gray-500 hover:text-blue-600"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      title="View Task"
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
                            setHasPhoneNumber(contact.phone_number ? 'Yes' : 'No');
                            setMode('manual');
                          }}
                          className="p-1 text-gray-500 hover:text-indigo-600"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Edit Task"
                        >
                          <Edit className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-1 text-gray-500 hover:text-red-600"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Delete Task"
                        >
                          <Trash className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          onClick={() => handleDownloadPDF(contact)}
                          className="p-1 text-gray-500 hover:text-green-600"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </motion.button>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>
                    <p><span className="font-medium">Phone:</span> {contact.phone_number || 'N/A'}</p>
                    <p><span className="font-medium">Mobile:</span> {contact.mobile || 'N/A'}</p>
                    <p><span className="font-medium">Address:</span> {contact.street_number && contact.street_name ? `${contact.street_number} ${contact.street_name}` : 'N/A'}</p>
                    <p><span className="font-medium">Postcode:</span> {contact.postcode || 'N/A'}</p>
                  </div>
                  <div>
                    <p><span className="font-medium">House Type:</span> {contact.house_type || 'N/A'}</p>
                    <p><span className="font-medium">Call Back:</span> {contact.call_back_date ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}</p>
                    <p><span className="font-medium">Appraisals:</span> {contact.needs_monthly_appraisals ? 'Yes' : 'No'}</p>
                    <p><span className="font-medium">Notes:</span> {contact.notes ? contact.notes.substring(0, 50) + (contact.notes.length > 50 ? '...' : '') : 'N/A'}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
