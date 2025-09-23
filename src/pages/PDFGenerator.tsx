import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Styles } from 'jspdf-autotable';
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

interface SingleAmortizationScheduleEntry {
  month: number;
  beginningPrincipal: number;
  monthlyPrincipal: number;
  monthlyInterest: number;
  totalEMI: number;
  endingPrincipal: number;
}

const formatCurrency = (value: number): string => {
  const isWholeNumber = Number.isInteger(value) || Math.abs(value % 1) < 0.0001;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: isWholeNumber ? 0 : 2,
    maximumFractionDigits: isWholeNumber ? 0 : 2,
  }).format(value);
};

const createHeader = (doc: jsPDF, pageWidth: number, margin: number, title: string) => {
  doc.setFontSize(24);
  doc.setTextColor(0, 0, 139);
  doc.text('H', pageWidth / 2 - 22, margin + 12, { align: 'center' });
  
  doc.setTextColor(0, 128, 255);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 25, margin + 14, pageWidth / 2 - 19, margin + 14);
  
  doc.setTextColor(0, 0, 139);
  doc.setFontSize(18);
  doc.text('ARCOURTS', pageWidth / 2 + 9, margin + 12, { align: 'center' });
  
  doc.setTextColor(0, 128, 255);
  doc.setFontSize(14);
  doc.text('SUCCESS', pageWidth / 2 + 10, margin + 20, { align: 'right' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(title, pageWidth / 2, margin + 28, { align: 'center' });
};

// Existing generatePLPDFBlob function (unchanged)
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

    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    createHeader(doc, pageWidth, margin, 'Profit/Loss Overview Report');

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);

    const loanData = [
      ['Type', planName],
      ['Tenure (Yrs)', emiPlan.loanTenure.toString()],
      ['Amount', formatCurrency(emiPlan.loanAmount)],
      ['Int. Rate', `${emiPlan.interestPerAnnum}%`],
      ['Bank %', `${emiPlan.bankPercent}%`],
      ['Own %', `${emiPlan.ownPercent}%`],
      ['GST %', `${emiPlan.gstPercentage || 0}%`],
    ];

    if (emiPlan.ownTenure !== 0) {
      loanData.push(['Own Tenure', emiPlan.ownTenure.toString()]);
    }
    if (emiPlan.ownFundsInterestRate !== 0) {
      loanData.push(['Own Int.', `${emiPlan.ownFundsInterestRate}%`]);
    }

    if (emiPlan.typeOfLoan === 'Rent Roll') {
      loanData.push(['Rental Revenue', formatCurrency(emiPlan.rentalRevenue || 0)]);
      loanData.push(['Per $ Value', formatCurrency(emiPlan.perDollarValue || 0)]);
      loanData.push(['Rent Roll Value', formatCurrency(emiPlan.rentRollPurchaseValue || 0)]);
    }

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
        overflow: 'linebreak',
      },
      margin: { left: margin + 2, right: pageWidth / 2 + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 30 },
      },
    });

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Revenue', pageWidth / 2 + 4, margin + 40);

    const revenueData = emiPlan.revenues.map(rev => [`${rev.name} (${rev.period})`, formatCurrency(rev.amount)]);

    autoTable(doc, {
      startY: margin + 45,
      head: [['Description', 'Amount']],
      body: revenueData,
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
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
      },
    });

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    const revenueTableHeight = revenueData.length * 7 + 20;
    doc.text('Expenses', pageWidth / 2 + 4, margin + 55 + revenueTableHeight);

    const expenseData = emiPlan.expenses.map(exp => [`${exp.name} (${exp.period})`, formatCurrency(exp.amount)]);

    autoTable(doc, {
      startY: margin + 60 + revenueTableHeight,
      head: [['Description', 'Amount']],
      body: expenseData,
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
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
      },
    });

    const loanTableHeight = loanData.length * 7 + 20;
    const loanDetailsTableEndY = margin + 40 + loanTableHeight;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Profit/Loss Yearly Summary', pageWidth / 2, loanDetailsTableEndY + 10 + revenueTableHeight, { align: 'center' });

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

    const ownAmtAllZero = plData.every(row => parseFloat(row[3].replace(/[^\d.-]/g, '')) === 0);
    const ownIntAllZero = plData.every(row => parseFloat(row[7].replace(/[^\d.-]/g, '')) === 0);
    const excludeOwnColumns = ownAmtAllZero && ownIntAllZero;

    const headers = excludeOwnColumns
      ? [['YR', 'Rev', 'Exps', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Loan Int', 'P/L', 'Sta']]
      : [['YR', 'Rev', 'Exps', 'Own Amt', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Sta']];

    const bodyData = excludeOwnColumns
      ? plData.map(row => [row[0], row[1], row[2], row[4], row[5], row[6], row[8], row[9], row[10]])
      : plData;

    const columnStyles = excludeOwnColumns
      ? {
          0: { cellWidth: 8 },
          1: { cellWidth: 24 },
          2: { cellWidth: 24 },
          3: { cellWidth: 24 },
          4: { cellWidth: 24 },
          5: { cellWidth: 24 },
          6: { cellWidth: 24 },
          7: { cellWidth: 24 },
          8: { cellWidth: 11 },
        }
      : {
          0: { cellWidth: 8 },
          1: { cellWidth: 19 },
          2: { cellWidth: 19 },
          3: { cellWidth: 19 },
          4: { cellWidth: 19 },
          5: { cellWidth: 19 },
          6: { cellWidth: 19 },
          7: { cellWidth: 19 },
          8: { cellWidth: 19 },
          9: { cellWidth: 19 },
          10: { cellWidth: 11 },
        };

    doc.setFont('helvetica', 'narrow');
    autoTable(doc, {
      startY: loanDetailsTableEndY + 15 + revenueTableHeight,
      head: headers,
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 8,
        halign: 'center',
        fontStyle: 'bold',
        minCellWidth: 8,
        cellPadding: 0.8,
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: 0.4,
        overflow: 'linebreak',
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      tableLineWidth: 0.15,
      columnStyles: columnStyles,
      pageBreak: 'auto',
      willDrawCell: (data) => {
        if (data.section === 'body') {
          const plIndex = excludeOwnColumns ? 7 : 9;
          const staIndex = excludeOwnColumns ? 8 : 10;
          if (data.column.index === staIndex) {
            const cellValue = data.cell.raw as string;
            doc.setFillColor(...(cellValue === 'Profit' ? [220, 255, 220] : [255, 220, 220]) as [number, number, number]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          }
          if (data.column.index === plIndex) {
            const cellValue = data.cell.raw as string;
            const numericValue = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
            doc.setTextColor(...(numericValue >= 0 ? [0, 128, 0] : [200, 0, 0]) as [number, number, number]);
          }
        }
      },
      didParseCell: (data) => {
        if (data.section === 'head' || data.section === 'body') {
          const text = data.cell.raw as string;
          const textWidth = doc.getTextWidth(text);
          const cellWidth = data.cell.width * doc.internal.scaleFactor;
          if (textWidth > cellWidth) {
            console.warn(`Text "${text}" in column ${data.column.index} (${data.section}) exceeds cell width: ${textWidth}mm > ${cellWidth}mm`);
          }
        }
      },
    });
    doc.setFont('helvetica', 'normal');

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
    const margin = 12; // Increased margin for better spacing
    const contentWidth = pageWidth - 2 * margin;
    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);
    createHeader(doc, pageWidth, margin, 'Amortization Schedule Report');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Amortization Schedule Details', margin + 4, margin + 40);

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
      startY: margin + 45, // Adjusted startY to prevent overlap with header text
      head: [
        [
          { content: 'Month', rowSpan: 2 },
          { content: 'Loan Details', colSpan: 5 },
          { content: 'Own Funds Details', colSpan: 5 },
        ],
        [
          'Beg. Principal',
          'Monthly Principal',
          'Monthly Interest',
          'Total EMI',
          'End Principal',
          'Beg. Principal',
          'Monthly Principal',
          'Monthly Interest',
          'Total EMI',
          'End Principal',
        ],
      ],
      body: amortizationData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        fontStyle: 'bold',
        cellPadding: 2, // Added padding for header
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: 1.8, // Slightly increased for better readability
        textColor: [0, 0, 0],
      },
      margin: { left: margin + 3, right: margin + 3 }, // Balanced margins
      tableWidth: contentWidth - 6, // Adjusted to fit within margins
      columnStyles: {
        0: { cellWidth: 20 }, // Month column
        1: { cellWidth: 22 }, // Loan Beg. Principal
        2: { cellWidth: 20 }, // Loan Monthly Principal
        3: { cellWidth: 20 }, // Loan Monthly Interest
        4: { cellWidth: 20 }, // Loan Total EMI
        5: { cellWidth: 22 }, // Loan End Principal
        6: { cellWidth: 22 }, // Own Beg. Principal
        7: { cellWidth: 20 }, // Own Monthly Principal
        8: { cellWidth: 20 }, // Own Monthly Interest
        9: { cellWidth: 20 }, // Own Total EMI
        10: { cellWidth: 22 }, // Own End Principal
      },
      pageBreak: 'auto', // Changed to 'auto' to handle large tables better
      didDrawCell: (data) => {
        // Ensure text doesn't overflow
        if (data.section === 'body' && data.column.index >= 1) {
          doc.setFontSize(6);
          doc.setTextColor(0, 0, 0);
        }
      },
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });
    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};

