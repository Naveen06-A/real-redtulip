import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, X } from 'lucide-react';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable'; // Updated import
import { Enquiry } from '../types/types';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

interface EnquiryPDFPreviewProps {
  enquiry: Enquiry;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (enquiry: Enquiry) => void;
}

export function EnquiryPDFPreview({ enquiry, isOpen, onClose, onDownload }: EnquiryPDFPreviewProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [modalDimensions, setModalDimensions] = useState({ width: '90vw', maxWidth: 1200, height: '90vh' });
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const updateDimensions = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = vw <= 768 ? '95vw' : vw <= 1024 ? '85vw' : '80vw';
      const maxWidth = Math.min(vw * 0.9, 1200);
      const height = `${Math.min(vh * 0.9, vh - 100)}px`;
      setModalDimensions({ width, maxWidth, height });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const generatePDF = async (preview: boolean = false) => {
    try {
      if (!enquiry) {
        console.error('No enquiry data provided');
        return;
      }

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      // No manual attachment needed; autoTable should be available via import

      // Set initial font context
      doc.setFont('helvetica');
      doc.setFontSize(18);
      console.log('Initial doc state:', doc.getFontSize(), doc.getFont());

      doc.setProperties({
        title: `Enquiry_${enquiry.full_name}_${enquiry.id}`,
        author: 'Harcourts',
        creator: 'Harcourts Admin Dashboard',
      });

      // Background and header
      doc.setFillColor(219, 234, 254);
      doc.rect(0, 0, 210, 297, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(30, 58, 138);
      doc.text('Harcourts Success', 105, 20, { align: 'center' });

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(29, 78, 216);
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

      // Use modern autoTable API (compatible with jspdf-autotable@5.x)
      doc.autoTable({
        startY: 45,
        columns: ['Field', 'Details'],
        body: tableData,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 10,
          textColor: [17, 24, 39],
          cellPadding: 4,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [147, 197, 253],
          textColor: [30, 58, 138],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [241, 245, 249],
        },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold', textColor: [29, 78, 216] },
          1: { cellWidth: 120 },
        },
        margin: { left: 20, right: 20 },
        didDrawPage: (data: any) => {
          doc.setFont('helvetica');
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text('Generated by Harcourts Admin Dashboard', 105, 290, { align: 'center' });
        },
      });

      console.log('Post-autoTable doc state:', doc.getFontSize(), doc.getFont());

      doc.setDisplayMode('100%', 'continuous');

      if (preview) {
        const pdfBlob = doc.output('blob');
        console.log('Generated PDF blob:', pdfBlob); // Debug blob
        if (!pdfBlob || !(pdfBlob instanceof Blob)) {
          throw new Error('Invalid PDF blob generated');
        }
        const url = URL.createObjectURL(pdfBlob);
        console.log('Generated PDF URL:', url); // Debug URL
        setPdfUrl(url);
      } else {
        doc.save(`enquiry-${enquiry.full_name}-${enquiry.id}.pdf`);
      }
    } catch (error: any) {
      console.error('PDF generation error:', error);
      if (preview) {
        setPreviewError('Failed to generate PDF preview: ' + error.message);
        setPdfUrl(null);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPreviewError(null); // Reset error on open
      generatePDF(true);
    } else if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
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
          <button onClick={onClose} className="text-blue-900 hover:text-blue-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        {previewError ? (
          <div className="text-center text-red-600 text-sm sm:text-base">{previewError}</div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full border border-blue-200 rounded-md"
            style={{ height: `calc(${modalDimensions.height} - 120px)` }}
            title="Enquiry PDF Preview"
            onError={() => {
              console.error('Iframe failed to load PDF');
              setPreviewError('Failed to display PDF preview');
              setPdfUrl(null);
            }}
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