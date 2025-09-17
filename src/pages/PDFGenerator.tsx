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

    let currentY = margin + 22;

    // Redesigned Loan details table - compact and efficient
    const loanDetails = [
      { label: 'Loan Type', value: planName },
      { label: 'Tenure', value: `${emiPlan.loanTenure} years` },
      { label: 'Loan Amount', value: formatCurrency(emiPlan.loanAmount) },
      { label: 'Interest Rate', value: `${emiPlan.interestPerAnnum}%` },
      { label: 'Bank Contribution', value: `${emiPlan.bankPercent}%` },
    ];

    // Draw loan details as compact text instead of a table
    doc.setFontSize(7);
    doc.setTextColor(0, 51, 102);
    doc.text('LOAN DETAILS', margin + 2, currentY);
    
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    
    const col1X = margin + 2;
    const col2X = margin + 35;
    const rowHeight = 4;
    
    loanDetails.forEach((detail, i) => {
      const yPos = currentY + 4 + (i * rowHeight);
      doc.text(`${detail.label}:`, col1X, yPos);
      doc.text(detail.value, col2X, yPos);
    });
    
    const loanDetailsHeight = 4 + (loanDetails.length * rowHeight);
    
    // Revenue & Expenses section - compact version
    const revenueExpenseData = [
      ...emiPlan.revenues.map(rev => [rev.name, formatCurrency(rev.amount), rev.period, 'Revenue']),
      ...emiPlan.expenses.map(exp => [exp.name, formatCurrency(exp.amount), exp.period, 'Expense']),
    ];
    
    const revExpX = pageWidth / 2 - 10;
    doc.setFontSize(7);
    doc.setTextColor(0, 51, 102);
    doc.text('REVENUE & EXPENSES', revExpX, currentY);
    
    // Show only the first 2 items of each with a "+ more" indicator if needed
    const maxItems = 4;
    const totalItems = revenueExpenseData.length;
    const displayItems = revenueExpenseData.slice(0, maxItems);
    
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    
    displayItems.forEach((item, i) => {
      const yPos = currentY + 4 + (i * rowHeight);
      const [name, amount, period, type] = item;
      const displayText = `${name} (${amount}, ${period})`;
      doc.text(displayText, revExpX, yPos);
    });
    
    if (totalItems > maxItems) {
      doc.text(`+ ${totalItems - maxItems} more items...`, revExpX, currentY + 4 + (maxItems * rowHeight));
    }
    
    currentY += Math.max(loanDetailsHeight, (Math.min(maxItems, totalItems) + 1) * rowHeight) + 4;

    // P/L data table - compact version
    const plData = calculations.yearlyAvg.slice(0, 2).map(entry => [
      `Y${entry.period}`,
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
      head: [['Yr', 'Revenue', 'Exp', 'Own', 'Own Pay', 'Loan', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Status']],
      body: plData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 6,
        halign: 'center',
        cellPadding: { top: 1, bottom: 1, left: 1, right: 1 },
      },
      bodyStyles: {
        fontSize: 5.5,
        halign: 'center',
        cellPadding: { top: 0.5, bottom: 0.5, left: 1, right: 1 },
        cellWidth: 'wrap',
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 16 },
        2: { cellWidth: 16 },
        3: { cellWidth: 16 },
        4: { cellWidth: 16 },
        5: { cellWidth: 16 },
        6: { cellWidth: 16 },
        7: { cellWidth: 16 },
        8: { cellWidth: 16 },
        9: { cellWidth: 18 },
        10: { cellWidth: 10 },
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

// Similar optimization for generateCompletePDFBlob function
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

    let currentY = margin + 22;

    // Redesigned Loan details table - compact and efficient
    const loanDetails = [
      { label: 'Loan Type', value: planName },
      { label: 'Tenure', value: `${emiPlan.loanTenure} years` },
      { label: 'Loan Amount', value: formatCurrency(emiPlan.loanAmount) },
      { label: 'Interest Rate', value: `${emiPlan.interestPerAnnum}%` },
      { label: 'Bank Contribution', value: `${emiPlan.bankPercent}%` },
    ];

    // Draw loan details as compact text instead of a table
    doc.setFontSize(7);
    doc.setTextColor(0, 51, 102);
    doc.text('LOAN DETAILS', margin + 2, currentY);
    
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    
    const col1X = margin + 2;
    const col2X = margin + 35;
    const rowHeight = 4;
    
    loanDetails.forEach((detail, i) => {
      const yPos = currentY + 4 + (i * rowHeight);
      doc.text(`${detail.label}:`, col1X, yPos);
      doc.text(detail.value, col2X, yPos);
    });
    
    const loanDetailsHeight = 4 + (loanDetails.length * rowHeight);
    
    // Revenue & Expenses section - compact version
    const revenueExpenseData = [
      ...emiPlan.revenues.map(rev => [rev.name, formatCurrency(rev.amount), rev.period, 'Revenue']),
      ...emiPlan.expenses.map(exp => [exp.name, formatCurrency(exp.amount), exp.period, 'Expense']),
    ];
    
    const revExpX = pageWidth / 2 - 10;
    doc.setFontSize(7);
    doc.setTextColor(0, 51, 102);
    doc.text('REVENUE & EXPENSES', revExpX, currentY);
    
    // Show only the first 2 items of each with a "+ more" indicator if needed
    const maxItems = 4;
    const totalItems = revenueExpenseData.length;
    const displayItems = revenueExpenseData.slice(0, maxItems);
    
    doc.setFontSize(6);
    doc.setTextColor(80, 80, 80);
    
    displayItems.forEach((item, i) => {
      const yPos = currentY + 4 + (i * rowHeight);
      const [name, amount, period, type] = item;
      const displayText = `${name} (${amount}, ${period})`;
      doc.text(displayText, revExpX, yPos);
    });
    
    if (totalItems > maxItems) {
      doc.text(`+ ${totalItems - maxItems} more items...`, revExpX, currentY + 4 + (maxItems * rowHeight));
    }
    
    currentY += Math.max(loanDetailsHeight, (Math.min(maxItems, totalItems) + 1) * rowHeight) + 4;

    // P/L data table - compact version
    const plData = calculations.yearlyAvg.slice(0, 2).map(entry => [
      `Y${entry.period}`,
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
      head: [['Yr', 'Revenue', 'Exp', 'Own', 'Own Pay', 'Loan', 'Loan Pay', 'Own Int', 'Loan Int', 'P/L', 'Status']],
      body: plData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 51, 102],
        textColor: [255, 255, 255],
        fontSize: 6,
        halign: 'center',
        cellPadding: { top: 1, bottom: 1, left: 1, right: 1 },
      },
      bodyStyles: {
        fontSize: 5.5,
        halign: 'center',
        cellPadding: { top: 0.5, bottom: 0.5, left: 1, right: 1 },
        cellWidth: 'wrap',
      },
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      pageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 16 },
        2: { cellWidth: 16 },
        3: { cellWidth: 16 },
        4: { cellWidth: 16 },
        5: { cellWidth: 16 },
        6: { cellWidth: 16 },
        7: { cellWidth: 16 },
        8: { cellWidth: 16 },
        9: { cellWidth: 18 },
        10: { cellWidth: 10 },
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