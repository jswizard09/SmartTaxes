import PDFDocument from "pdfkit";
import type { Form1040, Form8949, ScheduleD, TaxReturn, User } from "@shared/schema";

export interface PDFGenerationOptions {
  includeInstructions: boolean;
  includeCoverLetter: boolean;
  watermark?: string;
  signatureRequired: boolean;
}

export class PDFService {
  /**
   * Generate comprehensive tax forms PDF package
   */
  async generateTaxFormsPDF(
    taxReturn: TaxReturn,
    form1040: Form1040,
    form8949Data: Form8949[],
    scheduleD: ScheduleD | null,
    user: User,
    options: PDFGenerationOptions = {
      includeInstructions: true,
      includeCoverLetter: true,
      signatureRequired: true,
    }
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Cover letter
        if (options.includeCoverLetter) {
          this.addCoverLetter(doc, user, taxReturn);
        }

        // Form 1040
        this.addForm1040(doc, form1040, taxReturn, user);

        // Schedule D
        if (scheduleD) {
          this.addScheduleD(doc, scheduleD);
        }

        // Form 8949
        if (form8949Data.length > 0) {
          this.addForm8949(doc, form8949Data);
        }

        // Instructions
        if (options.includeInstructions) {
          this.addInstructions(doc, taxReturn);
        }

        // Signature page
        if (options.signatureRequired) {
          this.addSignaturePage(doc, user, taxReturn);
        }

        // Watermark
        if (options.watermark) {
          this.addWatermark(doc, options.watermark);
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate individual form PDF
   */
  async generateFormPDF(
    formType: "1040" | "8949" | "schedule-d",
    data: any,
    user: User,
    taxReturn: TaxReturn
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        switch (formType) {
          case "1040":
            this.addForm1040(doc, data, taxReturn, user);
            break;
          case "8949":
            this.addForm8949(doc, Array.isArray(data) ? data : [data]);
            break;
          case "schedule-d":
            this.addScheduleD(doc, data);
            break;
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add cover letter to PDF
   */
  private addCoverLetter(doc: typeof PDFDocument, user: User, taxReturn: TaxReturn): void {
    doc.fontSize(20).text("Tax Return Package", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(12).text(`Dear ${user.username},`, 50, doc.y);
    doc.moveDown(1);

    doc.text(`Your ${taxReturn.taxYear} tax return has been prepared and is ready for filing. This package includes:`);
    doc.moveDown(0.5);

    doc.text("• Form 1040 - U.S. Individual Income Tax Return");
    doc.text("• Schedule D - Capital Gains and Losses (if applicable)");
    doc.text("• Form 8949 - Sales and Other Dispositions of Capital Assets (if applicable)");
    doc.text("• Filing instructions and next steps");
    doc.moveDown(1);

    doc.text("Please review all forms carefully before filing. If you have any questions, please contact our support team.");
    doc.moveDown(2);

    doc.text("Thank you for using our tax preparation service!");
    doc.moveDown(3);

    doc.addPage();
  }

  /**
   * Add Form 1040 to PDF
   */
  private addForm1040(doc: typeof PDFDocument, form1040: Form1040, taxReturn: TaxReturn, user: User): void {
    // Header
    doc.fontSize(16).text("Form 1040", { align: "center" });
    doc.fontSize(12).text(`U.S. Individual Income Tax Return ${taxReturn.taxYear}`, { align: "center" });
    doc.moveDown(1);

    // Taxpayer Information
    doc.fontSize(14).text("Taxpayer Information", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Name: ${user.username}`);
    doc.text(`Email: ${user.email}`);
    doc.text(`Filing Status: ${taxReturn.filingStatus.replace(/_/g, " ").toUpperCase()}`);
    doc.moveDown(1.5);

    // Income Section
    doc.fontSize(14).text("Income", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    
    const wages = parseFloat(form1040.wages || "0");
    const interest = parseFloat(form1040.interestIncome || "0");
    const dividends = parseFloat(form1040.dividendIncome || "0");
    const qualifiedDividends = parseFloat(form1040.qualifiedDividends || "0");
    const capitalGains = parseFloat(form1040.capitalGains || "0");
    const totalIncome = parseFloat(form1040.totalIncome || "0");

    doc.text(`1. Wages, salaries, tips, etc: $${wages.toFixed(2)}`);
    doc.text(`2a. Tax-exempt interest: $0.00`);
    doc.text(`2b. Taxable interest: $${interest.toFixed(2)}`);
    doc.text(`3a. Qualified dividends: $${qualifiedDividends.toFixed(2)}`);
    doc.text(`3b. Ordinary dividends: $${dividends.toFixed(2)}`);
    doc.text(`7. Capital gain or (loss): $${capitalGains.toFixed(2)}`);
    doc.text(`9. Total income: $${totalIncome.toFixed(2)}`);
    doc.moveDown(1.5);

    // Adjusted Gross Income
    doc.fontSize(14).text("Adjusted Gross Income", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`10. Adjustments to income: $${parseFloat(form1040.adjustments || "0").toFixed(2)}`);
    doc.text(`11. Adjusted gross income: $${parseFloat(form1040.adjustedGrossIncome || "0").toFixed(2)}`);
    doc.moveDown(1.5);

    // Tax and Credits
    doc.fontSize(14).text("Tax and Credits", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`12. Standard deduction: $${parseFloat(form1040.standardDeduction || "0").toFixed(2)}`);
    doc.text(`15. Taxable income: $${parseFloat(form1040.taxableIncome || "0").toFixed(2)}`);
    doc.text(`16. Tax: $${parseFloat(form1040.tax || "0").toFixed(2)}`);
    doc.text(`19. Total tax: $${parseFloat(form1040.totalTax || "0").toFixed(2)}`);
    doc.moveDown(1.5);

    // Payments
    doc.fontSize(14).text("Payments", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`25. Federal income tax withheld: $${parseFloat(form1040.federalWithheld || "0").toFixed(2)}`);
    doc.moveDown(1.5);

    // Refund or Amount Owed
    const refundOrOwed = parseFloat(form1040.refundOrOwed || "0");
    doc.fontSize(14).text(refundOrOwed >= 0 ? "Refund" : "Amount You Owe", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(
      refundOrOwed >= 0
        ? `34. Amount to be refunded: $${refundOrOwed.toFixed(2)}`
        : `37. Amount you owe: $${Math.abs(refundOrOwed).toFixed(2)}`
    );

    doc.addPage();
  }

  /**
   * Add Schedule D to PDF
   */
  private addScheduleD(doc: typeof PDFDocument, scheduleD: ScheduleD): void {
    doc.fontSize(16).text("Schedule D", { align: "center" });
    doc.fontSize(12).text("Capital Gains and Losses", { align: "center" });
    doc.moveDown(1);

    // Part I - Short-term capital gains and losses
    doc.fontSize(14).text("Part I - Short-Term Capital Gains and Losses", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`1a. Total proceeds: $${parseFloat(scheduleD.shortTermTotalProceeds || "0").toFixed(2)}`);
    doc.text(`1b. Total cost basis: $${parseFloat(scheduleD.shortTermTotalCostBasis || "0").toFixed(2)}`);
    doc.text(`1c. Total gain or loss: $${parseFloat(scheduleD.shortTermTotalGainLoss || "0").toFixed(2)}`);
    doc.moveDown(1);

    // Part II - Long-term capital gains and losses
    doc.fontSize(14).text("Part II - Long-Term Capital Gains and Losses", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`8a. Total proceeds: $${parseFloat(scheduleD.longTermTotalProceeds || "0").toFixed(2)}`);
    doc.text(`8b. Total cost basis: $${parseFloat(scheduleD.longTermTotalCostBasis || "0").toFixed(2)}`);
    doc.text(`8c. Total gain or loss: $${parseFloat(scheduleD.longTermTotalGainLoss || "0").toFixed(2)}`);
    doc.moveDown(1);

    // Part III - Summary
    doc.fontSize(14).text("Part III - Summary", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text(`16. Net short-term capital gain or loss: $${parseFloat(scheduleD.netShortTermGainLoss || "0").toFixed(2)}`);
    doc.text(`17. Net long-term capital gain or loss: $${parseFloat(scheduleD.netLongTermGainLoss || "0").toFixed(2)}`);
    doc.text(`18. Total capital gain or loss: $${parseFloat(scheduleD.totalCapitalGainLoss || "0").toFixed(2)}`);

    doc.addPage();
  }

  /**
   * Add Form 8949 to PDF
   */
  private addForm8949(doc: typeof PDFDocument, form8949Data: Form8949[]): void {
    doc.fontSize(16).text("Form 8949", { align: "center" });
    doc.fontSize(12).text("Sales and Other Dispositions of Capital Assets", { align: "center" });
    doc.moveDown(1);

    // Group by short-term and long-term
    const shortTerm = form8949Data.filter(f => f.isShortTerm);
    const longTerm = form8949Data.filter(f => !f.isShortTerm);

    if (shortTerm.length > 0) {
      doc.fontSize(14).text("Part I - Short-Term Transactions", { underline: true });
      doc.moveDown(0.5);
      this.addForm8949Table(doc, shortTerm);
      doc.moveDown(1);
    }

    if (longTerm.length > 0) {
      doc.fontSize(14).text("Part II - Long-Term Transactions", { underline: true });
      doc.moveDown(0.5);
      this.addForm8949Table(doc, longTerm);
    }

    doc.addPage();
  }

  /**
   * Add Form 8949 table
   */
  private addForm8949Table(doc: typeof PDFDocument, transactions: Form8949[]): void {
    doc.fontSize(10);
    
    // Table headers
    const headers = ["Description", "Date Acquired", "Date Sold", "Proceeds", "Cost Basis", "Gain/Loss"];
    const colWidths = [120, 80, 80, 80, 80, 80];
    let x = 50;
    
    // Draw headers
    headers.forEach((header, i) => {
      doc.text(header, x, doc.y, { width: colWidths[i], align: "center" });
      x += colWidths[i];
    });
    doc.moveDown(0.5);
    
    // Draw separator line
    doc.moveTo(50, doc.y).lineTo(50 + colWidths.reduce((a, b) => a + b, 0), doc.y).stroke();
    doc.moveDown(0.2);

    // Draw transactions
    transactions.forEach(transaction => {
      x = 50;
      const row = [
        transaction.description || "N/A",
        transaction.dateAcquired || "N/A",
        transaction.dateSold || "N/A",
        `$${parseFloat(transaction.proceeds || "0").toFixed(2)}`,
        `$${parseFloat(transaction.costBasis || "0").toFixed(2)}`,
        `$${parseFloat(transaction.gainOrLoss || "0").toFixed(2)}`,
      ];
      
      row.forEach((cell, i) => {
        doc.text(cell, x, doc.y, { width: colWidths[i], align: "center" });
        x += colWidths[i];
      });
      doc.moveDown(0.3);
    });
  }

  /**
   * Add instructions to PDF
   */
  private addInstructions(doc: typeof PDFDocument, taxReturn: TaxReturn): void {
    doc.fontSize(16).text("Filing Instructions", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(12).text("Next Steps:", { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11);
    doc.text("1. Review all forms carefully for accuracy");
    doc.text("2. Sign and date Form 1040");
    doc.text("3. Choose your filing method:");
    doc.moveDown(0.3);
    doc.text("   • E-file (recommended) - fastest processing");
    doc.text("   • Mail to IRS - include payment if you owe taxes");
    doc.moveDown(0.5);

    doc.text("4. Keep copies of all forms for your records");
    doc.text("5. File by April 15th to avoid penalties");
    doc.moveDown(1);

    doc.text("Important Notes:", { underline: true });
    doc.moveDown(0.5);
    doc.text("• If you owe taxes, payment is due by April 15th");
    doc.text("• If you're getting a refund, expect it within 21 days of e-filing");
    doc.text("• Keep all supporting documents for at least 3 years");

    doc.addPage();
  }

  /**
   * Add signature page to PDF
   */
  private addSignaturePage(doc: typeof PDFDocument, user: User, taxReturn: TaxReturn): void {
    doc.fontSize(16).text("Signature Page", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(12).text("Taxpayer Signature", { underline: true });
    doc.moveDown(1);
    doc.text("I declare under penalty of perjury that I have examined this return and accompanying schedules and statements, and to the best of my knowledge and belief, they are true, correct, and complete.");
    doc.moveDown(2);

    // Signature line
    doc.text("Taxpayer Signature: _________________________ Date: ___________");
    doc.moveDown(1);
    doc.text(`Print Name: ${user.username}`);
    doc.moveDown(2);

    doc.text("Spouse Signature (if filing jointly): _________________________ Date: ___________");
    doc.moveDown(1);
    doc.text("Print Name: _________________________");
    doc.moveDown(2);

    doc.fontSize(10).fillColor("gray").text("Note: Both spouses must sign if filing jointly");
  }
  
  /**
   * Add watermark to PDF
   */
  private addWatermark(doc: typeof PDFDocument, watermark: string): void {
    doc.save();
    doc.rotate(-45);
    doc.fontSize(60);
    doc.fillColor("lightgray");
    doc.text(watermark, 200, 400);
    doc.restore();
  }

  /**
   * Generate fillable PDF (placeholder - would require additional libraries)
   */
  async generateFillablePDF(): Promise<Buffer> {
    // This would require additional libraries like pdf-lib or hummus
    // For now, return a placeholder
    throw new Error("Fillable PDF generation not yet implemented");
  }
}

// Export singleton instance
export const pdfService = new PDFService();
