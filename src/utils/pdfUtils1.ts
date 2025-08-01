// src/utils/pdfUtils.ts
import { jsPDF } from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import moment from 'moment';

interface GeneratePdfOptions {
  title: string;
  head: string[][];
  body: (string | number)[][];
  fileName: string;
  outputType: 'blob' | 'datauristring';
}

export const generatePdf = async ({ title, head, body, fileName, outputType }: GeneratePdfOptions) => {
  try {
    const doc = new jsPDF({
      orientation: 'landscape', // Use landscape to accommodate wide tables
      unit: 'mm',
      format: 'a4',
    });

    // Set document properties
    doc.setProperties({
      title,
      creator: 'xAI Property Management',
      author: 'xAI',
    });

    // Define fonts and styles
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);

    // Add header
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${moment().format('MMMM Do YYYY, h:mm:ss a')}`, 14, 28);
    doc.text('Generated by xAI Property Management', 14, 34);

    // Define table column widths (adjust based on content importance and expected length)
    const columnWidths = [
      10, // Street Number
      20, // Street Name
      20, // Suburb
      10, // Postcode
      15, // Agent
      15, // Type
      15, // Price
      15, // Sold Price
      10, // Status
      10, // Commission (%)
      15, // Commission Earned
      15, // Agency
      15, // Expected Price
      10, // Sale Type
      10, // Bedrooms
      10, // Bathrooms
      10, // Car Garage
      10, // SQM
      10, // Land Size
      15, // Listed Date
      15, // Sold Date
      10, // Flood Risk
      10, // Bushfire Risk
      10, // Contract Status
      20, // Features
    ];

    // Normalize column widths to fit page width (A4 landscape width is ~297mm, minus margins)
    const totalWidth = 297 - 28; // 14mm margin on each side
    const totalDefinedWidth = columnWidths.reduce((sum, width) => sum + width, 0);
    const normalizedWidths = columnWidths.map((width) => (width / totalDefinedWidth) * totalWidth);

    // Configure autoTable with improved styling
    autoTable(doc, {
      head,
      body,
      startY: 40,
      margin: { top: 40, left: 14, right: 14, bottom: 20 },
      styles: {
        fontSize: 8, // Smaller font size for better fit
        cellPadding: 2,
        overflow: 'linebreak', // Wrap text if it overflows
        minCellHeight: 6,
        halign: 'left',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [96, 165, 250], // Blue header background
        textColor: [255, 255, 255], // White text
        fontSize: 8,
        fontStyle: 'bold',
      },
      columnStyles: head[0].reduce((acc: { [key: number]: Partial<UserOptions> }, _, index) => {
        acc[index] = { cellWidth: normalizedWidths[index] };
        return acc;
      }, {}),
      didDrawPage: (data) => {
        // Add footer on each page
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('xAI Property Management - Confidential Report', 14, doc.internal.pageSize.height - 10);
      },
      theme: 'striped',
    });

    // Add page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
    }

    // Output based on type
    if (outputType === 'blob') {
      return doc.output('blob');
    } else if (outputType === 'datauristring') {
      return doc.output('datauristring');
    } else {
      throw new Error('Invalid output type');
    }
  } catch (err) {
    console.error('PDF generation error:', err);
    throw new Error('Failed to generate PDF');
  }
};