// New function for Loan Amortization PDF
export const generateLoanAmortizationPDFBlob = (emiPlan: EMIPlan, amortizationSchedule: SingleAmortizationScheduleEntry[]): Promise<Blob> => {
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

    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    createHeader(doc, pageWidth, margin, 'Loan Amortization Schedule Report');

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Loan Amortization Schedule Details', margin + 4, margin + 40);
    
    const amortizationData = amortizationSchedule.map(entry => [
      entry.month.toString(),
      formatCurrency(entry.beginningPrincipal),
      formatCurrency(entry.monthlyPrincipal),
      formatCurrency(entry.monthlyInterest),
      formatCurrency(entry.totalEMI),
      formatCurrency(entry.endingPrincipal),
    ]);

    autoTable(doc, {
      startY: margin + 30,
      head: [
        [
          'Month',
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
      margin: { left: margin + 2, right: margin + 6 },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 30 },
      },
      pageBreak: 'auto',
      didParseCell: (data) => {
        if (data.section === 'head' || data.section === 'body') {
          const text = data.cell.raw as string;
          const textWidth = doc.getTextWidth(text);
          const cellWidth = data.cell.width * doc.internal.scaleFactor;
          if (textWidth > cellWidth) {
            console.warn(`Text "${text}" in column ${data.column.index} (${data.section}) exceeds cell width: ${textWidth}mm > ${cellWidth}mm`);
          }
        }
      },
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};

// New function for Own Funds Amortization PDF
export const generateOwnAmortizationPDFBlob = (emiPlan: EMIPlan, amortizationSchedule: SingleAmortizationScheduleEntry[]): Promise<Blob> => {
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

    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    createHeader(doc, pageWidth, margin, 'Own Funds Amortization Schedule Report');

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Own Funds Amortization Schedule Details', margin + 4, margin + 40);
    
    const amortizationData = amortizationSchedule.map(entry => [
      entry.month.toString(),
      formatCurrency(entry.beginningPrincipal),
      formatCurrency(entry.monthlyPrincipal),
      formatCurrency(entry.monthlyInterest),
      formatCurrency(entry.totalEMI),
      formatCurrency(entry.endingPrincipal),
    ]);

    autoTable(doc, {
      startY: margin + 30,
      head: [
        [
          'Month',
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
      margin: { left: margin + 2, right: margin + 6 },
      tableWidth: contentWidth,
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 30 },
      },
      pageBreak: 'auto',
      didParseCell: (data) => {
        if (data.section === 'head' || data.section === 'body') {
          const text = data.cell.raw as string;
          const textWidth = doc.getTextWidth(text);
          const cellWidth = data.cell.width * doc.internal.scaleFactor;
          if (textWidth > cellWidth) {
            console.warn(`Text "${text}" in column ${data.column.index} (${data.section}) exceeds cell width: ${textWidth}mm > ${cellWidth}mm`);
          }
        }
      },
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};

// Existing generateYearlyBreakdownPDFBlob function (unchanged)
export const generateYearlyBreakdownPDFBlob = (emiPlan: EMIPlan, calculations: Calculations): Promise<Blob> => {
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

    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    createHeader(doc, pageWidth, margin, 'Yearly Repayment Breakdown Report');

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);

    const loanData = [
      ['Type', planName],
      ['Tenure (Yrs)', emiPlan.loanTenure.toString()],
      ['Amount', formatCurrency(emiPlan.loanAmount)],
      ['Int. Rate', `${emiPlan.interestPerAnnum}%`],
      ['Bank %', `${emiPlan.bankPercent}%`],
      ['Own %', `${emiPlan.ownPercent}%`],
      ['GST %', `${emiPlan.gstPercentage || 0}%`],
    ];

    if (emiPlan.ownTenure !== 0) {
      loanData.push(['Own Tenure', emiPlan.ownTenure.toString()]);
    }
    if (emiPlan.ownFundsInterestRate !== 0) {
      loanData.push(['Own Int.', `${emiPlan.ownFundsInterestRate}%`]);
    }

    if (emiPlan.typeOfLoan === 'Rent Roll') {
      loanData.push(['Rental Revenue', formatCurrency(emiPlan.rentalRevenue || 0)]);
      loanData.push(['Per $ Value', formatCurrency(emiPlan.perDollarValue || 0)]);
      loanData.push(['Rent Roll Value', formatCurrency(emiPlan.rentRollPurchaseValue || 0)]);
    }

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
        overflow: 'linebreak',
      },
      margin: { left: margin + 2, right: pageWidth / 2 + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 30 },
      },
    });

    const loanTableHeight = loanData.length * 7 + 20;
    const loanDetailsTableEndY = margin + 60 + loanTableHeight;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Loan Repayments Breakdown', margin + 4, loanDetailsTableEndY + 10);

    const loanRepaymentData = calculations.yearlyAvg.map(entry => [
      entry.period.toString(),
      formatCurrency(entry.loanRepayment - entry.loanInterest),
      formatCurrency(entry.loanInterest),
      formatCurrency(entry.loanRepayment),
    ]);

    autoTable(doc, {
      startY: loanDetailsTableEndY + 15,
      head: [['Year', 'Principal ($)', 'Interest ($)', 'Total ($)']],
      body: loanRepaymentData,
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
        0: { cellWidth: 15 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
      },
    });

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Own Funds Repayments Breakdown', pageWidth / 2 + 4, loanDetailsTableEndY + 10);

    const ownRepaymentData = calculations.yearlyAvg.map(entry => [
      entry.period.toString(),
      formatCurrency(entry.ownRepayment - entry.ownInterest),
      formatCurrency(entry.ownInterest),
      formatCurrency(entry.ownRepayment),
    ]);

    autoTable(doc, {
      startY: loanDetailsTableEndY + 15,
      head: [['Year', 'Principal ($)', 'Interest ($)', 'Total ($)']],
      body: ownRepaymentData,
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
        0: { cellWidth: 15 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
      },
    });

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};

