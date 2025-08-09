import React, { useState, useMemo, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'framer-motion';
import { X, Save, Download } from 'lucide-react';

interface Expense {
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
}

interface EMIPlan {
  typeOfLoan: string;
  customLoanType: string;
  loanTenure: number;
  loanAmount: number;
  interestPerAnnum: number;
  bankPercent: number; // Will be controlled by progress bar
  ownPercent: number;  // Will be controlled by progress bar
  ownFundsInterestRate: number;
  ownTenure: number;
  hasBorrowedFunds: 'yes' | 'no';
  borrowedFunds: number;
  borrowedFundsInterestRate: number;
  borrowedTenure: number;
  revenue1: number;
  revenue2: number;
  revenuePeriod: 'monthly' | 'yearly';
  expenses: Expense[];
}

interface YearlyAvg {
  year: number;
  avgRepay: number;
  pl: number;
}

interface Calculations {
  bankYear1Principal: number;
  bankYear1Interest: number;
  bankYear1Total: number;
  ownYear1Principal: number;
  ownYear1Interest: number;
  ownYear1Total: number;
  borrowedYear1Principal: number;
  borrowedYear1Interest: number;
  borrowedYear1Total: number;
  yearlyAvg: YearlyAvg[];
}

interface SavedPlan {
  id: string;
  emiPlan: EMIPlan;
}

const formatNumberInput = (value: number): string => {
  if (value === 0) return '';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const parseNumberInput = (value: string): number => {
  if (value === '') return 0;
  const cleaned = value.replace(/[^\d]/g, '');
  return parseInt(cleaned) || 0;
};

const CurrencyInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  min?: string;
  step?: string;
  disabled?: boolean;
}> = ({ value, onChange, placeholder, className, min, step, disabled }) => {
  const [displayValue, setDisplayValue] = useState(formatNumberInput(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    if (/^[\d,]*$/.test(input)) {
      if (input === '') {
        setDisplayValue('');
        onChange(0);
      } else {
        const numericValue = parseNumberInput(input);
        const cursorPosition = e.target.selectionStart;
        const oldLength = displayValue.length;
        const newDisplayValue = formatNumberInput(numericValue);
        setDisplayValue(newDisplayValue);
        onChange(numericValue);

        if (inputRef.current && cursorPosition !== null) {
          const newLength = newDisplayValue.length;
          const diff = newLength - oldLength;
          const newCursorPosition = cursorPosition + diff;
          setTimeout(() => {
            inputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
          }, 0);
        }
      }
    }
  };

  const handleBlur = () => {
    const numericValue = parseNumberInput(displayValue);
    setDisplayValue(formatNumberInput(numericValue));
    onChange(numericValue);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      min={min}
      step={step}
      disabled={disabled}
    />
  );
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value);
};

const calculateEMI = (plan: EMIPlan): Calculations => {
  const bankLoanAmount = plan.loanAmount * plan.bankPercent / 100;
  const ownFunds = plan.loanAmount * plan.ownPercent / 100;
  const borrowedFunds = plan.hasBorrowedFunds === 'yes' ? plan.borrowedFunds : 0;
  const loanTenureMonths = plan.loanTenure * 12;
  const ownTenureMonths = plan.ownTenure * 12;
  const borrowedTenureMonths = plan.hasBorrowedFunds === 'yes' ? plan.borrowedTenure * 12 : 0;
  const maxMonths = Math.max(loanTenureMonths, ownTenureMonths, borrowedTenureMonths, 1);
  const yearlyRevenue = plan.revenuePeriod === 'yearly' ? plan.revenue1 + plan.revenue2 : (plan.revenue1 + plan.revenue2) * 12;
  const yearlyExpenses = plan.expenses.reduce((sum, expense) => {
    const amount = expense.period === 'yearly' ? expense.amount : expense.amount * 12;
    return sum + amount;
  }, 0);
  let remainingBank = bankLoanAmount;
  let remainingOwn = ownFunds;
  let remainingBorrowed = borrowedFunds;
  let currentMonth = 1;
  let currentYear = 1;
  let bankYear1Principal = 0;
  let bankYear1Interest = 0;
  let ownYear1Principal = 0;
  let ownYear1Interest = 0;
  let borrowedYear1Principal = 0;
  let borrowedYear1Interest = 0;
  let yearPrincipalBank = 0;
  let yearInterestBank = 0;
  let yearPrincipalOwn = 0;
  let yearInterestOwn = 0;
  let yearPrincipalBorrowed = 0;
  let yearInterestBorrowed = 0;
  let yearTotalRepayment = 0;
  const yearlyAvg: YearlyAvg[] = [];

  while (currentMonth <= maxMonths) {
    let interestBank = 0;
    let principalBank = 0;
    if (currentMonth <= loanTenureMonths) {
      interestBank = remainingBank * (plan.interestPerAnnum / 100 / 12);
      principalBank = bankLoanAmount / loanTenureMonths;
      remainingBank -= principalBank;
      remainingBank = Math.max(remainingBank, 0);
    }
    yearInterestBank += interestBank;
    yearPrincipalBank += principalBank;

    let interestOwn = 0;
    let principalOwn = 0;
    if (currentMonth <= ownTenureMonths) {
      interestOwn = remainingOwn * (plan.ownFundsInterestRate / 100 / 12);
      principalOwn = ownFunds / ownTenureMonths;
      remainingOwn -= principalOwn;
      remainingOwn = Math.max(remainingOwn, 0);
    }
    yearInterestOwn += interestOwn;
    yearPrincipalOwn += principalOwn;

    let interestBorrowed = 0;
    let principalBorrowed = 0;
    if (plan.hasBorrowedFunds === 'yes' && currentMonth <= borrowedTenureMonths) {
      interestBorrowed = remainingBorrowed * (plan.borrowedFundsInterestRate / 100 / 12);
      principalBorrowed = borrowedFunds / borrowedTenureMonths;
      remainingBorrowed -= principalBorrowed;
      remainingBorrowed = Math.max(remainingBorrowed, 0);
    }
    yearInterestBorrowed += interestBorrowed;
    yearPrincipalBorrowed += principalBorrowed;

    yearTotalRepayment += (interestBank + principalBank) + (interestOwn + principalOwn) + (interestBorrowed + principalBorrowed);

    if (currentMonth % 12 === 0 || currentMonth === maxMonths) {
      const monthsInYear = currentMonth % 12 === 0 ? 12 : currentMonth % 12;
      yearlyAvg.push({
        year: currentYear,
        avgRepay: yearTotalRepayment / monthsInYear,
        pl: yearlyRevenue - yearlyExpenses - yearTotalRepayment,
      });
      if (currentYear === 1) {
        bankYear1Principal = yearPrincipalBank;
        bankYear1Interest = yearInterestBank;
        ownYear1Principal = yearPrincipalOwn;
        ownYear1Interest = yearInterestOwn;
        borrowedYear1Principal = yearPrincipalBorrowed;
        borrowedYear1Interest = yearInterestBorrowed;
      }
      yearPrincipalBank = 0;
      yearInterestBank = 0;
      yearPrincipalOwn = 0;
      yearInterestOwn = 0;
      yearPrincipalBorrowed = 0;
      yearInterestBorrowed = 0;
      yearTotalRepayment = 0;
      currentYear++;
    }
    currentMonth++;
  }

  return {
    bankYear1Principal,
    bankYear1Interest,
    bankYear1Total: bankYear1Principal + bankYear1Interest,
    ownYear1Principal,
    ownYear1Interest,
    ownYear1Total: ownYear1Principal + ownYear1Interest,
    borrowedYear1Principal,
    borrowedYear1Interest,
    borrowedYear1Total: borrowedYear1Principal + borrowedYear1Interest,
    yearlyAvg,
  };
};

const validateInputs = (plan: EMIPlan): string | null => {
  if (plan.typeOfLoan === '') return 'Type of Loan must be selected.';
  if (plan.typeOfLoan === 'Manual Entry' && plan.customLoanType.trim() === '') {
    return 'Custom Loan Type cannot be empty.';
  }
  if (plan.loanAmount < 0) return 'Loan Amount cannot be negative.';
  if (plan.bankPercent < 0 || plan.bankPercent > 100) return 'Bank Percentage must be between 0 and 100.';
  if (plan.ownPercent < 0 || plan.ownPercent > 100) return 'Own Percentage must be between 0 and 100.';
  if (plan.loanTenure <= 0) return 'Loan Tenure must be greater than zero.';
  if (plan.ownTenure <= 0) return 'Own Funds Tenure must be greater than zero.';
  if (plan.interestPerAnnum < 0) return 'Interest Per Annum cannot be negative.';
  if (plan.ownFundsInterestRate < 0) return 'Own Funds Interest Rate cannot be negative.';
  if (plan.revenue1 < 0) return 'Revenue 1 cannot be negative.';
  if (plan.revenue2 < 0) return 'Revenue 2 cannot be negative.';
  if (plan.expenses.some((expense) => expense.amount < 0)) return 'Expenses cannot be negative.';
  if (plan.expenses.length < 2) return 'At least two expenses are required.';
  if (plan.hasBorrowedFunds === 'yes') {
    if (plan.borrowedFunds < 0) return 'Borrowed Funds cannot be negative.';
    if (plan.borrowedTenure <= 0) return 'Borrowed Funds Tenure must be greater than zero.';
    if (plan.borrowedFundsInterestRate < 0) return 'Borrowed Funds Interest Rate cannot be negative.';
  }
  return null;
};

export function EMIPlanCalculator() {
  const [emiPlan, setEmiPlan] = useState<EMIPlan>({
    typeOfLoan: 'Business Loan',
    customLoanType: '',
    loanTenure: 5,
    loanAmount: 1000000,
    interestPerAnnum: 7.5,
    bankPercent: 70,
    ownPercent: 30,
    ownFundsInterestRate: 4.0,
    ownTenure: 5,
    hasBorrowedFunds: 'yes',
    borrowedFunds: 200000,
    borrowedFundsInterestRate: 6.0,
    borrowedTenure: 3,
    revenue1: 50000,
    revenue2: 30000,
    revenuePeriod: 'monthly',
    expenses: [
      { name: 'Rent', amount: 10000, period: 'monthly' },
      { name: 'Utilities', amount: 5000, period: 'monthly' },
    ],
  });
  const [error, setError] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    const saved = localStorage.getItem('emiPlans');
    return saved ? JSON.parse(saved) : [];
  });

  const calculations = useMemo(() => calculateEMI(emiPlan), [emiPlan]);

  const handleInputChange = useCallback(
    (field: keyof EMIPlan, value: string | 'monthly' | 'yearly' | 'yes' | 'no' | number) => {
      setEmiPlan((prev) => {
        const updatedPlan = {
          ...prev,
          [field]: field === 'typeOfLoan' || field === 'revenuePeriod' || field === 'hasBorrowedFunds' ? value : typeof value === 'number' ? value : parseInt(value) || 0,
        };
        if (field === 'typeOfLoan' && value !== 'Manual Entry') {
          updatedPlan.customLoanType = '';
        }
        if (field === 'hasBorrowedFunds' && value === 'no') {
          updatedPlan.borrowedFunds = 0;
          updatedPlan.borrowedFundsInterestRate = 0;
          updatedPlan.borrowedTenure = 0;
        }
        const validationError = validateInputs(updatedPlan);
        setError(validationError);
        return updatedPlan;
      });
    },
    []
  );

  const handleCustomLoanTypeChange = useCallback(
    (value: string) => {
      setEmiPlan((prev) => {
        const updatedPlan = { ...prev, customLoanType: value };
        const validationError = validateInputs(updatedPlan);
        setError(validationError);
        return updatedPlan;
      });
    },
    []
  );

  const handleExpenseChange = useCallback(
    (index: number, field: 'name' | 'amount' | 'period', value: string | number | 'monthly' | 'yearly') => {
      setEmiPlan((prev) => {
        const updatedExpenses = [...prev.expenses];
        updatedExpenses[index] = {
          ...updatedExpenses[index],
          [field]: field === 'amount' ? (typeof value === 'number' ? value : parseInt(value as string) || 0) : value,
        };
        const updatedPlan = { ...prev, expenses: updatedExpenses };
        const validationError = validateInputs(updatedPlan);
        setError(validationError);
        return updatedPlan;
      });
    },
    []
  );

  const addExpense = useCallback(() => {
    if (emiPlan.expenses.length < 3) {
      setEmiPlan((prev) => ({
        ...prev,
        expenses: [...prev.expenses, { name: 'Others', amount: 0, period: 'monthly' }],
      }));
    }
  }, [emiPlan.expenses.length]);

  const removeExpense = useCallback(
    (index: number) => {
      if (emiPlan.expenses.length > 2) {
        setEmiPlan((prev) => {
          const updatedExpenses = prev.expenses.filter((_, i) => i !== index);
          const updatedPlan = { ...prev, expenses: updatedExpenses };
          const validationError = validateInputs(updatedPlan);
          setError(validationError);
          return updatedPlan;
        });
      }
    },
    [emiPlan.expenses.length]
  );

  const savePlan = useCallback(() => {
    const validationError = validateInputs(emiPlan);
    if (validationError) {
      setError(validationError);
      return;
    }
    const newPlan: SavedPlan = {
      id: new Date().toISOString(),
      emiPlan,
    };
    const updatedPlans = [...savedPlans, newPlan];
    setSavedPlans(updatedPlans);
    localStorage.setItem('emiPlans', JSON.stringify(updatedPlans));
    setError('Plan saved successfully!');
    setTimeout(() => setError(null), 3000);
  }, [emiPlan, savedPlans]);

  const loadPlan = useCallback(
    (planId: string) => {
      const plan = savedPlans.find((p) => p.id === planId);
      if (plan) {
        setEmiPlan(plan.emiPlan);
        setError(null);
      }
    },
    [savedPlans]
  );

  const generatePDF = useCallback(() => {
    const validationError = validateInputs(emiPlan);
    if (validationError) {
      setError(validationError);
      return;
    }
    console.log('Generating PDF with LaTeX content...');
    const link = document.createElement('a');
    link.href = '#';
    link.download = 'EMIBreakdown.pdf';
    link.click();
  }, [emiPlan]);

  const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const bankPercent = parseInt(event.target.value, 10);
    const ownPercent = 100 - bankPercent;
    setEmiPlan((prev) => ({
      ...prev,
      bankPercent,
      ownPercent,
    }));
  };

  const loanTypeOptions = [
    'Business Loan',
    'Vehicle Loan',
    'Electronics Loan',
    'House Loan',
    'Personal Loan',
    'Manual Entry',
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-100 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-2xl shadow-2xl"
      >
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">EMI Plan Calculator</h1>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mb-6 p-4 rounded-lg border-l-4 ${
              error.includes('successfully') ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700'
            }`}
          >
            <p>{error}</p>
          </motion.div>
        )}

        {savedPlans.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Load Saved Plan</label>
            <select
              onChange={(e) => loadPlan(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a saved plan</option>
              {savedPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.emiPlan.typeOfLoan === 'Manual Entry' ? plan.emiPlan.customLoanType : plan.emiPlan.typeOfLoan} - {plan.id}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type of Loan</label>
            <select
              value={emiPlan.typeOfLoan}
              onChange={(e) => handleInputChange('typeOfLoan', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="" disabled>Select loan type</option>
              {loanTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {emiPlan.typeOfLoan === 'Manual Entry' && (
              <input
                type="text"
                value={emiPlan.customLoanType}
                onChange={(e) => handleCustomLoanTypeChange(e.target.value)}
                className="mt-2 w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter custom loan type"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Tenure (Years)</label>
            <input
              type="number"
              value={emiPlan.loanTenure || ''}
              onChange={(e) => handleInputChange('loanTenure', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="1"
              step="1"
              placeholder="Enter tenure in years"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (₹)</label>
            <CurrencyInput
              value={emiPlan.loanAmount}
              onChange={(value) => handleInputChange('loanAmount', value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              step="1000"
              placeholder="3,00,000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interest Per Annum (%)</label>
            <input
              type="number"
              value={emiPlan.interestPerAnnum || ''}
              onChange={(e) => handleInputChange('interestPerAnnum', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.1"
              placeholder="Enter annual interest rate"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Distribution (Bank vs Own Funds)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={emiPlan.bankPercent}
                onChange={handleProgressChange}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-700">{formatPercentage(emiPlan.bankPercent)} (Bank) / {formatPercentage(emiPlan.ownPercent)} (Own)</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Own Funds Interest Rate (% Annual)</label>
            <input
              type="number"
              value={emiPlan.ownFundsInterestRate || ''}
              onChange={(e) => handleInputChange('ownFundsInterestRate', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.1"
              placeholder="Enter own funds interest rate"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Own Tenure (Years)</label>
            <input
              type="number"
              value={emiPlan.ownTenure || ''}
              onChange={(e) => handleInputChange('ownTenure', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="1"
              step="1"
              placeholder="Enter tenure in years"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Has Borrowed Funds?</label>
            <select
              value={emiPlan.hasBorrowedFunds}
              onChange={(e) => handleInputChange('hasBorrowedFunds', e.target.value as 'yes' | 'no')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
          {emiPlan.hasBorrowedFunds === 'yes' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Borrowed Funds (₹)</label>
                <CurrencyInput
                  value={emiPlan.borrowedFunds}
                  onChange={(value) => handleInputChange('borrowedFunds', value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="1000"
                  placeholder="3,00,000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Borrowed Funds Interest Rate (% Annual)</label>
                <input
                  type="number"
                  value={emiPlan.borrowedFundsInterestRate || ''}
                  onChange={(e) => handleInputChange('borrowedFundsInterestRate', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="0.1"
                  placeholder="Enter borrowed funds interest rate"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Borrowed Tenure (Years)</label>
                <input
                  type="number"
                  value={emiPlan.borrowedTenure || ''}
                  onChange={(e) => handleInputChange('borrowedTenure', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="1"
                  step="1"
                  placeholder="Enter tenure in years"
                />
              </div>
            </>
          )}
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Revenue Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 rounded-lg shadow">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Period</label>
              <select
                value={emiPlan.revenuePeriod}
                onChange={(e) => handleInputChange('revenuePeriod', e.target.value as 'monthly' | 'yearly')}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revenue 1 (₹)</label>
              <CurrencyInput
                value={emiPlan.revenue1}
                onChange={(value) => handleInputChange('revenue1', value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                min="0"
                step="1000"
                placeholder="3,00,000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Revenue 2 (₹)</label>
              <CurrencyInput
                value={emiPlan.revenue2}
                onChange={(value) => handleInputChange('revenue2', value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                min="0"
                step="1000"
                placeholder="3,00,000"
              />
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Expenses</h2>
            {emiPlan.expenses.length < 3 && (
              <motion.button
                onClick={addExpense}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Add Expense
              </motion.button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-4 rounded-lg shadow">
            {emiPlan.expenses.map((expense, index) => (
              <div key={index} className="flex items-center gap-4 bg-white p-3 rounded-lg">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expense Name</label>
                  <input
                    type="text"
                    value={expense.name}
                    onChange={(e) => handleExpenseChange(index, 'name', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter expense name"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <CurrencyInput
                    value={expense.amount}
                    onChange={(value) => handleExpenseChange(index, 'amount', value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    placeholder="3,00,000"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                  <select
                    value={expense.period}
                    onChange={(e) => handleExpenseChange(index, 'period', e.target.value as 'monthly' | 'yearly')}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                {emiPlan.expenses.length > 2 && (
                  <motion.button
                    onClick={() => removeExpense(index)}
                    className="text-red-600 hover:text-red-800 p-2"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-4 mb-8">
          <motion.button
            onClick={savePlan}
            className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Save className="w-5 h-5" />
            Save Plan
          </motion.button>
          <motion.button
            onClick={generatePDF}
            className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Download className="w-5 h-5" />
            Save as PDF
          </motion.button>
        </div>

        <div className="mb-8">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount Int %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Amount %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">{emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{emiPlan.loanTenure}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(emiPlan.loanAmount)} {formatPercentage(emiPlan.interestPerAnnum)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatPercentage(emiPlan.bankPercent)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatPercentage(emiPlan.ownPercent)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(emiPlan.loanAmount * emiPlan.bankPercent / 100)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(emiPlan.loanAmount * emiPlan.ownPercent / 100)}</td>
              </tr>
            </tbody>
          </table>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.bankYear1Principal)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.bankYear1Interest)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.bankYear1Total)}</td>
              </tr>
            </tbody>
          </table>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Funds Repayment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Repayment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.ownYear1Principal)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.ownYear1Interest)}</td>
                <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.ownYear1Total)}</td>
              </tr>
            </tbody>
          </table>
          {emiPlan.hasBorrowedFunds === 'yes' && (
            <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrowed Funds Repayment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Repayment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.borrowedYear1Principal)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.borrowedYear1Interest)}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatCurrency(calculations.borrowedYear1Total)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Repay</th>
                {calculations.yearlyAvg.map((ya) => (
                  <th key={ya.year} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{ya.year}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">Avg Repay</td>
                {calculations.yearlyAvg.map((ya) => (
                  <td key={ya.year} className="px-6 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepay)}</td>
                ))}
              </tr>
              <tr>
                <td className="px-6 py-4 text-sm text-gray-700">P/L</td>
                {calculations.yearlyAvg.map((ya) => (
                  <td key={ya.year} className="px-6 py-4 text-sm text-gray-700">{formatCurrency(ya.pl)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}