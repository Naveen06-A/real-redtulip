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
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 6;
    const contentWidth = pageWidth - 2 * margin;

    // Set background and border
    doc.setFillColor(245, 245, 250);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header
    doc.setFontSize(12);
    doc.setTextColor(0, 51, 102);
    doc.text('HARCOURTS', pageWidth / 2, margin + 4, { align: 'center' });
    doc.setDrawColor(0, 153, 204);
    doc.setLineWidth(0.2);
    doc.line(pageWidth / 2 - 6, margin + 5, pageWidth / 2 + 6, margin + 5);
    doc.setTextColor(0, 153, 204);
    doc.setFontSize(9);
    doc.text('SUCCESS', pageWidth / 2, margin + 9, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.text('Profit/Loss Overview Report', pageWidth / 2, margin + 13, { align: 'center' });

    // Plan details
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 1, margin + 17);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 1, margin + 17, { align: 'right' });

    let currentY = margin + 20;

    // Loan details table (redesigned as single-column key-value pairs)
    const loanData = [
      ['Loan Type', planName],
      ['Tenure (Years)', emiPlan.loanTenure.toString()],
      ['Loan Amount', formatCurrency(emiPlan.loanAmount)],
      ['Interest Rate', `${emiPlan.interestPerAnnum}%`],
      ['Bank Contribution', `${emiPlan.bankPercent}%`],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Loan Details']],
      body: loanData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'left',
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'left',
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
        fillColor: [230, 240, 255],
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      margin: { left: margin, right: pageWidth / 2 + margin / 2 },
      tableWidth: contentWidth / 2 - margin / 2,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
      },
    });

    const loanTableFinalY = (doc as any).lastAutoTable.finalY;

    // Revenue & Expenses table
    const revenueExpenseData = [
      ...emiPlan.revenues.map(rev => [rev.name, formatCurrency(rev.amount), rev.period, 'Revenue']),
      ...emiPlan.expenses.map(exp => [exp.name, formatCurrency(exp.amount), exp.period, 'Expense']),
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Name', 'Amount', 'Period', 'Type']],
      body: revenueExpenseData.slice(0, 3),
      theme: 'striped',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
      },
      margin: { left: pageWidth / 2 + margin / 2, right: margin },
      tableWidth: contentWidth / 2 - margin / 2,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 14 },
        2: { cellWidth: 9 },
        3: { cellWidth: 9 },
      },
    });

    const revExpTableFinalY = (doc as any).lastAutoTable.finalY;

    currentY = Math.max(loanTableFinalY, revExpTableFinalY) + 5;

    // P/L data table
    const plData = calculations.yearlyAvg.slice(0, 2).map(entry => [
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

    const totalPL = calculations.yearlyAvg.reduce((sum, entry) => sum + entry.pl, 0);
    plData.push([
      'Total', '', '', '', '', '', '', '', '', formatCurrency(totalPL), totalPL >= 0 ? 'Profit' : 'Loss'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Period', 'Revenue', 'Exp', 'Own Amt', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Status']],
      body: plData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 18 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
        8: { cellWidth: 18 },
        9: { cellWidth: 20 },
        10: { cellWidth: 12 },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && (data.column.index === 9 || data.column.index === 10)) {
          const cellValue = data.cell.raw as string;
          if (data.column.index === 10) {
            doc.setFillColor(...(cellValue === 'Profit' ? [220, 255, 220] : [255, 220, 220]) as [number, number, number]);
            doc.setTextColor(...(cellValue === 'Profit' ? [0, 100, 0] : [150, 0, 0]) as [number, number, number]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          } else if (data.column.index === 9) {
            const numericValue = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
            doc.setTextColor(...(numericValue >= 0 ? [0, 100, 0] : [150, 0, 0]) as [number, number, number]);
          }
          doc.text(cellValue, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
            align: 'center',
            baseline: 'middle',
          });
        }
      },
    });

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin + 1, { align: 'center' });

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
    const margin = 6;
    const contentWidth = pageWidth - 2 * margin;

    // Set background and border
    doc.setFillColor(245, 245, 250);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header
    doc.setFontSize(12);
    doc.setTextColor(0, 51, 102);
    doc.text('HARCOURTS', pageWidth / 2, margin + 4, { align: 'center' });
    doc.setDrawColor(0, 153, 204);
    doc.setLineWidth(0.2);
    doc.line(pageWidth / 2 - 6, margin + 5, pageWidth / 2 + 6, margin + 5);
    doc.setTextColor(0, 153, 204);
    doc.setFontSize(9);
    doc.text('SUCCESS', pageWidth / 2, margin + 9, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.text('Amortization Schedule Report', pageWidth / 2, margin + 13, { align: 'center' });

    // Plan details
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 1, margin + 17);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 1, margin + 17, { align: 'right' });

    let currentY = margin + 20;

    // Amortization table (limited to 6 months to fit on one page)
    const amortizationData = amortizationSchedule.slice(0, 6).map(entry => [
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
      startY: currentY,
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
      theme: 'striped',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 20 },
        2: { cellWidth: 15 },
        3: { cellWidth: 15 },
        4: { cellWidth: 15 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 15 },
        8: { cellWidth: 15 },
        9: { cellWidth: 15 },
        10: { cellWidth: 20 },
      },
    });

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin + 1, { align: 'center' });

    // Return PDF as Blob
    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};

