import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Check, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Contact {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  street_name: string | null;
  suburb: string | null;
}

interface StreetStats {
  street_name: string;
}

interface ContactPageProps {
  suburb: string | null;
  streetStats: StreetStats[];
}

export function ContactPage({ suburb, streetStats }: ContactPageProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [newContact, setNewContact] = useState<Contact>({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    street_name: null,
    suburb: null,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
  }, [suburb]);

  const fetchContacts = async () => {
    if (!suburb) {
      setError('Suburb is required to fetch contacts');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, email, phone_number, street_name, suburb')
        .ilike('suburb', `%${suburb.toLowerCase().split(' qld')[0]}%`);
      if (error) {
        console.error('Fetch error:', error);
        throw new Error(`Failed to fetch contacts: ${error.message} (Code: ${error.code}, Details: ${error.details})`);
      }
      setContacts(data || []);
      setError(null);
    } catch (err: any) {
      setError(`Error fetching contacts: ${err.message}`);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!newContact.first_name || !newContact.last_name || !newContact.email || !newContact.phone_number) {
      setError('All fields (First Name, Last Name, Email, Phone Number) are required');
      return;
    }
    if (!selectedStreet) {
      setIsModalOpen(true);
      return;
    }
    if (!suburb) {
      setError('Suburb is required');
      return;
    }
    setLoading(true);
    try {
      const contactToInsert = {
        first_name: newContact.first_name,
        last_name: newContact.last_name,
        email: newContact.email,
        phone_number: newContact.phone_number,
        street_name: selectedStreet,
        status: 'Inprogress', // Add this line
        suburb,
      };
      const { data, error } = await supabase
        .from('contacts')
        .insert([contactToInsert])
        .select();
      if (error) {
        console.error('Supabase error:', error);
        throw new Error(`Failed to add contact: ${error.message} (Code: ${error.code}, Details: ${error.details})`);
      }
      setContacts([...contacts, data[0]]);
      setNewContact({ first_name: '', last_name: '', email: '', phone_number: '', street_name: null, suburb: null });
      setSelectedStreet(null);
      setSuccess('Contact added successfully');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(`Error adding contact: ${err.message}`);
      console.error('Insert error:', err);
    } finally {
      setLoading(false);
      setIsModalOpen(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setError('No file selected');
      return;
    }
    if (!suburb) {
      setError('Please select a suburb before uploading');
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const validContacts: any[] = [];
        const invalidRows: number[] = [];

        jsonData.forEach((row: any, index: number) => {
          const contact = {
            first_name: row['First Name']?.toString().trim() || '',
            last_name: row['Last Name']?.toString().trim() || '',
            email: row['Email']?.toString().trim() || '',
            phone_number: row['Phone Number']?.toString().trim() || '',
            street_name: row['Street Name']?.toString().trim() || null,
            suburb,
            status: 'Inprogress',
          };

          if (
            contact.first_name &&
            contact.last_name &&
            contact.email &&
            contact.phone_number &&
            contact.street_name &&
            streetStats.some((street) => street.street_name === contact.street_name)
          ) {
            validContacts.push(contact);
          } else {
            invalidRows.push(index + 2);
          }
        });

        if (validContacts.length === 0) {
          setError('No valid contacts found in the Excel file. Ensure columns are named "First Name", "Last Name", "Email", "Phone Number", and "Street Name".');
          setLoading(false);
          return;
        }

        try {
          const { data, error } = await supabase
            .from('contacts')
            .insert(validContacts)
            .select();
          if (error) {
            console.error('Supabase error:', error);
            throw new Error(`Failed to import contacts: ${error.message} (Code: ${error.code}, Details: ${error.details})`);
          }
          setContacts([...contacts, ...data]);
          setSuccess(`Successfully imported ${data.length} contacts${invalidRows.length > 0 ? `. Invalid rows: ${invalidRows.join(', ')}` : ''}`);
          setError(null);
          setTimeout(() => setSuccess(null), 3000);
        } catch (err: any) {
          setError(`Error importing contacts: ${err.message}`);
          console.error('Bulk insert error:', err);
        } finally {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setError(`Error processing file: ${err.message}`);
      console.error('File processing error:', err);
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewContact((prev) => ({ ...prev, [name]: value }));
  };

  const handleStreetSelect = (street: string) => {
    setSelectedStreet(street);
    setIsModalOpen(false);
  };

  return (
    <motion.div
      className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 max-w-4xl mx-auto mt-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
        <span className="mr-2 text-indigo-600">📇</span> Manage Contacts for {suburb || 'Select a Suburb'}
      </h2>
      {error && (
        <motion.div
          className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {error}
        </motion.div>
      )}
      {success && (
        <motion.div
          className="bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Check className="w-5 h-5 mr-2" /> {success}
        </motion.div>
      )}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Add New Contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </div>
        <motion.button
          onClick={handleAddContact}
          disabled={loading}
          className={`mt-4 flex items-center justify-center px-4 py-2 rounded-lg text-white ${
            loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
          } transition-all duration-200`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-5 h-5 mr-2" /> Add Contact
        </motion.button>
      </div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Import Contacts from Excel</h3>
        <p className="text-sm text-gray-600 mb-2">
          Upload an Excel file with columns: First Name, Last Name, Email, Phone Number, Street Name
        </p>
        <input
          type="file"
          accept=".xlsx, .xls"
          onChange={handleExcelUpload}
          disabled={loading}
          className="p-3 border border-gray-200 rounded-lg bg-gray-50 text-sm w-full"
          aria-label="Upload Excel file"
        />
        <motion.button
          onClick={() => {
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            fileInput.click();
          }}
          disabled={loading}
          className={`mt-2 flex items-center justify-center px-4 py-2 rounded-lg text-white ${
            loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
          } transition-all duration-200`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Upload className="w-5 h-5 mr-2" /> Upload Excel
        </motion.button>
      </div>
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Select a Street</h3>
                <motion.button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-600 hover:text-gray-800"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {streetStats.length === 0 ? (
                  <p className="text-gray-600 text-sm">No streets available for {suburb}</p>
                ) : (
                  <ul className="space-y-2">
                    {streetStats.map((street) => (
                      <motion.li
                        key={street.street_name}
                        className={`p-2 rounded-lg cursor-pointer text-sm ${
                          selectedStreet === street.street_name
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                        onClick={() => handleStreetSelect(street.street_name)}
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        {street.street_name}
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Existing Contacts</h3>
        {loading ? (
          <div className="flex justify-center items-center py-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="text-xl"
            >
              📇
            </motion.div>
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-gray-600 text-sm">No contacts found for {suburb}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-indigo-600 text-white">
                  <th className="p-2 text-left">First Name</th>
                  <th className="p-2 text-left">Last Name</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Street</th>
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
                    <td className="p-2">{contact.first_name}</td>
                    <td className="p-2">{contact.last_name}</td>
                    <td className="p-2">{contact.email}</td>
                    <td className="p-2">{contact.phone_number}</td>
                    <td className="p-2">{contact.street_name || 'N/A'}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}