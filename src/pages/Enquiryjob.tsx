
import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, Save, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDebounce } from 'use-debounce';

// Background image (base64-encoded light abstract pattern)
const backgroundImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxkZWZzPjxwYXR0ZXJuIGlkPSJwYXR0ZXJuIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0gMCA0MCAyMCAyMCA0MCA0MCAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzE5NjdGRiIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjEiLz48cGF0aCBkPSJNIDQwIDAgMjAgMjAgMCA0MCAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzE5NjdGRiIgc3Ryb2tlLXdpZHRoPSIxIiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjcGF0dGVybikiLz48L3N2Zz4=';

interface EnquiryDetails {
  full_name: string;
  languages_known: string;
  do_you_hold_a_full_license: boolean;
  full_license_details: string;
  do_you_own_a_car_and_license: boolean;
  car_and_license_details: string;
  why_real_estate: string;
  have_you_bought_and_sold_in_qld: boolean;
  bought_sold_qld_details: string;
  whats_your_goal: string;
  expected_earnings: string;
  why_us: string;
  what_do_you_expect_from_us: string;
  financial_capability: boolean;
  financial_capability_details: string;
  team_contribution: string;
  suburbs_to_prospect: string;
  strengths: string;
  weaknesses: string;
}

type ErrorsState = Partial<Record<keyof EnquiryDetails, string>> & { general?: string };

const steps = [
  {
    id: 1,
    title: 'Personal Information',
    fields: [
      'full_name',
      'languages_known',
      'do_you_hold_a_full_license',
      'full_license_details',
      'do_you_own_a_car_and_license',
      'car_and_license_details',
    ],
  },
  {
    id: 2,
    title: 'Motivations',
    fields: [
      'why_real_estate',
      'have_you_bought_and_sold_in_qld',
      'bought_sold_qld_details',
      'whats_your_goal',
      'expected_earnings',
    ],
  },
  {
    id: 3,
    title: 'Harcourts Expectations',
    fields: [
      'why_us',
      'what_do_you_expect_from_us',
      'financial_capability',
      'financial_capability_details',
      'team_contribution',
    ],
  },
  {
    id: 4,
    title: 'Experience & Skills',
    fields: ['suburbs_to_prospect', 'strengths', 'weaknesses'],
  },
];

