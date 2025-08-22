import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, Check, Edit, Download, Search } from 'lucide-react';
import { normalizeSuburb } from '../reportsUtils';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-toastify';

interface NurturingContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  mobile: string | null;
  address: string | null;
  house_type: string | null;
  requirements: string | null;
  notes: string | null;
  call_back_date: string | null;
  needs_monthly_appraisals: boolean;
  street_name: string | null;
  suburb: string | null;
  status: string | null;
}

interface BasicContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  street_name: string | null;
  suburb: string | null;
}

export function NurturingList() {
  const [contacts, setContacts] = useState<NurturingContact[]>([]);
  const [availableContacts, setAvailableContacts] = useState<BasicContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedContact, setSelectedContact] = useState<NurturingContact | null>(null);
  const [newContact, setNewContact] = useState<NurturingContact>({
    id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    mobile: '',
    address: '',
    house_type: '',
    requirements: '',
    notes: '',
    call_back_date: '',
    needs_monthly_appraisals: false,
    street_name: null,
    suburb: null,
    status: 'New',
  });
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const { profile } = useAuthStore();
  const [mode, setMode] = useState<'manual' | 'import'>('manual');
  const [searchQuery, setSearchQuery] = useState('');

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
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('nurturing_list')
          .select('id, first_name, last_name, email, phone_number, mobile, address, house_type, requirements, notes, call_back_date, needs_monthly_appraisals, street_name, suburb, status');

        if (error) throw new Error(`Failed to fetch nurturing contacts: ${error.message}`);

        setContacts(data || []);
      } catch (err: any) {
        setError(`Error fetching nurturing contacts: ${err.message}`);
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchAvailableContacts = async () => {
      try {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone_number, street_name, suburb');

        if (error) throw new Error(`Failed to fetch available contacts: ${error.message}`);

        setAvailableContacts(data || []);
      } catch (err: any) {
        console.error('Fetch error for available contacts:', err);
      }
    };

    fetchNurturingContacts();
    fetchAvailableContacts();
  }, []);

  const handleAddContact = async () => {
    if (!newContact.first_name || !newContact.last_name || !newContact.email || !newContact.phone_number) {
      setContactError('First Name, Last Name, Email, and Phone Number are required');
      toast.error('First Name, Last Name, Email, and Phone Number are required');
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
          phone_number: newContact.phone_number,
          mobile: newContact.mobile || null,
          address: newContact.address || null,
          house_type: newContact.house_type || null,
          requirements: newContact.requirements || null,
          notes: newContact.notes || null,
          call_back_date: newContact.call_back_date || null,
          needs_monthly_appraisals: newContact.needs_monthly_appraisals,
          street_name: newContact.street_name || null,
          suburb: newContact.suburb || null,
          status: newContact.status || 'New',
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
    if (!selectedContact || !newContact.first_name || !newContact.last_name || !newContact.email || !newContact.phone_number) {
      setContactError('First Name, Last Name, Email, and Phone Number are required');
      toast.error('First Name, Last Name, Email, and Phone Number are required');
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
          phone_number: newContact.phone_number,
          mobile: newContact.mobile || null,
          address: newContact.address || null,
          house_type: newContact.house_type || null,
          requirements: newContact.requirements || null,
          notes: newContact.notes || null,
          call_back_date: newContact.call_back_date || null,
          needs_monthly_appraisals: newContact.needs_monthly_appraisals,
          street_name: newContact.street_name || null,
          suburb: newContact.suburb || null,
          status: newContact.status || 'New',
        })
        .eq('id', selectedContact.id)
        .select();

      if (error) throw new Error(`Failed to update contact: ${error.message}`);

      setContacts(contacts.map((contact) => (contact.id === selectedContact.id ? data[0] : contact)));
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

  const handleImportAll = async () => {
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
        phone_number: c.phone_number,
        street_name: c.street_name || null,
        suburb: c.suburb || null,
        status: 'New',
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
      street_name: basic.street_name,
      suburb: basic.suburb,
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
      address: '',
      house_type: '',
      requirements: '',
      notes: '',
      call_back_date: '',
      needs_monthly_appraisals: false,
      street_name: null,
      suburb: null,
      status: 'New',
    });
    setMode('manual');
    setSearchQuery('');
  };

  const filteredAvailableContacts = availableContacts.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone_number.includes(searchQuery)
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
      className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 mt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
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
              exit={{ opacity: 0 }}
            >
              {contactError}
            </motion.div>
          )}
          {contactSuccess && (
            <motion.div
              className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm flex items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                        <div className="text-xs text-gray-600">{basic.phone_number}</div>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          {mode === 'manual' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="first_name"
                value={newContact.first_name}
                onChange={handleInputChange}
                placeholder="First Name"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="First Name"
              />
              <input
                type="text"
                name="last_name"
                value={newContact.last_name}
                onChange={handleInputChange}
                placeholder="Last Name"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Last Name"
              />
              <input
                type="email"
                name="email"
                value={newContact.email}
                onChange={handleInputChange}
                placeholder="Email"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Email"
              />
              <input
                type="tel"
                name="phone_number"
                value={newContact.phone_number}
                onChange={handleInputChange}
                placeholder="Phone Number"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Phone Number"
              />
              <input
                type="tel"
                name="mobile"
                value={newContact.mobile || ''}
                onChange={handleInputChange}
                placeholder="Mobile"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Mobile"
              />
              <input
                type="text"
                name="address"
                value={newContact.address || ''}
                onChange={handleInputChange}
                placeholder="Address"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Address"
              />
              {/* House Type Dropdown */}
              <select
                name="house_type"
                value={newContact.house_type || ''}
                onChange={handleInputChange}
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="House Type"
              >
                {houseTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                name="street_name"
                value={newContact.street_name || ''}
                onChange={handleInputChange}
                placeholder="Street Name"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Street Name"
              />
              <input
                type="text"
                name="suburb"
                value={newContact.suburb || ''}
                onChange={handleInputChange}
                placeholder="Suburb"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Suburb"
              />
              <select
                name="status"
                value={newContact.status || 'New'}
                onChange={handleInputChange}
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm"
                aria-label="Status"
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
              />
              <textarea
                name="notes"
                value={newContact.notes || ''}
                onChange={handleInputChange}
                placeholder="Notes"
                className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm md:col-span-2"
                rows={4}
                aria-label="Notes"
              />
              <div className="md:col-span-2">
                <input
                  type="date"
                  name="call_back_date"
                  value={newContact.call_back_date || ''}
                  onChange={handleInputChange}
                  className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-sm w-full"
                  aria-label="Call Back Date"
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
                />
                <span className="text-sm text-gray-600">Needs Monthly Appraisals</span>
              </label>
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
              {isEditMode && (
                <motion.button
                  onClick={resetForm}
                  className="md:col-span-2 w-full flex items-center justify-center px-4 py-2 rounded-lg text-white bg-gray-600 hover:bg-gray-700 transition-all duration-200"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-5 h-5 mr-2" /> Cancel Edit
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
                  <td className="p-2">{contact.phone_number}</td>
                  <td className="p-2">{contact.mobile || 'N/A'}</td>
                  <td className="p-2">{contact.address || 'N/A'}</td>
                  <td className="p-2">{contact.house_type || 'N/A'}</td>
                  <td className="p-2">{contact.requirements || 'N/A'}</td>
                  <td className="p-2">{contact.notes || 'N/A'}</td>
                  <td className="p-2">{contact.call_back_date ? new Date(contact.call_back_date).toLocaleDateString() : 'N/A'}</td>
                  <td className="p-2">{contact.needs_monthly_appraisals ? 'Yes' : 'No'}</td>
                  <td className="p-2">
                    <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeClass(contact.status)}`}>
                      {contact.status || 'New'}
                    </span>
                  </td>
                  <td className="p-2">
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
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
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