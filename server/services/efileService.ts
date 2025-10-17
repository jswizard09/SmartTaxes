import type { TaxReturn, Form1040, User, EfileSubmission } from "@shared/schema";
import { EFILE_STATUS } from "@shared/schema";

export interface EfileOptions {
  submissionType: "federal" | "state";
  bankAccount?: {
    routingNumber: string;
    accountNumber: string;
    accountType: "checking" | "savings";
  };
  signatureConsent: boolean;
  refundPreference?: "direct_deposit" | "check" | "savings_bond";
}

export interface EfileResponse {
  success: boolean;
  submissionId?: string;
  acknowledgmentNumber?: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  processingTime?: number;
}

export class EfileService {
  private apiEndpoint: string;
  private apiKey: string;
  private isTestMode: boolean;

  constructor() {
    this.apiEndpoint = process.env.IRS_EFILE_ENDPOINT || "https://api.irs.gov/efile/v1";
    this.apiKey = process.env.IRS_EFILE_API_KEY || "";
    this.isTestMode = process.env.NODE_ENV !== "production";
    
    if (!this.apiKey) {
      console.warn("[EfileService] No IRS e-file API key found. E-file features will be disabled.");
    }
  }

  /**
   * Submit tax return to IRS
   */
  async submitTaxReturn(
    taxReturn: TaxReturn,
    form1040: Form1040,
    user: User,
    options: EfileOptions
  ): Promise<EfileResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        status: EFILE_STATUS.ERROR,
        errorMessage: "E-file service not configured - no API key",
      };
    }

    try {
      const startTime = Date.now();
      
      // Generate XML for submission
      const xmlData = this.generateSubmissionXML(taxReturn, form1040, user, options);
      
      // Submit to IRS
      const response = await this.submitToIRS(xmlData, options);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: response.success,
        submissionId: response.submissionId,
        acknowledgmentNumber: response.acknowledgmentNumber,
        status: response.success ? EFILE_STATUS.PENDING : EFILE_STATUS.ERROR,
        errorCode: response.errorCode,
        errorMessage: response.errorMessage,
        processingTime,
      };
    } catch (error: any) {
      console.error("[EfileService] Error submitting tax return:", error);
      return {
        success: false,
        status: EFILE_STATUS.ERROR,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Check submission status
   */
  async checkSubmissionStatus(submissionId: string): Promise<EfileResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        status: EFILE_STATUS.ERROR,
        errorMessage: "E-file service not configured",
      };
    }

    try {
      const response = await fetch(`${this.apiEndpoint}/submissions/${submissionId}/status`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`IRS API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        submissionId: data.submissionId,
        acknowledgmentNumber: data.acknowledgmentNumber,
        status: data.status,
        errorCode: data.errorCode,
        errorMessage: data.errorMessage,
      };
    } catch (error: any) {
      console.error("[EfileService] Error checking status:", error);
      return {
        success: false,
        status: EFILE_STATUS.ERROR,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Generate XML for IRS submission
   */
  private generateSubmissionXML(
    taxReturn: TaxReturn,
    form1040: Form1040,
    user: User,
    options: EfileOptions
  ): string {
    // This is a simplified XML structure
    // In a real implementation, this would follow the IRS Modernized e-File (MeF) specification
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Return xmlns="http://www.irs.gov/efile">
  <ReturnHeader>
    <ReturnType>1040</ReturnType>
    <TaxYear>${taxReturn.taxYear}</TaxYear>
    <FilingStatus>${this.mapFilingStatus(taxReturn.filingStatus)}</FilingStatus>
    <Taxpayer>
      <Name>${user.username}</Name>
      <Email>${user.email}</Email>
    </Taxpayer>
  </ReturnHeader>
  <ReturnData>
    <Form1040>
      <Wages>${form1040.wages || "0"}</Wages>
      <InterestIncome>${form1040.interestIncome || "0"}</InterestIncome>
      <DividendIncome>${form1040.dividendIncome || "0"}</DividendIncome>
      <QualifiedDividends>${form1040.qualifiedDividends || "0"}</QualifiedDividends>
      <CapitalGains>${form1040.capitalGains || "0"}</CapitalGains>
      <TotalIncome>${form1040.totalIncome || "0"}</TotalIncome>
      <AdjustedGrossIncome>${form1040.adjustedGrossIncome || "0"}</AdjustedGrossIncome>
      <StandardDeduction>${form1040.standardDeduction || "0"}</StandardDeduction>
      <TaxableIncome>${form1040.taxableIncome || "0"}</TaxableIncome>
      <Tax>${form1040.tax || "0"}</Tax>
      <TotalTax>${form1040.totalTax || "0"}</TotalTax>
      <FederalWithheld>${form1040.federalWithheld || "0"}</FederalWithheld>
      <RefundOrOwed>${form1040.refundOrOwed || "0"}</RefundOrOwed>
    </Form1040>
  </ReturnData>
  <PaymentInfo>
    ${options.bankAccount ? this.generateBankAccountXML(options.bankAccount) : ""}
  </PaymentInfo>
</Return>`;

    return xml;
  }

  /**
   * Generate bank account XML for direct deposit
   */
  private generateBankAccountXML(bankAccount: EfileOptions["bankAccount"]): string {
    if (!bankAccount) return "";
    
    return `
    <DirectDeposit>
      <RoutingNumber>${bankAccount.routingNumber}</RoutingNumber>
      <AccountNumber>${bankAccount.accountNumber}</AccountNumber>
      <AccountType>${bankAccount.accountType}</AccountType>
    </DirectDeposit>`;
  }

  /**
   * Map internal filing status to IRS format
   */
  private mapFilingStatus(status: string): string {
    const mapping: Record<string, string> = {
      "single": "1",
      "married_joint": "2",
      "married_separate": "3",
      "head_of_household": "4",
    };
    return mapping[status] || "1";
  }

  /**
   * Submit XML to IRS
   */
  private async submitToIRS(xmlData: string, options: EfileOptions): Promise<EfileResponse> {
    try {
      const response = await fetch(`${this.apiEndpoint}/submissions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/xml",
          "X-Test-Mode": this.isTestMode ? "true" : "false",
        },
        body: xmlData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`IRS API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        submissionId: data.submissionId,
        acknowledgmentNumber: data.acknowledgmentNumber,
        status: data.status,
      };
    } catch (error: any) {
      console.error("[EfileService] IRS submission error:", error);
      return {
        success: false,
        status: EFILE_STATUS.ERROR,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Validate bank account information
   */
  validateBankAccount(bankAccount: EfileOptions["bankAccount"]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!bankAccount) {
      return { isValid: true, errors: [] };
    }

    // Validate routing number (9 digits)
    if (!bankAccount.routingNumber || !/^\d{9}$/.test(bankAccount.routingNumber)) {
      errors.push("Routing number must be 9 digits");
    }

    // Validate account number (4-17 digits)
    if (!bankAccount.accountNumber || !/^\d{4,17}$/.test(bankAccount.accountNumber)) {
      errors.push("Account number must be 4-17 digits");
    }

    // Validate account type
    if (!["checking", "savings"].includes(bankAccount.accountType)) {
      errors.push("Account type must be 'checking' or 'savings'");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get submission requirements
   */
  getSubmissionRequirements(): {
    requiredFields: string[];
    optionalFields: string[];
    deadlines: {
      federal: string;
      state: Record<string, string>;
    };
  } {
    return {
      requiredFields: [
        "taxpayer_name",
        "taxpayer_email",
        "filing_status",
        "tax_year",
        "signature_consent",
      ],
      optionalFields: [
        "bank_account_routing",
        "bank_account_number",
        "bank_account_type",
        "refund_preference",
      ],
      deadlines: {
        federal: "April 15th",
        state: {
          "CA": "April 15th",
          "NY": "April 15th",
          "TX": "N/A (no state income tax)",
        },
      },
    };
  }

  /**
   * Check if e-file is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get supported states for e-filing
   */
  getSupportedStates(): string[] {
    return ["CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI"];
  }
}

// Export singleton instance
export const efileService = new EfileService();
