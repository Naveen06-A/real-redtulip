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
    // Add background logo/watermark
    this.doc.setGState(new this.doc.GState({ opacity: 0.1 }));
    this.doc.setFontSize(60);
    this.doc.setTextColor(200, 200, 200);
    
    // Center the watermark
    const text = 'REAL ESTATE';
    const textWidth = this.doc.getTextWidth(text);
    const x = (this.pageWidth - textWidth) / 2;
    const y = this.pageHeight / 2;
    
    this.doc.text(text, x, y, { angle: 45 });
    
    // Reset opacity
    this.doc.setGState(new this.doc.GState({ opacity: 1 }));
  }

  private addHeader(title: string, subtitle?: string) {
    // Company logo area (placeholder)
    this.doc.setFillColor(59, 130, 246); // Blue color
    this.doc.rect(this.margin, this.margin, 30, 20, 'F');
    
    // Company name in logo area
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(8);
    this.doc.text('REAL ESTATE', this.margin + 2, this.margin + 8);
    this.doc.text('PLATFORM', this.margin + 2, this.margin + 14);
    
    // Reset text color
    this.doc.setTextColor(0, 0, 0);
    
    // Title
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.margin + 40, this.margin + 15);
    
    // Subtitle
    if (subtitle) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(subtitle, this.margin + 40, this.margin + 25);
    }
    
    // Date
    this.doc.setFontSize(10);
    const date = new Date().toLocaleDateString();
    const dateWidth = this.doc.getTextWidth(`Generated: ${date}`);
    this.doc.text(`Generated: ${date}`, this.pageWidth - this.margin - dateWidth, this.margin + 15);
    
    // Horizontal line
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.margin + 35, this.pageWidth - this.margin, this.margin + 35);
    
    return this.margin + 45; // Return Y position after header
  }

  private addFooter() {
    const footerY = this.pageHeight - 20;
    
    // Footer line
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, footerY, this.pageWidth - this.margin, footerY);
    
    // Footer text
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('Real Estate Platform - Confidential Report', this.margin, footerY + 10);
    
    // Page number
    const pageNum = `Page ${this.doc.getCurrentPageInfo().pageNumber}`;
    const pageNumWidth = this.doc.getTextWidth(pageNum);
    this.doc.text(pageNum, this.pageWidth - this.margin - pageNumWidth, footerY + 10);
  }

  generatePropertyReport(properties: any[], title: string = 'Property Report') {
    this.addWatermark();
    let currentY = this.addHeader(title, `Total Properties: ${properties.length}`);
    
    // Summary statistics
    const totalValue = properties.reduce((sum, prop) => sum + (prop.price || 0), 0);
    const avgPrice = properties.length > 0 ? totalValue / properties.length : 0;
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Summary Statistics', this.margin, currentY);
    currentY += 10;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.text(`Total Properties: ${properties.length}`, this.margin, currentY);
    this.doc.text(`Total Value: $${totalValue.toLocaleString()}`, this.margin + 80, currentY);
    this.doc.text(`Average Price: $${avgPrice.toLocaleString()}`, this.margin + 160, currentY);
    currentY += 20;
    
    // Properties table
    const tableData = properties.map(prop => [
      prop.street_number + ' ' + prop.street_name,
      prop.suburb || '',
      prop.property_type || '',
      prop.bedrooms || '',
      prop.bathrooms || '',
      prop.price ? `$${prop.price.toLocaleString()}` : '',
      prop.category || ''
    ]);
    
    this.doc.autoTable({
      head: [['Address', 'Suburb', 'Type', 'Bed', 'Bath', 'Price', 'Status']],
      body: tableData,
      startY: currentY,
      margin: { left: this.margin, right: this.margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });
    
    this.addFooter();
    return this.doc;
  }

  generateActivityReport(activities: any[], title: string = 'Activity Report') {
    this.addWatermark();
    let currentY = this.addHeader(title, `Total Activities: ${activities.length}`);
    
    // Activity summary
    const doorKnocks = activities.filter(a => a.activity_type === 'door_knock').length;
    const phoneCalls = activities.filter(a => a.activity_type === 'phone_call').length;
    const appraisals = activities.filter(a => a.activity_type === 'appraisal').length;
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Activity Summary', this.margin, currentY);
    currentY += 10;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.text(`Door Knocks: ${doorKnocks}`, this.margin, currentY);
    this.doc.text(`Phone Calls: ${phoneCalls}`, this.margin + 60, currentY);
    this.doc.text(`Appraisals: ${appraisals}`, this.margin + 120, currentY);
    currentY += 20;
    
    // Activities table
    const tableData = activities.map(activity => [
      new Date(activity.activity_date).toLocaleDateString(),
      activity.activity_type?.replace('_', ' ').toUpperCase() || '',
      activity.suburb || '',
      activity.street_name || '',
      activity.notes || '',
      activity.status || ''
    ]);
    
    this.doc.autoTable({
      head: [['Date', 'Type', 'Suburb', 'Street', 'Notes', 'Status']],
      body: tableData,
      startY: currentY,
      margin: { left: this.margin, right: this.margin },
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });
    
    this.addFooter();
    return this.doc;
  }

  generateCommissionReport(commissions: any[], title: string = 'Commission Report') {
    this.addWatermark();
    let currentY = this.addHeader(title, `Total Records: ${commissions.length}`);
    
    // Commission summary
    const totalCommission = commissions.reduce((sum, comm) => sum + (comm.commission_rate || 0), 0);
    const avgCommission = commissions.length > 0 ? totalCommission / commissions.length : 0;
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Commission Summary', this.margin, currentY);
    currentY += 10;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.text(`Total Commission: ${totalCommission.toFixed(2)}%`, this.margin, currentY);
    this.doc.text(`Average Commission: ${avgCommission.toFixed(2)}%`, this.margin + 100, currentY);
    currentY += 20;
    
    // Commission table
    const tableData = commissions.map(comm => [
      comm.agent_name || '',
      comm.property_id || '',
      `${comm.commission_rate || 0}%`,
      new Date(comm.created_at || Date.now()).toLocaleDateString()
    ]);
    
    this.doc.autoTable({
      head: [['Agent Name', 'Property ID', 'Commission Rate', 'Date']],
      body: tableData,
      startY: currentY,
      margin: { left: this.margin, right: this.margin },
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [168, 85, 247],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });
    
    this.addFooter();
    return this.doc;
  }

  save(filename: string) {
    this.doc.save(filename);
  }
}