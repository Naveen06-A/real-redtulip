import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { toast } from 'react-toastify';

interface Owner {
  fullName: string;
  email: string;
  mobile: string;
  streetNumber: string;
  streetName: string;
  suburbName: string;
  postcode: string;
}

interface ContactDetails {
  name: string;
  streetNumber: string;
  streetName: string;
  suburb: string;
  email: string;
  state: string;
  postcode: string;
  mobile: string;
}

const PropertyManagementForm: React.FC = () => {
  const { user } = useAuthStore();
  const [numOwners, setNumOwners] = useState<number>(1);
  const [owners, setOwners] = useState<Owner[]>(Array.from({ length: 1 }, () => ({
    fullName: '',
    email: '',
    mobile: '',
    streetNumber: '',
    streetName: '',
    suburbName: '',
    postcode: '',
  })));
  const [propertyType, setPropertyType] = useState<string>('house');
  const [hasPool, setHasPool] = useState<string>('no');
  const [hasBodyCorporate, setHasBodyCorporate] = useState<string>('no');
  const [bodyCorporate, setBodyCorporate] = useState<string>('');
  const [cts, setCts] = useState<string>('');
  const [secretaryDetails, setSecretaryDetails] = useState<ContactDetails>({
    name: '',
    streetNumber: '',
    streetName: '',
    suburb: '',
    email: '',
    state: '',
    postcode: '',
    mobile: '',
  });
  const [managerDetails, setManagerDetails] = useState<ContactDetails>({
    name: '',
    streetNumber: '',
    streetName: '',
    suburb: '',
    email: '',
    state: '',
    postcode: '',
    mobile: '',
  });
  const [agreementNames, setAgreementNames] = useState<string>('both');
  const [accountName, setAccountName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [bsb, setBsb] = useState<string>('');
  const [rentedLastYear, setRentedLastYear] = useState<string>('no');
  const [rentalDate, setRentalDate] = useState<string>('');
  const [rentDisbursement, setRentDisbursement] = useState<string>('monthly');
  const [utilityPreference, setUtilityPreference] = useState<string>('option1');

  const handleNumOwnersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newNum = parseInt(e.target.value, 10);
    setNumOwners(newNum);
    setOwners(prevOwners => {
      const newOwners = [...prevOwners];
      while (newOwners.length < newNum) {
        newOwners.push({
          fullName: '',
          email: '',
          mobile: '',
          streetNumber: '',
          streetName: '',
          suburbName: '',
          postcode: '',
        });
      }
      while (newOwners.length > newNum) {
        newOwners.pop();
      }
      return newOwners;
    });
  };

  const handleOwnerChange = (index: number, field: keyof Owner, value: string) => {
    setOwners(prevOwners => {
      const newOwners = [...prevOwners];
      newOwners[index] = { ...newOwners[index], [field]: value };
      return newOwners;
    });
  };

  const handleSecretaryChange = (field: keyof ContactDetails, value: string) => {
    setSecretaryDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleManagerChange = (field: keyof ContactDetails, value: string) => {
    setManagerDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (owners.some(owner =>
      !owner.fullName ||
      !owner.email ||
      !owner.mobile ||
      !owner.streetNumber ||
      !owner.streetName ||
      !owner.suburbName ||
      !owner.postcode
    )) {
      toast.error('Please fill out all owner details (including address fields)');
      return;
    }
    if (!accountName || !accountNumber || !bsb) {
      toast.error('Please fill out all bank details');
      return;
    }
    if (rentedLastYear === 'yes' && !rentalDate) {
      toast.error('Please provide the rental date');
      return;
    }
    if (hasBodyCorporate === 'yes' && (
      !bodyCorporate ||
      !secretaryDetails.name ||
      !secretaryDetails.email ||
      !secretaryDetails.mobile ||
      !secretaryDetails.streetNumber ||
      !secretaryDetails.streetName ||
      !secretaryDetails.suburb ||
      !secretaryDetails.state ||
      !secretaryDetails.postcode ||
      !managerDetails.name ||
      !managerDetails.email ||
      !managerDetails.mobile ||
      !managerDetails.streetNumber ||
      !managerDetails.streetName ||
      !managerDetails.suburb ||
      !managerDetails.state ||
      !managerDetails.postcode
    )) {
      toast.error('Please fill out all body corporate details');
      return;
    }

    const formData = {
      user_id: user?.id ?? null,
      owners,
      property_type: propertyType,
      has_pool: hasPool,
      has_body_corporate: hasBodyCorporate,
      body_corporate: hasBodyCorporate === 'yes' ? bodyCorporate : null,
      cts: hasBodyCorporate === 'yes' ? cts : null,
      secretary_details: hasBodyCorporate === 'yes' ? secretaryDetails : null,
      manager_details: hasBodyCorporate === 'yes' ? managerDetails : null,
      agreement_names: agreementNames,
      bank_details: { accountName, accountNumber, bsb },
      rented_last_year: rentedLastYear,
      rental_date: rentedLastYear === 'yes' ? rentalDate : null,
      rent_disbursement: rentDisbursement,
      utility_preference: utilityPreference,
    };

    try {
      const { data, error } = await supabase
        .from('property_management_forms')
        .insert([formData]);

      if (error) throw error;

      console.log('Supabase insert response:', { data });
      toast.success('Form data saved successfully!');
      setOwners([{
        fullName: '',
        email: '',
        mobile: '',
        streetNumber: '',
        streetName: '',
        suburbName: '',
        postcode: '',
      }]);
      setNumOwners(1);
      setPropertyType('house');
      setHasPool('no');
      setHasBodyCorporate('no');
      setBodyCorporate('');
      setCts('');
      setSecretaryDetails({
        name: '',
        streetNumber: '',
        streetName: '',
        suburb: '',
        email: '',
        state: '',
        postcode: '',
        mobile: '',
      });
      setManagerDetails({
        name: '',
        streetNumber: '',
        streetName: '',
        suburb: '',
        email: '',
        state: '',
        postcode: '',
        mobile: '',
      });
      setAgreementNames('both');
      setAccountName('');
      setAccountNumber('');
      setBsb('');
      setRentedLastYear('no');
      setRentalDate('');
      setRentDisbursement('monthly');
      setUtilityPreference('option1');
    } catch (error) {
      console.error('Error saving form data:', error);
      toast.error('Unable to save form data. Please check your input and try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Property Details Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Property Details</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Property Type</label>
            <select
              value={propertyType}
              onChange={e => setPropertyType(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value="house">House</option>
              <option value="acreage">Acreage</option>
              <option value="townhouse">Townhouse</option>
              <option value="land">Land</option>
              <option value="manual">Manual Type</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Does the property have a pool?</label>
            <select
              value={hasPool}
              onChange={e => setHasPool(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        {/* Owner Details Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Owner Details</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Number of Owners
            </label>
            <select
              value={numOwners}
              onChange={handleNumOwnersChange}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          {owners.map((owner, index) => (
            <div key={index} className="border-t border-gray-200 pt-4 mt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Owner {index + 1} Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={owner.fullName}
                    onChange={e => handleOwnerChange(index, 'fullName', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={owner.email}
                    onChange={e => handleOwnerChange(index, 'email', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    value={owner.mobile}
                    onChange={e => handleOwnerChange(index, 'mobile', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Number</label>
                    <input
                      type="text"
                      value={owner.streetNumber}
                      onChange={e => handleOwnerChange(index, 'streetNumber', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street Name</label>
                    <input
                      type="text"
                      value={owner.streetName}
                      onChange={e => handleOwnerChange(index, 'streetName', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Suburb Name</label>
                  <input
                    type="text"
                    value={owner.suburbName}
                    onChange={e => handleOwnerChange(index, 'suburbName', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                  <input
                    type="text"
                    value={owner.postcode}
                    onChange={e => handleOwnerChange(index, 'postcode', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Body Corporate Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Body Corporate Details</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Does the property have a body corporate?
            </label>
            <select
              value={hasBodyCorporate}
              onChange={e => setHasBodyCorporate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {hasBodyCorporate === 'yes' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name/Body Corporate</label>
                <input
                  type="text"
                  value={bodyCorporate}
                  onChange={e => setBodyCorporate(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">CTS</label>
                <input
                  type="text"
                  value={cts}
                  onChange={e => setCts(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                />
              </div>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Secretary Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={secretaryDetails.name}
                      onChange={e => handleSecretaryChange('name', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={secretaryDetails.email}
                      onChange={e => handleSecretaryChange('email', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={secretaryDetails.mobile}
                      onChange={e => handleSecretaryChange('mobile', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Number</label>
                      <input
                        type="text"
                        value={secretaryDetails.streetNumber}
                        onChange={e => handleSecretaryChange('streetNumber', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Name</label>
                      <input
                        type="text"
                        value={secretaryDetails.streetName}
                        onChange={e => handleSecretaryChange('streetName', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
                    <input
                      type="text"
                      value={secretaryDetails.suburb}
                      onChange={e => handleSecretaryChange('suburb', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={secretaryDetails.state}
                      onChange={e => handleSecretaryChange('state', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                    <input
                      type="text"
                      value={secretaryDetails.postcode}
                      onChange={e => handleSecretaryChange('postcode', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Corporate Manager Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={managerDetails.name}
                      onChange={e => handleManagerChange('name', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={managerDetails.email}
                      onChange={e => handleManagerChange('email', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      value={managerDetails.mobile}
                      onChange={e => handleManagerChange('mobile', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Number</label>
                      <input
                        type="text"
                        value={managerDetails.streetNumber}
                        onChange={e => handleManagerChange('streetNumber', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Name</label>
                      <input
                        type="text"
                        value={managerDetails.streetName}
                        onChange={e => handleManagerChange('streetName', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Suburb</label>
                    <input
                      type="text"
                      value={managerDetails.suburb}
                      onChange={e => handleManagerChange('suburb', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={managerDetails.state}
                      onChange={e => handleManagerChange('state', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                    <input
                      type="text"
                      value={managerDetails.postcode}
                      onChange={e => handleManagerChange('postcode', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Management Agreement Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Management Agreement</h2>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Should the management agreement include both owners’ names, or only your name?
          </label>
          <select
            value={agreementNames}
            onChange={e => setAgreementNames(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          >
            <option value="both">Both owners’ names</option>
            <option value="onlyMine">Only your name</option>
          </select>
        </div>

        {/* Bank Details Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Bank Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BSB</label>
              <input
                type="text"
                value={bsb}
                onChange={e => setBsb(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Disclosure and Rent Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Disclosure and Rent</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Has the property been rented in the last year?
            </label>
            <select
              value={rentedLastYear}
              onChange={e => setRentedLastYear(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          {rentedLastYear === 'yes' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter the date</label>
              <input
                type="date"
                value={rentalDate}
                onChange={e => setRentalDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Would you prefer rent payments to be disbursed monthly or fortnightly?
            </label>
            <select
              value={rentDisbursement}
              onChange={e => setRentDisbursement(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value="monthly">Monthly</option>
              <option value="fortnightly">Fortnightly</option>
            </select>
          </div>
        </div>

        {/* Urban Utility Bills Section */}
        <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Urban Utility Bills Management Preference</h2>
          <p className="text-sm text-gray-600 mb-4">Please let us know how you would like to handle the urban utility bills:</p>
          <div className="space-y-4">
            <label className="flex items-start space-x-2">
              <input
                type="radio"
                value="option1"
                checked={utilityPreference === 'option1'}
                onChange={e => setUtilityPreference(e.target.value)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                You receive the water bills, make the payment, and forward the bill to us. We will then pass it on to the tenant for reimbursement of water usage charges. <span className="italic text-gray-500">(Note: The bill must be issued to the tenant within 30 days of receipt; otherwise, the tenant may not be liable for the water usage charges.)</span>
              </span>
            </label>
            <label className="flex items-start space-x-2">
              <input
                type="radio"
                value="option2"
                checked={utilityPreference === 'option2'}
                onChange={e => setUtilityPreference(e.target.value)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                We request Urban Utilities to redirect the bills to us, and we will forward them directly to the tenant for payment. The bill will be paid by us from the ownership funds.
              </span>
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};

export default PropertyManagementForm;