import { motion } from 'framer-motion';
import { Download, Eye, Save, X, Edit, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generatePLPDFBlob,
  generateAmortizationPDFBlob,
  generateYearlyBreakdownPDFBlob,
  generateCompletePDFBlob,
  generateLoanAmortizationPDFBlob,
  generateOwnAmortizationPDFBlob,
} from './PDFGenerator';

// Interfaces and utility functions remain unchanged
export interface Revenue {
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
}
export interface Expense {
  name: string;
  amount: number;
  period: 'monthly' | 'yearly';
}
export interface EMIPlan {
  typeOfLoan: string;
  customLoanType: string;
  loanTenure: number;
  loanAmount: number;
  interestPerAnnum: number;
  bankPercent: number;
  ownPercent: number;
  ownFundsInterestRate: number;
  ownTenure: number;
  revenues: Revenue[];
  expenses: Expense[];
  rentalRevenue?: number;
  perDollarValue?: number;
  rentRollPurchaseValue?: number;
  gstPercentage?: number;
}
export interface PeriodData {
  period: number;
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
export interface Calculations {
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
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

const parseNumberInput = (value: string): number => {
  if (value === '') return 0;
  const cleaned = value.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    return parseFloat(parts[0] + '.' + parts.slice(1).join(''));
  }
  return parseFloat(cleaned) || 0;
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
  const [displayValue, setDisplayValue] = useState<string>(formatNumberInput(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayValue(formatNumberInput(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    if (/^[\d,.]*$/.test(input)) {
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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

const calculateEMI = (plan: EMIPlan): Calculations => {
  const effectiveLoanAmount = plan.gstPercentage ? plan.loanAmount * (1 + plan.gstPercentage / 100) : plan.loanAmount;
  const bankLoanAmount = effectiveLoanAmount * plan.bankPercent / 100;
  const ownFunds = effectiveLoanAmount * plan.ownPercent / 100;
  const loanTenureMonths = plan.loanTenure * 12;
  const ownTenureMonths = plan.ownTenure * 12;
  const maxMonths = Math.max(loanTenureMonths, ownTenureMonths, 1);

  const yearlyRevenue = plan.revenues.reduce((sum, rev) => {
    let amount = 0;
    if (rev.period === 'monthly') {
      amount = rev.amount;
    } else if (rev.period === 'yearly') {
      amount = rev.amount * 12;
    }
    return amount + sum;
  }, 0);

  const monthlyRevenue = plan.revenues.reduce((sum, rev) => {
    let amount = 0;
    if (rev.period === 'monthly') {
      amount = rev.amount;
    }
    return amount + sum;
  }, 0);

  const yearlyExpenses = plan.expenses.reduce((sum, expense) => {
    let amount = 0;
    if (expense.period === 'monthly') {
      amount = expense.amount;
    } else if (expense.period === 'yearly') {
      amount = expense.amount * 12;
    }
    return sum + amount;
  }, 0);

  const monthlyExpenses = plan.expenses.reduce((sum, expense) => {
    let amount = 0;
    if (expense.period === 'monthly') {
      amount = expense.amount;
    }
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
    yearTotalRepayment += (interestBank + principalBank) + (interestOwn + interestOwn);

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
      yearlyAvg.push({
        period: currentYear,
        revenue: yearlyRevenue,
        expenses: yearlyExpenses,
        ownAmount: ownFunds,
        ownRepayment: yearPrincipalOwn + yearInterestOwn,
        loanAmount: bankLoanAmount,
        loanRepayment: yearPrincipalBank + yearInterestBank,
        ownInterest: yearInterestOwn,
        loanInterest: yearInterestBank,
        pl: yearlyRevenue - (yearTotalRepayment + yearlyExpenses),
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
  if (plan.revenues.some((revenue) => revenue.amount < 0)) return 'Revenues cannot be negative.';
  if (plan.expenses.some((expense) => expense.amount < 0)) return 'Expenses cannot be negative.';
  if (plan.rentalRevenue && plan.rentalRevenue < 0) return 'Rental Revenue cannot be negative.';
  if (plan.perDollarValue && plan.perDollarValue < 0) return 'Per $ Value cannot be negative.';
  if (plan.gstPercentage && (plan.gstPercentage < 0 || plan.gstPercentage > 100)) return 'GST Percentage must be between 0 and 100.';
  if (plan.revenues.length < 2) return 'At least two revenues are required.';
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
    revenues: [
      { name: 'Revenue 1', amount: 0, period: 'monthly' },
      { name: 'Revenue 2', amount: 0, period: 'monthly' },
    ],
    expenses: [
      { name: 'Expense 1', amount: 0, period: 'monthly' },
      { name: 'Expense 2', amount: 0, period: 'monthly' },
    ],
    rentalRevenue: 0,
    perDollarValue: 0,
    rentRollPurchaseValue: 0,
    gstPercentage: 0,
  });

  const createNewPlan = useCallback(() => {
    setEmiPlan({
      typeOfLoan: '',
      customLoanType: '',
      loanTenure: 0,
      loanAmount: 0,
      interestPerAnnum: 0,
      bankPercent: 70,
      ownPercent: 30,
      ownFundsInterestRate: 0,
      ownTenure: 0,
      revenues: [
        { name: 'Revenue 1', amount: 0, period: 'monthly' },
        { name: 'Revenue 2', amount: 0, period: 'monthly' },
      ],
      expenses: [
        { name: 'Expense 1', amount: 0, period: 'monthly' },
        { name: 'Expense 2', amount: 0, period: 'monthly' },
      ],
      rentalRevenue: 0,
      perDollarValue: 0,
      rentRollPurchaseValue: 0,
      gstPercentage: 0,
    });
    setError(null);
  }, []);

  const [showYearlyBreakdownTable, setShowYearlyBreakdownTable] = useState(false);
  const [showCompleteTable, setShowCompleteTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
    const saved = localStorage.getItem('emiPlans');
    return saved ? JSON.parse(saved) : [];
  });
  const [amortizationView, setAmortizationView] = useState<'combined' | 'loan' | 'own'>('combined');
  const [showAmortizationTable, setShowAmortizationTable] = useState<boolean>(false);
  const [plPeriod, setPlPeriod] = useState<'monthly' | 'yearly'>('yearly');

  const calculations = useMemo(() => calculateEMI(emiPlan), [emiPlan]);

  const handleInputChange = useCallback(
    (field: keyof EMIPlan, value: string | 'monthly' | 'yearly' | number) => {
      setEmiPlan((prev) => {
        let updatedPlan = { ...prev };
        if (field === 'typeOfLoan') {
          updatedPlan = {
            ...prev,
            typeOfLoan: value as string,
            bankPercent: value === 'Rent Roll' ? 70 : prev.bankPercent,
            ownPercent: value === 'Rent Roll' ? 30 : prev.ownPercent,
          };
          if (value !== 'Manual Entry') {
            updatedPlan.customLoanType = '';
          }
          if (value !== 'Rent Roll') {
            updatedPlan.rentalRevenue = 0;
            updatedPlan.perDollarValue = 0;
            updatedPlan.rentRollPurchaseValue = 0;
            updatedPlan.loanAmount = 0;
          } else {
            updatedPlan.loanAmount = prev.rentRollPurchaseValue || 0;
          }
        } else if (field === 'rentalRevenue' || field === 'perDollarValue') {
          const newValue = typeof value === 'number' ? value : parseNumberInput(value as string);
          const rentalRevenue = field === 'rentalRevenue' ? newValue : (prev.rentalRevenue || 0);
          const perDollarValue = field === 'perDollarValue' ? newValue : (prev.perDollarValue || 0);
          const rentRollPurchaseValue = Math.round(rentalRevenue * perDollarValue * 100) / 100;
          updatedPlan = {
            ...prev,
            [field]: newValue,
            rentRollPurchaseValue,
            loanAmount: prev.typeOfLoan === 'Rent Roll' ? rentRollPurchaseValue : prev.loanAmount,
          };
        } else if (field === 'gstPercentage') {
          const newGstPercentage = typeof value === 'number' ? value : parseFloat(value as string) || 0;
          const baseLoanAmount = prev.loanAmount / (1 + (prev.gstPercentage || 0) / 100);
          const newLoanAmount = baseLoanAmount * (1 + newGstPercentage / 100);
          updatedPlan = {
            ...prev,
            gstPercentage: newGstPercentage,
            loanAmount: newLoanAmount,
          };
        } else if (field === 'bankPercent') {
          const newBankPercent = typeof value === 'number' ? value : parseFloat(value as string) || 0;
          updatedPlan = {
            ...prev,
            bankPercent: newBankPercent,
            ownPercent: 100 - newBankPercent,
          };
        } else if (field === 'ownPercent') {
          const newOwnPercent = typeof value === 'number' ? value : parseFloat(value as string) || 0;
          updatedPlan = {
            ...prev,
            ownPercent: newOwnPercent,
            bankPercent: 100 - newOwnPercent,
          };
        } else {
          updatedPlan = {
            ...prev,
            [field]: typeof value === 'number' ? value : parseFloat(value as string) || 0,
          };
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

  const handleRevenueChange = useCallback(
    (index: number, field: 'name' | 'amount' | 'period', value: string | number | 'monthly' | 'yearly') => {
      setEmiPlan((prev) => {
        const updatedRevenues = [...prev.revenues];
        updatedRevenues[index] = {
          ...updatedRevenues[index],
          [field]: field === 'amount' ? (typeof value === 'number' ? value : parseNumberInput(value as string)) : value,
        };
        const updatedPlan = { ...prev, revenues: updatedRevenues };
        const validationError = validateInputs(updatedPlan);
        setError(validationError);
        return updatedPlan;
      });
    },
    []
  );

  const addRevenue = useCallback(() => {
    if (emiPlan.revenues.length < 3) {
      setEmiPlan((prev) => ({
        ...prev,
        revenues: [...prev.revenues, { name: 'Others', amount: 0, period: 'monthly' }],
      }));
    }
  }, [emiPlan.revenues.length]);

  const removeRevenue = useCallback(
    (index: number) => {
      if (emiPlan.revenues.length > 2) {
        setEmiPlan((prev) => {
          const updatedRevenues = prev.revenues.filter((_, i) => i !== index);
          const updatedPlan = { ...prev, revenues: updatedRevenues };
          const validationError = validateInputs(updatedPlan);
          setError(validationError);
          return updatedPlan;
        });
      }
    },
    [emiPlan.revenues.length]
  );

  const handleExpenseChange = useCallback(
    (index: number, field: 'name' | 'amount' | 'period', value: string | number | 'monthly' | 'yearly') => {
      setEmiPlan((prev) => {
        const updatedExpenses = [...prev.expenses];
        updatedExpenses[index] = {
          ...updatedExpenses[index],
          [field]: field === 'amount' ? (typeof value === 'number' ? value : parseNumberInput(value as string)) : value,
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

  const deletePlan = useCallback(
    (planId: string) => {
      const updatedPlans = savedPlans.filter((p) => p.id !== planId);
      setSavedPlans(updatedPlans);
      localStorage.setItem('emiPlans', JSON.stringify(updatedPlans));
      setError('Plan deleted successfully!');
      setTimeout(() => setError(null), 3000);
    },
    [savedPlans]
  );

  const amortizationSchedule = useMemo(() => {
    const effectiveLoanAmount = emiPlan.gstPercentage ? emiPlan.loanAmount * (1 + emiPlan.gstPercentage / 100) : emiPlan.loanAmount;
    const bankLoanAmount = effectiveLoanAmount * emiPlan.bankPercent / 100;
    const bankMonthlyPrincipal = bankLoanAmount / (emiPlan.loanTenure * 12);
    let bankRemainingPrincipal = bankLoanAmount;
    const ownAmount = effectiveLoanAmount * emiPlan.ownPercent / 100;
    const ownMonthlyPrincipal = ownAmount / (emiPlan.ownTenure * 12);
    let ownRemainingPrincipal = ownAmount;
    const maxMonths = Math.max(emiPlan.loanTenure * 12, emiPlan.ownTenure * 12);
    const combinedSchedule: Array<{
      month: number;
      bankBeginningPrincipal: number;
      bankMonthlyPrincipal: number;
      bankMonthlyInterest: number;
      bankTotalEMI: number;
      bankEndingPrincipal: number;
      ownBeginningPrincipal: number;
      ownMonthlyPrincipal: number;
      ownMonthlyInterest: number;
      ownTotalEMI: number;
      ownEndingPrincipal: number;
    }> = [];
    const loanSchedule: Array<{
      month: number;
      beginningPrincipal: number;
      monthlyPrincipal: number;
      monthlyInterest: number;
      totalEMI: number;
      endingPrincipal: number;
    }> = [];
    const ownSchedule: Array<{
      month: number;
      beginningPrincipal: number;
      monthlyPrincipal: number;
      monthlyInterest: number;
      totalEMI: number;
      endingPrincipal: number;
    }> = [];

    for (let month = 1; month <= maxMonths; month++) {
      let bankMonthlyInterest = 0;
      let bankTotalEMI = 0;
      let bankBeginningPrincipal = bankRemainingPrincipal + bankMonthlyPrincipal;
      if (month <= emiPlan.loanTenure * 12) {
        bankMonthlyInterest = bankRemainingPrincipal * (emiPlan.interestPerAnnum / 100 / 12);
        bankTotalEMI = bankMonthlyPrincipal + bankMonthlyInterest;
        bankRemainingPrincipal -= bankMonthlyPrincipal;
        if (bankRemainingPrincipal < 0) bankRemainingPrincipal = 0;
      }

      let ownMonthlyInterest = 0;
      let ownTotalEMI = 0;
      let ownBeginningPrincipal = ownRemainingPrincipal + ownMonthlyPrincipal;
      if (month <= emiPlan.ownTenure * 12) {
        ownMonthlyInterest = ownRemainingPrincipal * (emiPlan.ownFundsInterestRate / 100 / 12);
        ownTotalEMI = ownMonthlyPrincipal + ownMonthlyInterest;
        ownRemainingPrincipal -= ownMonthlyPrincipal;
        if (ownRemainingPrincipal < 0) ownRemainingPrincipal = 0;
      }

      combinedSchedule.push({
        month,
        bankBeginningPrincipal,
        bankMonthlyPrincipal,
        bankMonthlyInterest,
        bankTotalEMI,
        bankEndingPrincipal: bankRemainingPrincipal,
        ownBeginningPrincipal,
        ownMonthlyPrincipal,
        ownMonthlyInterest,
        ownTotalEMI,
        ownEndingPrincipal: ownRemainingPrincipal,
      });

      if (month <= emiPlan.loanTenure * 12) {
        loanSchedule.push({
          month,
          beginningPrincipal: bankBeginningPrincipal,
          monthlyPrincipal: bankMonthlyPrincipal,
          monthlyInterest: bankMonthlyInterest,
          totalEMI: bankTotalEMI,
          endingPrincipal: bankRemainingPrincipal,
        });
      }

      if (month <= emiPlan.ownTenure * 12) {
        ownSchedule.push({
          month,
          beginningPrincipal: ownBeginningPrincipal,
          monthlyPrincipal: ownMonthlyPrincipal,
          monthlyInterest: ownMonthlyInterest,
          totalEMI: ownTotalEMI,
          endingPrincipal: ownRemainingPrincipal,
        });
      }
    }

    return { combinedSchedule, loanSchedule, ownSchedule };
  }, [emiPlan]);

  const generatePLPDFBlobLocal = useCallback(() => generatePLPDFBlob(emiPlan, calculations), [emiPlan, calculations]);
  const generateAmortizationPDFBlobLocal = useCallback(
    () => generateAmortizationPDFBlob(emiPlan, amortizationSchedule.combinedSchedule),
    [emiPlan, amortizationSchedule.combinedSchedule]
  );
  const generateLoanAmortizationPDFBlobLocal = useCallback(
    () => generateLoanAmortizationPDFBlob(emiPlan, amortizationSchedule.loanSchedule),
    [emiPlan, amortizationSchedule.loanSchedule]
  );
  const generateOwnAmortizationPDFBlobLocal = useCallback(
    () => generateOwnAmortizationPDFBlob(emiPlan, amortizationSchedule.ownSchedule),
    [emiPlan, amortizationSchedule.ownSchedule]
  );
  const generateCompletePDFBlobLocal = useCallback(() => generateCompletePDFBlob(emiPlan, calculations), [emiPlan, calculations]);
  const generateYearlyBreakdownPDFBlobLocal = useCallback(() => generateYearlyBreakdownPDFBlob(emiPlan, calculations), [emiPlan, calculations]);

  const viewPLPDF = useCallback(async () => {
    try {
      const blob = await generatePLPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated P/L PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error generating P/L PDF:', error);
      setError('Failed to generate P/L PDF');
    }
  }, [generatePLPDFBlobLocal]);

  const downloadPLPDF = useCallback(async () => {
    try {
      const blob = await generatePLPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'ProfitLossReport.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated P/L PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error downloading P/L PDF:', error);
      setError('Failed to download P/L PDF');
    }
  }, [generatePLPDFBlobLocal]);

  const viewAmortizationPDF = useCallback(async () => {
    try {
      const blob = await generateAmortizationPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Amortization PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error generating Amortization PDF:', error);
      setError('Failed to generate Amortization PDF');
    }
  }, [generateAmortizationPDFBlobLocal]);

  const downloadAmortizationPDF = useCallback(async () => {
    try {
      const blob = await generateAmortizationPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'AmortizationSchedule.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Amortization PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error downloading Amortization PDF:', error);
      setError('Failed to download Amortization PDF');
    }
  }, [generateAmortizationPDFBlobLocal]);

  const viewLoanAmortizationPDF = useCallback(async () => {
    try {
      const blob = await generateLoanAmortizationPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Loan Amortization PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error generating Loan Amortization PDF:', error);
      setError('Failed to generate Loan Amortization PDF');
    }
  }, [generateLoanAmortizationPDFBlobLocal]);

  const downloadLoanAmortizationPDF = useCallback(async () => {
    try {
      const blob = await generateLoanAmortizationPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'LoanAmortizationSchedule.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Loan Amortization PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error downloading Loan Amortization PDF:', error);
      setError('Failed to download Loan Amortization PDF');
    }
  }, [generateLoanAmortizationPDFBlobLocal]);

  const viewOwnAmortizationPDF = useCallback(async () => {
    try {
      const blob = await generateOwnAmortizationPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Own Amortization PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error generating Own Amortization PDF:', error);
      setError('Failed to generate Own Amortization PDF');
    }
  }, [generateOwnAmortizationPDFBlobLocal]);

  const downloadOwnAmortizationPDF = useCallback(async () => {
    try {
      const blob = await generateOwnAmortizationPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'OwnAmortizationSchedule.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Own Amortization PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error downloading Own Amortization PDF:', error);
      setError('Failed to download Own Amortization PDF');
    }
  }, [generateOwnAmortizationPDFBlobLocal]);

  const viewYearlyBreakdownPDF = useCallback(async () => {
    try {
      const blob = await generateYearlyBreakdownPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Yearly Breakdown PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error generating Yearly Breakdown PDF:', error);
      setError('Failed to generate Yearly Breakdown PDF');
    }
  }, [generateYearlyBreakdownPDFBlobLocal]);

  const downloadYearlyBreakdownPDF = useCallback(async () => {
    try {
      const blob = await generateYearlyBreakdownPDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'YearlyBreakdownReport.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Yearly Breakdown PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error downloading Yearly Breakdown PDF:', error);
      setError('Failed to download Yearly Breakdown PDF');
    }
  }, [generateYearlyBreakdownPDFBlobLocal]);

  const viewCompletePDF = useCallback(async () => {
    try {
      const blob = await generateCompletePDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Complete PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error generating Complete PDF:', error);
      setError('Failed to generate Complete PDF');
    }
  }, [generateCompletePDFBlobLocal]);

  const downloadCompletePDF = useCallback(async () => {
    try {
      const blob = await generateCompletePDFBlobLocal();
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'CompleteEMIPlanReport.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        throw new Error('Generated Complete PDF is not a valid Blob');
      }
    } catch (error) {
      console.error('Error downloading Complete PDF:', error);
      setError('Failed to download Complete PDF');
    }
  }, [generateCompletePDFBlobLocal]);

  const loanTypeOptions: string[] = [
    'Business Loan',
    'Vehicle Loan',
    'Electronics Loan',
    'House Loan',
    'Personal Loan',
    'Rent Roll',
    'Manual Entry',
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-100 min-h-screen">
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
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
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 bg-blue-200 text-center py-2">Saved Plans</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount ($)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Tenure (Years)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {savedPlans.map((plan) => (
                    <tr key={plan.id}>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        {plan.emiPlan.typeOfLoan === 'Manual Entry' ? plan.emiPlan.customLoanType : plan.emiPlan.typeOfLoan}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{plan.emiPlan.typeOfLoan}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{formatCurrency(plan.emiPlan.loanAmount)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{plan.emiPlan.loanTenure}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{new Date(plan.id).toLocaleString()}</td>
                      <td className="px-4 py-4 text-sm text-gray-700 flex gap-2">
                        <motion.button
                          onClick={() => loadPlan(plan.id)}
                          className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 flex items-center gap-2"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </motion.button>
                        <motion.button
                          onClick={() => deletePlan(plan.id)}
                          className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 flex items-center gap-2"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </motion.button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center mt-4">
              <motion.button
                onClick={createNewPlan}
                className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-3 rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                New Plan
              </motion.button>
            </div>
          </div>
        )}
        <div className="mb-8">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Term (Years)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount ($)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loan Amount ($)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own Fund ($)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Repay Loan ($)</th>
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
                  {emiPlan.typeOfLoan === 'Rent Roll' && (
                    <>
                      <div className="mt-2 flex gap-2">
                        <CurrencyInput
                          value={emiPlan.rentalRevenue || 0}
                          onChange={(value) => handleInputChange('rentalRevenue', value)}
                          className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Rental Revenue"
                          step="0.01"
                        />
                        <input
                          type="number"
                          value={emiPlan.perDollarValue || ''}
                          onChange={(e) => handleInputChange('perDollarValue', parseFloat(e.target.value) || 0)}
                          className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Per $ Value"
                          min="0"
                          step="0.01"
                        />
                        <CurrencyInput
                          value={emiPlan.rentRollPurchaseValue || 0}
                          onChange={() => {}} // No-op since it's read-only
                          className="w-1/3 p-2 border border-gray-300 rounded-lg bg-gray-100"
                          placeholder="Rent Roll Purchase Value"
                          disabled
                        />
                      </div>
                    </>
                  )}
                  {emiPlan.typeOfLoan && (
                    <div className="mt-2">
                      <input
                        type="number"
                        value={emiPlan.gstPercentage || ''}
                        onChange={(e) => handleInputChange('gstPercentage', parseFloat(e.target.value) || 0)}
                        className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="GST %"
                      />
                    </div>
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
                    placeholder="300,000"
                    disabled={emiPlan.typeOfLoan === 'Rent Roll'}
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
                    disabled={emiPlan.typeOfLoan === 'Rent Roll'}
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
                    disabled={emiPlan.typeOfLoan === 'Rent Roll'}
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Own fund ($)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tenure (Years)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest %</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment ($)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interest ($)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Repayment Total ($)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Repay Own ($)</th>
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
          <table className="min-w-full bg-white border border-gray-200 rounded-lg table-fixed mt-4">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenues</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-4 text-sm text-gray-700">
                  {emiPlan.revenues.map((revenue, index) => (
                    <div key={index} className="mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={revenue.name}
                          onChange={(e) => handleRevenueChange(index, 'name', e.target.value)}
                          className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="Revenue Name"
                        />
                        <CurrencyInput
                          value={revenue.amount}
                          onChange={(value) => handleRevenueChange(index, 'amount', value)}
                          className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          min="0"
                          step="0.01"
                          placeholder="0"
                        />
                        <select
                          value={revenue.period}
                          onChange={(e) => handleRevenueChange(index, 'period', e.target.value as 'monthly' | 'yearly')}
                          className="w-1/3 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                        {index >= 2 && (
                          <button
                            onClick={() => removeRevenue(index)}
                            className="ml-2 text-red-600 hover:text-red-800"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {emiPlan.revenues.length < 3 && (
                    <button
                      onClick={addRevenue}
                      className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                    >
                      Add Revenue
                    </button>
                  )}
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
                          step="0.01"
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
            <div className="flex justify-end gap-4 mb-4">
              <motion.button
                onClick={viewPLPDF}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Eye className="w-5 h-5" />
                View P/L Report
              </motion.button>
              <motion.button
                onClick={downloadPLPDF}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-5 h-5" />
                Download P/L Report
              </motion.button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full bg-white border border-gray-200 rounded-lg table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[5%]">{plPeriod === 'yearly' ? 'YR' : 'Month'}</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Rev ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Exp ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Own Amt ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Own Pay ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Loan Amt ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Loan Pay ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Own Int ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">Loan Int ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[10%]">P/L ($)</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[15%]">P/L Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(plPeriod === 'yearly' ? calculations.yearlyAvg : calculations.monthlyAvg).map((entry, index) => {
                    const maxPL = Math.max(...(plPeriod === 'yearly' ? calculations.yearlyAvg : calculations.monthlyAvg).map(e => Math.abs(e.pl))) || 1;
                    const progress = (Math.abs(entry.pl) / maxPL) * 100;
                    return (
                      <tr key={index}>
                        <td className="px-2 py-2 text-xs text-gray-700">{entry.period}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{formatCurrency(entry.revenue)}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{formatCurrency(entry.expenses)}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{formatCurrency(entry.ownAmount)}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{formatCurrency(entry.ownRepayment)}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{formatCurrency(entry.loanAmount)}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{formatCurrency(entry.loanRepayment)}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{formatCurrency(entry.ownInterest)}</td>
                        <td className="px-2 py-2 text-xs text-gray-700">{formatCurrency(entry.loanInterest)}</td>
                        <td className={`px-2 py-2 text-xs font-medium ${entry.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(entry.pl)}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-700">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`${entry.pl >= 0 ? 'bg-green-600' : 'bg-red-600'} h-2 rounded-full`}
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
            <div className="mt-6 flex flex-wrap gap-4">
              <motion.button
                onClick={() => setShowAmortizationTable(!showAmortizationTable)}
                className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-indigo-700 hover:to-indigo-800"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {showAmortizationTable ? 'Hide Amortization Table' : 'Show Amortization Table'}
              </motion.button>
              {showAmortizationTable && (
                <div className="flex items-center">
                  <label htmlFor="amortizationView" className="mr-2 text-sm font-medium text-gray-700">
                    View:
                  </label>
                  <select
                    id="amortizationView"
                    value={amortizationView}
                    onChange={(e) => setAmortizationView(e.target.value as 'combined' | 'loan' | 'own')}
                    className="block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="combined">Combined</option>
                    <option value="loan">Loan Only</option>
                    <option value="own">Own Funds Only</option>
                  </select>
                </div>
              )}
              <motion.button
                onClick={() => setShowYearlyBreakdownTable(!showYearlyBreakdownTable)}
                className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-teal-700 hover:to-teal-800"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {showYearlyBreakdownTable ? 'Hide Yearly Breakdown' : 'Show Yearly Breakdown'}
              </motion.button>
            </div>
            {showAmortizationTable && amortizationView === 'combined' && (
              <div className="overflow-x-auto mt-6">
                <div className="flex justify-end gap-4 mb-4">
                  <motion.button
                    onClick={viewAmortizationPDF}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Eye className="w-5 h-5" />
                    View Amortization
                  </motion.button>
                  <motion.button
                    onClick={downloadAmortizationPDF}
                    className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download className="w-5 h-5" />
                    Download Amortization
                  </motion.button>
                </div>
                <table className="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th
                        rowSpan={2}
                        className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300"
                        style={{ width: '80px' }}
                      >
                        Month
                      </th>
                      <th
                        colSpan={5}
                        className="px-4 py-3 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300"
                      >
                        Loan Details
                      </th>
                      <th
                        colSpan={5}
                        className="px-4 py-3 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-300"
                      >
                        Own Funds Details
                      </th>
                    </tr>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '120px' }}>
                        Beg Principal ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '100px' }}>
                        Principal ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '100px' }}>
                        Interest ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '100px' }}>
                        Total EMI ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '120px' }}>
                        End Principal ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '120px' }}>
                        Beg Principal ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '100px' }}>
                        Principal ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '100px' }}>
                        Interest ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300 text-right" style={{ width: '100px' }}>
                        Total EMI ($)
                      </th>
                      <th className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider text-right" style={{ width: '120px' }}>
                        End Principal ($)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {amortizationSchedule.combinedSchedule.map((entry, index) => (
                      <tr key={index} className="hover:bg gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200" style={{ width: '80px' }}>
                          {entry.month}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '120px' }}>
                          {formatCurrency(entry.bankBeginningPrincipal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                          {formatCurrency(entry.bankMonthlyPrincipal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                          {formatCurrency(entry.bankMonthlyInterest)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                          {formatCurrency(entry.bankTotalEMI)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '120px' }}>
                          {formatCurrency(entry.bankEndingPrincipal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '120px' }}>
                          {formatCurrency(entry.ownBeginningPrincipal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                          {formatCurrency(entry.ownMonthlyPrincipal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                          {formatCurrency(entry.ownMonthlyInterest)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                          {formatCurrency(entry.ownTotalEMI)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-right" style={{ width: '120px' }}>
                          {formatCurrency(entry.ownEndingPrincipal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {showAmortizationTable && amortizationView === 'loan' && (
              <div className="overflow-x-auto mt-6">
                <div className="flex justify-end gap-4 mb-4">
                  <motion.button
                    onClick={viewLoanAmortizationPDF}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Eye className="w-5 h-5" />
                    View Loan Amortization
                  </motion.button>
                  <motion.button
                    onClick={downloadLoanAmortizationPDF}
                    className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                     <Download className="w-5 h-5" />
                      Download Loan Amortization
                    </motion.button>
                  </div>
                  <table className="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '80px' }}>
                          Month
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '120px' }}>
                          Beginning Principal ($)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '100px' }}>
                          Monthly Principal ($)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '100px' }}>
                          Monthly Interest ($)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '100px' }}>
                          Total EMI ($)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider" style={{ width: '120px' }}>
                          Ending Principal ($)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {amortizationSchedule.loanSchedule.map((entry, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200" style={{ width: '80px' }}>
                            {entry.month}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '120px' }}>
                            {formatCurrency(entry.beginningPrincipal)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                            {formatCurrency(entry.monthlyPrincipal)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                            {formatCurrency(entry.monthlyInterest)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                            {formatCurrency(entry.totalEMI)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right" style={{ width: '120px' }}>
                            {formatCurrency(entry.endingPrincipal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {showAmortizationTable && amortizationView === 'own' && (
                <div className="overflow-x-auto mt-6">
                  <div className="flex justify-end gap-4 mb-4">
                    <motion.button
                      onClick={viewOwnAmortizationPDF}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 flex items-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Eye className="w-5 h-5" />
                      View Own Amortization
                    </motion.button>
                    <motion.button
                      onClick={downloadOwnAmortizationPDF}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 flex items-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Download className="w-5 h-5" />
                      Download Own Amortization
                    </motion.button>
                  </div>
                  <table className="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '80px' }}>
                          Month
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '120px' }}>
                          Beginning Principal ($)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '100px' }}>
                          Monthly Principal ($)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '100px' }}>
                          Monthly Interest ($)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300" style={{ width: '100px' }}>
                          Total EMI ($)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider" style={{ width: '120px' }}>
                          Ending Principal ($)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {amortizationSchedule.ownSchedule.map((entry, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200" style={{ width: '80px' }}>
                            {entry.month}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '120px' }}>
                            {formatCurrency(entry.beginningPrincipal)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                            {formatCurrency(entry.monthlyPrincipal)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                            {formatCurrency(entry.monthlyInterest)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right" style={{ width: '100px' }}>
                            {formatCurrency(entry.totalEMI)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 text-right" style={{ width: '120px' }}>
                            {formatCurrency(entry.endingPrincipal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {showYearlyBreakdownTable && (
                <div className="mt-6">
                  <div className="flex justify-end gap-4 mb-4">
                    <motion.button
                      onClick={viewYearlyBreakdownPDF}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 flex items-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Eye className="w-5 h-5" />
                      View Yearly Breakdown
                    </motion.button>
                    <motion.button
                      onClick={downloadYearlyBreakdownPDF}
                      className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 flex items-center gap-2"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Download className="w-5 h-5" />
                      Download Yearly Breakdown
                    </motion.button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300 rounded-lg shadow-sm">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Year</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Revenue ($)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Expenses ($)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Own Amount ($)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Own Repayment ($)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Loan Amount ($)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Loan Repayment ($)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Own Interest ($)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-300">Loan Interest ($)</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">P/L ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {calculations.yearlyAvg.map((entry, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200">{entry.period}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right">{formatCurrency(entry.revenue)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right">{formatCurrency(entry.expenses)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right">{formatCurrency(entry.ownAmount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right">{formatCurrency(entry.ownRepayment)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right">{formatCurrency(entry.loanAmount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right">{formatCurrency(entry.loanRepayment)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right">{formatCurrency(entry.ownInterest)}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-200 text-right">{formatCurrency(entry.loanInterest)}</td>
                            <td className={`px-4 py-3 text-sm text-right ${entry.pl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(entry.pl)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              <motion.button
                onClick={savePlan}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Save className="w-5 h-5" />
                Save Plan
              </motion.button>
              <motion.button
                onClick={viewCompletePDF}
                className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-purple-800 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Eye className="w-5 h-5" />
                View Complete Report
              </motion.button>
              <motion.button
                onClick={downloadCompletePDF}
                className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-green-700 hover:to-green-800 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-5 h-5" />
                Download Complete Report
              </motion.button>
              <motion.button
                onClick={createNewPlan}
                className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                New Plan
              </motion.button>
            </div>
          </div>
        
      </motion.div>
    </div>
  );
}