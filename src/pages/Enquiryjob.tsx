import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download, Save, Eye } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useDebounce } from 'use-debounce';

interface EnquiryDetails {
  full_name: string;
  languages_known: string;
  full_license: boolean;
  full_license_details: string;
  owns_car_and_license: boolean;
  owns_car_and_license_details: string;
  why_real_estate: string;
  bought_sold_qld: boolean;
  bought_sold_qld_details: string;
  goal: string;
  expected_earnings: string;
  why_harcourts: string;
  expectations_from_harcourts: string;
  financial_capability: boolean;
  financial_capability_details: string;
  team_contribution: string;
  real_estate_experience: boolean;
  real_estate_experience_details: string;
  strengths: string;
  weaknesses: string;
}

type ErrorsState = Partial<Record<keyof EnquiryDetails, string>> & { general?: string };

const steps = [
  {
    id: 1,
    title: 'Personal Information',
    fields: ['full_name', 'languages_known', 'full_license', 'full_license_details', 'owns_car_and_license', 'owns_car_and_license_details'],
  },
  {
    id: 2,
    title: 'Motivations',
    fields: ['why_real_estate', 'bought_sold_qld', 'bought_sold_qld_details', 'goal', 'expected_earnings'],
  },
  {
    id: 3,
    title: 'Harcourts Expectations',
    fields: ['why_harcourts', 'expectations_from_harcourts', 'financial_capability', 'financial_capability_details', 'team_contribution'],
  },
  {
    id: 4,
    title: 'Experience & Skills',
    fields: ['real_estate_experience', 'real_estate_experience_details', 'strengths', 'weaknesses'],
  },
];

