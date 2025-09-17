
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EMIPlan, Calculations } from './EMIPlanCalculator';

interface AmortizationScheduleEntry {
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
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
};

export const generatePLPDFBlob = (emiPlan: EMIPlan, calculations: Calculations): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF({
      orientation: 'protrait',
      unit: 'mm',
      format: 'a3',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 4;
    const contentWidth = pageWidth - 2 * margin;

    // Set background and border
    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 139);
    doc.text('HARCOURTS', pageWidth / 2, margin + 4, { align: 'center' });
    doc.setDrawColor(0, 191, 255);
    doc.setLineWidth(0.2);
    doc.line(pageWidth / 2 - 8, margin + 6, pageWidth / 2 + 8, margin + 6);
    doc.setTextColor(0, 191, 255);
    doc.setFontSize(10);
    doc.text('SUCCESS', pageWidth / 2, margin + 10, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text('Profit/Loss Overview Report', pageWidth / 2, margin + 14, { align: 'center' });

    // Plan details
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 2, margin + 18);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 2, margin + 18, { align: 'right' });

    // Loan details table
    const loanData = [
      ['Type', planName],
      ['Tenure (Yrs)', emiPlan.loanTenure.toString()],
      ['Amount', formatCurrency(emiPlan.loanAmount)],
      ['Int. Rate', `${emiPlan.interestPerAnnum}%`],
      ['Bank %', `${emiPlan.bankPercent}%`],
      ['Own %', `${emiPlan.ownPercent}%`],
      ['Own Tenure', emiPlan.ownTenure.toString()],
      ['Own Int.', `${emiPlan.ownFundsInterestRate}%`],
      ['GST %', `${emiPlan.gstPercentage || 0}%`],
    ];

    autoTable(doc, {
      startY: margin + 20,
      head: [['Loan Details', 'Values']],
      body: loanData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 4.5,
        halign: 'center',
        cellPadding: 0.6,
      },
      margin: { left: margin + 2, right: pageWidth / 2 + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
      },
    });

    // Revenue & Expenses table
    const revenueExpenseData = [
      ...emiPlan.revenues.map(rev => [rev.name, formatCurrency(rev.amount), rev.period, 'Revenue']),
      ...emiPlan.expenses.map(exp => [exp.name, formatCurrency(exp.amount), exp.period, 'Expense']),
    ];

    autoTable(doc, {
      startY: margin + 20,
      head: [['Name', 'Amount', 'Period', 'Type']],
      body: revenueExpenseData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 4.5,
        halign: 'center',
        cellPadding: 0.8,
      },
      margin: { left: pageWidth / 2 + 2, right: margin + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 14 },
        2: { cellWidth: 19 },
        3: { cellWidth: 19 },
      },
    });

    // P/L data table
    const plData = calculations.yearlyAvg.map(entry => [
      `Year ${entry.period}`,
      formatCurrency(entry.revenue),
      formatCurrency(entry.expenses),
      formatCurrency(entry.ownAmount),
      formatCurrency(entry.ownRepayment),
      formatCurrency(entry.loanAmount),
      formatCurrency(entry.loanRepayment),
      formatCurrency(entry.ownInterest),
      formatCurrency(entry.loanInterest),
      formatCurrency(entry.pl),
      entry.pl >= 0 ? 'Profit' : 'Loss',
    ]);

    autoTable(doc, {
      startY: margin + 80,
      head: [['Period', 'Revenue', 'Expenses', 'Own Amt', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Status']],
      body: plData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 4.5,
        halign: 'center',
        cellPadding: 1.3,
      },
      margin: { left: margin + 2, right: margin + 2 },
      tableWidth: contentWidth - 4,
      columnStyles: {
        0: { cellWidth: 13 },
        1: { cellWidth: 13 },
        2: { cellWidth: 13 },
        3: { cellWidth: 13 },
        4: { cellWidth: 13 },
        5: { cellWidth: 13 },
        6: { cellWidth: 13 },
        7: { cellWidth: 13 },
        8: { cellWidth: 13 },
        9: { cellWidth: 24 }, // P/L column
        10: { cellWidth: 8 }, // Status column
      },
      pageBreak: 'avoid',
      didDrawCell: (data) => {
        if (data.section === 'body' && (data.column.index === 9 || data.column.index === 10)) {
          const cellValue = data.cell.raw as string;
          if (data.column.index === 10) {
            doc.setFillColor(...(cellValue === 'Profit' ? [220, 255, 220] : [255, 220, 220]) as [number, number, number]);
            doc.setTextColor(...(cellValue === 'Profit' ? [0, 128, 0] : [200, 0, 0]) as [number, number, number]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          } else if (data.column.index === 9) {
            const numericValue = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
            doc.setTextColor(...(numericValue >= 0 ? [0, 128, 0] : [200, 0, 0]) as [number, number, number]);
          }
          doc.text(cellValue, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
            align: 'center',
            baseline: 'middle',
          });
        }
      },
    });

    // Footer
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 2, { align: 'center' });

    // Return PDF as Blob
    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};