export const generateCompletePDFBlob = (emiPlan: EMIPlan, calculations: Calculations): Promise<Blob> => {
  return new Promise((resolve) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm
    const margin = 6;
    const contentWidth = pageWidth - 2 * margin;

    // Set background and border
    doc.setFillColor(245, 245, 250);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    doc.setDrawColor(0, 51, 102);
    doc.setLineWidth(0.2);
    doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

    // Header
    doc.setFontSize(12);
    doc.setTextColor(0, 51, 102);
    doc.text('HARCOURTS', pageWidth / 2, margin + 4, { align: 'center' });
    doc.setDrawColor(0, 153, 204);
    doc.setLineWidth(0.2);
    doc.line(pageWidth / 2 - 6, margin + 5, pageWidth / 2 + 6, margin + 5);
    doc.setTextColor(0, 153, 204);
    doc.setFontSize(9);
    doc.text('SUCCESS', pageWidth / 2, margin + 9, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.text('Complete EMI Plan Report', pageWidth / 2, margin + 13, { align: 'center' });

    // Plan details
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    const planName = emiPlan.typeOfLoan === 'Manual Entry' ? emiPlan.customLoanType : emiPlan.typeOfLoan;
    doc.text(`Plan: ${planName}`, margin + 1, margin + 17);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin - 1, margin + 17, { align: 'right' });

    let currentY = margin + 20;

    // Loan details table (redesigned as single-column key-value pairs)
    const loanData = [
      ['Loan Type', planName],
      ['Tenure (Years)', emiPlan.loanTenure.toString()],
      ['Loan Amount', formatCurrency(emiPlan.loanAmount)],
      ['Interest Rate', `${emiPlan.interestPerAnnum}%`],
      ['Bank Contribution', `${emiPlan.bankPercent}%`],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Loan Details']],
      body: loanData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'left',
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'left',
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
        fillColor: [230, 240, 255],
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255],
      },
      margin: { left: margin, right: pageWidth / 2 + margin / 2 },
      tableWidth: contentWidth / 2 - margin / 2,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 20 },
      },
    });

    const loanTableFinalY = (doc as any).lastAutoTable.finalY;

    // Revenue & Expenses table
    const revenueExpenseData = [
      ...emiPlan.revenues.map(rev => [rev.name, formatCurrency(rev.amount), rev.period, 'Revenue']),
      ...emiPlan.expenses.map(exp => [exp.name, formatCurrency(exp.amount), exp.period, 'Expense']),
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Name', 'Amount', 'Period', 'Type']],
      body: revenueExpenseData.slice(0, 3),
      theme: 'striped',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
      },
      margin: { left: pageWidth / 2 + margin / 2, right: margin },
      tableWidth: contentWidth / 2 - margin / 2,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 14 },
        2: { cellWidth: 9 },
        3: { cellWidth: 9 },
      },
    });

    const revExpTableFinalY = (doc as any).lastAutoTable.finalY;

    currentY = Math.max(loanTableFinalY, revExpTableFinalY) + 5;

    // P/L data table
    const plData = calculations.yearlyAvg.slice(0, 2).map(entry => [
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

    const totalPL = calculations.yearlyAvg.reduce((sum, entry) => sum + entry.pl, 0);
    plData.push([
      'Total', '', '', '', '', '', '', '', '', formatCurrency(totalPL), totalPL >= 0 ? 'Profit' : 'Loss'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Period', 'Revenue', 'Exp', 'Own Amt', 'Own Pay', 'Loan Amt', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Status']],
      body: plData,
      theme: 'striped',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 7,
        halign: 'center',
        cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
      },
      bodyStyles: {
        fontSize: 6,
        halign: 'center',
        cellPadding: { top: 1, bottom: 1, left: 2, right: 2 },
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 18 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
        8: { cellWidth: 18 },
        9: { cellWidth: 20 },
        10: { cellWidth: 12 },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && (data.column.index === 9 || data.column.index === 10)) {
          const cellValue = data.cell.raw as string;
          if (data.column.index === 10) {
            doc.setFillColor(...(cellValue === 'Profit' ? [220, 255, 220] : [255, 220, 220]) as [number, number, number]);
            doc.setTextColor(...(cellValue === 'Profit' ? [0, 100, 0] : [150, 0, 0]) as [number, number, number]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          } else if (data.column.index === 9) {
            const numericValue = parseFloat(cellValue.replace(/[^\d.-]/g, ''));
            doc.setTextColor(...(numericValue >= 0 ? [0, 100, 0] : [150, 0, 0]) as [number, number, number]);
          }
          doc.text(cellValue, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2, {
            align: 'center',
            baseline: 'middle',
          });
        }
      },
    });

    // Footer
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.text('Generated by Harcourts Success EMI Calculator', pageWidth / 2, pageHeight - margin + 1, { align: 'center' });

    // Return PDF as Blob
    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
};