export function Enquiryjob() {
  const [enquiryDetails, setEnquiryDetails] = useState<EnquiryDetails>({
    full_name: '',
    languages_known: '',
    full_license: false,
    full_license_details: '',
    owns_car_and_license: false,
    owns_car_and_license_details: '',
    why_real_estate: '',
    bought_sold_qld: false,
    bought_sold_qld_details: '',
    goal: '',
    expected_earnings: '',
    why_harcourts: '',
    expectations_from_harcourts: '',
    financial_capability: false,
    financial_capability_details: '',
    team_contribution: '',
    real_estate_experience: false,
    real_estate_experience_details: '',
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
    const requiredFields = steps.flatMap(step => step.fields).filter(
      field => !field.endsWith('_details') || enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] !== undefined
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
    const requiredFields = steps.flatMap(step => step.fields).filter(
      field => !field.endsWith('_details') || enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] !== undefined
    );
    requiredFields.forEach(field => {
      const value = enquiryDetails[field as keyof EnquiryDetails];
      if (field === 'expected_earnings') {
        const error = validateDollarAmount(value as string);
        if (error) newErrors[field] = error;
      } else if (field.endsWith('_details') && enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] !== undefined && !value) {
        newErrors[field] = `${field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} is required when selecting Yes or No`;
      } else if (!field.endsWith('_details') && typeof value === 'string' && !value.trim()) {
        newErrors[field] = `${field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} is required`;
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
      const requiredFields = steps.flatMap(step => step.fields).filter(
        field => !field.endsWith('_details') || enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] !== undefined
      );
      requiredFields.forEach(field => {
        const value = enquiryDetails[field as keyof EnquiryDetails];
        if (field === 'expected_earnings') {
          const error = validateDollarAmount(value as string);
          if (error) newErrors[field] = error;
        } else if (field.endsWith('_details') && enquiryDetails[field.replace('_details', '') as keyof EnquiryDetails] !== undefined && !value) {
          newErrors[field] = `${field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} is required when selecting Yes or No`;
        } else if (!field.endsWith('_details') && typeof value === 'string' && !value.trim()) {
          newErrors[field] = `${field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} is required`;
        }
      });

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        throw new Error('Please fill all required fields correctly');
      }

      const submissionId = uuidv4();
      const submittedAt = new Date().toISOString();

      // Save to Supabase
      const { error: dbError } = await supabase.from('enquiry').insert({
        id: submissionId,
        ...enquiryDetails,
        submitted_at: submittedAt,
      });

      if (dbError) {
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
      Languages Known: ${success.languages_known}
      Full License: ${success.full_license ? 'Yes' : 'No'}
      Full License Details: ${success.full_license_details || 'N/A'}
      Owns Car and Driver's License: ${success.owns_car_and_license ? 'Yes' : 'No'}
      Owns Car and License Details: ${success.owns_car_and_license_details || 'N/A'}
      Why Real Estate: ${success.why_real_estate}
      Bought/Sold in QLD: ${success.bought_sold_qld ? 'Yes' : 'No'}
      Bought/Sold QLD Details: ${success.bought_sold_qld_details || 'N/A'}
      Goal: ${success.goal}
      Expected Earnings: ${success.expected_earnings}
      Why Harcourts: ${success.why_harcourts}
      Expectations from Harcourts: ${success.expectations_from_harcourts}
      Financial Capability: ${success.financial_capability ? 'Yes' : 'No'}
      Financial Capability Details: ${success.financial_capability_details || 'N/A'}
      Team Contribution: ${success.team_contribution}
      Real Estate Experience: ${success.real_estate_experience ? 'Yes' : 'No'}
      Real Estate Experience Details: ${success.real_estate_experience_details || 'N/A'}
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
      full_license: false,
      full_license_details: '',
      owns_car_and_license: false,
      owns_car_and_license_details: '',
      why_real_estate: '',
      bought_sold_qld: false,
      bought_sold_qld_details: '',
      goal: '',
      expected_earnings: '',
      why_harcourts: '',
      expectations_from_harcourts: '',
      financial_capability: false,
      financial_capability_details: '',
      team_contribution: '',
      real_estate_experience: false,
      real_estate_experience_details: '',
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
      'goal',
      'why_harcourts',
      'expectations_from_harcourts',
      'team_contribution',
      'real_estate_experience_details',
      'strengths',
      'weaknesses',
      'full_license_details',
      'owns_car_and_license_details',
      'bought_sold_qld_details',
      'financial_capability_details',
    ].includes(field);

    const placeholderMap: Partial<Record<keyof EnquiryDetails, string>> = {
      full_name: 'John Doe',
      languages_known: 'English, Spanish',
      full_license_details: 'Provide details (e.g., license type or reason for no license)',
      owns_car_and_license_details: 'Provide details (e.g., car type or reason for no car/license)',
      why_real_estate: 'Why are you interested in a real estate career?',
      bought_sold_qld_details: 'Provide details (e.g., property details or reason for not buying/selling)',
      goal: 'What are your career goals?',
      expected_earnings: '$100,000',
      why_harcourts: 'Why do you want to work with Harcourts?',
      expectations_from_harcourts: 'What support do you expect from Harcourts?',
      financial_capability_details: 'Provide details (e.g., financial resources or limitations)',
      team_contribution: 'How will you contribute to the team?',
      real_estate_experience_details: 'Provide details (e.g., years as an agent or reason for no experience)',
      strengths: 'E.g., Communication, negotiation',
      weaknesses: 'E.g., Time management',
    };

    if (['full_license', 'owns_car_and_license', 'bought_sold_qld', 'financial_capability', 'real_estate_experience'].includes(field)) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={enquiryDetails[field as keyof EnquiryDetails] === true}
                onChange={() => {
                  setEnquiryDetails({
                    ...enquiryDetails,
                    [field]: true,
                    ...(field === 'real_estate_experience' && !enquiryDetails.real_estate_experience ? { strengths: '', weaknesses: '' } : {}),
                  });
                }}
                disabled={isLoading}
                className="h-4 w-4 text-blue-300 focus:ring-blue-300 border-blue-200"
              />
              <span className="ml-2 text-blue-900">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={enquiryDetails[field as keyof EnquiryDetails] === false}
                onChange={() => {
                  setEnquiryDetails({
                    ...enquiryDetails,
                    [field]: false,
                    ...(field === 'real_estate_experience' && enquiryDetails.real_estate_experience ? { strengths: '', weaknesses: '' } : {}),
                  });
                }}
                disabled={isLoading}
                className="h-4 w-4 text-blue-300 focus:ring-blue-300 border-blue-200"
              />
              <span className="ml-2 text-blue-900">No</span>
            </label>
          </div>
          {enquiryDetails[field as keyof EnquiryDetails] !== undefined && (
            <div className="mt-2">
              
              
              {errors[`${field}_details` as keyof EnquiryDetails] && (
                <p id={`${field}_details-error`} className="text-red-500 text-sm mt-1">
                  {errors[`${field}_details` as keyof EnquiryDetails]}
                </p>
              )}
            </div>
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
            onChange={(e) => setEnquiryDetails({ ...enquiryDetails, [field]: e.target.value })}
            rows={4}
            placeholder={placeholderMap[field as keyof EnquiryDetails]}
            {...commonProps}
          />
        ) : (
          <input
            id={field}
            type="text"
            value={enquiryDetails[field as keyof EnquiryDetails] as string}
            onChange={(e) => {
              let value = e.target.value;
              if (field === 'expected_earnings') {
                value = formatDollarAmount(value);
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
    <div className={`min-h-screen flex items-center justify-center p-4 ${isDarkMode ? 'bg-blue-300' : 'bg-white'} transition-colors duration-300`}>
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`bg-white rounded-xl shadow-2xl p-8 w-full max-w-3xl border ${isDarkMode ? 'border-blue-200' : 'border-blue-200'}`}
      >
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-center text-blue-900">
            Harcourts Success Job 
          </h1>
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
              className="text-center space-y-4"
            >
              {/* CSS Checkmark Animation */}
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full" viewBox="0 0 50 50">
                  <circle
                    className="text-blue-200"
                    strokeWidth="5"
                    stroke="currentColor"
                    fill="transparent"
                    r="20"
                    cx="25"
                    cy="25"
                  />
                  <motion.circle
                    className="text-blue-300"
                    strokeWidth="5"
                    stroke="currentColor"
                    fill="transparent"
                    r="20"
                    cx="25"
                    cy="25"
                    initial={{ strokeDasharray: "0 125.6", strokeDashoffset: "0" }}
                    animate={{ strokeDasharray: "125.6 125.6", strokeDashoffset: "0" }}
                    transition={{ duration: 1.5 }}
                  />
                  <motion.path
                    d="M15 30 L22 37 L35 20"
                    stroke="blue"
                    strokeWidth="5"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                  />
                </svg>
              </div>
              <p className="text-blue-900 font-semibold">Enquiry submitted successfully!</p>
              <div className="text-left space-y-2 bg-blue-100 p-4 rounded-lg">
                <p className="text-blue-900">
                  Submission ID: <span className="font-mono font-semibold">{success.id}</span>
                  <button
                    onClick={() => copyToClipboard(success.id, 'Submission ID')}
                    className="ml-2 text-blue-300 hover:text-blue-400"
                    aria-label="Copy Submission ID"
                  >
                    <Copy className="w-4 h-4 inline" />
                  </button>
                </p>
                <p className="text-blue-900">
                  Full Name: <span className="font-mono font-semibold">{success.full_name}</span>
                  <button
                    onClick={() => copyToClipboard(success.full_name, 'Full Name')}
                    className="ml-2 text-blue-300 hover:text-blue-400"
                    aria-label="Copy Full Name"
                  >
                    <Copy className="w-4 h-4 inline" />
                  </button>
                </p>
                <p className="text-blue-900">
                  Submitted At: <span className="font-mono font-semibold">{new Date(success.submitted_at).toLocaleString()}</span>
                  <button
                    onClick={() => copyToClipboard(new Date(success.submitted_at).toLocaleString(), 'Submitted At')}
                    className="ml-2 text-blue-300 hover:text-blue-400"
                    aria-label="Copy Submission Time"
                  >
                    <Copy className="w-4 h-4 inline" />
                  </button>
                </p>
              </div>
              <div className="flex justify-center gap-4">
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
              {steps.find(step => step.id === currentStep)?.fields.map(field => (
                <div key={field} className="mb-6">
                  <label htmlFor={field} className="block text-sm font-medium text-blue-900 mb-1 capitalize">
                    {field.replace(/_/g, ' ')} *
                  </label>
                  {renderField(field)}
                </div>
              ))}

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
              className="bg-white p-6 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-bold mb-4 text-blue-900">Submission Preview</h2>
              <div className="space-y-2">
                {Object.entries(enquiryDetails).map(([key, value]) => (
                  <p key={key} className="text-blue-900">
                    <span className="font-semibold capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value || 'Not provided'}
                  </p>
                ))}
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