import React, { useState, useMemo, useCallback, useRef } from 'react';
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
  revenue1: number;
  revenue2: number;
  revenuePeriod: 'monthly' | 'yearly';
  expenses: Expense[];
}

interface PeriodData {
  period: number; // Represents year or month
  revenue: number;
  expenses: number;
  ownAmount: number;
  ownRepayment: number;
  loanAmount: number;
  loanRepayment: number;
  ownInterest: number;
  loanInterest: number;
  pl: number;
}

interface Calculations {
  bankYear1Principal: number;
  bankYear1Interest: number;
  bankYear1Total: number;
  ownYear1Principal: number;
  ownYear1Interest: number;
  ownYear1Total: number;
  yearlyAvg: PeriodData[];
  monthlyAvg: PeriodData[];
  totalBankInterest: number;
  totalOwnInterest: number;
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
  const loanTenureMonths = plan.loanTenure * 12;
  const ownTenureMonths = plan.ownTenure * 12;
  const maxMonths = Math.max(loanTenureMonths, ownTenureMonths, 1);
  const yearlyRevenue = plan.revenuePeriod === 'yearly' ? plan.revenue1 + plan.revenue2 : (plan.revenue1 + plan.revenue2) * 12;
  const monthlyRevenue = plan.revenuePeriod === 'yearly' ? (plan.revenue1 + plan.revenue2) / 12 : plan.revenue1 + plan.revenue2;
  const yearlyExpenses = plan.expenses.reduce((sum, expense) => {
    const amount = expense.period === 'yearly' ? expense.amount : expense.amount * 12;
    return sum + amount;
  }, 0);
  const monthlyExpenses = plan.expenses.reduce((sum, expense) => {
    const amount = expense.period === 'monthly' ? expense.amount : expense.amount / 12;
    return sum + amount;
  }, 0);

  let remainingBank = bankLoanAmount;
  let remainingOwn = ownFunds;
  let currentMonth = 1;
  let currentYear = 1;
  let bankYear1Principal = 0;
  let bankYear1Interest = 0;
  let ownYear1Principal = 0;
  let ownYear1Interest = 0;
  let yearPrincipalBank = 0;
  let yearInterestBank = 0;
  let yearPrincipalOwn = 0;
  let yearInterestOwn = 0;
  let yearTotalRepayment = 0;
  let totalBankInterest = 0;
  let totalOwnInterest = 0;
  const yearlyAvg: PeriodData[] = [];
  const monthlyAvg: PeriodData[] = [];

