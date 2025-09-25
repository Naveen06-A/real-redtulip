import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronUp, Download, Edit2, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { formatCurrency, normalizeSuburb } from '../reportsUtils';
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
interface Contact {
  id?: string;
  owner_1: string;
  owner_2: string;
  owner_1_email: string;
  owner_2_email: string;
  phone_number: string;
  owner_1_mobile: string;
  owner_2_mobile: string;
  outcome: string;
  street_name: string | null;
  street_number: string | null;
  suburb?: string;
  status: string;
  last_sold_date: string | null;
  price: number | null;
  marketing_plan: string;
  activity_log: string;
}
interface StreetStats {
  street_name: string;
  listed_count: number;
  sold_count: number;
  total_properties: number;
  average_sold_price: number | null;
  properties: Property[];
  contacts: Contact[];
}
interface StreetSuggestionsProps {
  suburb: string | null;
  soldPropertiesFilter: string;
  onSelectStreet: (street: { name: string }, type: 'door_knock' | 'phone_call') => void;
  onRemoveStreet?: (street: { name: string }, type: 'door_knock' | 'phone_call') => void;
  existingDoorKnocks?: { name: string }[];
  existingPhoneCalls?: { name: string }[];
}
export function StreetSuggestions({
  suburb,
  soldPropertiesFilter,
  onSelectStreet,
  onRemoveStreet,
  existingDoorKnocks = [],
  existingPhoneCalls = [],
}: StreetSuggestionsProps) {
  const [streetStats, setStreetStats] = useState<StreetStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFilter, setLocalFilter] = useState(soldPropertiesFilter);
  const [expandedStreet, setExpandedStreet] = useState<string | null>(null);
  const [addedStreets, setAddedStreets] = useState<{
    [key: string]: { door_knock: number; phone_call: number; contacts: number };
  }>({});
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedStreet, setSelectedStreet] = useState<string | null>(null);
  const [modalView, setModalView] = useState<'add' | 'list'>('add');
  const [newContact, setNewContact] = useState<Contact>({
    id: '',
    owner_1: '',
    owner_2: '',
    owner_1_email: '',
    owner_2_email: '',
    phone_number: '',
    owner_1_mobile: '',
    owner_2_mobile: '',
    outcome: '',
    street_name: null,
    street_number: null,
    suburb: '',
    status: '',
    last_sold_date: null,
    price: null,
    marketing_plan: '',
    activity_log: '',
  });
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSuccess, setContactSuccess] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isGlobalImportOpen, setIsGlobalImportOpen] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [showConfirmDeleteSelected, setShowConfirmDeleteSelected] = useState(false);
  useEffect(() => {
    setLocalFilter(soldPropertiesFilter);
  }, [soldPropertiesFilter]);
  const excelSerialToDate = (serial: number | string | null | undefined): string | null => {
    if (!serial || serial === 'NA' || serial === '' || serial === null || serial === undefined) return null;
    if (typeof serial === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(serial)) {
      const datePart = serial.split(' ')[0];
      const date = new Date(datePart);
      return isNaN(date.getTime()) ? null : datePart;
    }
    if (typeof serial === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(serial)) {
      const parts = serial.split('-');
      const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
      const date = new Date(formattedDate);
      return isNaN(date.getTime()) ? null : formattedDate;
    }
    if (typeof serial === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(serial)) {
      const date = new Date(serial);
      return isNaN(date.getTime()) ? null : serial;
    }
    if (typeof serial === 'number') {
      const excelEpoch = new Date(1900, 0, 1);
      const days = serial > 59 ? serial - 1 : serial;
      const date = new Date(excelEpoch.getTime() + (days - 2) * 24 * 60 * 60 * 1000);
      return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
    }
    const serialNum = typeof serial === 'string' ? parseFloat(serial) : serial;
    if (isNaN(serialNum)) return null;
    const excelEpoch = new Date(1900, 0, 1);
    const days = serialNum > 59 ? serialNum - 1 : serialNum;
    const date = new Date(excelEpoch.getTime() + (days - 2) * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  };
  const normalizeKey = (key: string): string => {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
  };
  const normalizeRow = (row: any, headerMap: { [key: string]: string }): any => {
    const normalized: any = {};
    const standardKeys = [
      'owner_1',
      'owner_2',
      'owner_1_email',
      'owner_2_email',
      'phone_number',
      'owner_1_mobile',
      'owner_2_mobile',
      'outcome',
      'street_name',
      'street_number',
      'suburb',
      'status',
      'last_sold_date',
      'price',
      'marketing_plan',
      'activity_log',
    ];
    standardKeys.forEach((stdKey) => {
      let excelKey;
      if (stdKey === 'last_sold_date') {
        excelKey = headerMap['last_sold_date'] || 'last_sold_date';
      } else if (stdKey === 'street_number') {
        excelKey = headerMap['street_number'] || 'street_no';
      } else if (stdKey === 'owner_1_mobile') {
        excelKey = headerMap['owner_1_mobile'] || 'own1_mob';
      } else if (stdKey === 'owner_2_mobile') {
        excelKey = headerMap['owner_2_mobile'] || 'own2_mob';
      } else {
        excelKey = headerMap[stdKey] || stdKey;
      }
      let value = row[excelKey] ?? null;
      if (stdKey === 'last_sold_date') {
        value = excelSerialToDate(value);
      } else if (stdKey === 'price' && value) {
        if (typeof value === 'string') {
          value = value.replace(/[$,]/g, '');
        }
        const numValue = parseFloat(value.toString());
        value = isNaN(numValue) ? null : numValue;
      } else if (value === 'NA' || value === 'Unsure' || value === 'DNC' || value === 'DNC/unsure') {
        value = stdKey === 'price' ? null : '';
      } else if (typeof value === 'string') {
        value = value.trim();
      }
      normalized[stdKey] = value;
    });
    if (!normalized.phone_number && normalized.owner_1_mobile) {
      normalized.phone_number = normalized.owner_1_mobile;
      normalized.owner_1_mobile = '';
    }
    return normalized;
  };
  const syncAddedStreetsFromProps = useCallback(() => {
    if (streetStats.length === 0) return;
    setAddedStreets((prev) => {
      const newAdded: typeof prev = { ...prev };
      streetStats.forEach((street) => {
        const streetName = street.street_name;
        if (!newAdded[streetName]) {
          const doorKnockCount = Array.isArray(existingDoorKnocks)
            ? existingDoorKnocks.filter((s) => s.name === streetName).length
            : 0;
          const phoneCallCount = Array.isArray(existingPhoneCalls)
            ? existingPhoneCalls.filter((s) => s.name === streetName).length
            : 0;
          const contactCount = street.contacts.length;
          newAdded[streetName] = {
            door_knock: doorKnockCount,
            phone_call: phoneCallCount,
            contacts: contactCount,
          };
        } else {
          newAdded[streetName] = {
            ...newAdded[streetName],
            contacts: street.contacts.length,
          };
        }
      });
      Object.keys(newAdded).forEach((key) => {
        if (!streetStats.find((s) => s.street_name === key)) {
          delete newAdded[key];
        }
      });
      return newAdded;
    });
  }, [streetStats, existingDoorKnocks, existingPhoneCalls]);
  useEffect(() => {
    syncAddedStreetsFromProps();
  }, [syncAddedStreetsFromProps]);
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
    try {
      const normalizedInput = normalizeSuburb(suburb);
      const queryString = `%${normalizedInput.toLowerCase().split(' qld')[0]}%`;
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select(
          'id, street_name, street_number, suburb, price, sold_price, sold_date, property_type, bedrooms, bathrooms, car_garage, sqm, landsize'
        )
        .ilike('suburb', queryString);
      if (propError) throw new Error(`Failed to fetch properties: ${propError.message}`);
      if (!propertiesData || propertiesData.length === 0) {
        setError(`No properties found for ${suburb}. Please add properties to the database or check the suburb name format.`);
        setLoading(false);
        return;
      }
      const { data: contactsData, error: contactError } = await supabase
        .from('contacts')
        .select(
          'id, owner_1, owner_2, owner_1_email, owner_2_email, phone_number, owner_1_mobile, owner_2_mobile, outcome, street_name, street_number, suburb, status, last_sold_date, price, marketing_plan, activity_log'
        )
        .ilike('suburb', queryString);
      if (contactError) throw new Error(`Failed to fetch contacts: ${contactError.message}`);
      let filteredProperties = propertiesData;
      if (localFilter !== 'all') {
        const now = new Date();
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
        status: prop.sold_price || prop.sold_date ? 'Sold' : 'Listed',
      }));
      const streetMap = new Map<
        string,
        { listed: number; sold: number; total: number; totalSoldPrice: number; properties: Property[]; contacts: Contact[] }
      >();
      combinedProperties.forEach((prop) => {
        const streetName = prop.street_name?.trim() || 'Unknown Street';
        const stats =
          streetMap.get(streetName) || { listed: 0, sold: 0, total: 0, totalSoldPrice: 0, properties: [], contacts: [] };
        stats.total += 1;
        if (prop.status === 'Listed') stats.listed += 1;
        if (prop.status === 'Sold') {
          stats.sold += 1;
          if (prop.sold_price) stats.totalSoldPrice += prop.sold_price;
        }
        stats.properties.push(prop);
        streetMap.set(streetName, stats);
      });
      (contactsData || []).forEach((contact) => {
        const streetName = contact.street_name?.trim() || 'Unknown Street';
        const stats =
          streetMap.get(streetName) || { listed: 0, sold: 0, total: 0, totalSoldPrice: 0, properties: [], contacts: [] };
        stats.contacts.push({
          ...contact,
          last_sold_date: contact.last_sold_date ? excelSerialToDate(contact.last_sold_date) : null,
          marketing_plan: contact.marketing_plan || '',
          activity_log: contact.activity_log || '',
        });
        streetMap.set(streetName, stats);
      });
      const statsArray: StreetStats[] = Array.from(streetMap.entries()).map(([street_name, stats]) => ({
        street_name,
        listed_count: stats.listed,
        sold_count: stats.sold,
        total_properties: stats.total,
        average_sold_price: stats.sold > 0 ? stats.totalSoldPrice / stats.sold : null,
        properties: stats.properties,
        contacts: stats.contacts,
      }));
      statsArray.sort(
        (a, b) =>
          b.sold_count - a.sold_count ||
          b.total_properties - a.total_properties ||
          b.listed_count - a.listed_count
      );
      setStreetStats(statsArray);
      syncAddedStreetsFromProps();
    } catch (err: any) {
      setError(`Error fetching street suggestions for ${suburb}: ${err.message}`);
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [suburb, localFilter]);
  const handleAddStreet = useCallback(
    (street: StreetStats, type: 'door_knock' | 'phone_call') => {
      onSelectStreet({ name: street.street_name }, type);
      setAddedStreets((prev) => ({
        ...prev,
        [street.street_name]: {
          ...prev[street.street_name] || { door_knock: 0, phone_call: 0, contacts: street.contacts.length },
          [type]: (prev[street.street_name]?.[type] || 0) + 1,
        },
      }));
    },
    [onSelectStreet]
  );
  const handleRemoveStreet = useCallback(
    (street: StreetStats, type: 'door_knock' | 'phone_call') => {
      if (onRemoveStreet) {
        onRemoveStreet({ name: street.street_name }, type);
      }
      setAddedStreets((prev) => {
        const currentCount = prev[street.street_name]?.[type] || 0;
        if (currentCount > 0) {
          const newCount = currentCount - 1;
          const updatedStreet = {
            ...prev[street.street_name],
            [type]: newCount,
          };
          if (updatedStreet.door_knock === 0 && updatedStreet.phone_call === 0 && updatedStreet.contacts === 0) {
            const { [street.street_name]: _, ...rest } = prev;
            return rest;
          }
          return {
            ...prev,
            [street.street_name]: updatedStreet,
          };
        }
        return prev;
      });
    },
    [onRemoveStreet]
  );
  const handleAddStreetIndividual = useCallback(
    (street: StreetStats, type: 'door_knock' | 'phone_call') => {
      handleAddStreet(street, type);
    },
    [handleAddStreet]
  );
  const handleAddAllToBoth = useCallback(() => {
    setAddedStreets((prev) => {
      const newState = { ...prev };
      streetStats.forEach((street) => {
        const streetName = street.street_name;
        // Call onSelectStreet for both door_knock and phone_call
        onSelectStreet({ name: streetName }, 'door_knock');
        onSelectStreet({ name: streetName }, 'phone_call');
       
        // Update state with both counts incremented
        newState[streetName] = {
          ...prev[streetName] || { door_knock: 0, phone_call: 0, contacts: street.contacts.length },
          door_knock: (prev[streetName]?.door_knock || 0) + 1,
          phone_call: (prev[streetName]?.phone_call || 0) + 1,
        };
      });
      return newState;
    });
  }, [streetStats, onSelectStreet]);
  const handleRemoveAllToBoth = useCallback(() => {
    setAddedStreets((prev) => {
      const newState = { ...prev };
      streetStats.forEach((street) => {
        const streetName = street.street_name;
        if (newState[streetName]) {
          const current = newState[streetName];
          const doorKnockCount = current.door_knock;
          const phoneCallCount = current.phone_call;
          for (let i = 0; i < doorKnockCount; i++) {
            if (onRemoveStreet) {
              onRemoveStreet({ name: streetName }, 'door_knock');
            }
          }
          for (let i = 0; i < phoneCallCount; i++) {
            if (onRemoveStreet) {
              onRemoveStreet({ name: streetName }, 'phone_call');
            }
          }
          newState[streetName] = {
            ...current,
            door_knock: 0,
            phone_call: 0,
          };
          if (newState[streetName].contacts === 0) {
            delete newState[streetName];
          }
        }
      });
      return newState;
    });
  }, [streetStats, onRemoveStreet]);
  const handleExportContacts = () => {
    const allContacts = streetStats.flatMap(street => street.contacts.map(contact => ({
      ...contact,
      suburb: suburb,
    })));
    if (allContacts.length === 0) {
      setContactError('No contacts to export.');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(allContacts);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
    XLSX.writeFile(workbook, `${suburb}_contacts.xlsx`);
  };
  const handleAddContact = async () => {
    if (!newContact.owner_1 && !newContact.owner_2) {
      setContactError('At least one of Owner 1 or Owner 2 is required');
      return;
    }
    setLoading(true);
    try {
      const contactData = {
        owner_1: newContact.owner_1 || '',
        owner_2: newContact.owner_2 || '',
        owner_1_email: newContact.owner_1_email || '',
        owner_2_email: newContact.owner_2_email || '',
        phone_number: newContact.phone_number || '',
        owner_1_mobile: newContact.owner_1_mobile || '',
        owner_2_mobile: newContact.owner_2_mobile || '',
        outcome: newContact.outcome || '',
        street_name: selectedStreet,
        street_number: newContact.street_number || null,
        suburb,
        status: newContact.status || '',
        last_sold_date: newContact.last_sold_date ? excelSerialToDate(newContact.last_sold_date) : null,
        price: newContact.price ? parseFloat(newContact.price.toString()) : null,
        marketing_plan: newContact.marketing_plan || '',
        activity_log: newContact.activity_log || '',
      };
      if (isEditMode && newContact.id) {
        const { error } = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', newContact.id);
        if (error) throw new Error(`Failed to update contact: ${error.message}`);
        setStreetStats((prev) =>
          prev.map((street) =>
            street.street_name === selectedStreet
              ? {
                  ...street,
                  contacts: street.contacts.map((contact) =>
                    contact.id === newContact.id
                      ? { ...contactData, id: newContact.id, street_name: selectedStreet, suburb }
                      : contact
                  ),
                }
              : street
          )
        );
        setContactSuccess('Contact updated successfully');
      } else {
        const { data: insertData, error } = await supabase
          .from('contacts')
          .insert([contactData])
          .select();
        if (error) throw new Error(`Failed to add contact: ${error.message}`);
        setStreetStats((prev) =>
          prev.map((street) =>
            street.street_name === selectedStreet
              ? { ...street, contacts: [...street.contacts, insertData[0]] }
              : street
          )
        );
        setAddedStreets((prev) => ({
          ...prev,
          [selectedStreet!]: {
            ...prev[selectedStreet!] || { door_knock: 0, phone_call: 0, contacts: 0 },
            contacts: (prev[selectedStreet!]?.contacts || 0) + 1,
          },
        }));
        setContactSuccess('Contact added successfully');
      }
      setNewContact({
        id: '',
        owner_1: '',
        owner_2: '',
        owner_1_email: '',
        owner_2_email: '',
        phone_number: '',
        owner_1_mobile: '',
        owner_2_mobile: '',
        outcome: '',
        street_name: null,
        street_number: null,
        suburb: '',
        status: '',
        last_sold_date: null,
        price: null,
        marketing_plan: '',
        activity_log: '',
      });
      setContactError(null);
      setTimeout(() => setContactSuccess(null), 3000);
    } catch (err: any) {
      setContactError(`Error ${isEditMode ? 'updating' : 'adding'} contact: ${err.message}`);
    } finally {
      setLoading(false);
      setModalView('list');
    }
  };
  const handleEditContact = (contact: Contact) => {
    setNewContact({
      ...contact,
      last_sold_date: contact.last_sold_date || '',
    });
    setIsEditMode(true);
    setModalView('add');
  };
  const handleDeleteContact = async (contactId: string, streetName: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', contactId);
      if (error) throw new Error(`Failed to delete contact: ${error.message}`);
      setStreetStats((prev) =>
        prev.map((street) =>
          street.street_name === streetName
            ? { ...street, contacts: street.contacts.filter((contact) => contact.id !== contactId) }
            : street
        )
      );
      setAddedStreets((prev) => ({
        ...prev,
        [streetName]: {
          ...prev[streetName] || { door_knock: 0, phone_call: 0, contacts: 0 },
          contacts: Math.max(0, (prev[streetName]?.contacts || 1) - 1),
        },
      }));
      setContactSuccess('Contact deleted successfully');
      setTimeout(() => setContactSuccess(null), 3000);
    } catch (err: any) {
      setContactError(`Error deleting contact: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteAllContacts = async (streetName: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('contacts').delete().eq('street_name', streetName);
      if (error) throw new Error(`Failed to delete all contacts: ${error.message}`);
      setStreetStats((prev) =>
        prev.map((street) =>
          street.street_name === streetName
            ? { ...street, contacts: [] }
            : street
        )
      );
      setAddedStreets((prev) => ({
        ...prev,
        [streetName]: {
          ...prev[streetName] || { door_knock: 0, phone_call: 0, contacts: 0 },
          contacts: 0,
        },
      }));
      setContactSuccess('All contacts deleted successfully');
      setTimeout(() => setContactSuccess(null), 3000);
    } catch (err: any) {
      setContactError(`Error deleting all contacts: ${err.message}`);
    } finally {
      setLoading(false);
      setShowConfirmDeleteAll(false);
    }
  };
  const handleDeleteSelectedContacts = async (streetName: string) => {
    if (selectedContactIds.length === 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('contacts').delete().in('id', selectedContactIds);
      if (error) throw new Error(`Failed to delete selected contacts: ${error.message}`);
      setStreetStats((prev) =>
        prev.map((street) =>
          street.street_name === streetName
            ? { ...street, contacts: street.contacts.filter((contact) => !selectedContactIds.includes(contact.id!)) }
            : street
        )
      );
      setAddedStreets((prev) => ({
        ...prev,
        [streetName]: {
          ...prev[streetName] || { door_knock: 0, phone_call: 0, contacts: 0 },
          contacts: Math.max(0, (prev[streetName]?.contacts || 0) - selectedContactIds.length),
        },
      }));
      setSelectedContactIds([]);
      setContactSuccess('Selected contacts deleted successfully');
      setTimeout(() => setContactSuccess(null), 3000);
    } catch (err: any) {
      setContactError(`Error deleting selected contacts: ${err.message}`);
    } finally {
      setLoading(false);
      setShowConfirmDeleteSelected(false);
    }
  };
  const toggleSelectContact = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };
  const toggleSelectAllContacts = (contacts: Contact[]) => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map((c) => c.id!));
    }
  };
  const handleSingleStreetExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !selectedStreet || !suburb) return;
    setLoading(true);
    setContactError(null);
    try {
      const { data: existingContacts, error: contactError } = await supabase
        .from('contacts')
        .select('id, owner_1, owner_2, street_number, street_name, suburb')
        .eq('street_name', selectedStreet)
        .eq('suburb', suburb);
      if (contactError) throw new Error(`Failed to fetch existing contacts: ${contactError.message}`);
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select('street_number')
        .eq('street_name', selectedStreet)
        .eq('suburb', suburb);
      if (propError) throw new Error(`Failed to fetch properties: ${propError.message}`);
      const availableStreetNumbers = propertiesData
        .map((prop) => prop.street_number)
        .filter((num): num is string => !!num);
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        let json = XLSX.utils.sheet_to_json(worksheet) as any[];
        if (json.length === 0) {
          setContactError('No data found in the Excel file.');
          setLoading(false);
          return;
        }
        const firstRowKeys = Object.keys(json[0]);
        const headerMap: { [key: string]: string } = {};
        firstRowKeys.forEach((origKey) => {
          let normKey = normalizeKey(origKey);
          if (normKey === 'owner1_email') normKey = 'owner_1_email';
          if (normKey === 'owner2_email') normKey = 'owner_2_email';
          if (normKey === 'own1_mob') normKey = 'owner_1_mobile';
          if (normKey === 'own2_mob') normKey = 'owner_2_mobile';
          if (normKey === 'street_no') normKey = 'street_number';
          if (normKey === 'last_sold_date') normKey = 'last_sold_date';
          headerMap[normKey] = origKey;
        });
        json = json.map((row) => normalizeRow(row, headerMap));
        const validContacts: Omit<Contact, 'id'>[] = [];
        const duplicateContacts: string[] = [];
        json.forEach((row, index) => {
          if (!row.owner_1 && !row.owner_2) return;
          const streetNumberFromExcel = row.street_number?.toString().trim();
          const streetNumber = streetNumberFromExcel || (availableStreetNumbers[index % availableStreetNumbers.length] || null);
          const isDuplicate = existingContacts.some(
            (contact) =>
              contact.owner_1?.toLowerCase() === row.owner_1?.toLowerCase() &&
              contact.owner_2?.toLowerCase() === row.owner_2?.toLowerCase() &&
              contact.street_number === streetNumber &&
              contact.street_name === selectedStreet &&
              contact.suburb === suburb
          );
          if (isDuplicate) {
            const ownerName = row.owner_1 && row.owner_2 ? `${row.owner_1} & ${row.owner_2}` : row.owner_1 || row.owner_2;
            duplicateContacts.push(`${ownerName} at ${streetNumber || 'N/A'} ${selectedStreet}`);
            return;
          }
          validContacts.push({
            owner_1: row.owner_1 || '',
            owner_2: row.owner_2 || '',
            owner_1_email: row.owner_1_email || '',
            owner_2_email: row.owner_2_email || '',
            phone_number: row.phone_number || '',
            owner_1_mobile: row.owner_1_mobile || '',
            owner_2_mobile: row.owner_2_mobile || '',
            outcome: row.outcome || '',
            street_name: selectedStreet,
            street_number: streetNumber,
            suburb,
            status: row.status || '',
            last_sold_date: row.last_sold_date,
            price: row.price,
            marketing_plan: row.marketing_plan || '',
            activity_log: row.activity_log || '',
          });
        });
        if (validContacts.length === 0) {
          setContactError(
            `No valid contacts to import. ${duplicateContacts.length > 0 ? `Found ${duplicateContacts.length} duplicates: ${duplicateContacts.join(', ')}` : 'Ensure at least one of owner_1 or owner_2 is provided.'}`
          );
          setLoading(false);
          return;
        }
        const { data: importedData, error } = await supabase
          .from('contacts')
          .insert(validContacts)
          .select();
        if (error) throw new Error(`Failed to import contacts: ${error.message}`);
        setStreetStats((prev) =>
          prev.map((street) =>
            street.street_name === selectedStreet
              ? { ...street, contacts: [...street.contacts, ...importedData] }
              : street
          )
        );
        setAddedStreets((prev) => ({
          ...prev,
          [selectedStreet]: {
            ...prev[selectedStreet] || { door_knock: 0, phone_call: 0, contacts: 0 },
            contacts: (prev[selectedStreet]?.contacts || 0) + validContacts.length,
          },
        }));
        let successMessage = `Successfully imported ${validContacts.length} contacts for ${selectedStreet}.`;
        if (duplicateContacts.length > 0) {
          successMessage += ` Skipped ${duplicateContacts.length} duplicates: ${duplicateContacts.join(', ')}.`;
        }
        setContactSuccess(successMessage);
        setTimeout(() => setContactSuccess(null), 5000);
        event.target.value = '';
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setContactError(`Error importing contacts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleGlobalExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !suburb) return;
    setLoading(true);
    setContactError(null);
    try {
      const { data: existingContacts, error: contactError } = await supabase
        .from('contacts')
        .select('id, owner_1, owner_2, street_number, street_name, suburb')
        .ilike('suburb', `%${suburb.toLowerCase().split(' qld')[0]}%`);
      if (contactError) throw new Error(`Failed to fetch existing contacts: ${contactError.message}`);
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select('street_name, street_number')
        .ilike('suburb', `%${suburb.toLowerCase().split(' qld')[0]}%`);
      if (propError) throw new Error(`Failed to fetch street names: ${propError.message}`);
      const availableStreetNames = [...new Set(propertiesData
        .map((prop) => prop.street_name?.trim())
        .filter((name): name is string => !!name))];
      const streetNumberMap = new Map<string, string[]>();
      propertiesData.forEach((prop) => {
        if (prop.street_name && prop.street_number) {
          const streetNumbers = streetNumberMap.get(prop.street_name) || [];
          streetNumbers.push(prop.street_number);
          streetNumberMap.set(prop.street_name, streetNumbers);
        }
      });
      const file = event.target.files[0];
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        let json = XLSX.utils.sheet_to_json(worksheet) as any[];
        if (json.length === 0) {
          setContactError('No data found in the Excel file.');
          setLoading(false);
          return;
        }
        const firstRowKeys = Object.keys(json[0]);
        const headerMap: { [key: string]: string } = {};
        firstRowKeys.forEach((origKey) => {
          let normKey = normalizeKey(origKey);
          if (normKey === 'owner1_email') normKey = 'owner_1_email';
          if (normKey === 'owner2_email') normKey = 'owner_2_email';
          if (normKey === 'own1_mob') normKey = 'owner_1_mobile';
          if (normKey === 'own2_mob') normKey = 'owner_2_mobile';
          if (normKey === 'street_no') normKey = 'street_number';
          if (normKey === 'last_sold_date') normKey = 'last_sold_date';
          headerMap[normKey] = origKey;
        });
        json = json.map((row) => normalizeRow(row, headerMap));
        const validContacts: Omit<Contact, 'id'>[] = [];
        const duplicateContacts: string[] = [];
        const unmatchedStreets: string[] = [];
        json.forEach((row, index) => {
          if (!row.owner_1 && !row.owner_2) return;
          let streetName = row.street_name ? row.street_name.trim() : '';
          let streetNumber = row.street_number?.toString().trim() || null;
          if (!streetName || !availableStreetNames.includes(streetName)) {
            const matchedStreet = availableStreetNames.find(
              (availableStreet) => availableStreet.toLowerCase().includes(streetName.toLowerCase()) ||
                streetName.toLowerCase().includes(availableStreet.toLowerCase())
            );
            if (matchedStreet) {
              streetName = matchedStreet;
            } else if (availableStreetNames.length > 0) {
              streetName = availableStreetNames[0];
              unmatchedStreets.push(row.street_name || 'Unknown');
            } else {
              unmatchedStreets.push(row.street_name || 'Unknown');
              return;
            }
          }
          if (!streetNumber) {
            const availableStreetNumbers = streetNumberMap.get(streetName) || [];
            streetNumber = availableStreetNumbers[index % availableStreetNumbers.length] || null;
          }
          const isDuplicate = existingContacts.some(
            (contact) =>
              contact.owner_1?.toLowerCase() === row.owner_1?.toLowerCase() &&
              contact.owner_2?.toLowerCase() === row.owner_2?.toLowerCase() &&
              contact.street_number === streetNumber &&
              contact.street_name === streetName &&
              contact.suburb === suburb
          );
          if (isDuplicate) {
            const ownerName = row.owner_1 && row.owner_2 ? `${row.owner_1} & ${row.owner_2}` : row.owner_1 || row.owner_2;
            duplicateContacts.push(`${ownerName} at ${streetNumber || 'N/A'} ${streetName}`);
            return;
          }
          validContacts.push({
            owner_1: row.owner_1 || '',
            owner_2: row.owner_2 || '',
            owner_1_email: row.owner_1_email || '',
            owner_2_email: row.owner_2_email || '',
            phone_number: row.phone_number || '',
            owner_1_mobile: row.owner_1_mobile || '',
            owner_2_mobile: row.owner_2_mobile || '',
            outcome: row.outcome || '',
            street_name: streetName,
            street_number: streetNumber,
            suburb: row.suburb || suburb,
            status: row.status || '',
            last_sold_date: row.last_sold_date,
            price: row.price,
            marketing_plan: row.marketing_plan || '',
            activity_log: row.activity_log || '',
          });
        });
        if (validContacts.length === 0) {
          let errorMessage = 'No valid contacts to import. Ensure at least one of owner_1 or owner_2 is provided.';
          if (duplicateContacts.length > 0) {
            errorMessage += ` Found ${duplicateContacts.length} duplicates: ${duplicateContacts.join(', ')}.`;
          }
          if (unmatchedStreets.length > 0) {
            errorMessage += ` Unmatched street names: ${[...new Set(unmatchedStreets)].join(', ')}.`;
          }
          setContactError(errorMessage);
          setLoading(false);
          return;
        }
        const { data: importedData, error } = await supabase
          .from('contacts')
          .insert(validContacts)
          .select();
        if (error) throw new Error(`Failed to import contacts: ${error.message}`);
        await fetchData();
        let successMessage = `Successfully imported ${validContacts.length} contacts across all streets.`;
        if (duplicateContacts.length > 0) {
          successMessage += ` Skipped ${duplicateContacts.length} duplicates: ${duplicateContacts.join(', ')}.`;
        }
        if (unmatchedStreets.length > 0) {
          successMessage += ` Assigned ${unmatchedStreets.length} unmatched streets to ${availableStreetNames[0] || 'Unknown'}.`;
        }
        setContactSuccess(successMessage);
        setTimeout(() => setContactSuccess(null), 5000);
        event.target.value = '';
        setIsGlobalImportOpen(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setContactError(`Error importing contacts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewContact((prev) => ({ ...prev, [name]: value }));
  };
  const openContactModal = (streetName: string, view: 'add' | 'list' = 'add') => {
    setSelectedStreet(streetName);
    setModalView(view);
    setNewContact({
      id: '',
      owner_1: '',
      owner_2: '',
      owner_1_email: '',
      owner_2_email: '',
      phone_number: '',
      owner_1_mobile: '',
      owner_2_mobile: '',
      outcome: '',
      street_name: null,
      street_number: null,
      suburb: '',
      status: '',
      last_sold_date: null,
      price: null,
      marketing_plan: '',
      activity_log: '',
    });
    setIsEditMode(false);
    setSelectedContactIds([]);
    setIsContactModalOpen(true);
  };
  const closeContactModal = () => {
    setIsContactModalOpen(false);
    setIsEditMode(false);
    setModalView('add');
    setNewContact({
      id: '',
      owner_1: '',
      owner_2: '',
      owner_1_email: '',
      owner_2_email: '',
      phone_number: '',
      owner_1_mobile: '',
      owner_2_mobile: '',
      outcome: '',
      street_name: null,
      street_number: null,
      suburb: '',
      status: '',
      last_sold_date: null,
      price: null,
      marketing_plan: '',
      activity_log: '',
    });
    setContactError(null);
    setContactSuccess(null);
    setSelectedContactIds([]);
    setShowConfirmDeleteAll(false);
    setShowConfirmDeleteSelected(false);
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
        <p className="text-gray-600 text-center text-sm sm:text-base">Select a suburb to view streets</p>
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
            className="text-xl sm:text-2xl"
          >
            🏠
          </motion.div>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mt-4 w-full max-w-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center">
        <span className="mr-2 text-indigo-600 text-lg sm:text-xl">🏠</span>
        Streets in {suburb} ({localFilter.replace('_', ' ')})
      </h2>
      {error && (
        <div className="text-red-600 text-center py-2 bg-red-50 rounded-lg mb-4 text-sm sm:text-base">{error}</div>
      )}
      {contactSuccess && (
        <div className="text-green-600 text-center py-2 bg-green-50 rounded-lg mb-4 text-sm sm:text-base flex items-center justify-center">
          <Check className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> {contactSuccess}
        </div>
      )}
      {streetStats.length === 0 && !error && (
        <p className="text-gray-600 text-center py-2 text-sm sm:text-base">No streets found for {suburb}</p>
      )}
      {streetStats.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-gray-800 font-semibold mb-1 text-sm sm:text-base">Filter Sold</label>
              <select
                value={localFilter}
                onChange={(e) => setLocalFilter(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 text-sm sm:text-base"
                aria-label="Select sold properties filter"
              >
                <option value="all">All Time</option>
                <option value="30_days">Last 30 Days</option>
                <option value="3_months">Last 3 Months</option>
                <option value="6_months">Last 6 Months</option>
                <option value="12_months">Last 12 Months</option>
              </select>
            </div>
            <motion.button
              onClick={handleAddAllToBoth}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm sm:text-base"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 4v16m8-8H4" />
              </svg>
              Add All to Both
            </motion.button>
            <motion.button
              onClick={handleRemoveAllToBoth}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm sm:text-base"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={Object.values(addedStreets).every(
                (street) => street.door_knock === 0 && street.phone_call === 0
              )}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove All from Both
            </motion.button>
            <motion.button
              onClick={() => setIsGlobalImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-sm sm:text-base"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
              Import Contacts (All Streets)
            </motion.button>
            <motion.button
              onClick={handleExportContacts}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm sm:text-base"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              Download Contacts
            </motion.button>
          </div>
          {Object.values(addedStreets).length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm">
              <p className="text-blue-800">
                Selected: {Object.values(addedStreets).reduce((sum, street) => sum + street.door_knock + street.phone_call, 0)} total actions across{' '}
                {Object.keys(addedStreets).length} streets (Today's tasks: Door knocks and phone calls are logged as daily marketing activities; progress tracked in report page via activity logs)
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-96 overflow-y-auto">
            {streetStats.map((street, index) => {
              const doorKnockCount = addedStreets[street.street_name]?.door_knock || 0;
              const phoneCallCount = addedStreets[street.street_name]?.phone_call || 0;
              return (
                <motion.div
                  key={street.street_name}
                  className="bg-gray-50 p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 min-w-0"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <div className="flex justify-between items-center mb-1">
                    <h3
                      className="text-sm sm:text-base font-semibold text-gray-800 cursor-pointer hover:text-indigo-600 transition-colors truncate"
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
                        <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </motion.button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <div className="flex items-center">
                      <span className="text-indigo-600 mr-1 text-sm sm:text-base">🏠</span>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Total</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900">{street.total_properties}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-indigo-600 mr-1 text-sm sm:text-base">📋</span>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">List/Sold</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900">
                          {street.listed_count}/{street.sold_count}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center col-span-2">
                      <span className="text-indigo-600 mr-1 text-sm sm:text-base">💰</span>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">ASP</p>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900">
                          {street.average_sold_price ? formatCurrency(street.average_sold_price) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <motion.button
                      onClick={() => handleAddStreetIndividual(street, 'door_knock')}
                      className={`flex-1 p-1 rounded-md text-white flex items-center justify-center relative ${
                        doorKnockCount > 0
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-blue-300 hover:bg-blue-400'
                      } transition-all text-xs sm:text-sm`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h6m4-14v10m-4-10v2a2 2 0 002 2h2m-4 4v2a2 2 0 002 2h2" />
                        <circle cx="10" cy="12" r="1" />
                      </svg>
                      {doorKnockCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-3 w-3 flex items-center justify-center">
                          {doorKnockCount}
                        </span>
                      )}
                    </motion.button>
                    <motion.button
                      onClick={() => handleAddStreetIndividual(street, 'phone_call')}
                      className={`flex-1 p-1 rounded-md text-white flex items-center justify-center relative ${
                        phoneCallCount > 0
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-blue-300 hover:bg-blue-400'
                      } transition-all text-xs sm:text-sm`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                      </svg>
                      {phoneCallCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-3 w-3 flex items-center justify-center">
                          {phoneCallCount}
                        </span>
                      )}
                    </motion.button>
                    <motion.button
                      onClick={() => openContactModal(street.street_name, 'add')}
                      className={`flex-1 p-1 rounded-md text-white flex items-center justify-center relative ${
                        addedStreets[street.street_name]?.contacts > 0
                          ? 'bg-purple-300 hover:bg-purple-400'
                          : 'bg-purple-200 hover:bg-purple-300'
                      } transition-all text-xs sm:text-sm`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <UserPlus className="w-4 h-4" />
                      {addedStreets[street.street_name]?.contacts > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-3 w-3 flex items-center justify-center">
                          {addedStreets[street.street_name].contacts}
                        </span>
                      )}
                    </motion.button>
                    <motion.button
                      onClick={() => openContactModal(street.street_name, 'list')}
                      className="flex-1 p-1 rounded-md text-white flex items-center justify-center relative bg-green-200 hover:bg-green-300 transition-all text-xs sm:text-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m1 4h1m-6 0h1m1-4h1" />
                      </svg>
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
                          <div className="overflow-x-auto mb-4">
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
                                    <td className="p-1">
                                      {property.sold_price ? formatCurrency(property.sold_price) : 'N/A'}
                                    </td>
                                    <td className="p-1">
                                      {property.sold_date ? new Date(property.sold_date).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="p-1">{property.status}</td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <h4 className="text-xs font-semibold text-gray-800 mb-1">Contacts on {street.street_name}</h4>
                        {street.contacts.length === 0 ? (
                          <p className="text-gray-600 text-xs">No contacts found for {street.street_name}.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                              <thead>
                                <tr className="bg-purple-600 text-white text-xs">
                                  <th className="p-1 text-left">Owner 1</th>
                                  <th className="p-1 text-left">Owner 2</th>
                                  <th className="p-1 text-left">Owner 1 Email</th>
                                  <th className="p-1 text-left">Owner 2 Email</th>
                                  <th className="p-1 text-left">Phone Number</th>
                                  <th className="p-1 text-left">Owner 1 Mobile</th>
                                  <th className="p-1 text-left">Owner 2 Mobile</th>
                                  <th className="p-1 text-left">Outcome</th>
                                  <th className="p-1 text-left">Street Number</th>
                                  <th className="p-1 text-left">Status</th>
                                  <th className="p-1 text-left">Last Sold Date</th>
                                  <th className="p-1 text-left">Price</th>
                                  <th className="p-1 text-left">Marketing Plan</th>
                                  <th className="p-1 text-left">Activity Log</th>
                                  <th className="p-1 text-left">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {street.contacts.map((contact) => (
                                  <motion.tr
                                    key={contact.id}
                                    className="border-b border-gray-200 hover:bg-gray-100"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                  >
                                    <td className="p-1">{contact.owner_1 || 'N/A'}</td>
                                    <td className="p-1">{contact.owner_2 || 'N/A'}</td>
                                    <td className="p-1">{contact.owner_1_email}</td>
                                    <td className="p-1">{contact.owner_2_email}</td>
                                    <td className="p-1">{contact.phone_number}</td>
                                    <td className="p-1">{contact.owner_1_mobile || 'N/A'}</td>
                                    <td className="p-1">{contact.owner_2_mobile || 'N/A'}</td>
                                    <td className="p-1">{contact.outcome || 'N/A'}</td>
                                    <td className="p-1">{contact.street_number || 'N/A'}</td>
                                    <td className="p-1">{contact.status || 'N/A'}</td>
                                    <td className="p-1">{contact.last_sold_date ? new Date(contact.last_sold_date).toLocaleDateString() : 'N/A'}</td>
                                    <td className="p-1">{contact.price ? formatCurrency(contact.price) : 'N/A'}</td>
                                    <td className="p-1">{contact.marketing_plan || 'N/A'}</td>
                                    <td className="p-1">{contact.activity_log || 'N/A'}</td>
                                    <td className="p-1 flex gap-1">
                                      <motion.button
                                        onClick={() => handleEditContact(contact)}
                                        className="text-blue-600 hover:text-blue-800"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </motion.button>
                                      <motion.button
                                        onClick={() => handleDeleteContact(contact.id!, street.street_name)}
                                        className="text-red-600 hover:text-red-800"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </motion.button>
                                    </td>
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
              );
            })}
          </div>
        </div>
      )}
      <AnimatePresence>
        {isGlobalImportOpen && (
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
                <h3 className="text-lg font-semibold text-gray-800">Import Contacts for All Streets in {suburb}</h3>
                <motion.button
                  onClick={() => setIsGlobalImportOpen(false)}
                  className="text-gray-600 hover:text-gray-800"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
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
              <div className="mb-4">
                <label className="block text-gray-800 font-semibold mb-2 text-sm">
                  Upload Excel file with columns: owner_1 or owner_2, street_name (owner_1_email, owner_2_email, phone_number, owner_1_mobile, owner_2_mobile, outcome, status, last_sold_date, price optional)
                </label>
                <div className="flex items-center">
                  <Upload className="w-5 h-5 mr-2 text-gray-500" />
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleGlobalExcelImport}
                    className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm flex-1"
                    disabled={loading}
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isContactModalOpen && (
          <motion.div
            key="contact-modal"
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeContactModal}
          >
            <motion.div
              key="modal-content"
              className="bg-white p-6 rounded-xl shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Contacts for {selectedStreet} - {modalView === 'add' ? (isEditMode ? 'Edit' : 'Add') : 'List'}
                </h3>
                <motion.button
                  onClick={closeContactModal}
                  className="text-gray-600 hover:text-gray-800"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
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
              {modalView === 'list' ? (
                <div>
                  <div className="flex justify-between mb-4 gap-2 flex-wrap">
                    <button
                      onClick={() => setModalView('add')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      Add New Contact
                    </button>
                    {!isEditMode && (
                      <div className="flex items-center">
                        <Upload className="w-5 h-5 mr-2 text-gray-500" />
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleSingleStreetExcelImport}
                          className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-sm"
                          disabled={loading}
                        />
                      </div>
                    )}
                    <button
                      onClick={() => setShowConfirmDeleteSelected(true)}
                      disabled={selectedContactIds.length === 0}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 text-sm"
                    >
                      Delete Selected ({selectedContactIds.length})
                    </button>
                    <button
                      onClick={() => setShowConfirmDeleteAll(true)}
                      className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800 text-sm"
                    >
                      Delete All Contacts
                    </button>
                  </div>
                  {showConfirmDeleteSelected && (
                    <div className="mb-4 p-4 bg-yellow-100 rounded-lg">
                      <p className="text-base mb-2">Are you sure you want to delete the selected contacts?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteSelectedContacts(selectedStreet!)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Yes, Delete
                        </button>
                        <button
                          onClick={() => setShowConfirmDeleteSelected(false)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {showConfirmDeleteAll && (
                    <div className="mb-4 p-4 bg-yellow-100 rounded-lg">
                      <p className="text-base mb-2">Are you sure you want to delete all contacts for this street?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteAllContacts(selectedStreet!)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Yes, Delete All
                        </button>
                        <button
                          onClick={() => setShowConfirmDeleteAll(false)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {streetStats.find((s) => s.street_name === selectedStreet)?.contacts.length === 0 ? (
                    <p className="text-gray-600 text-base">No contacts found for {selectedStreet}.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-base">
                        <thead>
                          <tr className="bg-purple-600 text-white text-base">
                            <th className="p-2 text-left">
                              <input
                                type="checkbox"
                                checked={
                                  selectedContactIds.length ===
                                  streetStats.find((s) => s.street_name === selectedStreet)?.contacts.length
                                }
                                onChange={() =>
                                  toggleSelectAllContacts(
                                    streetStats.find((s) => s.street_name === selectedStreet)?.contacts || []
                                  )
                                }
                              />
                            </th>
                            <th className="p-2 text-left">Owner 1</th>
                            <th className="p-2 text-left">Owner 2</th>
                            <th className="p-2 text-left">Owner 1 Email</th>
                            <th className="p-2 text-left">Owner 2 Email</th>
                            <th className="p-2 text-left">Phone Number</th>
                            <th className="p-2 text-left">Owner 1 Mobile</th>
                            <th className="p-2 text-left">Owner 2 Mobile</th>
                            <th className="p-2 text-left">Outcome</th>
                            <th className="p-2 text-left">Street Number</th>
                            <th className="p-2 text-left">Status</th>
                            <th className="p-2 text-left">Last Sold Date</th>
                            <th className="p-2 text-left">Price</th>
                            <th className="p-2 text-left">Marketing Plan</th>
                            <th className="p-2 text-left">Activity Log</th>
                            <th className="p-2 text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {streetStats
                            .find((s) => s.street_name === selectedStreet)
                            ?.contacts.map((contact) => (
                              <tr key={contact.id} className="border-b border-gray-200 hover:bg-gray-100">
                                <td className="p-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedContactIds.includes(contact.id!)}
                                    onChange={() => toggleSelectContact(contact.id!)}
                                  />
                                </td>
                                <td className="p-2">{contact.owner_1}</td>
                                <td className="p-2">{contact.owner_2}</td>
                                <td className="p-2">{contact.owner_1_email}</td>
                                <td className="p-2">{contact.owner_2_email}</td>
                                <td className="p-2">{contact.phone_number}</td>
                                <td className="p-2">{contact.owner_1_mobile || 'N/A'}</td>
                                <td className="p-2">{contact.owner_2_mobile || 'N/A'}</td>
                                <td className="p-2">{contact.outcome || 'N/A'}</td>
                                <td className="p-2">{contact.street_number || 'N/A'}</td>
                                <td className="p-2">{contact.status || 'N/A'}</td>
                                <td className="p-2">
                                  {contact.last_sold_date
                                    ? new Date(contact.last_sold_date).toLocaleDateString()
                                    : 'N/A'}
                                </td>
                                <td className="p-2">{contact.price ? formatCurrency(contact.price) : 'N/A'}</td>
                                <td className="p-2">{contact.marketing_plan || 'N/A'}</td>
                                <td className="p-2">{contact.activity_log || 'N/A'}</td>
                                <td className="p-2 flex gap-1">
                                  <button
                                    onClick={() => handleEditContact(contact)}
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    <Edit2 className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteContact(contact.id!, selectedStreet!)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => setModalView('list')}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      View List
                    </button>
                  </div>
                  {!isEditMode && (
                    <div className="mb-4">
                      <label className="block text-gray-800 font-semibold mb-2 text-base">
                        Import Contacts from Excel (for {selectedStreet})
                      </label>
                      <div className="flex items-center">
                        <Upload className="w-5 h-5 mr-2 text-gray-500" />
                        <input
                          type="file"
                          accept=".xlsx, .xls"
                          onChange={handleSingleStreetExcelImport}
                          className="p-2 border border-gray-200 rounded-lg bg-gray-50 text-base flex-1"
                          disabled={loading}
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="owner_1"
                      value={newContact.owner_1}
                      onChange={handleInputChange}
                      placeholder="Owner 1"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Owner 1"
                    />
                    <input
                      type="text"
                      name="owner_2"
                      value={newContact.owner_2}
                      onChange={handleInputChange}
                      placeholder="Owner 2"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Owner 2"
                    />
                    <input
                      type="email"
                      name="owner_1_email"
                      value={newContact.owner_1_email}
                      onChange={handleInputChange}
                      placeholder="Owner 1 Email"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Owner 1 Email"
                    />
                    <input
                      type="email"
                      name="owner_2_email"
                      value={newContact.owner_2_email}
                      onChange={handleInputChange}
                      placeholder="Owner 2 Email"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Owner 2 Email"
                    />
                    <input
                      type="tel"
                      name="phone_number"
                      value={newContact.phone_number}
                      onChange={handleInputChange}
                      placeholder="Phone Number"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Phone Number"
                    />
                    <input
                      type="tel"
                      name="owner_1_mobile"
                      value={newContact.owner_1_mobile}
                      onChange={handleInputChange}
                      placeholder="Owner 1 Mobile"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Owner 1 Mobile"
                    />
                    <input
                      type="tel"
                      name="owner_2_mobile"
                      value={newContact.owner_2_mobile}
                      onChange={handleInputChange}
                      placeholder="Owner 2 Mobile"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Owner 2 Mobile"
                    />
                    <input
                      type="text"
                      name="outcome"
                      value={newContact.outcome}
                      onChange={handleInputChange}
                      placeholder="Outcome"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Outcome"
                    />
                    <input
                      type="text"
                      name="street_number"
                      value={newContact.street_number || ''}
                      onChange={handleInputChange}
                      placeholder="Street Number (optional)"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Street Number"
                    />
                    <input
                      type="text"
                      name="status"
                      value={newContact.status}
                      onChange={handleInputChange}
                      placeholder="Status"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Status"
                    />
                    <input
                      type="date"
                      name="last_sold_date"
                      value={newContact.last_sold_date || ''}
                      onChange={handleInputChange}
                      placeholder="Last Sold Date"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Last Sold Date"
                    />
                    <input
                      type="number"
                      name="price"
                      value={newContact.price || ''}
                      onChange={handleInputChange}
                      placeholder="Price"
                      className="p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base"
                      aria-label="Price"
                    />
                    <div className="col-span-1 md:col-span-2">
                      <textarea
                        name="marketing_plan"
                        value={newContact.marketing_plan}
                        onChange={handleInputChange}
                        placeholder="Marketing Plan"
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base h-24"
                        aria-label="Marketing Plan"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <textarea
                        name="activity_log"
                        value={newContact.activity_log}
                        onChange={handleInputChange}
                        placeholder="Activity Log"
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50 text-base h-32"
                        aria-label="Activity Log"
                      />
                    </div>
                  </div>
                  <motion.button
                    onClick={handleAddContact}
                    disabled={loading}
                    className={`mt-4 w-full flex items-center justify-center px-4 py-2 rounded-lg text-white ${
                      loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
                    } transition-all duration-200`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <UserPlus className="w-5 h-5 mr-2" /> {isEditMode ? 'Update Contact' : 'Add Single Contact'}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}