export function Enquiryjob() {
  const [enquiryDetails, setEnquiryDetails] = useState<EnquiryDetails>({
    full_name: '',
    languages_known: '',
    do_you_hold_a_full_license: false,
    full_license_details: '',
    do_you_own_a_car_and_license: false,
    car_and_license_details: '',
    why_real_estate: '',
    have_you_bought_and_sold_in_qld: false,
    bought_sold_qld_details: '',
    whats_your_goal: '',
    expected_earnings: '',
    why_us: '',
    what_do_you_expect_from_us: '',
    financial_capability: false,
    financial_capability_details: '',
    team_contribution: '',
    suburbs_to_prospect: '',
    strengths: '',
    weaknesses: '',
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<ErrorsState>({});
  const [success, setSuccess] = useState<EnquiryDetails & { id: string; submitted_at: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [debouncedDetails] = useDebounce(enquiryDetails, 500);

  // Capitalize first letter of a string
  const capitalizeFirstLetter = (value: string): string => {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  // Format dollar amount
  const formatDollarAmount = (value: string): string => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const number = parseFloat(cleanValue);
    if (isNaN(number)) return '';
    return `$${number.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  };

  // Validate dollar amount
  const validateDollarAmount = (value: string): string | null => {
    const cleanValue = value.replace(/[^0-9.]/g, '');
    const number = parseFloat(cleanValue);
    if (!value.trim()) return 'Expected earnings is required';
    if (isNaN(number) || number < 0) return 'Please enter a valid positive dollar amount';
    return null;
  };

  // Calculate form completion percentage
  const completionPercentage = useMemo(() => {
    const requiredFields = steps
      .flatMap(step => step.fields)
      .filter(
        field =>
          !field.endsWith('_details') ||
          enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] === true
      );
    const filledFields = requiredFields.filter(field => {
      const value = enquiryDetails[field as keyof EnquiryDetails];
      return typeof value === 'string' ? value.trim() !== '' : value !== undefined;
    });
    return Math.round((filledFields.length / requiredFields.length) * 100);
  }, [enquiryDetails]);

  // Real-time validation
  useEffect(() => {
    const newErrors: ErrorsState = {};
    const requiredFields = steps
      .flatMap(step => step.fields)
      .filter(
        field =>
          !field.endsWith('_details') ||
          enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] === true
      );
    requiredFields.forEach(field => {
      const value = enquiryDetails[field as keyof EnquiryDetails];
      if (field === 'expected_earnings') {
        const error = validateDollarAmount(value as string);
        if (error) newErrors[field] = error;
      } else if (
        field.endsWith('_details') &&
        enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] === true &&
        !value?.trim()
      ) {
        newErrors[field] = `${field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} is required when selecting Yes`;
      } else if (!field.endsWith('_details') && typeof value === 'string' && !value.trim()) {
        const displayField = field === 'financial_capability' ? 'Financial Capability Next 12 Months' : field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        newErrors[field] = `${displayField} is required`;
      }
    });
    setErrors(newErrors);
  }, [debouncedDetails]);

  const handleSubmit = useCallback(async () => {
    try {
      setIsLoading(true);
      setSuccess(null);

      // Validate all fields
      const newErrors: ErrorsState = {};
      const requiredTextFields = [
        'full_name',
        'why_real_estate',
        'whats_your_goal',
        'expected_earnings',
        'why_us',
        'what_do_you_expect_from_us',
        'team_contribution',
        'suburbs_to_prospect',
        'strengths',
        'weaknesses',
      ];
      const requiredFields = steps
        .flatMap(step => step.fields)
        .filter(
          field =>
            !field.endsWith('_details') ||
            enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] === true
        );

      requiredFields.forEach(field => {
        const value = enquiryDetails[field as keyof EnquiryDetails];
        if (field === 'expected_earnings') {
          const error = validateDollarAmount(value as string);
          if (error) newErrors[field] = error;
        } else if (
          field.endsWith('_details') &&
          enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] === true &&
          !value?.trim()
        ) {
          newErrors[field] = `${field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} is required when selecting Yes`;
        } else if (requiredTextFields.includes(field) && typeof value === 'string' && !value.trim()) {
          const displayField = field === 'financial_capability' ? 'Financial Capability Next 12 Months' : field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          newErrors[field] = `${displayField} is required`;
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        throw new Error('Please fill all required fields correctly');
      }

      const submissionId = uuidv4();
      const submittedAt = new Date().toISOString();

      // Explicitly map fields to ensure correct column names for database
      const supabaseData = {
        id: submissionId,
        full_name: enquiryDetails.full_name,
        languages_known: enquiryDetails.languages_known || null,
        do_you_hold_a_full_license: enquiryDetails.do_you_hold_a_full_license,
        full_license_details: enquiryDetails.full_license_details || null,
        do_you_own_a_car_and_license: enquiryDetails.do_you_own_a_car_and_license,
        car_and_license_details: enquiryDetails.car_and_license_details || null,
        why_real_estate: enquiryDetails.why_real_estate,
        have_you_bought_and_sold_in_qld: enquiryDetails.have_you_bought_and_sold_in_qld,
        bought_sold_qld_details: enquiryDetails.bought_sold_qld_details || null,
        whats_your_goal: enquiryDetails.whats_your_goal,
        expected_earnings: enquiryDetails.expected_earnings,
        why_us: enquiryDetails.why_us,
        what_do_you_expect_from_us: enquiryDetails.what_do_you_expect_from_us,
        financial_capability: enquiryDetails.financial_capability,
        financial_capability_details: enquiryDetails.financial_capability_details || null,
        team_contribution: enquiryDetails.team_contribution,
        suburbs_to_prospect: enquiryDetails.suburbs_to_prospect,
        strengths: enquiryDetails.strengths,
        weaknesses: enquiryDetails.weaknesses,
        submitted_at: submittedAt,
      };

      // Log data for debugging
      console.log('Submitting to Supabase:', supabaseData);

      // Validate that no required fields are null
      const missingRequiredFields = requiredTextFields.filter(
        field => supabaseData[field as keyof typeof supabaseData] === null || supabaseData[field as keyof typeof supabaseData] === ''
      );
      if (missingRequiredFields.length > 0) {
        throw new Error(`Required fields are missing or empty: ${missingRequiredFields.join(', ')}`);
      }

      // Save to Supabase
      const { error: dbError } = await supabase.from('enquiry').insert(supabaseData);

      if (dbError) {
        console.error('Supabase error:', dbError);
        if (dbError.code === '42P01') {
          throw new Error('The enquiry table does not exist. Please check the database schema.');
        } else if (dbError.code === '42703') {
          throw new Error('One or more columns are missing in the enquiry table. Please update the schema.');
        } else if (dbError.code === '23502') {
          const columnMatch = dbError.message.match(/column "([^"]+)"/);
          const missingColumn = columnMatch ? columnMatch[1] : 'unknown';
          const displayColumn = missingColumn === 'financial_capability' ? 'Financial Capability Next 12 Months' : missingColumn.replace(/_/g, ' ');
          throw new Error(`Missing required field: ${displayColumn}`);
        }
        throw new Error(`Failed to save enquiry: ${dbError.message}`);
      }

      setSuccess({ id: submissionId, ...enquiryDetails, submitted_at: submittedAt });
      toast.success('Enquiry submitted successfully!', {
        duration: 5000,
        style: { background: '#BFDBFE', color: '#1E3A8A', borderRadius: '8px' },
      });
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      setErrors({ general: errorMessage });
      toast.error(`Failed to submit: ${errorMessage}`, {
        style: { background: '#FECACA', color: '#991B1B', borderRadius: '8px' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [enquiryDetails]);

  const handleSaveDraft = async () => {
    try {
      const draftId = uuidv4();
      await supabase.from('drafts').insert({
        id: draftId,
        data: enquiryDetails,
        created_at: new Date().toISOString(),
      });
      toast.success('Draft saved successfully!', {
        style: { background: '#BFDBFE', color: '#1E3A8A', borderRadius: '8px' },
      });
    } catch (err: any) {
      toast.error('Failed to save draft', {
        style: { background: '#FECACA', color: '#991B1B', borderRadius: '8px' },
      });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`, {
      style: { background: '#BFDBFE', color: '#1E3A8A', borderRadius: '8px' },
    });
  };

  const handleDownloadDetails = () => {
    if (!success) return;
    const details = `
      Enquiry Details:
      Submission ID: ${success.id}
      Submitted At: ${new Date(success.submitted_at).toLocaleString()}
      Full Name: ${success.full_name}
      Languages Known: ${success.languages_known || 'N/A'}
      Do You Hold a Full License: ${success.do_you_hold_a_full_license ? 'Yes' : 'No'}
      Full License Details: ${success.full_license_details || 'N/A'}
      Do You Own a Car and License: ${success.do_you_own_a_car_and_license ? 'Yes' : 'No'}
      Car and License Details: ${success.car_and_license_details || 'N/A'}
      Why Real Estate: ${success.why_real_estate}
      Have You Bought and Sold in QLD: ${success.have_you_bought_and_sold_in_qld ? 'Yes' : 'No'}
      Bought/Sold QLD Details: ${success.bought_sold_qld_details || 'N/A'}
      What's Your Goal: ${success.whats_your_goal}
      Expected Earnings: ${success.expected_earnings}
      Why Us: ${success.why_us}
      What Do You Expect From Us: ${success.what_do_you_expect_from_us}
      Financial Capability Next 12 Months: ${success.financial_capability ? 'Yes' : 'No'}
      Financial Capability Details: ${success.financial_capability_details || 'N/A'}
      Team Contribution: ${success.team_contribution}
      Suburbs to Prospect: ${success.suburbs_to_prospect}
      Strengths: ${success.strengths}
      Weaknesses: ${success.weaknesses}
    `;
    const blob = new Blob([details], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enquiry-${success.full_name}-${success.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Details downloaded!', {
      style: { background: '#BFDBFE', color: '#1E3A8A', borderRadius: '8px' },
    });
  };

  const handleReset = () => {
    setEnquiryDetails({
      full_name: '',
      languages_known: '',
      do_you_hold_a_full_license: false,
      full_license_details: '',
      do_you_own_a_car_and_license: false,
      car_and_license_details: '',
      why_real_estate: '',
      have_you_bought_and_sold_in_qld: false,
      bought_sold_qld_details: '',
      whats_your_goal: '',
      expected_earnings: '',
      why_us: '',
      what_do_you_expect_from_us: '',
      financial_capability: false,
      financial_capability_details: '',
      team_contribution: '',
      suburbs_to_prospect: '',
      strengths: '',
      weaknesses: '',
    });
    setSuccess(null);
    setErrors({});
    setCurrentStep(1);
  };

  const renderField = (field: string) => {
    const commonProps = {
      className: `w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white transition-all duration-300 ${
        errors[field as keyof EnquiryDetails] ? 'border-red-500' : 'border-blue-200'
      }`,
      disabled: isLoading,
      'aria-invalid': !!errors[field as keyof EnquiryDetails],
      'aria-describedby': errors[field as keyof EnquiryDetails] ? `${field}-error` : undefined,
    };

    const isTextArea = [
      'why_real_estate',
      'whats_your_goal',
      'why_us',
      'what_do_you_expect_from_us',
      'team_contribution',
      'suburbs_to_prospect',
      'strengths',
      'weaknesses',
      'full_license_details',
      'car_and_license_details',
      'bought_sold_qld_details',
      'financial_capability_details',
    ].includes(field);

    const placeholderMap: Partial<Record<keyof EnquiryDetails, string>> = {
      full_name: 'John Doe',
      languages_known: 'English, Spanish',
      full_license_details: 'Provide details (e.g., license type or reason for no license)',
      car_and_license_details: 'Provide details (e.g., car type or reason for no car/license)',
      why_real_estate: 'Why are you interested in a real estate career?',
      bought_sold_qld_details: 'Provide details (e.g., property details or reason for not buying/selling)',
      whats_your_goal: 'What are your career goals?',
      expected_earnings: '$100,000',
      why_us: 'Why do you want to work with Harcourts Success?',
      what_do_you_expect_from_us: 'What support do you expect from Harcourts Success?',
      financial_capability: 'Do you have financial capability for the next 12 months?',
      financial_capability_details: 'Provide details (e.g., financial resources or limitations)',
      team_contribution: 'How will you contribute to the team?',
      suburbs_to_prospect: 'E.g., Brisbane, Gold Coast',
      strengths: 'E.g., Communication, negotiation',
      weaknesses: 'E.g., Time management',
    };

    if (
      [
        'do_you_hold_a_full_license',
        'do_you_own_a_car_and_license',
        'have_you_bought_and_sold_in_qld',
        'financial_capability',
      ].includes(field)
    ) {
      const displayLabel = field === 'financial_capability' ? 'Financial Capability Next 12 Months' : field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name={field}
                checked={enquiryDetails[field as keyof EnquiryDetails] === true}
                onChange={() => setEnquiryDetails({ ...enquiryDetails, [field]: true })}
                disabled={isLoading}
                className="h-4 w-4 text-blue-300 focus:ring-blue-300 border-blue-200"
              />
              <span className="ml-2 text-blue-900">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name={field}
                checked={enquiryDetails[field as keyof EnquiryDetails] === false}
                onChange={() => setEnquiryDetails({ ...enquiryDetails, [field]: false })}
                disabled={isLoading}
                className="h-4 w-4 text-blue-300 focus:ring-blue-300 border-blue-200"
              />
              <span className="ml-2 text-blue-900">No</span>
            </label>
          </div>
          {enquiryDetails[field as keyof EnquiryDetails] &&
            [
              'full_license_details',
              'car_and_license_details',
              'bought_sold_qld_details',
              'financial_capability_details',
            ].includes(`${field}_details`) && (
              <div className="mt-4">{renderField(`${field}_details`)}</div>
            )}
        </div>
      );
    }

    return (
      <div className="relative">
        {isTextArea ? (
          <textarea
            id={field}
            value={enquiryDetails[field as keyof EnquiryDetails] as string}
            onChange={e => setEnquiryDetails({ ...enquiryDetails, [field]: capitalizeFirstLetter(e.target.value) })}
            rows={4}
            placeholder={placeholderMap[field as keyof EnquiryDetails]}
            {...commonProps}
          />
        ) : (
          <input
            id={field}
            type="text"
            value={enquiryDetails[field as keyof EnquiryDetails] as string}
            onChange={e => {
              let value = e.target.value;
              if (field === 'expected_earnings') {
                value = formatDollarAmount(value);
              } else {
                value = capitalizeFirstLetter(value);
              }
              setEnquiryDetails({ ...enquiryDetails, [field]: value });
            }}
            placeholder={placeholderMap[field as keyof EnquiryDetails]}
            {...commonProps}
          />
        )}
        {errors[field as keyof EnquiryDetails] && (
          <p id={`${field}-error`} className="text-red-500 text-sm mt-1">
            {errors[field as keyof EnquiryDetails]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-blue-300' : 'bg-white'}`}
      style={{ backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="bg-white bg-opacity-90 rounded-xl shadow-2xl p-8 w-full max-w-3xl border border-blue-200"
      >
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-center text-blue-900">Harcourts Success</h1>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-full bg-blue-200"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {steps.map(step => (
              <div
                key={step.id}
                className={`flex-1 text-center py-2 rounded-md cursor-pointer transition-all duration-300 ${
                  currentStep === step.id ? 'bg-blue-300 text-white' : 'bg-blue-200 text-blue-900'
                }`}
                onClick={() => setCurrentStep(step.id)}
              >
                {step.title}
              </div>
            ))}
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2.5">
            <motion.div
              className="bg-blue-300 h-2.5 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${completionPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-sm text-blue-900 mt-2">Form Completion: {completionPercentage}%</p>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="bg-white bg-opacity-90 p-6 rounded-lg w-full max-h-[80vh] overflow-y-auto border border-blue-200"
              style={{ backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover' }}
            >
              <h2 className="text-2xl font-bold mb-4 text-blue-900">Submitted Enquiry Details</h2>
              <div className="space-y-4">
                <div className="bg-blue-100 p-4 rounded-lg">
                  <p className="text-blue-900">
                    <span className="font-semibold">Submission ID:</span>{' '}
                    <span className="font-mono">{success.id}</span>
                    <button
                      onClick={() => copyToClipboard(success.id, 'Submission ID')}
                      className="ml-2 text-blue-300 hover:text-blue-400"
                      aria-label="Copy Submission ID"
                    >
                      <Copy className="w-4 h-4 inline" />
                    </button>
                  </p>
                  <p className="text-blue-900 mt-2">
                    <span className="font-semibold">Submitted At:</span>{' '}
                    <span className="font-mono">{new Date(success.submitted_at).toLocaleString()}</span>
                    <button
                      onClick={() => copyToClipboard(new Date(success.submitted_at).toLocaleString(), 'Submitted At')}
                      className="ml-2 text-blue-300 hover:text-blue-400"
                      aria-label="Copy Submission Time"
                    >
                      <Copy className="w-4 h-4 inline" />
                    </button>
                  </p>
                </div>
                {steps.map(step => (
                  <div key={step.id} className="mb-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">{step.title}</h3>
                    <div className="bg-blue-100 p-4 rounded-lg space-y-2">
                      {step.fields.map(field => {
                        const displayField = field === 'financial_capability' ? 'Financial Capability Next 12 Months' : field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        return (
                          <p key={field} className="text-blue-900">
                            <span className="font-semibold">{displayField}:</span>{' '}
                            {typeof success[field as keyof EnquiryDetails] === 'boolean'
                              ? success[field as keyof EnquiryDetails]
                                ? 'Yes'
                                : 'No'
                              : success[field as keyof EnquiryDetails] || 'Not provided'}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={handleDownloadDetails}
                  className="flex items-center px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
                  aria-label="Download Enquiry Details"
                >
                  <Download className="w-5 h-5 mr-2" /> Download Details
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
                  aria-label="Submit another enquiry"
                >
                  Submit Another Enquiry
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.3 }}
            >
              {steps
                .find(step => step.id === currentStep)
                ?.fields.map(field => {
                  const displayLabel = field === 'financial_capability' ? 'Financial Capability Next 12 Months' : field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <div key={field} className="mb-6">
                      <label htmlFor={field} className="block text-sm font-medium text-blue-900 mb-1">
                        {displayLabel} {['languages_known', 'full_license_details', 'car_and_license_details', 'bought_sold_qld_details', 'financial_capability_details'].includes(field) ? '' : '*'}
                      </label>
                      {renderField(field)}
                    </div>
                  );
                })}

              {errors.general && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-500 mb-4 text-sm"
                >
                  {errors.general}
                </motion.p>
              )}

              <div className="flex justify-between gap-4">
                <div>
                  {currentStep > 1 && (
                    <button
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="px-4 py-2 bg-blue-200 text-blue-900 rounded-md hover:bg-blue-300"
                      aria-label="Previous step"
                    >
                      Previous
                    </button>
                  )}
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleSaveDraft}
                    className="flex items-center px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
                    aria-label="Save draft"
                  >
                    <Save className="w-5 h-5 mr-2" /> Save Draft
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="flex items-center px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
                    aria-label="Preview submission"
                  >
                    <Eye className="w-5 h-5 mr-2" /> Preview
                  </button>
                  {currentStep < steps.length ? (
                    <button
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400"
                      aria-label="Next step"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isLoading}
                      className={`px-4 py-3 rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                        isLoading ? 'bg-blue-200 cursor-not-allowed' : 'bg-blue-300 hover:bg-blue-400'
                      }`}
                      aria-label="Submit enquiry"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Submitting...
                        </span>
                      ) : (
                        'Submit Enquiry'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Modal */}
        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-blue-200/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white bg-opacity-90 p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto border border-blue-200"
              style={{ backgroundImage: `url(${backgroundImage})`, backgroundSize: 'cover' }}
            >
              <h2 className="text-2xl font-bold mb-4 text-blue-900">Submission Preview</h2>
              <div className="space-y-2">
                {Object.entries(enquiryDetails).map(([key, value]) => {
                  const displayKey = key === 'financial_capability' ? 'Financial Capability Next 12 Months' : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <p key={key} className="text-blue-900">
                      <span className="font-semibold">{displayKey}:</span>{' '}
                      {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || 'Not provided'}
                    </p>
                  );
                })}
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-blue-200 text-blue-900 rounded-md hover:bg-blue-300"
                  aria-label="Close preview"
                >
                  Close
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`px-4 py-2 rounded-lg text-white transition-colors ${
                    isLoading ? 'bg-blue-200 cursor-not-allowed' : 'bg-blue-300 hover:bg-blue-400'
                  }`}
                  aria-label="Submit from preview"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
