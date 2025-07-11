import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface EnquiryDetails {
  full_name: string;
  languages_known: string;
  full_license: boolean;
  owns_car_and_license: boolean;
  why_real_estate: string;
  bought_sold_qld: boolean;
  goal: string;
  expected_earnings: string;
  why_harcourts: string;
  expectations_from_harcourts: string;
  financial_capability: boolean;
  team_contribution: string;
}

export function Enquiryjob() {
  const [enquiryDetails, setEnquiryDetails] = useState<EnquiryDetails>({
    full_name: '',
    languages_known: '',
    full_license: false,
    owns_car_and_license: false,
    why_real_estate: '',
    bought_sold_qld: false,
    goal: '',
    expected_earnings: '',
    why_harcourts: '',
    expectations_from_harcourts: '',
    financial_capability: false,
    team_contribution: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<EnquiryDetails & { id: string; submitted_at: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      // Validate required fields
      if (!enquiryDetails.full_name.trim()) {
        throw new Error('Full Name is required');
      }
      if (!enquiryDetails.languages_known.trim()) {
        throw new Error('Languages Known is required');
      }
      if (!enquiryDetails.why_real_estate.trim()) {
        throw new Error('Why Real Estate is required');
      }
      if (!enquiryDetails.goal.trim()) {
        throw new Error('Goal is required');
      }
      if (!enquiryDetails.expected_earnings.trim()) {
        throw new Error('Expected Earnings is required');
      }
      if (!enquiryDetails.why_harcourts.trim()) {
        throw new Error('Why Harcourts is required');
      }
      if (!enquiryDetails.expectations_from_harcourts.trim()) {
        throw new Error('Expectations from Harcourts is required');
      }
      if (!enquiryDetails.team_contribution.trim()) {
        throw new Error('Team Contribution is required');
      }

      const submissionId = uuidv4();
      const submittedAt = new Date().toISOString();

      // Save to Supabase
      console.log('Submitting enquiry:', { id: submissionId, ...enquiryDetails });
      const { error: dbError } = await supabase.from('enquiry').insert({
        id: submissionId,
        ...enquiryDetails,
        submitted_at: submittedAt,
      });

      if (dbError) {
        console.error('Enquiry submission error:', dbError);
        throw new Error(`Failed to save enquiry: ${dbError.message}`);
      }

      setSuccess({ id: submissionId, ...enquiryDetails, submitted_at: submittedAt });
      toast.success(
        `Enquiry submitted successfully! Submission ID: ${submissionId}\nThank you for your interest in Harcourts Success.`,
        {
          duration: 15000,
          style: { background: '#3B82F6', color: '#fff', borderRadius: '8px', maxWidth: '500px' },
        }
      );
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred';
      console.error('Enquiry submission failed:', errorMessage, err);
      setError(errorMessage);
      toast.error(`Failed to submit enquiry: ${errorMessage}`, {
        style: { background: '#EF4444', color: '#fff', borderRadius: '8px' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [enquiryDetails]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`, {
      style: { background: '#10B981', color: '#fff', borderRadius: '8px' },
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
      Owns Car and Driver's License: ${success.owns_car_and_license ? 'Yes' : 'No'}
      Why Real Estate: ${success.why_real_estate}
      Bought/Sold in QLD: ${success.bought_sold_qld ? 'Yes' : 'No'}
      Goal: ${success.goal}
      Expected Earnings: ${success.expected_earnings}
      Why Harcourts: ${success.why_harcourts}
      Expectations from Harcourts: ${success.expectations_from_harcourts}
      Financial Capability: ${success.financial_capability ? 'Yes' : 'No'}
      Team Contribution: ${success.team_contribution}
    `;
    const blob = new Blob([details], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enquiry-${success.full_name}-${success.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Enquiry details downloaded!', {
      style: { background: '#10B981', color: '#fff', borderRadius: '8px' },
    });
  };

  const handleReset = () => {
    setEnquiryDetails({
      full_name: '',
      languages_known: '',
      full_license: false,
      owns_car_and_license: false,
      why_real_estate: '',
      bought_sold_qld: false,
      goal: '',
      expected_earnings: '',
      why_harcourts: '',
      expectations_from_harcourts: '',
      financial_capability: false,
      team_contribution: '',
    });
    setSuccess(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Toaster position="top-center" />
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="bg-white/90 backdrop-blur-md rounded-xl shadow-2xl p-8 w-full max-w-2xl border border-gray-200"
      >
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">
          Harcourts Success Enquiry Form
        </h1>
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
              <p className="text-green-600 font-semibold">Enquiry submitted successfully!</p>
              <div className="text-left space-y-2">
                <p className="text-gray-700">
                  Submission ID:{' '}
                  <span className="font-mono font-semibold">{success.id}</span>
                  <button
                    onClick={() => copyToClipboard(success.id, 'Submission ID')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    aria-label="Copy Submission ID"
                  >
                    <Copy className="w-4 h-4 inline" />
                  </button>
                </p>
                <p className="text-gray-700">
                  Full Name:{' '}
                  <span className="font-mono font-semibold">{success.full_name}</span>
                  <button
                    onClick={() => copyToClipboard(success.full_name, 'Full Name')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    aria-label="Copy Full Name"
                  >
                    <Copy className="w-4 h-4 inline" />
                  </button>
                </p>
                <p className="text-gray-700">
                  Submitted At:{' '}
                  <span className="font-mono font-semibold">{new Date(success.submitted_at).toLocaleString()}</span>
                  <button
                    onClick={() => copyToClipboard(new Date(success.submitted_at).toLocaleString(), 'Submitted At')}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    aria-label="Copy Submission Time"
                  >
                    <Copy className="w-4 h-4 inline" />
                  </button>
                </p>
              </div>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleDownloadDetails}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  aria-label="Download Enquiry Details"
                >
                  <Download className="w-5 h-5 mr-2" /> Download Details
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  aria-label="Submit another enquiry"
                >
                  Submit Another Enquiry
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="mb-4">
                  <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={enquiryDetails.full_name}
                    onChange={(e) => setEnquiryDetails({ ...enquiryDetails, full_name: e.target.value })}
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white/50"
                    placeholder="John Doe"
                    disabled={isLoading}
                    aria-required="true"
                    aria-invalid={!!error && !enquiryDetails.full_name}
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="languages-known" className="block text-sm font-medium text-gray-700 mb-1">
                    Languages Known *
                  </label>
                  <input
                    id="languages-known"
                    type="text"
                    value={enquiryDetails.languages_known}
                    onChange={(e) => setEnquiryDetails({ ...enquiryDetails, languages_known: e.target.value })}
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white/50"
                    placeholder="English, Spanish"
                    disabled={isLoading}
                    aria-required="true"
                    aria-invalid={!!error && !enquiryDetails.languages_known}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Do you hold a full license? *</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="full_license"
                        checked={enquiryDetails.full_license}
                        onChange={() => setEnquiryDetails({ ...enquiryDetails, full_license: true })}
                        disabled={isLoading}
                        className="mr-2"
                      />
                      Yes
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="full_license"
                        checked={!enquiryDetails.full_license}
                        onChange={() => setEnquiryDetails({ ...enquiryDetails, full_license: false })}
                        disabled={isLoading}
                        className="mr-2"
                      />
                      No
                    </label>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Do you own a car and hold a driver’s license? *
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="owns_car_and_license"
                        checked={enquiryDetails.owns_car_and_license}
                        onChange={() => setEnquiryDetails({ ...enquiryDetails, owns_car_and_license: true })}
                        disabled={isLoading}
                        className="mr-2"
                      />
                      Yes
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="owns_car_and_license"
                        checked={!enquiryDetails.owns_car_and_license}
                        onChange={() => setEnquiryDetails({ ...enquiryDetails, owns_car_and_license: false })}
                        disabled={isLoading}
                        className="mr-2"
                      />
                      No
                    </label>
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="why-real-estate" className="block text-sm font-medium text-gray-700 mb-1">
                  Why Real Estate? *
                </label>
                <textarea
                  id="why-real-estate"
                  value={enquiryDetails.why_real_estate}
                  onChange={(e) => setEnquiryDetails({ ...enquiryDetails, why_real_estate: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white/50"
                  rows={4}
                  placeholder="What motivates you to pursue a career in real estate?"
                  disabled={isLoading}
                  aria-required="true"
                  aria-invalid={!!error && !enquiryDetails.why_real_estate}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Have you bought and sold in QLD? *
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bought_sold_qld"
                      checked={enquiryDetails.bought_sold_qld}
                      onChange={() => setEnquiryDetails({ ...enquiryDetails, bought_sold_qld: true })}
                      disabled={isLoading}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="bought_sold_qld"
                      checked={!enquiryDetails.bought_sold_qld}
                      onChange={() => setEnquiryDetails({ ...enquiryDetails, bought_sold_qld: false })}
                      disabled={isLoading}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-1">
                  What’s your Goal? *
                </label>
                <textarea
                  id="goal"
                  value={enquiryDetails.goal}
                  onChange={(e) => setEnquiryDetails({ ...enquiryDetails, goal: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white/50"
                  rows={4}
                  placeholder="What are your career goals in real estate?"
                  disabled={isLoading}
                  aria-required="true"
                  aria-invalid={!!error && !enquiryDetails.goal}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="expected-earnings" className="block text-sm font-medium text-gray-700 mb-1">
                  What do you plan to earn in the next 12 months? *
                </label>
                <input
                  id="expected-earnings"
                  type="text"
                  value={enquiryDetails.expected_earnings}
                  onChange={(e) => setEnquiryDetails({ ...enquiryDetails, expected_earnings: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white/50"
                  placeholder="$100,000"
                  disabled={isLoading}
                  aria-required="true"
                  aria-invalid={!!error && !enquiryDetails.expected_earnings}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="why-harcourts" className="block text-sm font-medium text-gray-700 mb-1">
                  Why Harcourts Success? *
                </label>
                <textarea
                  id="why-harcourts"
                  value={enquiryDetails.why_harcourts}
                  onChange={(e) => setEnquiryDetails({ ...enquiryDetails, why_harcourts: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white/50"
                  rows={4}
                  placeholder="Why do you want to join Harcourts Success?"
                  disabled={isLoading}
                  aria-required="true"
                  aria-invalid={!!error && !enquiryDetails.why_harcourts}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="expectations-from-harcourts" className="block text-sm font-medium text-gray-700 mb-1">
                  What do you expect from us? *
                </label>
                <textarea
                  id="expectations-from-harcourts"
                  value={enquiryDetails.expectations_from_harcourts}
                  onChange={(e) => setEnquiryDetails({ ...enquiryDetails, expectations_from_harcourts: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white/50"
                  rows={4}
                  placeholder="What support or resources do you expect from Harcourts Success?"
                  disabled={isLoading}
                  aria-required="true"
                  aria-invalid={!!error && !enquiryDetails.expectations_from_harcourts}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Do you have the financial capability to support yourself for the next few months? *
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="financial_capability"
                      checked={enquiryDetails.financial_capability}
                      onChange={() => setEnquiryDetails({ ...enquiryDetails, financial_capability: true })}
                      disabled={isLoading}
                      className="mr-2"
                    />
                    Yes
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="financial_capability"
                      checked={!enquiryDetails.financial_capability}
                      onChange={() => setEnquiryDetails({ ...enquiryDetails, financial_capability: false })}
                      disabled={isLoading}
                      className="mr-2"
                    />
                    No
                  </label>
                </div>
              </div>
              <div className="mb-4">
                <label htmlFor="team-contribution" className="block text-sm font-medium text-gray-700 mb-1">
                  How can you contribute to a team’s growth? *
                </label>
                <textarea
                  id="team-contribution"
                  value={enquiryDetails.team_contribution}
                  onChange={(e) => setEnquiryDetails({ ...enquiryDetails, team_contribution: e.target.value })}
                  className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white/50"
                  rows={4}
                  placeholder="How will you help our team grow?"
                  disabled={isLoading}
                  aria-required="true"
                  aria-invalid={!!error && !enquiryDetails.team_contribution}
                />
              </div>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-red-600 mb-4 text-sm"
                >
                  {error}
                </motion.p>
              )}
              <div className="flex justify-end gap-4">
                <button
                  onClick={handleReset}
                  disabled={isLoading}
                  className="px-4 py-2 text-gray-600 rounded-md hover:bg-gray-100"
                  aria-label="Reset form"
                >
                  Reset
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isLoading}
                  className={`px-4 py-3 rounded-lg text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                    isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}