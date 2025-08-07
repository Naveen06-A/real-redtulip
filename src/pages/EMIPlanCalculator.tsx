import React, { useState, useMemo, useCallback, useRef } from 'react';
    import { createRoot } from 'react-dom/client';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
    import { Bar } from 'react-chartjs-2';
    import { X, Save, Eye, Download, Calendar } from 'lucide-react';

    ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

    interface Expense {
      name: string;
      amount: number;
      period: 'monthly' | 'yearly';
    }

    interface EMIPlan {
      typeOfLoan: string;
      customLoanType: string;
      repaymentTerm: 'months' | 'years';
      loanTenure: number;
      loanAmount: number;
      interestPerAnnum: number;
      hasMonthlyRepayment: 'yes' | 'no';
      ownFunds: number;
      ownFundsInterestRate: number;
      hasBorrowedFunds: 'yes' | 'no';
      borrowedFunds: number;
      borrowedFundsInterestRate: number;
      revenue1: number;
      revenue2: number;
      revenuePeriod: 'monthly' | 'yearly';
      expenses: Expense[];
    }

    interface EMICalculations {
      monthlyInterest: number;
      monthlyRepayment: number;
      monthlyTotal: number;
      ownFundsMonthlyPrincipal: number;
      ownFundsMonthlyInterest: number;
      ownFundsMonthlyTotal: number;
      borrowedFundsMonthlyPrincipal: number;
      borrowedFundsMonthlyInterest: number;
      borrowedFundsMonthlyTotal: number;
      totalRevenue: number;
      totalExpenses: number;
      monthlyProfitLoss: number;
      yearlyProfitLoss: number;
    }

    interface AmortizationSchedule {
      month: number;
      beginningPrincipal: number;
      monthlyPrincipal: number;
      monthlyInterest: number;
      totalEMI: number;
      endingPrincipal: number;
    }

    interface YearlyTotal {
      year: number;
      totalPrincipalPaid: number;
      totalInterestPaid: number;
      remainingPrincipal: number;
    }

    interface SavedPlan {
      id: string;
      emiPlan: EMIPlan;
      calculations: EMICalculations;
    }

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
      return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
      }).format(value);
    };

    const calculateEMI = (plan: EMIPlan): { calculations: EMICalculations; schedule: AmortizationSchedule[]; yearlyTotals: YearlyTotal[] } => {
      const loanTenureMonths = plan.repaymentTerm === 'years' ? plan.loanTenure * 12 : plan.loanTenure;
      const monthlyRepayment = plan.hasMonthlyRepayment === 'yes' && loanTenureMonths > 0 ? plan.loanAmount / loanTenureMonths : 0;
      const monthlyInterest = plan.hasMonthlyRepayment === 'yes' ? (plan.loanAmount * (plan.interestPerAnnum / 100)) / 12 : 0;
      const monthlyTotal = monthlyRepayment + monthlyInterest;
      const ownFundsMonthlyPrincipal = loanTenureMonths > 0 ? plan.ownFunds / loanTenureMonths : 0;
      const ownFundsMonthlyInterest = (plan.ownFunds * (plan.ownFundsInterestRate / 100)) / 12;
      const ownFundsMonthlyTotal = ownFundsMonthlyPrincipal + ownFundsMonthlyInterest;
      const borrowedFundsMonthlyPrincipal = plan.hasBorrowedFunds === 'yes' && loanTenureMonths > 0 ? plan.borrowedFunds / loanTenureMonths : 0;
      const borrowedFundsMonthlyInterest = plan.hasBorrowedFunds === 'yes' ? (plan.borrowedFunds * (plan.borrowedFundsInterestRate / 100)) / 12 : 0;
      const borrowedFundsMonthlyTotal = borrowedFundsMonthlyPrincipal + borrowedFundsMonthlyInterest;
      const totalRevenue = plan.revenuePeriod === 'yearly' ? (plan.revenue1 + plan.revenue2) / 12 : plan.revenue1 + plan.revenue2;
      const totalExpenses = plan.expenses.reduce((sum, expense) => {
        const amount = expense.period === 'yearly' ? expense.amount / 12 : expense.amount;
        return sum + amount;
      }, 0);
      const monthlyProfitLoss = totalRevenue - (monthlyTotal + ownFundsMonthlyTotal + borrowedFundsMonthlyTotal + totalExpenses);
      const yearlyProfitLoss = monthlyProfitLoss * 12;

      const schedule: AmortizationSchedule[] = [];
      const yearlyTotals: YearlyTotal[] = [];
      let remainingPrincipal = plan.loanAmount;
      let totalPrincipalPaid = 0;
      let totalInterestPaid = 0;

      for (let month = 1; month <= loanTenureMonths; month++) {
        const monthlyInterest = plan.hasMonthlyRepayment === 'yes' ? (remainingPrincipal * (plan.interestPerAnnum / 100)) / 12 : 0;
        const totalEMI = monthlyRepayment + monthlyInterest;
        const endingPrincipal = remainingPrincipal - monthlyRepayment;
        schedule.push({
          month,
          beginningPrincipal: remainingPrincipal,
          monthlyPrincipal: monthlyRepayment,
          monthlyInterest,
          totalEMI,
          endingPrincipal: endingPrincipal > 0 ? endingPrincipal : 0,
        });
        totalPrincipalPaid += monthlyRepayment;
        totalInterestPaid += monthlyInterest;
        remainingPrincipal = endingPrincipal > 0 ? endingPrincipal : 0;

        if (month % 12 === 0 || month === loanTenureMonths) {
          yearlyTotals.push({
            year: Math.ceil(month / 12),
            totalPrincipalPaid,
            totalInterestPaid,
            remainingPrincipal: remainingPrincipal > 0 ? remainingPrincipal : 0,
          });
        }
      }

      return {
        calculations: {
          monthlyInterest,
          monthlyRepayment,
          monthlyTotal,
          ownFundsMonthlyPrincipal,
          ownFundsMonthlyInterest,
          ownFundsMonthlyTotal,
          borrowedFundsMonthlyPrincipal,
          borrowedFundsMonthlyInterest,
          borrowedFundsMonthlyTotal,
          totalRevenue,
          totalExpenses,
          monthlyProfitLoss,
          yearlyProfitLoss,
        },
        schedule,
        yearlyTotals,
      };
    };

    const validateInputs = (plan: EMIPlan): string | null => {
      if (plan.typeOfLoan === '') return 'Type of Loan must be selected.';
      if (plan.typeOfLoan === 'Manual Entry' && plan.customLoanType.trim() === '') {
        return 'Custom Loan Type cannot be empty.';
      }
      if (plan.loanAmount < 0) return 'Loan Amount cannot be negative.';
      if (plan.ownFunds < 0) return 'Own Funds cannot be negative.';
      if (plan.hasBorrowedFunds === 'yes' && plan.borrowedFunds < 0) return 'Borrowed Funds cannot be negative.';
      if (plan.loanTenure <= 0) return 'Loan Tenure must be greater than zero.';
      if (plan.hasMonthlyRepayment === 'yes' && plan.interestPerAnnum < 0) return 'Interest Per Annum cannot be negative.';
      if (plan.ownFundsInterestRate < 0) return 'Own Funds Interest Rate cannot be negative.';
      if (plan.hasBorrowedFunds === 'yes' && plan.borrowedFundsInterestRate < 0) return 'Borrowed Funds Interest Rate cannot be negative.';
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
        repaymentTerm: 'years',
        loanTenure: 0,
        loanAmount: 0,
        interestPerAnnum: 0,
        hasMonthlyRepayment: 'no',
        ownFunds: 0,
        ownFundsInterestRate: 0,
        hasBorrowedFunds: 'no',
        borrowedFunds: 0,
        borrowedFundsInterestRate: 0,
        revenue1: 0,
        revenue2: 0,
        revenuePeriod: 'monthly',
        expenses: [
          { name: 'Expense 1', amount: 0, period: 'monthly' },
          { name: 'Expense 2', amount: 0, period: 'monthly' },
        ],
      });
      const [error, setError] = useState<string | null>(null);
      const [showPreview, setShowPreview] = useState(false);
      const [showSchedule, setShowSchedule] = useState(false);
      const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() => {
        const saved = localStorage.getItem('emiPlans');
        return saved ? JSON.parse(saved) : [];
      });

      const { calculations, schedule, yearlyTotals } = useMemo(() => calculateEMI(emiPlan), [emiPlan]);

      const handleInputChange = useCallback(
        (field: keyof EMIPlan, value: string | 'months' | 'years' | 'monthly' | 'yearly' | 'yes' | 'no' | number) => {
          setEmiPlan((prev) => {
            const updatedPlan = {
              ...prev,
              [field]: field === 'repaymentTerm' || field === 'typeOfLoan' || field === 'revenuePeriod' || field === 'hasBorrowedFunds' || field === 'hasMonthlyRepayment' ? value : typeof value === 'number' ? value : parseInt(value) || 0,
            };
            if (field === 'typeOfLoan' && value !== 'Manual Entry') {
              updatedPlan.customLoanType = '';
            }
            if (field === 'hasBorrowedFunds' && value === 'no') {
              updatedPlan.borrowedFunds = 0;
              updatedPlan.borrowedFundsInterestRate = 0;
            }
            if (field === 'hasMonthlyRepayment' && value === 'no') {
              updatedPlan.interestPerAnnum = 0;
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
        link.href = '#';
        link.download = 'EMIBreakdown.pdf';
        link.click();
      }, [emiPlan]);

      const chartData = useMemo(() => ({
        labels: ['Bank Loan', 'Own Funds', emiPlan.hasBorrowedFunds === 'yes' ? 'Borrowed Funds' : '', 'Expenses', 'Profit/Loss'],
        datasets: [
          {
            label: 'Principal/Expenses',
            data: [
              emiPlan.hasMonthlyRepayment === 'yes' ? calculations.monthlyRepayment : 0,
              calculations.ownFundsMonthlyPrincipal,
              emiPlan.hasBorrowedFunds === 'yes' ? calculations.borrowedFundsMonthlyPrincipal : 0,
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
              emiPlan.hasMonthlyRepayment === 'yes' ? calculations.monthlyInterest : 0,
              calculations.ownFundsMonthlyInterest,
              emiPlan.hasBorrowedFunds === 'yes' ? calculations.borrowedFundsMonthlyInterest : 0,
              0,
              calculations.monthlyProfitLoss < 0 ? Math.abs(calculations.monthlyProfitLoss) : 0,
            ],
            backgroundColor: '#EF444480',
            borderColor: '#EF4444',
            borderWidth: 1,
          },
        ],
      }), [calculations, emiPlan.hasBorrowedFunds, emiPlan.hasMonthlyRepayment]);

      const chartOptions = useMemo(() => ({
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: 'Monthly Financial Breakdown (A$)' },
          tooltip: {
            callbacks: {
              label: (context: any) => {
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
              callback: (value: any) => formatCurrency(value),
            },
          },
        },
      }), []);

      const loanTypeOptions = [
        'Business Loan',
        'Vehicle Loan',
        'Electronics Loan',
        'House Loan',
        'Personal Loan',
        'Manual Entry',
      ];

      const breakdownItems = [
        { label: 'Type of Loan', value: emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType || 'Not specified' : emiPlan.typeOfLoan || 'Not specified' },
        { label: `Loan Tenure (${emiPlan.repaymentTerm})`, value: `${emiPlan.loanTenure} ${emiPlan.repaymentTerm}` },
        { label: 'Loan Amount', value: formatCurrency(emiPlan.loanAmount) },
        ...(emiPlan.hasMonthlyRepayment === 'yes' ? [
          { label: 'Interest Per Annum', value: formatPercentage(emiPlan.interestPerAnnum) },
          { label: 'Monthly Interest', value: formatCurrency(calculations.monthlyInterest) },
          { label: 'Monthly Repayment', value: formatCurrency(calculations.monthlyRepayment) },
          { label: 'Monthly Repayments + Interest', value: formatCurrency(calculations.monthlyTotal), bold: true },
        ] : []),
        { label: 'Own Funds', value: formatCurrency(emiPlan.ownFunds) },
        { label: 'Own Funds Interest Rate (Annual)', value: formatPercentage(emiPlan.ownFundsInterestRate) },
        { label: 'Own Funds Monthly Principal Repayment', value: formatCurrency(calculations.ownFundsMonthlyPrincipal) },
        { label: 'Own Funds Monthly Interest', value: formatCurrency(calculations.ownFundsMonthlyInterest) },
        { label: 'Total Monthly Allocation for Own Funds', value: formatCurrency(calculations.ownFundsMonthlyTotal), bold: true },
        ...(emiPlan.hasBorrowedFunds === 'yes' ? [
          { label: 'Borrowed Funds', value: formatCurrency(emiPlan.borrowedFunds) },
          { label: 'Borrowed Funds Interest Rate (Annual)', value: formatPercentage(emiPlan.borrowedFundsInterestRate) },
          { label: 'Borrowed Funds Monthly Principal Repayment', value: formatCurrency(calculations.borrowedFundsMonthlyPrincipal) },
          { label: 'Borrowed Funds Monthly Interest', value: formatCurrency(calculations.borrowedFundsMonthlyInterest) },
          { label: 'Total Monthly Allocation for Borrowed Funds', value: formatCurrency(calculations.borrowedFundsMonthlyTotal), bold: true },
        ] : []),
        { label: 'Total Expenses', value: formatCurrency(calculations.totalExpenses), bold: true },
        { label: 'Monthly Profit/Loss', value: `${formatCurrency(calculations.monthlyProfitLoss)} ${calculations.monthlyProfitLoss >= 0 ? '(Profit)' : '(Loss)'}`, bold: true },
        { label: 'Yearly Profit/Loss', value: `${formatCurrency(calculations.yearlyProfitLoss)} ${calculations.yearlyProfitLoss >= 0 ? '(Profit)' : '(Loss)'}`, bold: true },
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Do you pay monthly repayments?</label>
                <select
                  value={emiPlan.hasMonthlyRepayment}
                  onChange={(e) => handleInputChange('hasMonthlyRepayment', e.target.value as 'yes' | 'no')}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {emiPlan.hasMonthlyRepayment === 'yes' && (
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
              )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Do you have borrowed funds?</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Borrowed Funds (A$)</label>
                    <CurrencyInput
                      value={emiPlan.borrowedFunds}
                      onChange={(value) => handleInputChange('borrowedFunds', value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="1000"
                      placeholder="1,234,567"
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
                </>
              )}
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Revenue Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Period</label>
                  <select
                    value={emiPlan.revenuePeriod}
                    onChange={(e) => handleInputChange('revenuePeriod', e.target.value as 'monthly' | 'yearly')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue 1 (A$)</label>
                  <CurrencyInput
                    value={emiPlan.revenue1}
                    onChange={(value) => handleInputChange('revenue1', value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    placeholder="1,234,567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue 2 (A$)</label>
                  <CurrencyInput
                    value={emiPlan.revenue2}
                    onChange={(value) => handleInputChange('revenue2', value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="1000"
                    placeholder="1,234,567"
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
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                    <select
                      value={expense.period}
                      onChange={(e) => handleExpenseChange(index, 'period', e.target.value as 'monthly' | 'yearly')}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                onClick={() => setShowSchedule(true)}
                className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-4 py-2 rounded-lg font-semibold hover:from-teal-700 hover:to-teal-800 flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Calendar className="w-5 h-5" />
                View Schedule
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {breakdownItems.map((item, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
                    <p className={`text-sm ${item.bold ? 'font-bold' : 'font-medium'} text-gray-900`}>{item.label}</p>
                    <p className={`text-sm text-right ${item.bold ? 'font-bold' : ''} text-gray-700`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {emiPlan.loanTenure > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Financial Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Summary</h3>
                    <table className="min-w-full bg-white">
                      <tbody>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-900">Total Loan Amount</td>
                          <td className="py-2 text-sm text-right text-gray-700">{formatCurrency(emiPlan.loanAmount)}</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-900">Total Principal Paid (Full Tenure)</td>
                          <td className="py-2 text-sm text-right text-gray-700">
                            {formatCurrency(yearlyTotals.length > 0 ? yearlyTotals[yearlyTotals.length - 1].totalPrincipalPaid : 0)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-900">Total Interest Paid (Full Tenure)</td>
                          <td className="py-2 text-sm text-right text-gray-700">
                            {formatCurrency(yearlyTotals.length > 0 ? yearlyTotals[yearlyTotals.length - 1].totalInterestPaid : 0)}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-900">Monthly Profit/Loss</td>
                          <td className="py-2 text-sm text-right text-gray-700 font-bold">
                            {formatCurrency(calculations.monthlyProfitLoss)} {calculations.monthlyProfitLoss >= 0 ? '(Profit)' : '(Loss)'}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2 text-sm font-medium text-gray-900">Yearly Profit/Loss</td>
                          <td className="py-2 text-sm text-right text-gray-700 font-bold">
                            {formatCurrency(calculations.yearlyProfitLoss)} {calculations.yearlyProfitLoss >= 0 ? '(Profit)' : '(Loss)'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4">Monthly Breakdown Chart</h3>
                    <Bar data={chartData} options={chartOptions} />
                  </div>
                </div>
              </div>
            )}

            {showSchedule && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Amortization Schedule</h2>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Loan Repayment Progress</h3>
                  <AnimatePresence>
                    {yearlyTotals.map((total) => (
                      <motion.div
                        key={total.year}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="mb-4"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-600">Year {total.year}</span>
                          <span className="text-sm font-medium text-gray-600">
                            {emiPlan.loanAmount > 0 ? ((total.totalPrincipalPaid / emiPlan.loanAmount) * 100).toFixed(1) : 0}% Paid
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <motion.div
                            className="bg-gradient-to-r from-green-400 to-green-600 h-2.5 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: emiPlan.loanAmount > 0 ? `${(total.totalPrincipalPaid / emiPlan.loanAmount) * 100}%` : '0%' }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Beginning Principal (A$)</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Principal (A$)</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Monthly Interest (A$)</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total EMI (A$)</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ending Principal (A$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {schedule.map((row) => (
                        <React.Fragment key={row.month}>
                          <tr>
                            <td className="px-6 py-4 text-sm text-left text-gray-700">{row.month}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(row.beginningPrincipal)}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(row.monthlyPrincipal)}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(row.monthlyInterest)}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(row.totalEMI)}</td>
                            <td className="px-6 py-4 text-sm text-right text-gray-700">{formatCurrency(row.endingPrincipal)}</td>
                          </tr>
                          {row.month % 12 === 0 && (
                            <tr className="bg-gray-100">
                              <td className="px-6 py-4 text-sm font-bold text-gray-900" colSpan={6}>
                                Year {Math.ceil(row.month / 12)} Total: Principal Paid - {formatCurrency(yearlyTotals.find((t) => t.year === Math.ceil(row.month / 12))?.totalPrincipalPaid || 0)}, Interest Paid - {formatCurrency(yearlyTotals.find((t) => t.year === Math.ceil(row.month / 12))?.totalInterestPaid || 0)}, Remaining Principal - {formatCurrency(yearlyTotals.find((t) => t.year === Math.ceil(row.month / 12))?.remainingPrincipal || 0)}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      );
    }
