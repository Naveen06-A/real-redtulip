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

// Helper function to create the Harcourts Success header
const createHeader = (doc: jsPDF, pageWidth: number, margin: number, title: string) => {
  // Draw the H with a thin light blue line underneath
  doc.setFontSize(24);
  doc.setTextColor(0, 0, 139); // Dark blue for H
  doc.text('H', pageWidth / 2 - 22, margin + 12, { align: 'center' });
  
  // Thin light blue line under H
  doc.setDrawColor(173, 216, 230); // Light blue
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 25, margin + 14, pageWidth / 2 - 19, margin + 14);
  
  // Harcourts in blue
  doc.setTextColor(0, 0, 139); // Blue color
  doc.setFontSize(18);
  doc.text('ARCOURTS', pageWidth / 2+9, margin + 12, { align: 'center' });
  
  // Success in light blue
  doc.setTextColor(173, 216, 230); // Light blue color
  doc.setFontSize(14);
  doc.text('SUCCESS', pageWidth / 2+10, margin + 20, { align: 'right' });
  
  // Report title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(title, pageWidth / 2, margin + 28, { align: 'center' });
};

export const generatePLPDFBlob = (emiPlan: EMIPlan, calculations: Calculations): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    doc.internal.scaleFactor = 1.78;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;

    // Set background and border
    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header with new Harcourts Success branding
    createHeader(doc, pageWidth, margin, 'Profit/Loss Overview Report');

    // Plan details
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 4, margin + 34, { align: 'right' });

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
      startY: margin + 40,
      head: [['Loan Details', 'Values']],
      body: loanData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 8,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7,
        halign: 'center',
        cellPadding: 1.5,
      },
      margin: { left: margin + 2, right: pageWidth / 2 + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold' },
        1: { cellWidth: 25 },
      },
    });

    // Revenue & Expenses table
    const revenueExpenseData = [
      ...emiPlan.revenues.map(rev => [rev.name, formatCurrency(rev.amount), rev.period, 'Revenue']),
      ...emiPlan.expenses.map(exp => [exp.name, formatCurrency(exp.amount), exp.period, 'Expense']),
    ];

    autoTable(doc, {
      startY: margin + 40,
      head: [['Name', 'Amount', 'Period', 'Type']],
      body: revenueExpenseData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 8,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7,
        halign: 'center',
        cellPadding: 1.5,
      },
      margin: { left: pageWidth / 2 + 2, right: margin + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 15 },
      },
    });

    // P/L data table - Add table name above
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Profit/Loss Yearly Summary', margin + 4, margin + 140);
    
    const plData = calculations.yearlyAvg.map(entry => [
      entry.period.toString(),
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
      startY: margin + 145,
      head: [['YR', 'Rev', 'Exps', 'Own Amt', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Sta']],
      body: plData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 5,
        halign: 'center',
        cellPadding: 0.8,
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 16.5, overflow: 'linebreak' },
        2: { cellWidth: 16.5, overflow: 'linebreak' },
        3: { cellWidth: 16.5, overflow: 'linebreak' },
        4: { cellWidth: 16.5, overflow: 'linebreak' },
        5: { cellWidth: 16.5, overflow: 'linebreak' },
        6: { cellWidth: 16.5, overflow: 'linebreak' },
        7: { cellWidth: 16.5, overflow: 'linebreak' },
        8: { cellWidth: 16.5, overflow: 'linebreak' },
        9: { cellWidth: 16.5, overflow: 'linebreak' },
        10: { cellWidth: 12 },
      },
      pageBreak: 'auto',
      willDrawCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 10) {
            const cellValue = data.cell.raw as string;
            doc.setFillColor(...(cellValue === 'Profit' ? [220, 255, 220] : [255, 220, 220]) as [number, number, number]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          }
          if (data.column.index === 9) {
            const cellValue = data.cell.raw as string;
            const numericValue = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
            doc.setTextColor(...(numericValue >= 0 ? [0, 128, 0] : [200, 0, 0]) as [number, number, number]);
          }
        }
      },
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

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
      compress: true
    });

    doc.internal.scaleFactor = 1.78;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;

    // Set background and border
    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header with new Harcourts Success branding
    createHeader(doc, pageWidth, margin, 'Amortization Schedule Report');

    // Plan details
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 4, margin + 34, { align: 'right' });

    // Add table name above
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Amortization Schedule Details', margin + 4, margin + 40);
    
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
      startY: margin + 45,
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
        fontSize: 7,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: 1.5,
      },
      margin: { left: margin + 2, right: margin + 2 },
      tableWidth: contentWidth - 4,
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 18 },
        2: { cellWidth: 16 },
        3: { cellWidth: 16 },
        4: { cellWidth: 16 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 16 },
        8: { cellWidth: 16 },
        9: { cellWidth: 16 },
        10: { cellWidth: 18 },
      },
      pageBreak: 'avoid',
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};

