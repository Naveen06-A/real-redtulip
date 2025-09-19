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

    // Calculate the final y-position of the Expenses table
    const expensesTableHeight = expenseData.length * 7 + 20;
    const expensesTableEndY = margin + 60 + revenueTableHeight + expensesTableHeight;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Profit/Loss Yearly Summary', pageWidth / 2, expensesTableEndY + 10, { align: 'center' });

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

    // Check if Own Amt and Own Int columns are all zero
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
          0: { cellWidth: 8 }, // YR
          1: { cellWidth: 24 }, // Rev
          2: { cellWidth: 24 }, // Exps
          3: { cellWidth: 24 }, // Own Pay
          4: { cellWidth: 24 }, // Loan Amt
          5: { cellWidth: 24 }, // Loan Pay
          6: { cellWidth: 24 }, // Loan Int
          7: { cellWidth: 24 }, // P/L
          8: { cellWidth: 11 }, // Sta
        }
      : {
          0: { cellWidth: 8 }, // YR
          1: { cellWidth: 19 }, // Rev
          2: { cellWidth: 19 }, // Exps
          3: { cellWidth: 19 }, // Own Amt
          4: { cellWidth: 19 }, // Own Pay
          5: { cellWidth: 19 }, // Loan Amt
          6: { cellWidth: 19 }, // Loan Pay
          7: { cellWidth: 19 }, // Own Int
          8: { cellWidth: 19 }, // Loan Int
          9: { cellWidth: 19 }, // P/L
          10: { cellWidth: 11 }, // Sta
        };

    doc.setFont('helvetica', 'narrow');
    autoTable(doc, {
      startY: expensesTableEndY + 15,
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
    const margin = 10;
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

    // Calculate the final y-position of the Expenses table
    const expensesTableHeight = expenseData.length * 7 + 20;
    const expensesTableEndY = margin + 60 + revenueTableHeight + expensesTableHeight;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 139);
    doc.text('Profit/Loss Yearly Summary', pageWidth / 2, expensesTableEndY + 10, { align: 'center' });

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

    // Check if Own Amt and Own Int columns are all zero
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
          0: { cellWidth: 8 }, // YR
          1: { cellWidth: 24 }, // Rev
          2: { cellWidth: 24 }, // Exps
          3: { cellWidth: 24 }, // Own Pay
          4: { cellWidth: 24 }, // Loan Amt
          5: { cellWidth: 24 }, // Loan Pay
          6: { cellWidth: 24 }, // Loan Int
          7: { cellWidth: 24 }, // P/L
          8: { cellWidth: 11 }, // Sta
        }
      : {
          0: { cellWidth: 8 }, // YR
          1: { cellWidth: 19 }, // Rev
          2: { cellWidth: 19 }, // Exps
          3: { cellWidth: 19 }, // Own Amt
          4: { cellWidth: 19 }, // Own Pay
          5: { cellWidth: 19 }, // Loan Amt
          6: { cellWidth: 19 }, // Loan Pay
          7: { cellWidth: 19 }, // Own Int
          8: { cellWidth: 19 }, // Loan Int
          9: { cellWidth: 19 }, // P/L
          10: { cellWidth: 11 }, // Sta
        };

    doc.setFont('helvetica', 'narrow');
    autoTable(doc, {
      startY: expensesTableEndY + 15,
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