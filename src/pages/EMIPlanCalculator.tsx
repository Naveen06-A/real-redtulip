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
  bankPercent: number;
  ownPercent: number;
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
  avgRepayBank: number;
  avgRepayOwn: number;
  avgRepayBorrowed: number;
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
        avgRepayBank: (yearPrincipalBank + yearInterestBank) / monthsInYear,
        avgRepayOwn: (yearPrincipalOwn + yearInterestOwn) / monthsInYear,
        avgRepayBorrowed: (yearPrincipalBorrowed + yearInterestBorrowed) / monthsInYear,
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
    typeOfLoan: '',
    customLoanType: '',
    loanTenure: 0,
    loanAmount: 0,
    interestPerAnnum: 0,
    bankPercent: 70,
    ownPercent: 30,
    ownFundsInterestRate: 0,
    ownTenure: 0,
    hasBorrowedFunds: 'no',
    borrowedFunds: 0,
    borrowedFundsInterestRate: 0,
    borrowedTenure: 0,
    revenue1: 0,
    revenue2: 0,
    revenuePeriod: 'monthly',
    expenses: [
      { name: 'Expense 1', amount: 0, period: 'monthly' },
      { name: 'Expense 2', amount: 0, period: 'monthly' },
    ],
  });
  const [error, setError] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    const saved = localStorage.getItem('emiPlans');
    return saved ? JSON.parse(saved) : [];
  });
  const [view, setView] = useState<'loan' | 'own' | 'borrowed'>('loan');
  const [showAmortizationTable, setShowAmortizationTable] = useState(false);

  const calculations = useMemo(() => calculateEMI(emiPlan), [emiPlan]);

  const handleInputChange = useCallback(
    (field: keyof EMIPlan, value: string | 'monthly' | 'yearly' | 'yes' | 'no' | number) => {
      setEmiPlan((prev) => {
        const updatedPlan = {
          ...prev,
          [field]: field === 'typeOfLoan' || field === 'revenuePeriod' || field === 'hasBorrowedFunds' ? value : typeof value === 'number' ? value : parseFloat(value) || 0,
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

  const loanTypeOptions = [
    'Business Loan',
    'Vehicle Loan',
    'Electronics Loan',
    'House Loan',
    'Personal Loan',
    'Manual Entry',
  ];

  // Calculate amortization schedule for the bank loan
  const amortizationSchedule = useMemo(() => {
    const schedule = [];
    const loanAmount = emiPlan.loanAmount * emiPlan.bankPercent / 100;
    const monthlyPrincipal = loanAmount / (emiPlan.loanTenure * 12);
    let remainingPrincipal = loanAmount;

    for (let month = 1; month <= emiPlan.loanTenure * 12; month++) {
      const monthlyInterest = remainingPrincipal * (emiPlan.interestPerAnnum / 100 / 12);
      const totalEMI = monthlyPrincipal + monthlyInterest;
      const endingPrincipal = remainingPrincipal - monthlyPrincipal;

      schedule.push({
        month,
        beginningPrincipal: remainingPrincipal,
        monthlyPrincipal,
        monthlyInterest,
        totalEMI,
        endingPrincipal,
      });

      remainingPrincipal = endingPrincipal;
      if (remainingPrincipal < 0) remainingPrincipal = 0;
    }

    return schedule;
  }, [emiPlan]);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-100 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white p-8 rounded-2xl shadow-2xl"
      >
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center">EMI Plan Calculator</h1>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mb-6 p-4 rounded-lg border-l-4 ${
              error.includes('successfully') ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700'
            }`}
          >
            <p className="text-center">{error}</p>
          </motion.div>
        )}

        {savedPlans.length > 0 && (
          <div className="mb-6 text-center">
            <label className="block text-sm font-medium text-gray-700 mb-1">Load Saved Plan</label>
            <select
              onChange={(e) => loadPlan(e.target.value)}
              className="w-1/3 mx-auto p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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

        <div className="mb-8">
          <div className="mb-4 flex justify-center gap-4">
            <button
              onClick={() => setView('loan')}
              className={`px-4 py-2 rounded-lg ${view === 'loan' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-700`}
            >
              Loan Amount
            </button>
            <button
              onClick={() => setView('own')}
              className={`px-4 py-2 rounded-lg ${view === 'own' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-700`}
            >
              Own Amount
            </button>
            <button
              onClick={() => setView('borrowed')}
              className={`px-4 py-2 rounded-lg ${view === 'borrowed' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} hover:bg-blue-700`}
            >
              Borrowed Amount
            </button>
          </div>

          <div className="mb-4">
            <button
              onClick={() => setShowAmortizationTable(!showAmortizationTable)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              {showAmortizationTable ? 'Hide Amortization Table' : 'Show Amortization Table'}
            </button>
          </div>

          {showAmortizationTable && (
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beginning Principal (A$)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Principal (A$)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Interest (A$)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total EMI (A$)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ending Principal (A$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {amortizationSchedule.map((entry, index) => (
                    <tr key={index}>
                      <td className="px-4 py-4 text-sm text-gray-700">{entry.month}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.beginningPrincipal)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.monthlyPrincipal)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.monthlyInterest)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.totalEMI)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.endingPrincipal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'loan' && (
            <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month/Year</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Repay</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calculations.yearlyAvg.map((ya, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-4 text-sm text-gray-700">{`Year ${ya.year}`}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayBank * 12)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayBank * 12 * (emiPlan.interestPerAnnum / 100))}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayBank)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayBank * 12)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency((emiPlan.loanAmount * emiPlan.bankPercent / 100) - (ya.avgRepayBank * idx * 12))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {view === 'own' && (
            <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month/Year</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Repay</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calculations.yearlyAvg.map((ya, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-4 text-sm text-gray-700">{`Year ${ya.year}`}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayOwn * 12)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayOwn * 12 * (emiPlan.ownFundsInterestRate / 100))}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayOwn)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayOwn * 12)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency((emiPlan.loanAmount * emiPlan.ownPercent / 100) - (ya.avgRepayOwn * idx * 12))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {view === 'borrowed' && (
            <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month/Year</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrowed</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Repay</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrowed Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {calculations.yearlyAvg.map((ya, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-4 text-sm text-gray-700">{`Year ${ya.year}`}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayBorrowed * 12)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayBorrowed * 12 * (emiPlan.borrowedFundsInterestRate / 100))}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayBorrowed)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(ya.avgRepayBorrowed * 12)}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(emiPlan.borrowedFunds - (ya.avgRepayBorrowed * idx * 12))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term (Years)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Amount (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Repay Loan (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <select
                    value={emiPlan.typeOfLoan}
                    onChange={(e) => handleInputChange('typeOfLoan', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                      className="mt-2 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter custom loan type"
                    />
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    value={emiPlan.loanTenure || ''}
                    onChange={(e) => handleInputChange('loanTenure', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    step="1"
                    placeholder="7"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <CurrencyInput
                    value={emiPlan.loanAmount}
                    onChange={(value) => handleInputChange('loanAmount', value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    placeholder="3,00,000"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    value={emiPlan.interestPerAnnum || ''}
                    onChange={(e) => handleInputChange('interestPerAnnum', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.1"
                    placeholder="9"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    value={emiPlan.bankPercent || ''}
                    onChange={(e) => handleInputChange('bankPercent', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="70"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    value={emiPlan.ownPercent || ''}
                    onChange={(e) => handleInputChange('ownPercent', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="30"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(emiPlan.loanAmount * emiPlan.bankPercent / 100)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(emiPlan.loanAmount * emiPlan.ownPercent / 100)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.bankYear1Principal + calculations.bankYear1Interest)}</td>
              </tr>
            </tbody>
          </table>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Amount (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenure (Years)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment Total (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Repay Own (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(emiPlan.loanAmount * emiPlan.ownPercent / 100)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    value={emiPlan.ownTenure || ''}
                    onChange={(e) => handleInputChange('ownTenure', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    step="1"
                    placeholder="2"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    value={emiPlan.ownFundsInterestRate || ''}
                    onChange={(e) => handleInputChange('ownFundsInterestRate', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.1"
                    placeholder="9"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.ownYear1Principal)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.ownYear1Interest)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.ownYear1Total)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.ownYear1Principal + calculations.ownYear1Interest)}</td>
              </tr>
            </tbody>
          </table>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrowed Funds?</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Borrowed Amount (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenure (Years)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment Total (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Repay Borrowed (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <select
                    value={emiPlan.hasBorrowedFunds}
                    onChange={(e) => handleInputChange('hasBorrowedFunds', e.target.value as 'yes' | 'no')}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <CurrencyInput
                    value={emiPlan.borrowedFunds}
                    onChange={(value) => handleInputChange('borrowedFunds', value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    placeholder="3,00,000"
                    disabled={emiPlan.hasBorrowedFunds === 'no'}
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    value={emiPlan.borrowedTenure || ''}
                    onChange={(e) => handleInputChange('borrowedTenure', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="1"
                    step="1"
                    placeholder="2"
                    disabled={emiPlan.hasBorrowedFunds === 'no'}
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <input
                    type="number"
                    value={emiPlan.borrowedFundsInterestRate || ''}
                    onChange={(e) => handleInputChange('borrowedFundsInterestRate', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.1"
                    placeholder="9"
                    disabled={emiPlan.hasBorrowedFunds === 'no'}
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.borrowedYear1Principal)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.borrowedYear1Interest)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.borrowedYear1Total)}</td>
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.borrowedYear1Principal + calculations.borrowedYear1Interest)}</td>
              </tr>
            </tbody>
          </table>
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue 1 (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue 2 (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <select
                    value={emiPlan.revenuePeriod}
                    onChange={(e) => handleInputChange('revenuePeriod', e.target.value as 'monthly' | 'yearly')}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <CurrencyInput
                    value={emiPlan.revenue1}
                    onChange={(value) => handleInputChange('revenue1', value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    placeholder="3,00,000"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  <CurrencyInput
                    value={emiPlan.revenue2}
                    onChange={(value) => handleInputChange('revenue2', value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    placeholder="3,00,000"
                  />
                </td>
                <td className="px-4 py-4 text-sm text-gray-700">
                  {emiPlan.expenses.map((expense, index) => (
                    <div key={index} className="mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={expense.name}
                          onChange={(e) => handleExpenseChange(index, 'name', e.target.value)}
                          className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Expense Name"
                        />
                        <CurrencyInput
                          value={expense.amount}
                          onChange={(value) => handleExpenseChange(index, 'amount', value)}
                          className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="1000"
                          placeholder="0"
                        />
                        <select
                          value={expense.period}
                          onChange={(e) => handleExpenseChange(index, 'period', e.target.value as 'monthly' | 'yearly')}
                          className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                        {index >= 2 && (
                          <button
                            onClick={() => removeExpense(index)}
                            className="ml-2 text-red-600 hover:text-red-800"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {emiPlan.expenses.length < 3 && (
                    <button
                      onClick={addExpense}
                      className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                    >
                      Add Expense
                    </button>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
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
      </motion.div>
    </div>
  );
}