export const generateCompletePDFBlob = (emiPlan: EMIPlan, calculations: Calculations): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    doc.internal.scaleFactor = 1.78;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;

    // Set background and border
    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header with new Harcourts Success branding
    createHeader(doc, pageWidth, margin, 'Complete EMI Plan Report');

    // Plan details
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 4, margin + 34, { align: 'right' });

    // Loan details table - Add table name above
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Loan Details', margin + 4, margin + 40);
    
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
      startY: margin + 45,
      head: [['Loan Details', 'Values']],
      body: loanData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 8,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7,
        halign: 'center',
        cellPadding: 1.5,
      },
      margin: { left: margin + 2, right: pageWidth / 2 + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold' },
        1: { cellWidth: 25 },
      },
    });

    // Revenue & Expenses table - Add table name above
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Revenue & Expenses', pageWidth / 2 + 4, margin + 40);
    
    const revenueExpenseData = [
      ...emiPlan.revenues.map(rev => [rev.name, formatCurrency(rev.amount), rev.period, 'Rev']),
      ...emiPlan.expenses.map(exp => [exp.name, formatCurrency(exp.amount), exp.period, 'Exps']),
    ];

    autoTable(doc, {
      startY: margin + 45,
      head: [['Name', 'Amount', 'Period', 'Type']],
      body: revenueExpenseData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 8,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 7,
        halign: 'center',
        cellPadding: 1.5,
      },
      margin: { left: pageWidth / 2 + 2, right: margin + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 15 },
      },
    });

    // P/L data table - Add table name above
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Profit/Loss Yearly Summary', margin + 4, margin + 110);
    
    const plData = calculations.yearlyAvg.map(entry => [
      entry.period.toString(),
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
      startY: margin + 115,
      head: [['YR', 'Rev', 'Exps', 'Own Amt', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Sta']],
      body: plData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 5,
        halign: 'center',
        cellPadding: 0.8,
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 16.5, overflow: 'linebreak' },
        2: { cellWidth: 16.5, overflow: 'linebreak' },
        3: { cellWidth: 16.5, overflow: 'linebreak' },
        4: { cellWidth: 16.5, overflow: 'linebreak' },
        5: { cellWidth: 16.5, overflow: 'linebreak' },
        6: { cellWidth: 16.5, overflow: 'linebreak' },
        7: { cellWidth: 16.5, overflow: 'linebreak' },
        8: { cellWidth: 16.5, overflow: 'linebreak' },
        9: { cellWidth: 16.5, overflow: 'linebreak' },
        10: { cellWidth: 12 },
      },
      pageBreak: 'auto',
      willDrawCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 10) {
            const cellValue = data.cell.raw as string;
            doc.setFillColor(...(cellValue === 'Profit' ? [220, 255, 220] : [255, 220, 220]) as [number, number, number]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          }
          if (data.column.index === 9) {
            const cellValue = data.cell.raw as string;
            const numericValue = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
            doc.setTextColor(...(numericValue >= 0 ? [0, 128, 0] : [200, 0, 0]) as [number, number, number]);
          }
        }
      },
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};