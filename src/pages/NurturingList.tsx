
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, X, Check, Edit, Download, Search, Eye, Trash, Upload } from 'lucide-react';
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
  priority: 'hot' | 'warm' | 'cold' | null;
  agent_id: string;
}

interface BasicContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
}

interface Agent {
  id: string;
  name: string; // Changed from username to name
}

export function NurturingList() {
  const [contacts, setContacts] = useState<NurturingContact[]>([]);
  const [availableContacts, setAvailableContacts] = useState<BasicContact[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
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
    status: 'Inprogress',
    priority: 'warm',
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
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'completed' | 'ongoing' | 'progress'>('all');
  const [sortBy, setSortBy] = useState<'newToOld' | 'oldToNew' | 'dueSoon'>('newToOld');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState('');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);

  const houseTypeOptions = [
    { value: '', label: 'Select House Type' },
    { value: 'house', label: 'House' },
    { value: 'acreage', label: 'Acreage' },
    { value: 'apartment', label: 'Apartment' },
    { value: 'land', label: 'Land' },
    { value: 'commercial', label: 'Commercial' },
  ];

  const priorityOptions = [
    { value: 'hot', label: 'Hot 🔥', emoji: '🔥' },
    { value: 'warm', label: 'Warm ☀️', emoji: '☀️' },
    { value: 'cold', label: 'Cold ❄️', emoji: '❄️' },
  ];

  useEffect(() => {
    if (!user || !profile) {
      setError('User not authenticated');
      toast.error('User not authenticated');
      return;
    }

    const fetchAvailableContacts = async () => {
      try {
        const { data, error } = await supabase.from('contacts').select('id, first_name, last_name, email, phone_number');
        if (error) throw new Error(`Failed to fetch available contacts: ${error.message}`);
        setAvailableContacts(data || []);
      } catch (err: any) {
        setError(`Error fetching available contacts: ${err.message}`);
        toast.error(`Error fetching available contacts: ${err.message}`);
      }
    };

    const fetchAgents = async () => {
      if (profile.role === 'admin') {
        const { data, error } = await supabase.from('profiles').select('id, name').in('role', ['admin', 'agent']);
        if (error) throw error;
        setAgents(data || []);
      }
    };

    const fetchNurturingContacts = async () => {
      setLoading(true);
      try {
        let query = supabase.from('nurturing_list').select('*');
        if (profile.role !== 'admin') {
          query = query.eq('agent_id', user.id);
        } else if (selectedAgent && selectedAgent !== 'all') {
          query = query.eq('agent_id', selectedAgent);
        }
        const { data, error } = await query;
        if (error) throw new Error(`Failed to fetch nurturing contacts: ${error.message}`);
        setContacts(data || []);
      } catch (err: any) {
        setError(`Error fetching nurturing contacts: ${err.message}`);
        toast.error(`Error fetching nurturing contacts: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableContacts();
    fetchAgents();
    setSelectedAgent(profile.role === 'admin' ? 'all' : user.id);
    fetchNurturingContacts();

    const reminderInterval = setInterval(() => {
      // Reminders are handled in UI
    }, 1000 * 60 * 60);

    return () => clearInterval(reminderInterval);
  }, [profile, user, selectedAgent]);

  const getReminder = (contact: NurturingContact) => {
    if (contact.status === 'Closed') return 'Completed';
    if (!contact.call_back_date) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(contact.call_back_date);
    due.setHours(0, 0, 0, 0);
    const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today is your task';
    if (diff > 0) return `${diff} days to go`;
    return `Overdue by ${-diff} days`;
  };

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
          ...newContact,
          phone_number: hasPhoneNumber === 'Yes' ? (newContact.phone_number || '') : '',
          agent_id: profile?.role === 'admin' && selectedAgent !== 'all' ? selectedAgent : user.id,
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
          ...newContact,
          phone_number: hasPhoneNumber === 'Yes' ? (newContact.phone_number || '') : '',
        })
        .eq('id', selectedContact.id)
        .eq('agent_id', profile?.role === 'admin' && selectedAgent !== 'all' ? selectedAgent : user.id)
        .select();
      if (error) throw new Error(`Failed to update contact: ${error.message}`);
      if (!data || data.length === 0) throw new Error('No contact was updated.');
      setContacts(contacts.map(c => c.id === selectedContact.id ? data[0] : c));
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
        .eq('agent_id', profile?.role === 'admin' && selectedAgent !== 'all' ? selectedAgent : user?.id);
      if (error) throw new Error(`Failed to delete contact: ${error.message}`);
      setContacts(contacts.filter(c => c.id !== id));
      setSelectedContactIds(selectedContactIds.filter(cid => cid !== id));
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
        .eq('agent_id', profile?.role === 'admin' && selectedAgent !== 'all' ? selectedAgent : user?.id);
      if (error) throw new Error(`Failed to delete contacts: ${error.message}`);
      setContacts(contacts.filter(c => !selectedContactIds.includes(c.id)));
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
        .eq('agent_id', profile?.role === 'admin' && selectedAgent !== 'all' ? selectedAgent : user?.id);
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
      case 'Inprogress':
        return [219, 234, 254, 0.8]; // Blue for In Progress
      case 'Not interested':
        return [254, 202, 202, 0.8]; // Red for Not Interested
      case 'Undecided':
        return [252, 231, 243, 0.8]; // Pink for Undecided
      case 'Will list':
        return [199, 210, 254, 0.8]; // Indigo for Will List
      case 'Closed':
        return [209, 250, 229, 0.8]; // Green for Closed
      default:
        return [243, 244, 246, 0.8]; // Gray for default
    }
  };
  const getPriorityBadgeClass = (priority: string | null) => {
    switch (priority) {
      case 'hot':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warm':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'cold':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityEmoji = (priority: string | null) => {
    switch (priority) {
      case 'hot':
        return '🔥';
      case 'warm':
        return '☀️';
      case 'cold':
        return '❄️';
      default:
        return '⚪';
    }
  };

    const handleDownloadPDF = (contact: NurturingContact) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      
      // Set blue theme colors
      const primaryColor = [14, 105, 203]; // Deep blue
      const secondaryColor = [227, 239, 255]; // Light blue background
      const accentColor = [66, 153, 225]; // Medium blue
      
      // Add header with blue background
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Header text
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('Contact Details', margin, 25);
      
      // Contact name
      doc.setFontSize(16);
      doc.text(`${contact.first_name} ${contact.last_name}`, pageWidth - margin, 25, { align: 'right' });
      
      let y = 50;
      
      // Add decorative element
      doc.setDrawColor(...accentColor);
      doc.setLineWidth(0.5);
      doc.line(margin, y - 5, pageWidth - margin, y - 5);
      
      // Create two-column layout with blue accents
      const leftColumnX = margin;
      const rightColumnX = pageWidth / 2 + 5;
      const rowHeight = 8;
      
      // Set background for content area
      doc.setFillColor(...secondaryColor);
      doc.rect(margin, y, contentWidth, 120, 'F');
      
      // Contact information
      doc.setFontSize(12);
      doc.setTextColor(...primaryColor);
      doc.setFont(undefined, 'bold');
      doc.text('CONTACT INFORMATION', margin + 5, y + 10);
      
      doc.setDrawColor(...accentColor);
      doc.line(margin + 5, y + 12, margin + 60, y + 12);
      
      y += 20;
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
      
      // Left column details
      doc.text(`Email: ${contact.email || 'N/A'}`, leftColumnX + 5, y);
      doc.text(`Phone: ${contact.phone_number || 'N/A'}`, leftColumnX + 5, y + rowHeight);
      doc.text(`Mobile: ${contact.mobile || 'N/A'}`, leftColumnX + 5, y + rowHeight * 2);
      
      // Right column details
      doc.text(`Status: ${contact.status || 'N/A'}`, rightColumnX, y);
      doc.text(`Priority: ${contact.priority ? contact.priority.charAt(0).toUpperCase() + contact.priority.slice(1) : 'N/A'} ${getPriorityEmoji(contact.priority)}`, rightColumnX, y + rowHeight);
      doc.text(`Call Back: ${contact.call_back_date ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`, rightColumnX, y + rowHeight * 2);
      
      y += 30;
      
      // Address section
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('ADDRESS DETAILS', margin + 5, y);
      
      doc.setDrawColor(...accentColor);
      doc.line(margin + 5, y + 2, margin + 70, y + 2);
      
      y += 10;
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Street: ${contact.street_number || ''} ${contact.street_name || ''}`, margin + 5, y);
      doc.text(`Suburb: ${contact.suburb || 'N/A'}`, margin + 5, y + rowHeight);
      doc.text(`Postcode: ${contact.postcode || 'N/A'}`, margin + 5, y + rowHeight * 2);
      doc.text(`House Type: ${contact.house_type || 'N/A'}`, margin + 5, y + rowHeight * 3);
      
      y += 25;
      
      // Additional information
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...primaryColor);
      doc.text('ADDITIONAL INFORMATION', margin + 5, y);
      
      doc.setDrawColor(...accentColor);
      doc.line(margin + 5, y + 2, margin + 110, y + 2);
      
      y += 10;
      
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      // Requirements with proper text wrapping
      const requirements = contact.requirements || 'N/A';
      const splitRequirements = doc.splitTextToSize(`Requirements: ${requirements}`, contentWidth - 10);
      doc.text(splitRequirements, margin + 5, y);
      y += rowHeight * splitRequirements.length;
      
      // Monthly appraisals
      doc.text(`Monthly Appraisals: ${contact.needs_monthly_appraisals ? 'Yes' : 'No'}`, margin + 5, y);
      
      y += 15;
      
      // Notes section with blue background
      if (contact.notes) {
        doc.setFillColor(...secondaryColor);
        const notesHeight = 40;
        doc.rect(margin, y, contentWidth, notesHeight, 'F');
        
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('NOTES', margin + 5, y + 8);
        
        doc.setDrawColor(...accentColor);
        doc.line(margin + 5, y + 10, margin + 30, y + 10);
        
        const notes = contact.notes;
        const splitNotes = doc.splitTextToSize(notes, contentWidth - 10);
        doc.setFont(undefined, 'normal');
        doc.setTextColor(0, 0, 0);
        doc.text(splitNotes, margin + 5, y + 15);
        
        y += notesHeight + 5;
      } else {
        // Add empty notes section
        doc.setFillColor(...secondaryColor);
        doc.rect(margin, y, contentWidth, 20, 'F');
        
        doc.setFont(undefined, 'bold');
        doc.setTextColor(...primaryColor);
        doc.text('NOTES', margin + 5, y + 8);
        
        doc.setDrawColor(...accentColor);
        doc.line(margin + 5, y + 10, margin + 30, y + 10);
        
        doc.setFont(undefined, 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text('No notes available', margin + 5, y + 15);
        
        y += 25;
      }
      
      // Footer
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.setFillColor(...primaryColor);
      doc.rect(0, footerY, pageWidth, 15, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, margin, footerY + 10);
      doc.text('Nurturing List Management System', pageWidth - margin, footerY + 10, { align: 'right' });
      
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
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - 2 * margin;
      
      // Set blue theme colors
      const primaryColor = [14, 105, 203];
      const secondaryColor = [227, 239, 255];
      const accentColor = [66, 153, 225];
      
      // Add header
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.text('All Nurturing Tasks', margin, 25);
      
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, pageWidth - margin, 25, { align: 'right' });
      doc.text(`Total Tasks: ${contacts.length}`, pageWidth - margin, 35, { align: 'right' });
      
      let y = 50;
      
      contacts.forEach((contact, index) => {
        if (y > 250) {
          doc.addPage();
          y = 20;
          
          // Add header to new page
          doc.setFillColor(...primaryColor);
          doc.rect(0, 0, pageWidth, 40, 'F');
          doc.setFontSize(20);
          doc.setTextColor(255, 255, 255);
          doc.setFont(undefined, 'bold');
          doc.text('All Nurturing Tasks (Continued)', margin, 25);
          y = 50;
        }
        
        // Calculate height needed for this contact card
        const notes = contact.notes || '';
        const splitNotes = notes ? doc.splitTextToSize(notes, contentWidth - 10) : [];
        const notesHeight = splitNotes.length * 5;
        const cardHeight = 70 + (notes ? Math.max(notesHeight - 15, 0) : 0);
        
        // Contact card with blue background
        doc.setFillColor(...secondaryColor);
        doc.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'F');
        
        doc.setDrawColor(...accentColor);
        doc.roundedRect(margin, y, contentWidth, cardHeight, 3, 3, 'S');
        
        // Contact name and status
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.setFont(undefined, 'bold');
        doc.text(`${contact.first_name} ${contact.last_name}`, margin + 5, y + 10);
        
        // Status badge
        const status = contact.status || 'New';
        const statusWidth = doc.getTextWidth(status) + 8;
        doc.setFillColor(...primaryColor);
        doc.roundedRect(margin + contentWidth - statusWidth - 5, y + 5, statusWidth, 8, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(status, margin + contentWidth - statusWidth/2 - 5, y + 9, { align: 'center' });
        
        y += 15;
        
        // Contact details
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        doc.text(`Email: ${contact.email || 'N/A'}`, margin + 5, y + 10);
        doc.text(`Phone: ${contact.phone_number || 'N/A'}`, margin + 5, y + 20);
        doc.text(`Priority: ${contact.priority || 'N/A'} ${getPriorityEmoji(contact.priority)}`, margin + 5, y + 30);
        
        doc.text(`Call Back: ${contact.call_back_date ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`, margin + contentWidth/2, y + 10);
        doc.text(`Status: ${contact.status || 'N/A'}`, margin + contentWidth/2, y + 20);
        doc.text(`Appraisals: ${contact.needs_monthly_appraisals ? 'Yes' : 'No'}`, margin + contentWidth/2, y + 30);
        
        y += 40;
        
        // Add notes section if available
        if (notes) {
          doc.setFont(undefined, 'bold');
          doc.setTextColor(...primaryColor);
          doc.text('Notes:', margin + 5, y);
          
          doc.setFont(undefined, 'normal');
          doc.setTextColor(0, 0, 0);
          doc.text(splitNotes, margin + 5, y + 5);
          
          y += splitNotes.length * 5 + 10;
        }
        
        // Add separator if not last contact
        if (index < contacts.length - 1) {
          doc.setDrawColor(...accentColor);
          doc.setLineWidth(0.3);
          doc.line(margin, y, pageWidth - margin, y);
          y += 10;
        }
      });
      
      // Add footer to last page
      const footerY = doc.internal.pageSize.getHeight() - 15;
      doc.setFillColor(...primaryColor);
      doc.rect(0, footerY, pageWidth, 15, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, margin, footerY + 10);
      doc.text('Nurturing List Management System', pageWidth - margin, footerY + 10, { align: 'right' });
      
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
        status: 'Inprogress',
        priority: 'warm',
        agent_id: profile?.role === 'admin' && selectedAgent !== 'all' ? selectedAgent : user.id,
      }));
      const { data, error } = await supabase.from('nurturing_list').insert(importData).select();
      if (error) throw new Error(`Failed to import contacts: ${error.message}`);
      setContacts([...contacts, ...data]);
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
          const allowedStatuses = [ 'Inprogress', 'Not interested','undecided' ,'will list','Closed'];
          const allowedPriorities = ['hot', 'warm', 'cold'];
          const serialToDate = (serial: number): string | null => {
            const excelEpoch = new Date(1899, 11, 31);
            const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
            if (serial < 60) {
              date.setDate(date.getDate() - 1);
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
            let status = row.status?.toString().trim();
            if (!status) {
              status = 'New';
            } else {
              const normalizedStatus = allowedStatuses.find(s => s.toLowerCase() === status.toLowerCase());
              if (!normalizedStatus) {
                errors.push(`Row ${index + 2}: Invalid status value (${status}). Must be one of: ${allowedStatuses.join(', ')}`);
                return;
              }
              status = normalizedStatus;
            }
            let priority = row.priority?.toString().trim().toLowerCase();
            if (!priority) {
              priority = 'warm';
            } else {
              const normalizedPriority = allowedPriorities.find(p => p.toLowerCase() === priority.toLowerCase());
              if (!normalizedPriority) {
                errors.push(`Row ${index + 2}: Invalid priority value (${priority}). Must be one of: ${allowedPriorities.join(', ')}`);
                return;
              }
              priority = normalizedPriority;
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
              priority: priority as 'hot' | 'warm' | 'cold',
              agent_id: profile?.role === 'admin' && selectedAgent !== 'all' ? selectedAgent : user.id,
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
          setContacts([...contacts, ...importedData]);
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
      priority: 'warm',
    });
    setHasPhoneNumber(basic.phone_number ? 'Yes' : 'No');
    setMode('manual');
  };

  const resetForm = () => {
    setNewContact({
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
      status: 'Inprogress',
      priority: 'warm',
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
      setSelectedContactIds(filteredContacts.map(contact => contact.id));
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
      case 'Inprogress':
        return 'bg-blue-100 text-blue-800';
      case 'Not interested':
        return 'bg-red-100 text-red-800';
      case 'Undecided':
        return 'bg-pink-100 text-pink-800';
      case 'Will list':
        return 'bg-indigo-100 text-indigo-800';
      case 'Closed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewSavedTasks = () => {
    setShowTasks(!showTasks);
    setTaskSearchQuery('');
    setTaskFilter('all');
    setShowCompletedTasks(false);
  };

  let filteredContacts = contacts.filter(c =>
    (`${c.first_name} ${c.last_name}`.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
     c.email.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
     c.notes?.toLowerCase().includes(taskSearchQuery.toLowerCase()) ||
     c.requirements?.toLowerCase().includes(taskSearchQuery.toLowerCase()))
  );

  if (taskFilter !== 'all') {
    if (taskFilter === 'completed') {
      filteredContacts = filteredContacts.filter(c => c.status === 'Closed');
    } else if (taskFilter === 'ongoing') {
      filteredContacts = filteredContacts.filter(c => c.status === 'Inprogress' || c.status === 'Undecided' || c.status === 'Will list');
    } else if (taskFilter === 'progress') {
      filteredContacts = filteredContacts.filter(c => c.status === 'Inprogress');
    }
  }

  if (showCompletedTasks) {
    filteredContacts = filteredContacts.filter(c => c.status === 'Closed');
  }

  let sortedContacts = [...filteredContacts];
  if (sortBy === 'newToOld') {
    sortedContacts.sort((a, b) => b.id.localeCompare(a.id));
  } else if (sortBy === 'oldToNew') {
    sortedContacts.sort((a, b) => a.id.localeCompare(b.id));
  } else if (sortBy === 'dueSoon') {
    sortedContacts.sort((a, b) => {
      const dateA = a.call_back_date ? new Date(a.call_back_date).getTime() : Infinity;
      const dateB = b.call_back_date ? new Date(b.call_back_date).getTime() : Infinity;
      return dateA - dateB;
    });
  }

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
                {profile?.role === 'admin' && (
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm md:col-span-2"
                    disabled={isViewMode}
                  >
                    <option value="all">All Agents</option>
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                )}
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
                  <option value="Inprogress">In Progress</option>
                  <option value="Not interested">Not Interested</option>
                  <option value="Undecided">Undecided</option>
                  <option value="Will list">Will List</option>
                  <option value="Closed">Closed</option>
                </select>
                <select
                  name="priority"
                  value={newContact.priority || 'warm'}
                  onChange={handleInputChange}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Priority"
                  disabled={isViewMode}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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
                className="contact-list bg-white p-6 rounded-xl shadow-md border border-gray-200 w-full max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-auto"
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
                <div className="mb-4 flex space-x-4 items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={taskSearchQuery}
                      onChange={(e) => setTaskSearchQuery(e.target.value)}
                      placeholder="Search tasks by name, email, notes, or requirements..."
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent pl-10"
                    />
                    <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  </div>
                  <select
                    value={taskFilter}
                    onChange={(e) => {
                      setTaskFilter(e.target.value as typeof taskFilter);
                      setShowCompletedTasks(e.target.value === 'completed');
                    }}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="all">All Tasks</option>
                    <option value="progress">In Progress</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="newToOld">New to Old</option>
                    <option value="oldToNew">Old to New</option>
                    <option value="dueSoon">Due Soon</option>
                  </select>
                  {profile?.role === 'admin' && (
                    <select
                      value={selectedAgent}
                      onChange={(e) => setSelectedAgent(e.target.value)}
                      className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    >
                      <option value="all">All Agents</option>
                      {agents.map(agent => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  )}
                  <motion.button
                    onClick={() => setShowCompletedTasks(!showCompletedTasks)}
                    className={`p-2 ${showCompletedTasks ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800'} rounded-lg hover:bg-green-200`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    title="Toggle Completed Tasks"
                  >
                    <Check className="w-4 h-4" />
                  </motion.button>
                </div>
                {sortedContacts.length === 0 && !error && (
                  <p className="text-gray-500 text-center py-4 text-sm">No tasks found.</p>
                )}
                {sortedContacts.length > 0 && (
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
                    <table className="min-w-full divide-y divide-gray-200 bg-white">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Select</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">House Type</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call Back</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reminder</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Appraisals</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requirements</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                          {profile?.role === 'admin' && (
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                          )}
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedContacts.map((contact) => (
                          <motion.tr
                            key={contact.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedContactIds.includes(contact.id)}
                                onChange={() => handleSelectContact(contact.id)}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
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
                                  setShowTasks(false);
                                }}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {contact.first_name} {contact.last_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.phone_number || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.mobile || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {contact.street_number && contact.street_name
                                ? `${contact.street_number} ${contact.street_name}, ${contact.suburb || ''} ${contact.postcode || ''}`
                                : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{contact.house_type || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {contact.call_back_date
                                ? new Date(contact.call_back_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
                                : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-500">{getReminder(contact)}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <motion.span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityBadgeClass(contact.priority)}`}
                                animate={{
                                  scale: contact.priority === 'hot' ? [1, 1.1, 1] : 1,
                                  transition: contact.priority === 'hot' ? { repeat: Infinity, duration: 1.5 } : {}
                                }}
                              >
                                {getPriorityEmoji(contact.priority)} {contact.priority ? contact.priority.charAt(0).toUpperCase() + contact.priority.slice(1) : 'N/A'}
                              </motion.span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClass(contact.status)}`}>
                                {contact.status || 'New'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {contact.needs_monthly_appraisals ? 'Yes' : 'No'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {(contact.requirements || 'N/A').substring(0, 50) + (contact.requirements && contact.requirements.length > 50 ? '...' : '')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              <div className="flex items-center space-x-2">
                                <span>{(contact.notes || 'N/A').substring(0, 50) + (contact.notes && contact.notes.length > 50 ? '...' : '')}</span>
                                {contact.notes && contact.notes.length > 50 && (
                                  <motion.button
                                    onClick={() => {
                                      setSelectedNotes(contact.notes || 'N/A');
                                      setShowNotesModal(true);
                                    }}
                                    className="p-1 text-gray-500 hover:text-blue-600"
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    title="View Notes"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </motion.button>
                                )}
                              </div>
                            </td>
                            {profile?.role === 'admin' && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {agents.find(a => a.id === contact.agent_id)?.name || 'N/A'}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2">
                                <motion.button
                                  onClick={() => handleViewContact(contact)}
                                  className="text-gray-500 hover:text-blue-600"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  title="View Task"
                                >
                                  <Eye className="w-5 h-5" />
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
                                        setShowTasks(false);
                                      }}
                                      className="text-gray-500 hover:text-indigo-600"
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      title="Edit Task"
                                    >
                                      <Edit className="w-5 h-5" />
                                    </motion.button>
                                    <motion.button
                                      onClick={() => handleDeleteContact(contact.id)}
                                      className="text-gray-500 hover:text-red-600"
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      title="Delete Task"
                                    >
                                      <Trash className="w-5 h-5" />
                                    </motion.button>
                                    <motion.button
                                      onClick={() => handleDownloadPDF(contact)}
                                      className="text-gray-500 hover:text-green-600"
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      title="Download Task PDF"
                                    >
                                      <Download className="w-5 h-5" />
                                    </motion.button>
                                  </>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
          {showNotesModal && (
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNotesModal(false)}
            >
              <motion.div
                className="bg-white p-6 rounded-xl shadow-md border border-gray-200 max-w-md w-full"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">Notes</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{selectedNotes}</p>
                <motion.button
                  onClick={() => setShowNotesModal(false)}
                  className="mt-4 py-2 px-4 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 w-full"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Close
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