// Existing generateCompletePDFBlob function (unchanged)
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

    doc.setFillColor(240, 245, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 0, 139);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    createHeader(doc, pageWidth, margin, 'Complete EMI Plan Report');

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 4, margin + 34);

    const loanData = [
      ['Type', planName],
      ['Tenure (Yrs)', emiPlan.loanTenure.toString()],
      ['Amount', formatCurrency(emiPlan.loanAmount)],
      ['Int. Rate', `${emiPlan.interestPerAnnum}%`],
      ['Bank %', `${emiPlan.bankPercent}%`],
      ['Own %', `${emiPlan.ownPercent}%`],
      ['GST %', `${emiPlan.gstPercentage || 0}%`],
    ];

    if (emiPlan.ownTenure !== 0) {
      loanData.push(['Own Tenure', emiPlan.ownTenure.toString()]);
    }
    if (emiPlan.ownFundsInterestRate !== 0) {
      loanData.push(['Own Int.', `${emiPlan.ownFundsInterestRate}%`]);
    }

    if (emiPlan.typeOfLoan === 'Rent Roll') {
      loanData.push(['Rental Revenue', formatCurrency(emiPlan.rentalRevenue || 0)]);
      loanData.push(['Per $ Value', formatCurrency(emiPlan.perDollarValue || 0)]);
      loanData.push(['Rent Roll Purchase Value', formatCurrency(emiPlan.rentRollPurchaseValue || 0)]);
    }

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
        overflow: 'linebreak',
      },
      margin: { left: margin + 2, right: pageWidth / 2 + 2 },
      tableWidth: contentWidth / 2 - 4,
      columnStyles: {
        0: { cellWidth: 20, fontStyle: 'bold' },
        1: { cellWidth: 30 },
      },
    });

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Revenue', pageWidth / 2 + 4, margin + 40);

    const revenueData = emiPlan.revenues.map(rev => [`${rev.name} (${rev.period})`, formatCurrency(rev.amount)]);

    autoTable(doc, {
      startY: margin + 45,
      head: [['Description', 'Amount']],
      body: revenueData,
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
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
      },
    });

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    const revenueTableHeight = revenueData.length * 7 + 20;
    doc.text('Expenses', pageWidth / 2 + 4, margin + 55 + revenueTableHeight);

    const expenseData = emiPlan.expenses.map(exp => [`${exp.name} (${exp.period})`, formatCurrency(exp.amount)]);

    autoTable(doc, {
      startY: margin + 60 + revenueTableHeight,
      head: [['Description', 'Amount']],
      body: expenseData,
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
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
      },
    });

    const loanTableHeight = loanData.length * 7 + 20;
    const expensesTableHeight = expenseData.length * 7 + 20;
    const expensesTableEndY = margin + 60 + revenueTableHeight + expensesTableHeight;
    const maxTableEndY = Math.max(loanTableHeight + margin + 40, expensesTableEndY);

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Profit/Loss Yearly Summary', pageWidth / 2, maxTableEndY + 10, { align: 'center' });

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

    const ownAmtAllZero = plData.every(row => parseFloat(row[3].replace(/[^\d.-]/g, '')) === 0);
    const ownIntAllZero = plData.every(row => parseFloat(row[7].replace(/[^\d.-]/g, '')) === 0);
    const excludeOwnColumns = ownAmtAllZero && ownIntAllZero;

    const headers = excludeOwnColumns
      ? [['YR', 'Rev', 'Exps', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Loan Int', 'P/L', 'Sta']]
      : [['YR', 'Rev', 'Exps', 'Own Amt', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Sta']];

    const bodyData = excludeOwnColumns
      ? plData.map(row => [row[0], row[1], row[2], row[4], row[5], row[6], row[8], row[9], row[10]])
      : plData;

    const columnStyles = excludeOwnColumns
      ? {
          0: { cellWidth: 8 },
          1: { cellWidth: 24 },
          2: { cellWidth: 24 },
          3: { cellWidth: 24 },
          4: { cellWidth: 24 },
          5: { cellWidth: 24 },
          6: { cellWidth: 24 },
          7: { cellWidth: 24 },
          8: { cellWidth: 11 },
        }
      : {
          0: { cellWidth: 8 },
          1: { cellWidth: 19 },
          2: { cellWidth: 19 },
          3: { cellWidth: 19 },
          4: { cellWidth: 19 },
          5: { cellWidth: 19 },
          6: { cellWidth: 19 },
          7: { cellWidth: 19 },
          8: { cellWidth: 19 },
          9: { cellWidth: 19 },
          10: { cellWidth: 11 },
        };

    doc.setFont('helvetica', 'narrow');
    autoTable(doc, {
      startY: maxTableEndY + 15,
      head: headers,
      body: bodyData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 139],
        textColor: [255, 255, 255],
        fontSize: 8,
        halign: 'center',
        fontStyle: 'bold',
        minCellWidth: 8,
        cellPadding: 0.8,
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: 0.4,
        overflow: 'linebreak',
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      tableLineWidth: 0.15,
      columnStyles: columnStyles,
      pageBreak: 'auto',
      willDrawCell: (data) => {
        if (data.section === 'body') {
          const plIndex = excludeOwnColumns ? 7 : 9;
          const staIndex = excludeOwnColumns ? 8 : 10;
          if (data.column.index === staIndex) {
            const cellValue = data.cell.raw as string;
            doc.setFillColor(...(cellValue === 'Profit' ? [220, 255, 220] : [255, 220, 220]) as [number, number, number]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          }
          if (data.column.index === plIndex) {
            const cellValue = data.cell.raw as string;
            const numericValue = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
            doc.setTextColor(...(numericValue >= 0 ? [0, 128, 0] : [200, 0, 0]) as [number, number, number]);
          }
        }
      },
      didParseCell: (data) => {
        if (data.section === 'head' || data.section === 'body') {
          const text = data.cell.raw as string;
          const textWidth = doc.getTextWidth(text);
          const cellWidth = data.cell.width * doc.internal.scaleFactor;
          if (textWidth > cellWidth) {
            console.warn(`Text "${text}" in column ${data.column.index} (${data.section}) exceeds cell width: ${textWidth}mm > ${cellWidth}mm`);
          }
        }
      },
    });
    doc.setFont('helvetica', 'normal');

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin - 4, { align: 'center' });

    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};