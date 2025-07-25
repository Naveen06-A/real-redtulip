import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export class PDFGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;

  constructor() {
    this.doc = new jsPDF();
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  private addWatermark() {
    this.doc.setGState(new this.doc.GState({ opacity: 0.1 }));
    this.doc.setFontSize(60);
    this.doc.setTextColor(200, 200, 200);
    
    const text = 'REAL ESTATE';
    const textWidth = this.doc.getTextWidth(text);
    const x = (this.pageWidth - textWidth) / 2;
    const y = this.pageHeight / 2;
    
    this.doc.text(text, x, y, { angle: 45 });
    
    this.doc.setGState(new this.doc.GState({ opacity: 1 }));
  }

  private addHeader(title: string, subtitle?: string) {
    this.doc.setFillColor(59, 130, 246); // Blue header
    this.doc.rect(this.margin, this.margin, 30, 20, 'F');
    
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(8);
    this.doc.text('REAL ESTATE', this.margin + 2, this.margin + 8);
    this.doc.text('PLATFORM', this.margin + 2, this.margin + 14);
    
    this.doc.setTextColor(0, 0, 0);
    
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin + 40, this.margin + 15);
    
    if (subtitle) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(subtitle, this.margin + 40, this.margin + 25);
    }
    
    this.doc.setFontSize(10);
    const date = new Date().toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const dateWidth = this.doc.getTextWidth(`Generated: ${date} IST`);
    this.doc.text(`Generated: ${date} IST`, this.pageWidth - this.margin - dateWidth, this.margin + 15);
    
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.margin + 35, this.pageWidth - this.margin, this.margin + 35);
    
    return this.margin + 45;
  }

  private addFooter() {
    const footerY = this.pageHeight - 20;
    
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, footerY, this.pageWidth - this.margin, footerY);
    
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('Real Estate Platform - Confidential Report', this.margin, footerY + 10);
    
    const pageNum = `Page ${this.doc.getCurrentPageInfo().pageNumber}`;
    const pageNumWidth = this.doc.getTextWidth(pageNum);
    this.doc.text(pageNum, this.pageWidth - this.margin - pageNumWidth, footerY + 10);
  }

  generateProgressReport(progressData: any[], title: string = 'Marketing Progress Report') {
  this.addWatermark();
  let currentY = this.addHeader(title, `Total Records: ${progressData.length}`);

  // Debug: Log progressData to verify structure
  console.log('Progress Data in PDFGenerator:', progressData);

  // Overview
  this.doc.setFontSize(12);
  this.doc.setFont('helvetica', 'bold');
  this.doc.text('Overview', this.margin, currentY);
  currentY += 10;

  this.doc.setFont('helvetica', 'normal');
  this.doc.setFontSize(10);
  const totalCompleted = progressData.reduce((sum, p) => sum + (p.completed || 0), 0);
  const totalTarget = progressData.reduce((sum, p) => sum + (p.target || 0), 0);
  const overallProgress = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
  this.doc.text(`Total Completed: ${totalCompleted}`, this.margin, currentY);
  this.doc.text(`Total Target: ${totalTarget}`, this.margin + 80, currentY);
  this.doc.setTextColor(34, 197, 94); // Green for progress
  this.doc.text(`Overall Progress: ${overallProgress}%`, this.margin + 160, currentY);
  this.doc.setTextColor(0, 0, 0); // Reset color
  currentY += 20;

  // Progress table with enhanced styling
  const tableData = progressData.map(p => [
    p.suburb || 'N/A', // Suburb
    p.startDate ? new Date(p.startDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A', // Start Date
    p.endDate ? new Date(p.endDate).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A', // End Date
    p.streetName || 'N/A', // Street Name
    p.activityType || 'N/A', // Activity Type
    p.completed !== undefined && p.completed !== null ? p.completed : 0, // Completed
    p.target !== undefined && p.target !== null ? p.target : 0, // Target
    p.target > 0 ? `${Math.min(Math.round((p.completed / p.target) * 100), 100)}%` : '0%', // Progress (%)
    p.desktopAppraisals !== undefined && p.desktopAppraisals !== null ? p.desktopAppraisals : 0, // Desktop Appraisals
    p.faceToFaceAppraisals !== undefined && p.faceToFaceAppraisals !== null ? p.faceToFaceAppraisals : 0, // Face-to-Face Appraisals
    p.reason || 'N/A', // Reason
  ]);

  this.doc.autoTable({
    head: [['Suburb', 'Start Date', 'End Date', 'Street Name', 'Activity Type', 'Completed', 'Target', 'Progress (%)', 'Desktop Appraisals', 'Face-to-Face Appraisals', 'Reason']],
    body: tableData,
    startY: currentY,
    margin: { left: this.margin, right: this.margin },
    styles: {
      fontSize: 7, // Reduced for better fit
      cellPadding: 2,
      overflow: 'linebreak',
      textColor: [50, 50, 50],
    },
    headStyles: {
      fillColor: [239, 68, 68], // Red header
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    columnStyles: {
      0: { cellWidth: 30, halign: 'left' }, // Suburb
      1: { cellWidth: 20, halign: 'center' }, // Start Date
      2: { cellWidth: 20, halign: 'center' }, // End Date
      3: { cellWidth: 30, halign: 'left' }, // Street Name
      4: { cellWidth: 20, halign: 'center' }, // Activity Type
      5: { cellWidth: 20, halign: 'right' }, // Completed
      6: { cellWidth: 20, halign: 'right' }, // Target
      7: { cellWidth: 20, halign: 'center' }, // Progress (%)
      8: { cellWidth: 25, halign: 'right' }, // Desktop Appraisals
      9: { cellWidth: 25, halign: 'right' }, // Face-to-Face Appraisals
      10: { cellWidth: 45, halign: 'left' }, // Reason
    },
    didDrawPage: (data) => this.addFooter(),
  });

  return this.doc;
}

  save(filename: string) {
    this.doc.save(filename);
  }
}