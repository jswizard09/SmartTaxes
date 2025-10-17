import { parseW2Data, parse1099DivData, parse1099IntData, parse1099BData, parse1099MiscData, parseConsolidatedBrokerageStatement, detectDocumentType } from "../utils/parsers";
import { PARSING_METHOD, INSIGHT_TYPE, INSIGHT_CATEGORY, INSIGHT_PRIORITY } from "@shared/schema";
import type { ParsedW2, Parsed1099Div, Parsed1099Int, Parsed1099B, Parsed1099Misc, ConsolidatedBrokerageStatement } from "../utils/parsers";
import { llmService } from "./llmService";

export interface ParsingResult {
  success: boolean;
  data: ParsedW2 | Parsed1099Div | Parsed1099Int | Parsed1099B | Parsed1099Misc | ConsolidatedBrokerageStatement | null;
  confidenceScore: number;
  method: string;
  processingTimeMs: number;
  errorMessage?: string;
  extractedFields: string[];
  missingFields: string[];
}

export interface ParsingOptions {
  useLLMFallback: boolean;
  confidenceThreshold: number;
  userId: string;
  fileName?: string; // Add filename for fallback parsing
}

export class ParsingService {
  private confidenceThreshold: number = 0.7;

  /**
   * Main parsing orchestrator - tries pattern matching first, falls back to LLM if needed
   */
  async parseDocument(
    text: string,
    documentType: string,
    options: ParsingOptions
  ): Promise<ParsingResult> {
    const startTime = Date.now();
    
    try {
      // First attempt: Pattern matching
      const patternResult = await this.parseWithPatternMatching(text, documentType, options.fileName);
      
      // If confidence is high enough, return pattern result
      if (patternResult.confidenceScore >= this.confidenceThreshold) {
        return {
          ...patternResult,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // If LLM fallback is enabled and confidence is low, try LLM
      if (options.useLLMFallback && patternResult.confidenceScore < this.confidenceThreshold) {
        console.log(`[ParsingService] Low confidence (${patternResult.confidenceScore}), trying LLM fallback`);
        
        const llmResult = await this.parseWithLLM(text, documentType, options.userId);
        
        // Return the better result
        if (llmResult.confidenceScore > patternResult.confidenceScore) {
          return {
            ...llmResult,
            processingTimeMs: Date.now() - startTime,
          };
        }
      }

      // Return pattern result even if confidence is low
      return {
        ...patternResult,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        confidenceScore: 0,
        method: PARSING_METHOD.PATTERN,
        processingTimeMs: Date.now() - startTime,
        errorMessage: error.message,
        extractedFields: [],
        missingFields: this.getExpectedFields(documentType),
      };
    }
  }

  /**
   * Parse using regex/pattern matching with confidence scoring
   */
  private async parseWithPatternMatching(text: string, documentType: string, fileName?: string): Promise<ParsingResult> {
    const startTime = Date.now();
    
    try {
      let data: any = null;
      let extractedFields: string[] = [];
      let missingFields: string[] = [];

      // Parse based on document type
      switch (documentType) {
        case "W-2":
          data = parseW2Data(text);
          extractedFields = this.extractW2Fields(data);
          missingFields = this.getW2MissingFields(data);
          break;
        case "1099-DIV":
          data = parse1099DivData(text, fileName);
          extractedFields = this.extract1099DivFields(data);
          missingFields = this.get1099DivMissingFields(data);
          break;
        case "1099-INT":
          data = parse1099IntData(text, fileName);
          extractedFields = this.extract1099IntFields(data);
          missingFields = this.get1099IntMissingFields(data);
          break;
        case "1099-B":
          data = parse1099BData(text, fileName);
          extractedFields = this.extract1099BFields(data);
          missingFields = this.get1099BMissingFields(data);
          break;
        case "1099-MISC":
          data = parse1099MiscData(text, fileName);
          extractedFields = this.extract1099MiscFields(data);
          missingFields = this.get1099MiscMissingFields(data);
          break;
        case "CONSOLIDATED-BROKERAGE":
          data = parseConsolidatedBrokerageStatement(text);
          extractedFields = this.extractConsolidatedFields(data);
          missingFields = this.getConsolidatedMissingFields(data);
          break;
        default:
          throw new Error(`Unsupported document type: ${documentType}`);
      }

      // Calculate confidence score
      const expectedFields = this.getExpectedFields(documentType);
      const confidenceScore = extractedFields.length / expectedFields.length;

      return {
        success: true,
        data,
        confidenceScore: Math.min(confidenceScore, 1.0),
        method: PARSING_METHOD.PATTERN,
        processingTimeMs: Date.now() - startTime,
        extractedFields,
        missingFields,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        confidenceScore: 0,
        method: PARSING_METHOD.PATTERN,
        processingTimeMs: Date.now() - startTime,
        errorMessage: error.message,
        extractedFields: [],
        missingFields: this.getExpectedFields(documentType),
      };
    }
  }

  /**
   * Parse using LLM
   */
  private async parseWithLLM(text: string, documentType: string, userId: string): Promise<ParsingResult> {
    const startTime = Date.now();
    
    try {
      const llmResponse = await llmService.parseDocument(text, documentType, userId);
      
      if (!llmResponse.success) {
        return {
          success: false,
          data: null,
          confidenceScore: 0,
          method: PARSING_METHOD.LLM,
          processingTimeMs: Date.now() - startTime,
          errorMessage: llmResponse.errorMessage,
          extractedFields: [],
          missingFields: this.getExpectedFields(documentType),
        };
      }

      // Extract fields from LLM response
      const extractedFields = this.extractFieldsFromData(llmResponse.data, documentType);
      const missingFields = this.getExpectedFields(documentType).filter(field => !extractedFields.includes(field));

      return {
        success: true,
        data: llmResponse.data,
        confidenceScore: llmResponse.confidenceScore,
        method: PARSING_METHOD.LLM,
        processingTimeMs: Date.now() - startTime,
        extractedFields,
        missingFields,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        confidenceScore: 0,
        method: PARSING_METHOD.LLM,
        processingTimeMs: Date.now() - startTime,
        errorMessage: error.message,
        extractedFields: [],
        missingFields: this.getExpectedFields(documentType),
      };
    }
  }

  /**
   * Extract fields from parsed data based on document type
   */
  private extractFieldsFromData(data: any, documentType: string): string[] {
    if (!data) return [];
    
    switch (documentType) {
      case "W-2":
        return this.extractW2Fields(data);
      case "1099-DIV":
        return this.extract1099DivFields(data);
      case "1099-INT":
        return this.extract1099IntFields(data);
      case "1099-B":
        return this.extract1099BFields(data);
      case "1099-MISC":
        return this.extract1099MiscFields(data);
      case "CONSOLIDATED-BROKERAGE":
        return this.extractConsolidatedFields(data);
      default:
        return [];
    }
  }

  /**
   * Get expected fields for each document type
   */
  private getExpectedFields(documentType: string): string[] {
    switch (documentType) {
      case "W-2":
        return ["employerName", "employerEin", "wages", "federalWithheld", "socialSecurityWages", "socialSecurityWithheld", "medicareWages", "medicareWithheld"];
      case "1099-DIV":
        return ["payerName", "payerTin", "ordinaryDividends", "qualifiedDividends", "totalCapitalGain"];
      case "1099-INT":
        return ["payerName", "payerTin", "interestIncome", "earlyWithdrawalPenalty", "usBondInterest", "federalWithheld"];
      case "1099-B":
        return ["payerName", "payerTin", "description", "dateAcquired", "dateSold", "proceeds", "costBasis", "shortTermGainLoss", "longTermGainLoss"];
      case "1099-MISC":
        return ["payerName", "payerTin", "rents", "royalties", "otherIncome", "federalWithheld"];
      case "CONSOLIDATED-BROKERAGE":
        return ["brokerName", "brokerTin", "accountNumber", "taxYear", "hasDivSection", "hasIntSection", "hasMiscSection", "hasBSection"];
      default:
        return [];
    }
  }

  /**
   * Extract field names from parsed data for W-2
   */
  private extractW2Fields(data: ParsedW2): string[] {
    const fields: string[] = [];
    if (data.employerName) fields.push("employerName");
    if (data.employerEin) fields.push("employerEin");
    if (data.wages) fields.push("wages");
    if (data.federalWithheld) fields.push("federalWithheld");
    if (data.socialSecurityWages) fields.push("socialSecurityWages");
    if (data.socialSecurityWithheld) fields.push("socialSecurityWithheld");
    if (data.medicareWages) fields.push("medicareWages");
    if (data.medicareWithheld) fields.push("medicareWithheld");
    return fields;
  }

  /**
   * Extract field names from parsed data for 1099-DIV
   */
  private extract1099DivFields(data: Parsed1099Div): string[] {
    const fields: string[] = [];
    if (data.payerName) fields.push("payerName");
    if (data.payerTin) fields.push("payerTin");
    if (data.ordinaryDividends) fields.push("ordinaryDividends");
    if (data.qualifiedDividends) fields.push("qualifiedDividends");
    if (data.totalCapitalGain) fields.push("totalCapitalGain");
    return fields;
  }

  /**
   * Extract field names from parsed data for 1099-INT
   */
  private extract1099IntFields(data: Parsed1099Int): string[] {
    const fields: string[] = [];
    if (data.payerName) fields.push("payerName");
    if (data.payerTin) fields.push("payerTin");
    if (data.interestIncome) fields.push("interestIncome");
    if (data.earlyWithdrawalPenalty) fields.push("earlyWithdrawalPenalty");
    if (data.usBondInterest) fields.push("usBondInterest");
    if (data.federalWithheld) fields.push("federalWithheld");
    return fields;
  }

  /**
   * Extract field names from parsed data for 1099-B
   */
  private extract1099BFields(data: Parsed1099B): string[] {
    const fields: string[] = [];
    if (data.payerName) fields.push("payerName");
    if (data.payerTin) fields.push("payerTin");
    if (data.description) fields.push("description");
    if (data.dateAcquired) fields.push("dateAcquired");
    if (data.dateSold) fields.push("dateSold");
    if (data.proceeds) fields.push("proceeds");
    if (data.costBasis) fields.push("costBasis");
    if (data.shortTermGainLoss) fields.push("shortTermGainLoss");
    if (data.longTermGainLoss) fields.push("longTermGainLoss");
    return fields;
  }

  /**
   * Get missing fields for W-2
   */
  private getW2MissingFields(data: ParsedW2): string[] {
    const expected = this.getExpectedFields("W-2");
    const extracted = this.extractW2Fields(data);
    return expected.filter(field => !extracted.includes(field));
  }

  /**
   * Get missing fields for 1099-DIV
   */
  private get1099DivMissingFields(data: Parsed1099Div): string[] {
    const expected = this.getExpectedFields("1099-DIV");
    const extracted = this.extract1099DivFields(data);
    return expected.filter(field => !extracted.includes(field));
  }

  /**
   * Get missing fields for 1099-INT
   */
  private get1099IntMissingFields(data: Parsed1099Int): string[] {
    const expected = this.getExpectedFields("1099-INT");
    const extracted = this.extract1099IntFields(data);
    return expected.filter(field => !extracted.includes(field));
  }

  /**
   * Get missing fields for 1099-B
   */
  private get1099BMissingFields(data: Parsed1099B): string[] {
    const expected = this.getExpectedFields("1099-B");
    const extracted = this.extract1099BFields(data);
    return expected.filter(field => !extracted.includes(field));
  }

  /**
   * Extract field names from parsed data for 1099-MISC
   */
  private extract1099MiscFields(data: Parsed1099Misc): string[] {
    const fields: string[] = [];
    if (data.payerName) fields.push("payerName");
    if (data.payerTin) fields.push("payerTin");
    if (data.rents) fields.push("rents");
    if (data.royalties) fields.push("royalties");
    if (data.otherIncome) fields.push("otherIncome");
    if (data.federalWithheld) fields.push("federalWithheld");
    return fields;
  }

  /**
   * Extract field names from parsed data for Consolidated Brokerage Statement
   */
  private extractConsolidatedFields(data: ConsolidatedBrokerageStatement): string[] {
    const fields: string[] = [];
    if (data.brokerName) fields.push("brokerName");
    if (data.brokerTin) fields.push("brokerTin");
    if (data.accountNumber) fields.push("accountNumber");
    if (data.taxYear) fields.push("taxYear");
    if (data.hasDivSection) fields.push("hasDivSection");
    if (data.hasIntSection) fields.push("hasIntSection");
    if (data.hasMiscSection) fields.push("hasMiscSection");
    if (data.hasBSection) fields.push("hasBSection");
    return fields;
  }

  /**
   * Get missing fields for 1099-MISC
   */
  private get1099MiscMissingFields(data: Parsed1099Misc): string[] {
    const expected = this.getExpectedFields("1099-MISC");
    const extracted = this.extract1099MiscFields(data);
    return expected.filter(field => !extracted.includes(field));
  }

  /**
   * Get missing fields for Consolidated Brokerage Statement
   */
  private getConsolidatedMissingFields(data: ConsolidatedBrokerageStatement): string[] {
    const expected = this.getExpectedFields("CONSOLIDATED-BROKERAGE");
    const extracted = this.extractConsolidatedFields(data);
    return expected.filter(field => !extracted.includes(field));
  }

  /**
   * Validate extracted data for common issues
   */
  validateExtractedData(data: any, documentType: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Common validations
    if (data.employerEin && !this.isValidEIN(data.employerEin)) {
      issues.push("Invalid EIN format");
    }

    if (data.payerTin && !this.isValidEIN(data.payerTin)) {
      issues.push("Invalid TIN format");
    }

    // Validate dollar amounts
    const dollarFields = ["wages", "federalWithheld", "ordinaryDividends", "interestIncome", "proceeds", "costBasis"];
    for (const field of dollarFields) {
      if (data[field] && !this.isValidDollarAmount(data[field])) {
        issues.push(`Invalid dollar amount for ${field}: ${data[field]}`);
      }
    }

    // Validate dates
    const dateFields = ["dateAcquired", "dateSold"];
    for (const field of dateFields) {
      if (data[field] && !this.isValidDate(data[field])) {
        issues.push(`Invalid date format for ${field}: ${data[field]}`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validate EIN format (XX-XXXXXXX)
   */
  private isValidEIN(ein: string): boolean {
    const einRegex = /^\d{2}-\d{7}$/;
    return einRegex.test(ein);
  }

  /**
   * Validate dollar amount format
   */
  private isValidDollarAmount(amount: string): boolean {
    const amountRegex = /^\d+(\.\d{2})?$/;
    return amountRegex.test(amount);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(date);
  }
}

// Export singleton instance
export const parsingService = new ParsingService();