export const generateAmortizationPDFBlob = (emiPlan: EMIPlan, amortizationSchedule: AmortizationScheduleEntry[]): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 4;
    const contentWidth = pageWidth - 2 * margin;

    // Set background and border
    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 139);
    doc.text('HARCOURTS', pageWidth / 2, margin + 4, { align: 'center' });
    doc.setDrawColor(0, 191, 255);
    doc.setLineWidth(0.2);
    doc.line(pageWidth / 2 - 8, margin + 6, pageWidth / 2 + 8, margin + 6);
    doc.setTextColor(0, 191, 255);
    doc.setFontSize(10);
    doc.text('SUCCESS', pageWidth / 2, margin + 10, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text('Amortization Schedule Report', pageWidth / 2, margin + 14, { align: 'center' });

    // Plan details
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 2, margin + 18);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 2, margin + 18, { align: 'right' });

    // Amortization table
    const amortizationData = amortizationSchedule.map(entry => [
      entry.month.toString(),
      formatCurrency(entry.bankBeginningPrincipal),
      formatCurrency(entry.bankMonthlyPrincipal),
      formatCurrency(entry.bankMonthlyInterest),
      formatCurrency(entry.bankTotalEMI),
      formatCurrency(entry.bankEndingPrincipal),
      formatCurrency(entry.ownBeginningPrincipal),
      formatCurrency(entry.ownMonthlyPrincipal),
      formatCurrency(entry.ownMonthlyInterest),
      formatCurrency(entry.ownTotalEMI),
      formatCurrency(entry.ownEndingPrincipal),
    ]);

    autoTable(doc, {
      startY: margin + 20,
      head: [
        [
          { content: 'Month', rowSpan: 2 },
          { content: 'Loan Details', colSpan: 5 },
          { content: 'Own Funds Details', colSpan: 5 },
        ],
        [
          'Beginning Principal',
          'Principal',
          'Interest',
          'Total EMI',
          'Ending Principal',
          'Beginning Principal',
          'Principal',
          'Interest',
          'Total EMI',
          'Ending Principal',
        ],
      ],
      body: amortizationData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 4.5,
        halign: 'center',
        cellPadding: 0.6,
      },
      margin: { left: margin + 2, right: margin + 2 },
      tableWidth: contentWidth - 4,
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 16 },
        2: { cellWidth: 14 },
        3: { cellWidth: 14 },
        4: { cellWidth: 14 },
        5: { cellWidth: 14 },
        6: { cellWidth: 16 },
        7: { cellWidth: 14 },
        8: { cellWidth: 14 },
        9: { cellWidth: 14 },
        10: { cellWidth: 14 },
      },
      pageBreak: 'avoid',
    });

    // Footer
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 2, { align: 'center' });

    // Return PDF as Blob
    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};

