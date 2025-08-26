import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, Check, Edit, Download, Search, Eye, Trash,Upload } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
  const [mode, setMode] = useState<'manual' | 'import' | 'excel'>('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);

  const houseTypeOptions = [
    { value: '', label: 'Select House Type' },
    { value: 'house', label: 'House' },
    { value: 'acreage', label: 'Acreage' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'land', label: 'Land' },
    { value: 'commercial', label: 'Commercial' },
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
        const fetchedContacts = (data || []).sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        );
        setContacts(fetchedContacts);
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

    const reminderInterval = setInterval(() => {
      if (profile?.role === 'agent') {
        fetchNurturingContacts();
      }
    }, 1000 * 60 * 60);

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
          phone_number: hasPhoneNumber === 'Yes' ? (newContact.phone_number || '') : '',
          mobile: newContact.mobile || '',
          street_number: newContact.street_number || '',
          street_name: newContact.street_name || '',
          suburb: newContact.suburb || '',
          postcode: newContact.postcode || '',
          house_type: newContact.house_type || '',
          requirements: newContact.requirements || '',
          notes: newContact.notes || '',
          call_back_date: newContact.call_back_date || '',
          needs_monthly_appraisals: newContact.needs_monthly_appraisals,
          status: newContact.status || 'New',
          agent_id: user.id,
        }])
        .select();
      if (error) throw new Error(`Failed to add contact: ${error.message}`);
      const updatedContacts = [...contacts, data[0]].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
      setContacts(updatedContacts);
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
          phone_number: hasPhoneNumber === 'Yes' ? (newContact.phone_number || '') : '',
          mobile: newContact.mobile || '',
          street_number: newContact.street_number || '',
          street_name: newContact.street_name || '',
          suburb: newContact.suburb || '',
          postcode: newContact.postcode || '',
          house_type: newContact.house_type || '',
          requirements: newContact.requirements || '',
          notes: newContact.notes || '',
          call_back_date: newContact.call_back_date || '',
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
      const updatedContacts = contacts.map((contact) =>
        contact.id === selectedContact.id ? { ...contact, ...data[0] } : contact
      ).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
      setContacts(updatedContacts);
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
      const updatedContacts = contacts.filter((contact) => contact.id !== id).sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
      setContacts(updatedContacts);
      setSelectedContactIds(selectedContactIds.filter(contactId => contactId !== id));
      toast.success('Contact deleted successfully');
    } catch (err: any) {
      toast.error(`Error deleting contact: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContactIds.length === 0) {
      toast.info('No contacts selected for deletion');
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedContactIds.length} selected contact(s)?`)) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('nurturing_list')
        .delete()
        .in('id', selectedContactIds)
        .eq('agent_id', user?.id);
      if (error) throw new Error(`Failed to delete contacts: ${error.message}`);
      const updatedContacts = contacts.filter((contact) => !selectedContactIds.includes(contact.id)).sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
      setContacts(updatedContacts);
      setSelectedContactIds([]);
      setSelectAll(false);
      toast.success(`${selectedContactIds.length} contact(s) deleted successfully`);
    } catch (err: any) {
      toast.error(`Error deleting contacts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (contacts.length === 0) {
      toast.info('No contacts to delete');
      return;
    }
    if (!confirm('Are you sure you want to delete ALL contacts in the nurturing list? This action cannot be undone.')) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('nurturing_list')
        .delete()
        .eq('agent_id', user?.id);
      if (error) throw new Error(`Failed to delete all contacts: ${error.message}`);
      setContacts([]);
      setSelectedContactIds([]);
      setSelectAll(false);
      toast.success('All contacts deleted successfully');
    } catch (err: any) {
      toast.error(`Error deleting all contacts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewContact = (contact: NurturingContact) => {
    setSelectedContact(contact);
    setIsViewMode(true);
    setHasPhoneNumber(contact.phone_number ? 'Yes' : 'No');
  };

  const getStatusBadgeColor = (status: string | null) => {
    switch (status) {
      case 'New':
        return [219, 234, 254, 0.8];
      case 'Contacted':
        return [254, 243, 199, 0.8];
      case 'Followed Up':
        return [233, 213, 255, 0.8];
      case 'Closed':
        return [209, 250, 229, 0.8];
      default:
        return [243, 244, 246, 0.8];
    }
  };

  const handleDownloadPDF = (contact: NurturingContact) => {
    try {
      const doc = new jsPDF();
      const pageWidth = 210;
      const margin = 10;
      const columnWidth = (pageWidth - 3 * margin) / 2;
      let y = 20;
      doc.setFontSize(12);
      doc.text(`${contact.first_name} ${contact.last_name} - Contact Details`, margin, y);
      y += 10;

      const leftColumn = [
        `Email: ${contact.email || 'N/A'}`,
        ...(contact.phone_number ? [`Phone: ${contact.phone_number}`] : []),
        `Mobile: ${contact.mobile || 'N/A'}`,
        `Address: ${contact.street_number && contact.street_name ? `${contact.street_number} ${contact.street_name}` : 'N/A'}`,
        `Suburb: ${contact.suburb || 'N/A'}`,
        `Postcode: ${contact.postcode || 'N/A'}`,
        `House Type: ${contact.house_type || 'N/A'}`,
        `Call Back: ${contact.call_back_date ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`,
      ];
      const rightColumn = [
        `Appraisals: ${contact.needs_monthly_appraisals ? 'Yes' : 'No'}`,
        `Notes: ${contact.notes?.substring(0, 200) || 'N/A'}`,
      ];
      autoTable(doc, {
        startY: y,
        head: [],
        body: leftColumn.map((text, i) => [text, rightColumn[i] || '']),
        theme: 'grid',
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', lineColor: [209, 213, 219] },
        columnStyles: {
          0: { cellWidth: columnWidth },
          1: { cellWidth: columnWidth },
        },
        didParseCell: (data) => {
          if (data.cell.text && data.cell.text.length > 0) {
            data.cell.text = data.cell.text.map(text => text.length > 200 ? text.substring(0, 200) + '...' : text);
          }
        },
      });
      doc.save(`${contact.first_name}_${contact.last_name}_contact.pdf`);
    } catch (error: any) {
      console.error('Error generating individual PDF:', error);
      toast.error('Failed to generate PDF for this task. Please try again.');
    }
  };

  const handleDownloadAllTasks = () => {
    try {
      if (contacts.length === 0) {
        toast.info('No tasks available to download.');
        return;
      }
      const doc = new jsPDF();
      const pageWidth = 210;
      const margin = 10;
      const columnWidth = (pageWidth - 3 * margin) / 2;
      let y = 20;
      doc.setFontSize(14);
      doc.text('All Nurturing Tasks', margin, y);
      y += 7;
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, margin, y);
      doc.text(`Total Tasks: ${contacts.length}`, pageWidth - margin - 40, y);
      y += 10;
      contacts.forEach((contact, index) => {
        if (y > 267) {
          doc.addPage();
          y = 20;
        }
        doc.setDrawColor(209, 213, 219);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 80, 3, 3, 'FD');
        y += 8;
        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55);
        doc.text(`${contact.first_name} ${contact.last_name}`, margin + 5, y);
        const statusColor = getStatusBadgeColor(contact.status);
        doc.setFillColor(...statusColor);
        doc.roundedRect(pageWidth - margin - 30, y - 4, 25, 6, 2, 2, 'F');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text(contact.status || 'New', pageWidth - margin - 28, y);
        y += 8;
        doc.setFontSize(10);
        doc.text(`Closed: ${contact.status === 'Closed' ? '[X]' : '[ ]'}`, margin + 5, y);
        y += 8;
        const leftColumn = [
          `Email: ${contact.email || 'N/A'}`,
          ...(contact.phone_number ? [`Phone: ${contact.phone_number}`] : []),
          `Mobile: ${contact.mobile || 'N/A'}`,
          `Address: ${contact.street_number && contact.street_name ? `${contact.street_number} ${contact.street_name}` : 'N/A'}`,
          `Suburb: ${contact.suburb || 'N/A'}`,
          `Postcode: ${contact.postcode || 'N/A'}`,
          `House Type: ${contact.house_type || 'N/A'}`,
          `Call Back: ${contact.call_back_date ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`,
        ];
        const rightColumn = [
          `Appraisals: ${contact.needs_monthly_appraisals ? 'Yes' : 'No'}`,
          `Notes: ${contact.notes?.substring(0, 200) || 'N/A'}`,
        ];
        autoTable(doc, {
          startY: y,
          head: [],
          body: leftColumn.map((text, i) => [text, rightColumn[i] || '']),
          theme: 'grid',
          margin: { left: margin + 5, right: margin + 5 },
          styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', lineColor: [209, 213, 219] },
          columnStyles: {
            0: { cellWidth: columnWidth - 5 },
            1: { cellWidth: columnWidth - 5 },
          },
          didParseCell: (data) => {
            if (data.cell.text && data.cell.text.length > 0) {
              data.cell.text = data.cell.text.map(text => text.length > 200 ? text.substring(0, 200) + '...' : text);
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
        if (index < contacts.length - 1) {
          doc.setDrawColor(209, 213, 219);
          doc.line(margin, y, pageWidth - margin, y);
          y += 5;
        }
      });
      doc.save('all_nurturing_tasks.pdf');
    } catch (error: any) {
      console.error('Error generating PDF for all tasks:', error);
      toast.error('Failed to generate PDF for all tasks. Please try again or contact support.');
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
      const updatedContacts = [...contacts, ...data].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
      );
      setContacts(updatedContacts);
      toast.success(`${toImport.length} contacts imported successfully`);
    } catch (err: any) {
      toast.error(`Error importing contacts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExcelImport = async () => {
  if (!user) {
    toast.error('User not authenticated');
    return;
  }
  if (!excelFile) {
    toast.error('Please select an Excel file to import');
    return;
  }

  setLoading(true);
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fileData = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(fileData, { type: 'array', dateNF: 'dd-mm-yyyy' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, dateNF: 'dd-mm-yyyy' });

        const existingEmails = new Set(contacts.map(c => c.email.toLowerCase()));
        const validContacts: Partial<NurturingContact>[] = [];
        const errors: string[] = [];

        // Define allowed status values (update based on check constraint)
        const allowedStatuses = ['New', 'Contacted', 'Followed Up', 'Closed'];

        // Function to convert Excel serial date to YYYY-MM-DD
        const serialToDate = (serial: number): string | null => {
          const excelEpoch = new Date(1899, 11, 31); // 1899-12-31
          const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
          if (serial < 60) {
            date.setDate(date.getDate() - 1); // Adjust for Excel's 1900 leap year bug
          }
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const isoDate = `${year}-${month}-${day}`;
          const checkDate = new Date(isoDate);
          if (isNaN(checkDate.getTime()) || checkDate.getFullYear() !== year) {
            return null;
          }
          return isoDate;
        };

        jsonData.forEach((row: any, index: number) => {
          const email = row.email?.toString().trim();
          if (!email || !row.first_name || !row.last_name) {
            errors.push(`Row ${index + 2}: Missing required fields (first_name, last_name, or email)`);
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push(`Row ${index + 2}: Invalid email format (${email})`);
            return;
          }
          if (existingEmails.has(email.toLowerCase())) {
            errors.push(`Row ${index + 2}: Duplicate email (${email})`);
            return;
          }

          // Validate and convert call_back_date
          let callBackDate = row.call_back_date?.toString().trim();
          let formattedDate: string | null = null;
          if (callBackDate) {
            const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
            if (dateRegex.test(callBackDate)) {
              const [day, month, year] = callBackDate.split('-');
              const isoDate = `${year}-${month}-${day}`;
              const date = new Date(isoDate);
              if (isNaN(date.getTime()) || date.getFullYear() !== parseInt(year) || date.getMonth() + 1 !== parseInt(month) || date.getDate() !== parseInt(day)) {
                errors.push(`Row ${index + 2}: Invalid date value (${callBackDate})`);
                return;
              }
              formattedDate = isoDate;
            } else if (!isNaN(parseFloat(callBackDate)) && parseFloat(callBackDate) > 0) {
              const serial = parseFloat(callBackDate);
              const isoDate = serialToDate(serial);
              if (isoDate) {
                formattedDate = isoDate;
              } else {
                errors.push(`Row ${index + 2}: Invalid Excel serial date (${callBackDate})`);
                return;
              }
            } else {
              errors.push(`Row ${index + 2}: Invalid date format for call_back_date (${callBackDate}). Use DD-MM-YYYY (e.g., 01-09-2025).`);
              return;
            }
          }

          // Validate status
          let status = row.status?.toString().trim();
          if (!status) {
            status = 'New'; // Default to 'New' if empty
          } else {
            // Normalize status case (e.g., 'new' → 'New')
            const normalizedStatus = allowedStatuses.find(s => s.toLowerCase() === status.toLowerCase());
            if (!normalizedStatus) {
              errors.push(`Row ${index + 2}: Invalid status value (${status}). Must be one of: ${allowedStatuses.join(', ')}`);
              return;
            }
            status = normalizedStatus; // Use normalized case
          }

          const needsMonthlyAppraisals = row.needs_monthly_appraisals?.toString().toLowerCase() === 'yes' ||
                                        row.needs_monthly_appraisals === true ||
                                        row.needs_monthly_appraisals === 1;

          validContacts.push({
            first_name: row.first_name?.toString().trim() || '',
            last_name: row.last_name?.toString().trim() || '',
            email: email,
            phone_number: row.phone_number?.toString().trim() || '',
            mobile: row.mobile?.toString().trim() || '',
            street_number: row.street_number?.toString().trim() || '',
            street_name: row.street_name?.toString().trim() || '',
            suburb: row.suburb?.toString().trim() || '',
            postcode: row.postcode?.toString().trim() || '',
            house_type: row.house_type?.toString().trim() || '',
            requirements: row.requirements?.toString().trim() || '',
            notes: row.notes?.toString().trim() || '',
            call_back_date: formattedDate,
            needs_monthly_appraisals: needsMonthlyAppraisals,
            status: status,
            agent_id: user.id,
          });
        });

        if (errors.length > 0) {
          toast.error(`Some rows could not be imported:\n${errors.join('\n')}`, {
            autoClose: 10000,
          });
        }

        if (validContacts.length === 0) {
          toast.info('No valid contacts to import');
          setLoading(false);
          return;
        }

        const { data: importedData, error } = await supabase
          .from('nurturing_list')
          .insert(validContacts)
          .select<unknown, NurturingContact>();

        if (error) throw new Error(`Failed to import Excel contacts: ${error.message}`);

        const updatedContacts = [...contacts, ...importedData].sort((a, b) =>
          `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`)
        );
        setContacts(updatedContacts);
        setExcelFile(null);
        resetForm();
        toast.success(`${validContacts.length} contacts imported successfully from Excel`);
      } catch (err: any) {
        toast.error(`Error processing Excel file: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      toast.error('Error reading Excel file');
      setLoading(false);
    };
    reader.readAsArrayBuffer(excelFile);
  } catch (err: any) {
    toast.error(`Error importing Excel contacts: ${err.message}`);
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
    setExcelFile(null);
    setIsEditMode(false);
    setIsViewMode(false);
    setSelectedContact(null);
  };

  const handleSelectContact = (id: string) => {
    setSelectedContactIds(prev =>
      prev.includes(id) ? prev.filter(contactId => contactId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedContactIds([]);
      setSelectAll(false);
    } else {
      setSelectedContactIds(contacts.map(contact => contact.id));
      setSelectAll(true);
    }
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

  const handleViewSavedTasks = () => {
    setShowTasks(!showTasks);
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
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 flex items-center">
            <span className="mr-2">📋</span> Nurturing List
          </h2>
          <div className="flex items-center space-x-4">
            <motion.button
              onClick={handleViewSavedTasks}
              className="py-2 px-4 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Saved Tasks
            </motion.button>
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
              <motion.button
                onClick={() => setMode('excel')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${mode === 'excel' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'} hover:bg-indigo-500 hover:text-white transition-all`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Import Excel
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
            {mode === 'excel' && (
              <div className="mb-4">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Upload Excel File"
                />
                <motion.button
                  onClick={handleExcelImport}
                  className={`mt-4 w-full py-3 px-4 rounded-lg text-white text-sm font-medium ${
                    loading || !excelFile ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                  } transition-all flex items-center justify-center`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={loading || !excelFile}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Import Excel File
                </motion.button>
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
                <div className="md:col-span-2">
                  <textarea
                    name="notes"
                    value={newContact.notes || ''}
                    onChange={handleInputChange}
                    placeholder="Notes"
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-full"
                    rows={4}
                    aria-label="Notes"
                    disabled={isViewMode}
                  />
                  {isEditMode && selectedContact?.notes && (
                    <div className="mt-2 p-3 bg-gray-100 rounded-lg text-sm">
                      <p className="font-medium text-gray-700">Previous Notes:</p>
                      <p className="text-gray-600">{selectedContact.notes}</p>
                    </div>
                  )}
                </div>
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
        <AnimatePresence>
          {showTasks && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTasks(false)}
            >
              <motion.div
                className="contact-list bg-white p-6 rounded-xl shadow-md border border-gray-200 w-[794px] max-h-[80vh] overflow-y-auto"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-gray-800">Saved Tasks</h3>
                  <motion.button
                    onClick={() => setShowTasks(false)}
                    className="py-2 px-4 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Close
                  </motion.button>
                </div>
                {contacts.length === 0 && !error && (
                  <p className="text-gray-500 text-center py-4 text-sm">No tasks found. Add a task to start your list.</p>
                )}
                {contacts.length > 0 && (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center space-x-4">
                        {(profile?.role === 'agent' || profile?.role === 'admin') && (
                          <>
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={handleSelectAll}
                                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                              <span className="text-sm text-gray-600">Select All</span>
                            </label>
                            <motion.button
                              onClick={handleBulkDelete}
                              className="py-2 px-4 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              disabled={selectedContactIds.length === 0}
                            >
                              Delete Selected
                            </motion.button>
                            <motion.button
                              onClick={handleDeleteAll}
                              className="py-2 px-4 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Delete All Tasks
                            </motion.button>
                            <motion.button
                              onClick={handleDownloadAllTasks}
                              className="py-2 px-4 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              Download All Tasks
                            </motion.button>
                          </>
                        )}
                      </div>
                    </div>
                    {contacts.map((contact) => (
                      <motion.div
                        key={contact.id}
                        className="bg-white p-4 rounded-lg border border-gray-100 mb-4"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        layout
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {(profile?.role === 'agent' || profile?.role === 'admin') && (
                              <input
                                type="checkbox"
                                checked={selectedContactIds.includes(contact.id)}
                                onChange={() => handleSelectContact(contact.id)}
                                className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                            )}
                            <input
                              type="checkbox"
                              checked={contact.status === 'Closed'}
                              onChange={() => {
                                setIsEditMode(true);
                                setSelectedContact(contact);
                                setNewContact({
                                  ...contact,
                                  status: contact.status === 'Closed' ? 'New' : 'Closed',
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
                                  title="Download Task PDF"
                                >
                                  <Download className="w-4 h-4" />
                                </motion.button>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div>
                            <p><span className="font-medium">Email:</span> {contact.email}</p>
                            {contact.phone_number && (
                              <p><span className="font-medium">Phone:</span> {contact.phone_number}</p>
                            )}
                            <p><span className="font-medium">Mobile:</span> {contact.mobile || 'N/A'}</p>
                            <p>
                              <span className="font-medium">Address:</span>{' '}
                              {contact.street_number && contact.street_name
                                ? `${contact.street_number} ${contact.street_name}`
                                : 'N/A'}
                            </p>
                            <p><span className="font-medium">Suburb:</span> {contact.suburb || 'N/A'}</p>
                            <p><span className="font-medium">Postcode:</span> {contact.postcode || 'N/A'}</p>
                            <p><span className="font-medium">House Type:</span> {contact.house_type || 'N/A'}</p>
                            <p>
                              <span className="font-medium">Call Back:</span>{' '}
                              {contact.call_back_date
                                ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p><span className="font-medium">Appraisals:</span> {contact.needs_monthly_appraisals ? 'Yes' : 'No'}</p>
                            <div
                              className="cursor-pointer hover:bg-gray-100 p-2 rounded"
                              onClick={() => {
                                if (profile?.role === 'agent' || profile?.role === 'admin') {
                                  setIsEditMode(true);
                                  setSelectedContact(contact);
                                  setNewContact(contact);
                                  setHasPhoneNumber(contact.phone_number ? 'Yes' : 'No');
                                  setMode('manual');
                                  setShowTasks(false);
                                }
                              }}
                            >
                              <p className="font-medium">Notes:</p>
                              <p className="text-gray-600 whitespace-pre-wrap">{contact.notes || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}