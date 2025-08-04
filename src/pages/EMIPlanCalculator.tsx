import { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { X, Save, Eye, Download } from 'lucide-react';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

interface Expense {
  name: string;
  amount: number;
}

interface EMIPlan {
  typeOfLoan: string;
  customLoanType: string;
  repaymentTerm: 'months' | 'years';
  loanTenure: number;
  loanAmount: number;
  interestPerAnnum: number;
  ownFunds: number;
  ownFundsInterestRate: number;
  monthlyRevenue: number;
  expenses: Expense[];
}

interface EMICalculations {
  monthlyInterest: number;
  monthlyRepayment: number;
  monthlyTotal: number;
  ownFundsMonthlyPrincipal: number;
  ownFundsMonthlyInterest: number;
  ownFundsMonthlyTotal: number;
  totalExpenses: number;
  monthlyProfitLoss: number;
  yearlyProfitLoss: number;
}

interface SavedPlan {
  id: string;
  emiPlan: EMIPlan;
  calculations: EMICalculations;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(value);
};

const formatNumberInput = (value: number): string => {
  if (value === 0) return '';
  return new Intl.NumberFormat('en-AU', {
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
}> = ({ value, onChange, placeholder, className, min, step }) => {
  const [displayValue, setDisplayValue] = useState(formatNumberInput(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Allow only digits and commas
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

        // Restore cursor position
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
    />
  );
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const calculateEMI = (plan: EMIPlan): EMICalculations => {
  const loanTenureMonths = plan.repaymentTerm === 'years' ? plan.loanTenure * 12 : plan.loanTenure;
  const monthlyRepayment = loanTenureMonths > 0 ? plan.loanAmount / loanTenureMonths : 0;
  const monthlyInterest = (plan.loanAmount * (plan.interestPerAnnum / 100)) / 12;
  const monthlyTotal = monthlyRepayment + monthlyInterest;
  const ownFundsMonthlyPrincipal = loanTenureMonths > 0 ? plan.ownFunds / loanTenureMonths : 0;
  const ownFundsMonthlyInterest = (plan.ownFunds * (plan.ownFundsInterestRate / 100)) / 12;
  const ownFundsMonthlyTotal = ownFundsMonthlyPrincipal + ownFundsMonthlyInterest;
  const totalExpenses = plan.expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const monthlyProfitLoss = plan.monthlyRevenue - (monthlyTotal + ownFundsMonthlyTotal + totalExpenses);
  const yearlyProfitLoss = (plan.monthlyRevenue * 12) - ((monthlyTotal + ownFundsMonthlyTotal + totalExpenses) * 12);

  return {
    monthlyInterest,
    monthlyRepayment,
    monthlyTotal,
    ownFundsMonthlyPrincipal,
    ownFundsMonthlyInterest,
    ownFundsMonthlyTotal,
    totalExpenses,
    monthlyProfitLoss,
    yearlyProfitLoss,
  };
};

const validateInputs = (plan: EMIPlan): string | null => {
  if (plan.typeOfLoan === '') return 'Type of Loan must be selected.';
  if (plan.typeOfLoan === 'Manual Entry' && plan.customLoanType.trim() === '') {
    return 'Custom Loan Type cannot be empty.';
  }
  if (plan.loanAmount < 0) return 'Loan Amount cannot be negative.';
  if (plan.ownFunds < 0) return 'Own Funds cannot be negative.';
  if (plan.loanTenure <= 0) return 'Loan Tenure must be greater than zero.';
  if (plan.interestPerAnnum < 0) return 'Interest Per Annum cannot be negative.';
  if (plan.ownFundsInterestRate < 0) return 'Own Funds Interest Rate cannot be negative.';
  if (plan.monthlyRevenue < 0) return 'Monthly Revenue cannot be negative.';
  if (plan.expenses.some((expense) => expense.amount < 0)) return 'Expenses cannot be negative.';
  if (plan.expenses.length < 2) return 'At least two expenses are required.';
  return null;
};

export function EMIPlanCalculator() {
  const [emiPlan, setEmiPlan] = useState<EMIPlan>({
    typeOfLoan: '',
    customLoanType: '',
    repaymentTerm: 'years',
    loanTenure: 0,
    loanAmount: 0,
    interestPerAnnum: 0,
    ownFunds: 0,
    ownFundsInterestRate: 0,
    monthlyRevenue: 0,
    expenses: [
      { name: 'Staff Salary', amount: 0 },
      { name: 'Rent', amount: 0 },
    ],
  });
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    const saved = localStorage.getItem('emiPlans');
    return saved ? JSON.parse(saved) : [];
  });

  const calculations = useMemo(() => calculateEMI(emiPlan), [emiPlan]);

  const handleInputChange = useCallback(
    (field: keyof EMIPlan, value: string | 'months' | 'years' | number) => {
      setEmiPlan((prev) => {
        const updatedPlan = {
          ...prev,
          [field]: field === 'repaymentTerm' || field === 'typeOfLoan' ? value : typeof value === 'number' ? value : parseInt(value) || 0,
        };
        if (field === 'typeOfLoan' && value !== 'Manual Entry') {
          updatedPlan.customLoanType = '';
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
    (index: number, field: 'name' | 'amount', value: string | number) => {
      setEmiPlan((prev) => {
        const updatedExpenses = [...prev.expenses];
        updatedExpenses[index] = {
          ...updatedExpenses[index],
          [field]: field === 'amount' ? (typeof value === 'number' ? value : parseInt(value) || 0) : value,
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
        expenses: [...prev.expenses, { name: 'Others', amount: 0 }],
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
      calculations,
    };
    const updatedPlans = [...savedPlans, newPlan];
    setSavedPlans(updatedPlans);
    localStorage.setItem('emiPlans', JSON.stringify(updatedPlans));
    setError('Plan saved successfully!');
    setTimeout(() => setError(null), 3000);
  }, [emiPlan, calculations, savedPlans]);

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
    link.href = '#'; // Placeholder; actual implementation needs a LaTeX-to-PDF service
    link.download = 'EMIBreakdown.pdf';
    link.click();
  }, [emiPlan]);

  const chartData = useMemo(() => ({
    labels: ['Bank Loan', 'Own Funds', 'Expenses', 'Profit/Loss'],
    datasets: [
      {
        label: 'Principal/Expenses',
        data: [
          calculations.monthlyRepayment,
          calculations.ownFundsMonthlyPrincipal,
          calculations.totalExpenses,
          Math.max(0, calculations.monthlyProfitLoss),
        ],
        backgroundColor: '#3B82F680',
        borderColor: '#3B82F6',
        borderWidth: 1,
      },
      {
        label: 'Interest',
        data: [
          calculations.monthlyInterest,
          calculations.ownFundsMonthlyInterest,
          0,
          calculations.monthlyProfitLoss < 0 ? Math.abs(calculations.monthlyProfitLoss) : 0,
        ],
        backgroundColor: '#EF444480',
        borderColor: '#EF4444',
        borderWidth: 1,
      },
    ],
  }), [calculations]);

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Repayment Term</label>
            <select
              value={emiPlan.repaymentTerm}
              onChange={(e) => handleInputChange('repaymentTerm', e.target.value as 'months' | 'years')}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="years">Years</option>
              <option value="months">Months</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Tenure ({emiPlan.repaymentTerm})</label>
            <input
              type="number"
              value={emiPlan.loanTenure || ''}
              onChange={(e) => handleInputChange('loanTenure', e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="1"
              step="1"
              placeholder={`Enter tenure in ${emiPlan.repaymentTerm}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loan Amount (A$)</label>
            <CurrencyInput
              value={emiPlan.loanAmount}
              onChange={(value) => handleInputChange('loanAmount', value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              step="1000"
              placeholder="1,234,567"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Own Funds (A$)</label>
            <CurrencyInput
              value={emiPlan.ownFunds}
              onChange={(value) => handleInputChange('ownFunds', value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              step="1000"
              placeholder="1,234,567"
            />
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Revenue (A$)</label>
            <CurrencyInput
              value={emiPlan.monthlyRevenue}
              onChange={(value) => handleInputChange('monthlyRevenue', value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              step="1000"
              placeholder="1,234,567"
            />
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Monthly Expenses</h2>
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
          {emiPlan.expenses.map((expense, index) => (
            <div key={index} className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Expense Name</label>
                <input
                  type="text"
                  value={expense.name}
                  onChange={(e) => handleExpenseChange(index, 'name', e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter expense name"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (A$)</label>
                <CurrencyInput
                  value={expense.amount}
                  onChange={(value) => handleExpenseChange(index, 'amount', value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="1000"
                  placeholder="1,234,567"
                />
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
            onClick={() => setShowPreview(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Eye className="w-5 h-5" />
            Preview Plan
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
          <h2 className="text-xl font-bold text-gray-800 mb-4">EMI Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Type of Loan</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">
                    {emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType || 'Not specified' : emiPlan.typeOfLoan || 'Not specified'}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Loan Tenure ({emiPlan.repaymentTerm})</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{emiPlan.loanTenure} {emiPlan.repaymentTerm}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Loan Amount</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(emiPlan.loanAmount)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Interest Per Annum</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatPercentage(emiPlan.interestPerAnnum)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Interest</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(calculations.monthlyInterest)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Repayment</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(calculations.monthlyRepayment)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Repayments + Interest</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700 font-semibold">{formatCurrency(calculations.monthlyTotal)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Own Funds</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(emiPlan.ownFunds)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Own Funds Interest Rate (Annual)</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatPercentage(emiPlan.ownFundsInterestRate)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Own Funds Monthly Principal Repayment</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(calculations.ownFundsMonthlyPrincipal)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Own Funds Monthly Interest</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(calculations.ownFundsMonthlyInterest)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Total Monthly Allocation for Own Funds</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700 font-semibold">{formatCurrency(calculations.ownFundsMonthlyTotal)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Revenue</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(emiPlan.monthlyRevenue)}</td>
                </tr>
                {emiPlan.expenses.map((expense, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{expense.name || `Expense ${index + 1}`}</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(expense.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Total Monthly Expenses</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700 font-semibold">{formatCurrency(calculations.totalExpenses)}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Profit/Loss</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700 font-bold">
                    {formatCurrency(calculations.monthlyProfitLoss)} {calculations.monthlyProfitLoss >= 0 ? '(Profit)' : '(Loss)'}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Yearly Profit/Loss</td>
                  <td className="px-6 py-4 text-sm text-right text-gray-700 font-bold">
                    {formatCurrency(calculations.yearlyProfitLoss)} {calculations.yearlyProfitLoss >= 0 ? '(Profit)' : '(Loss)'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {emiPlan.loanTenure > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Financial Overview</h2>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <Bar
                data={chartData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const label = context.dataset.label || '';
                          const value = context.raw as number;
                          return `${label}: ${formatCurrency(value)}`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: { stacked: true },
                    y: {
                      stacked: true,
                      beginAtZero: true,
                      title: { display: true, text: 'Amount (A$)' },
                      ticks: {
                        callback: (value) => formatCurrency(value as number),
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}

        {showPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <div className="bg-white p-8 rounded-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Plan Preview</h2>
                <motion.button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-600 hover:text-gray-800"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Type of Loan</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">
                      {emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType || 'Not specified' : emiPlan.typeOfLoan || 'Not specified'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Loan Tenure ({emiPlan.repaymentTerm})</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{emiPlan.loanTenure} {emiPlan.repaymentTerm}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Loan Amount</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(emiPlan.loanAmount)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Interest Per Annum</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatPercentage(emiPlan.interestPerAnnum)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Interest</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(calculations.monthlyInterest)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Repayment</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(calculations.monthlyRepayment)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Repayments + Interest</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700 font-semibold">{formatCurrency(calculations.monthlyTotal)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Own Funds</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(emiPlan.ownFunds)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Own Funds Interest Rate (Annual)</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatPercentage(emiPlan.ownFundsInterestRate)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Own Funds Monthly Principal Repayment</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(calculations.ownFundsMonthlyPrincipal)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Own Funds Monthly Interest</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(calculations.ownFundsMonthlyInterest)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Total Monthly Allocation for Own Funds</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700 font-semibold">{formatCurrency(calculations.ownFundsMonthlyTotal)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Revenue</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(emiPlan.monthlyRevenue)}</td>
                  </tr>
                  {emiPlan.expenses.map((expense, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{expense.name || `Expense ${index + 1}`}</td>
                      <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(expense.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Total Monthly Expenses</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700 font-semibold">{formatCurrency(calculations.totalExpenses)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Monthly Profit/Loss</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700 font-bold">
                      {formatCurrency(calculations.monthlyProfitLoss)} {calculations.monthlyProfitLoss >= 0 ? '(Profit)' : '(Loss)'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">Yearly Profit/Loss</td>
                    <td className="px-6 py-4 text-sm text-right text-gray-700 font-bold">
                      {formatCurrency(calculations.yearlyProfitLoss)} {calculations.yearlyProfitLoss >= 0 ? '(Profit)' : '(Loss)'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}