  while (currentMonth <= maxMonths) {
    let interestBank = 0;
    let principalBank = 0;
    if (currentMonth <= loanTenureMonths) {
      interestBank = remainingBank * (plan.interestPerAnnum / 100 / 12);
      principalBank = bankLoanAmount / loanTenureMonths;
      remainingBank -= principalBank;
      remainingBank = Math.max(remainingBank, 0);
      totalBankInterest += interestBank;
    }

    let interestOwn = 0;
    let principalOwn = 0;
    if (currentMonth <= ownTenureMonths) {
      interestOwn = remainingOwn * (plan.ownFundsInterestRate / 100 / 12);
      principalOwn = ownFunds / ownTenureMonths;
      remainingOwn -= principalOwn;
      remainingOwn = Math.max(remainingOwn, 0);
      totalOwnInterest += interestOwn;
    }

    yearInterestBank += interestBank;
    yearPrincipalBank += principalBank;
    yearInterestOwn += interestOwn;
    yearPrincipalOwn += principalOwn;
    yearTotalRepayment += (interestBank + principalBank) + (interestOwn + principalOwn);

    // Monthly data
    const monthlyRepayment = (principalBank + interestBank) + (principalOwn + interestOwn);
    monthlyAvg.push({
      period: currentMonth,
      revenue: monthlyRevenue,
      expenses: monthlyExpenses,
      ownAmount: ownFunds,
      ownRepayment: principalOwn + interestOwn,
      loanAmount: bankLoanAmount,
      loanRepayment: principalBank + interestBank,
      ownInterest: interestOwn,
      loanInterest: interestBank,
      pl: monthlyRevenue - (monthlyExpenses + monthlyRepayment),
    });

    if (currentMonth % 12 === 0 || currentMonth === maxMonths) {
      const monthsInYear = currentMonth % 12 === 0 ? 12 : currentMonth % 12;
      const totalInterestOverTerm = (totalBankInterest + totalOwnInterest) / Math.max(plan.loanTenure, plan.ownTenure);
      yearlyAvg.push({
        period: currentYear,
        revenue: yearlyRevenue,
        expenses: yearlyExpenses,
        ownAmount: ownFunds,
        ownRepayment: (yearPrincipalOwn + yearInterestOwn) * monthsInYear,
        loanAmount: bankLoanAmount,
        loanRepayment: (yearPrincipalBank + yearInterestBank) * monthsInYear,
        ownInterest: yearInterestOwn,
        loanInterest: yearInterestBank,
        pl: yearlyRevenue - (yearTotalRepayment + totalInterestOverTerm + yearlyExpenses),
      });

      if (currentYear === 1) {
        bankYear1Principal = yearPrincipalBank;
        bankYear1Interest = yearInterestBank;
        ownYear1Principal = yearPrincipalOwn;
        ownYear1Interest = yearInterestOwn;
      }

      yearPrincipalBank = 0;
      yearInterestBank = 0;
      yearPrincipalOwn = 0;
      yearInterestOwn = 0;
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
    yearlyAvg,
    monthlyAvg,
    totalBankInterest,
    totalOwnInterest,
  };
};

const validateInputs = (plan: EMIPlan): string | null => {
  if (plan.typeOfLoan === '') return 'Type of Loan must be selected.';
  if (plan.typeOfLoan === 'Manual Entry' && plan.customLoanType.trim() === '') {
    return 'Custom Loan Type cannot be empty.';
  }
  if (plan.bankPercent + plan.ownPercent !== 100) {
    return 'Bank and Own percentages must add up to 100%';
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
  const [showAmortizationTable, setShowAmortizationTable] = useState(false);
  const [plPeriod, setPlPeriod] = useState<'monthly' | 'yearly'>('yearly');

  const calculations = useMemo(() => calculateEMI(emiPlan), [emiPlan]);

  const handleInputChange = useCallback(
    (field: keyof EMIPlan, value: string | 'monthly' | 'yearly' | number) => {
      setEmiPlan((prev) => {
        let updatedPlan = {
          ...prev,
          [field]: field === 'typeOfLoan' || field === 'revenuePeriod' ? value : typeof value === 'number' ? value : parseFloat(value) || 0,
        };

        if (field === 'bankPercent') {
          updatedPlan = {
            ...updatedPlan,
            ownPercent: 100 - (typeof value === 'number' ? value : parseFloat(value as string) || 0),
          };
        } else if (field === 'ownPercent') {
          updatedPlan = {
            ...updatedPlan,
            bankPercent: 100 - (typeof value === 'number' ? value : parseFloat(value as string) || 0),
          };
        }

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

  const amortizationSchedule = useMemo(() => {
    const schedule = [];
    const bankLoanAmount = emiPlan.loanAmount * emiPlan.bankPercent / 100;
    const bankMonthlyPrincipal = bankLoanAmount / (emiPlan.loanTenure * 12);
    let bankRemainingPrincipal = bankLoanAmount;

    const ownAmount = emiPlan.loanAmount * emiPlan.ownPercent / 100;
    const ownMonthlyPrincipal = ownAmount / (emiPlan.ownTenure * 12);
    let ownRemainingPrincipal = ownAmount;

    const maxMonths = Math.max(emiPlan.loanTenure * 12, emiPlan.ownTenure * 12);

    for (let month = 1; month <= maxMonths; month++) {
      let bankMonthlyInterest = 0;
      let bankTotalEMI = 0;
      if (month <= emiPlan.loanTenure * 12) {
        bankMonthlyInterest = bankRemainingPrincipal * (emiPlan.interestPerAnnum / 100 / 12);
        bankTotalEMI = bankMonthlyPrincipal + bankMonthlyInterest;
        bankRemainingPrincipal -= bankMonthlyPrincipal;
        if (bankRemainingPrincipal < 0) bankRemainingPrincipal = 0;
      }

      let ownMonthlyInterest = 0;
      let ownTotalEMI = 0;
      if (month <= emiPlan.ownTenure * 12) {
        ownMonthlyInterest = ownRemainingPrincipal * (emiPlan.ownFundsInterestRate / 100 / 12);
        ownTotalEMI = ownMonthlyPrincipal + ownMonthlyInterest;
        ownRemainingPrincipal -= ownMonthlyPrincipal;
        if (ownRemainingPrincipal < 0) ownRemainingPrincipal = 0;
      }

      schedule.push({
        month,
        bankBeginningPrincipal: bankRemainingPrincipal + bankMonthlyPrincipal,
        bankMonthlyPrincipal,
        bankMonthlyInterest,
        bankTotalEMI,
        bankEndingPrincipal: bankRemainingPrincipal,
        ownBeginningPrincipal: ownRemainingPrincipal + ownMonthlyPrincipal,
        ownMonthlyPrincipal,
        ownMonthlyInterest,
        ownTotalEMI,
        ownEndingPrincipal: ownRemainingPrincipal,
      });
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
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6 text-center bg-blue-200">EMI Plan Calculator</h1>

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
          {/* Loan Details Tables */}
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
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.bankYear1Total)}</td>
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
                <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(calculations.ownYear1Total)}</td>
              </tr>
            </tbody>
          </table>

          {/* Expenses Table */}
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

          {/* Profit/Loss Overview */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-center bg-blue-200 w-full py-2">Profit/Loss Overview</h2>
            </div>
            <div className="mb-4 flex justify-center">
              <select
                value={plPeriod}
                onChange={(e) => setPlPeriod(e.target.value as 'monthly' | 'yearly')}
                className="p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="yearly">Yearly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{plPeriod === 'yearly' ? 'Year' : 'Month'}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Amount (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Amount Repayment (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount Repayment (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Amount Interest (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Interest (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P/L (₹)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P/L Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(plPeriod === 'yearly' ? calculations.yearlyAvg : calculations.monthlyAvg).map((entry, index) => {
                    const maxPL = Math.max(...(plPeriod === 'yearly' ? calculations.yearlyAvg : calculations.monthlyAvg).map(e => Math.abs(e.pl))) || 1;
                    const progress = (Math.abs(entry.pl) / maxPL) * 100;

                    return (
                      <tr key={index}>
                        <td className="px-4 py-4 text-sm text-gray-700">{entry.period}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.revenue)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.expenses)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.ownAmount)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.ownRepayment)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.loanAmount)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.loanRepayment)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.ownInterest)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.loanInterest)}</td>
                        <td className={`px-4 py-4 text-sm font-medium ${entry.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(entry.pl)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                              className={`${entry.pl >= 0 ? 'bg-green-600' : 'bg-red-600'} h-2.5 rounded-full`}
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs">{progress.toFixed(1)}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown Section */}
          <div className="mt-8">
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
                <table className="min-w-full bg-white border border-gray-200 rounded-lg mb-8">
                  <thead>
                    <tr className="bg-gray-50">
                      <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Month</th>
                      <th colSpan={6} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Loan Details</th>
                      <th colSpan={6} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">Own Funds Details</th>
                    </tr>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beginning Principal (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total EMI (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ending Principal (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beginning Principal (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Principal (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total EMI (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ending Principal (₹)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {amortizationSchedule.map((entry, index) => {
                      const totalLoan = emiPlan.loanAmount * emiPlan.bankPercent / 100;
                      const loanProgress = totalLoan ? ((totalLoan - entry.bankEndingPrincipal) / totalLoan) * 100 : 0;
                      const totalOwn = emiPlan.loanAmount * emiPlan.ownPercent / 100;
                      const ownProgress = totalOwn ? ((totalOwn - entry.ownEndingPrincipal) / totalOwn) * 100 : 0;
                      return (
                        <tr key={index}>
                          <td className="px-4 py-4 text-sm text-gray-700">{entry.month}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.bankBeginningPrincipal)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.bankMonthlyPrincipal)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.bankMonthlyInterest)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.bankTotalEMI)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.bankEndingPrincipal)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-blue-600 h-2.5 rounded-full"
                                style={{ width: `${loanProgress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">{loanProgress.toFixed(1)}%</span>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.ownBeginningPrincipal)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.ownMonthlyPrincipal)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.ownMonthlyInterest)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.ownTotalEMI)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(entry.ownEndingPrincipal)}</td>
                          <td className="px-4 py-4 text-sm text-gray-700">
                            <div className="w-full bg-gray-200 rounded-full h-2.5">
                              <div
                                className="bg-green-600 h-2.5 rounded-full"
                                style={{ width: `${ownProgress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">{ownProgress.toFixed(1)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Yearly Average Repayment Breakdown */}
            <div className="mb-8">
              <h2 className="text-xl font-bold mb-4 bg-blue-200">Yearly Average Repayment Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-3 bg-blue-200">Yearly Average Repayment</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank (₹)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own (₹)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {calculations.yearlyAvg.map((year, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-700">{year.period}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(year.loanRepayment)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(year.ownRepayment)}</td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-700">{formatCurrency(year.ownRepayment + year.loanRepayment)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-3 bg-blue-200">Yearly Interest Breakdown</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank Interest (₹)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Interest (₹)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Interest (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {calculations.yearlyAvg.map((year, index) => (
                          <tr key={index}>
                            <td className="px-4 py-2 text-sm text-gray-700">{year.period}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(year.loanInterest)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(year.ownInterest)}</td>
                            <td className="px-4 py-2 text-sm font-medium text-gray-700">{formatCurrency(year.loanInterest + year.ownInterest)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Profit/Loss Summary */}
            <div className="mb-8 bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-3 bg-blue-200">Profit/Loss Summary</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue (₹)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses (₹)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Payments (₹)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Interest (₹)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P/L (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {calculations.yearlyAvg.map((year, index) => {
                      const totalInterestOverTerm = (calculations.totalBankInterest + calculations.totalOwnInterest) / Math.max(emiPlan.loanTenure, emiPlan.ownTenure);
                      return (
                        <tr key={index}>
                          <td className="px-4 py-2 text-sm text-gray-700">{year.period}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(year.revenue)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(year.expenses)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(year.loanRepayment + year.ownRepayment)}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">{formatCurrency(totalInterestOverTerm)}</td>
                          <td className={`px-4 py-2 text-sm font-medium ${year.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(year.pl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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
      </motion.div>
    </div>
  );
}