export const generateCompletePDFBlob = (emiPlan: EMIPlan, calculations: Calculations): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF({
      orientation: 'protrait',
      unit: 'mm',
      format: 'a3',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 4;
    const contentWidth = pageWidth - 4 * margin;

    // Set background and border
    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 139);
    doc.text('HARCOURTS', pageWidth / 2, margin + 4, { align: 'center' });
    doc.setDrawColor(0, 191, 255);
    doc.setLineWidth(0.2);
    doc.line(pageWidth / 2 - 8, margin + 6, pageWidth / 2 + 8, margin + 6);
    doc.setTextColor(0, 191, 255);
    doc.setFontSize(10);
    doc.text('SUCCESS', pageWidth / 2, margin + 10, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text('Complete EMI Plan Report', pageWidth / 2, margin + 14, { align: 'center' });

    // Plan details
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 2, margin + 18);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 2, margin + 18, { align: 'right' });

    // Loan details table
    const loanData = [
      ['Type', planName],
      ['Tenure (Yrs)', emiPlan.loanTenure.toString()],
      ['Amount', formatCurrency(emiPlan.loanAmount)],
      ['Int. Rate', `${emiPlan.interestPerAnnum}%`],
      ['Bank %', `${emiPlan.bankPercent}%`],
      ['Own %', `${emiPlan.ownPercent}%`],
      ['Own Tenure', emiPlan.ownTenure.toString()],
      ['Own Int.', `${emiPlan.ownFundsInterestRate}%`],
      ['GST %', `${emiPlan.gstPercentage || 0}%`],
    ];

    autoTable(doc, {
      startY: margin + 20,
      head: [['Loan Details', 'Values']],
      body: loanData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 4.5,
        halign: 'center',
        cellPadding: 0.6,
      },
      margin: { left: margin + 2, right: pageWidth / 2 + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
      },
    });

    // Revenue & Expenses table
    const revenueExpenseData = [
      ...emiPlan.revenues.map(rev => [rev.name, formatCurrency(rev.amount), rev.period, 'Revenue']),
      ...emiPlan.expenses.map(exp => [exp.name, formatCurrency(exp.amount), exp.period, 'Expense']),
    ];

    autoTable(doc, {
      startY: margin + 20,
      head: [['Name', 'Amount', 'Period', 'Type']],
      body: revenueExpenseData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 4.5,
        halign: 'center',
        cellPadding: 0.6,
      },
      margin: { left: pageWidth / 2 + 2, right: margin + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 14 },
        2: { cellWidth: 14 },
        3: { cellWidth: 14 },
      },
    });

    // P/L data table
    const plData = calculations.yearlyAvg.map(entry => [
      `Year ${entry.period}`,
      formatCurrency(entry.revenue),
      formatCurrency(entry.expenses),
      formatCurrency(entry.ownAmount),
      formatCurrency(entry.ownRepayment),
      formatCurrency(entry.loanAmount),
      formatCurrency(entry.loanRepayment),
      formatCurrency(entry.ownInterest),
      formatCurrency(entry.loanInterest),
      formatCurrency(entry.pl),
      entry.pl >= 0 ? 'Profit' : 'Loss',
    ]);

    autoTable(doc, {
      startY: margin + 80,
      head: [['Period', 'Revenue', 'Expenses', 'Own Amt', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Status']],
      body: plData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 5.5,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 4.5,
        halign: 'center',
        cellPadding: 2.3,
      },
      margin: { left: margin + 2, right: margin + 2 },
      tableWidth: contentWidth - 10,
      columnStyles: {
        0: { cellWidth: 13 },
        1: { cellWidth: 13 },
        2: { cellWidth: 13 },
        3: { cellWidth: 13 },
        4: { cellWidth: 13 },
        5: { cellWidth: 13 },
        6: { cellWidth: 13 },
        7: { cellWidth: 13 },
        8: { cellWidth: 13 },
        9: { cellWidth: 24 },
        10: { cellWidth: 24 },
      },
      pageBreak: 'avoid',
      didDrawCell: (data) => {
        if (data.section === 'body' && (data.column.index === 9 || data.column.index === 10)) {
          const cellValue = data.cell.raw as string;
          if (data.column.index === 10) {
            doc.setFillColor(...(cellValue === 'Profit' ? [220, 255, 220] : [255, 220, 220]) as [number, number, number]);
            doc.setTextColor(...(cellValue === 'Profit' ? [0, 128, 0] : [200, 0, 0]) as [number, number, number]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          } else if (data.column.index === 9) {
            const numericValue = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
            doc.setTextColor(...(numericValue >= 0 ? [0, 128, 0] : [200, 0, 0]) as [number, number, number]);
          }
          doc.text(cellValue, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
            align: 'center',
            baseline: 'middle',
          });
        }
      },
    });

    // Footer
    doc.setFontSize(5);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 2, { align: 'center' });

    // Return PDF as Blob
    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};
