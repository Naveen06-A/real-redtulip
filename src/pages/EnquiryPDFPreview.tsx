import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Enquiry } from '../types';

interface EnquiryPDFPreviewProps {
  enquiry: Enquiry;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (enquiry: Enquiry) => void;
}

export function EnquiryPDFPreview({ enquiry, isOpen, onClose, onDownload }: EnquiryPDFPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [modalDimensions, setModalDimensions] = useState({ width: '90vw', maxWidth: 1200, height: '90vh' });

  // Calculate modal dimensions based on window size
  useEffect(() => {
    const updateDimensions = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Calculate modal width: 90% of viewport width, capped at 1200px for desktop, 95% for mobile
      const width = vw <= 768 ? '95vw' : vw <= 1024 ? '85vw' : '80vw';
      const maxWidth = Math.min(vw * 0.9, 1200); // Remove DPR scaling for max-width

      // Calculate modal height: 90% of viewport height, capped at 90% of available height
      const height = `${Math.min(vh * 0.9, vh - 100)}px`;

      setModalDimensions({ width, maxWidth, height });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const generatePDF = (preview: boolean = false) => {
    try {
      if (!enquiry) {
        console.error('No enquiry data provided');
        return;
      }

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const dpr = window.devicePixelRatio || 1;

      // Adjust font sizes for high-resolution displays
      const baseFontSize = 10 * dpr;
      const headerFontSize = 18 * dpr;
      const subtitleFontSize = 12 * dpr;
      const footerFontSize = 8 * dpr;

      // Set document properties
      doc.setProperties({
        title: `Enquiry_${enquiry.full_name}_${enquiry.id}`,
        author: 'Harcourts',
        creator: 'Harcourts Admin Dashboard',
      });

      // Background and header
      doc.setFillColor(219, 234, 254); // Light blue background
      doc.rect(0, 0, 210, 297, 'F'); // A4 size
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(headerFontSize);
      doc.setTextColor(30, 58, 138); // Dark blue
      doc.text('Harcourts Success', 105, 20, { align: 'center' });

      // Subtitle
      doc.setFontSize(subtitleFontSize);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(29, 78, 216); // Lighter blue
      doc.text(`Submission ID: ${enquiry.id}`, 20, 30);
      doc.text(`Submitted: ${new Date(enquiry.submitted_at).toLocaleString()}`, 20, 38);

      // Table configuration
      const tableData = [
        ['Full Name', enquiry.full_name],
        ['Languages Known', enquiry.languages_known || 'N/A'],
        ['Full License', enquiry.do_you_hold_a_full_license ? 'Yes' : 'No'],
        ['License Details', enquiry.full_license_details || 'N/A'],
        ['Owns Car', enquiry.do_you_own_a_car ? 'Yes' : 'No'],
        ['Car Details', enquiry.car_details || 'N/A'],
        ['Driver’s License', enquiry.do_you_hold_a_drivers_license ? 'Yes' : 'No'],
        ['Driver’s License Details', enquiry.drivers_license_details || 'N/A'],
        ['Why Real Estate', enquiry.why_real_estate || 'N/A'],
        ['Bought/Sold in QLD', enquiry.have_you_bought_and_sold_in_qld ? 'Yes' : 'No'],
        ['Bought/Sold QLD Details', enquiry.bought_sold_qld_details || 'N/A'],
        ['Goal', enquiry.whats_your_goal || 'N/A'],
        ['Expected Earnings', enquiry.expected_earnings || 'N/A'],
        ['Agree to RITE Values', enquiry.agree_to_rite_values ? 'Yes' : 'No'],
        ['Why Harcourts', enquiry.why_us || 'N/A'],
        ['Expectations from Harcourts', enquiry.what_do_you_expect_from_us || 'N/A'],
        ['Financial Capability', enquiry.financial_capability ? 'Yes' : 'No'],
        ['Financial Capability Details', enquiry.financial_capability_details || 'N/A'],
        ['Team Contribution', enquiry.team_contribution || 'N/A'],
        ['Suburbs to Prospect', enquiry.suburbs_to_prospect || 'N/A'],
        ['Strengths', enquiry.strengths || 'N/A'],
        ['Weaknesses', enquiry.weaknesses || 'N/A'],
      ];

      // Use jsPDF-autotable for a professional table layout
      (doc as any).autoTable({
        startY: 45,
        head: [['Field', 'Details']],
        body: tableData,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: baseFontSize,
          textColor: [17, 24, 39], // Dark text
          cellPadding: 4 * dpr, // Adjust padding for high-DPI
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [147, 197, 253], // Light blue header
          textColor: [30, 58, 138], // Dark blue text
          fontStyle: 'bold',
          fontSize: baseFontSize + 2,
        },
        alternateRowStyles: {
          fillColor: [241, 245, 249], // Very light blue for alternating rows
        },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold', textColor: [29, 78, 216] }, // Label column
          1: { cellWidth: 120 }, // Value column
        },
        margin: { left: 20, right: 20 },
        didDrawPage: () => {
          // Add footer
          doc.setFontSize(footerFontSize);
          doc.setTextColor(100);
          doc.text(`Generated by Harcourts Admin Dashboard`, 105, 290, { align: 'center' });
        },
      });

      // Set default zoom level for PDF viewers
      doc.setDisplayMode('100%', 'continuous'); // Set zoom to 100% and continuous scroll

      if (preview) {
        const pdfBlob = doc.output('blob');
        setPdfUrl(URL.createObjectURL(pdfBlob));
      } else {
        doc.save(`enquiry-${enquiry.full_name}-${enquiry.id}.pdf`);
      }
    } catch (error: any) {
      console.error('PDF generation error:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      generatePDF(true);
    }
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    };
  }, [isOpen, enquiry]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-blue-200/50 flex items-center justify-center z-50 p-4"
    >
      <div
        className="bg-white p-6 rounded-lg overflow-y-auto border border-blue-200 shadow-xl"
        style={{
          width: modalDimensions.width,
          maxWidth: `${modalDimensions.maxWidth}px`,
          maxHeight: modalDimensions.height,
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-blue-900">Enquiry PDF Preview</h2>
          <button
            onClick={onClose}
            className="text-blue-900 hover:text-blue-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full border border-blue-200 rounded-md"
            style={{
              height: `calc(${modalDimensions.height} - 120px)`,
            }}
            title="Enquiry PDF Preview"
          />
        ) : (
          <div className="text-center text-blue-900 text-sm sm:text-base">Generating preview...</div>
        )}
        <div className="flex justify-end gap-4 mt-4">
          <motion.button
            onClick={onClose}
            className="px-4 py-2 bg-blue-200 text-blue-900 rounded-md hover:bg-blue-300 text-sm sm:text-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Close
          </motion.button>
          <motion.button
            onClick={() => onDownload(enquiry)}
            className="flex items-center px-4 py-2 bg-blue-300 text-white rounded-md hover:bg-blue-400 text-sm sm:text-base"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Download className="w-5 h-5 mr-2" /> Download PDF
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}