import * as XLSX from "xlsx";
import { createReadStream, readFileSync } from "fs";
import csvParser from "csv-parser";
import { createWorker } from "tesseract.js";
import { PDFParse } from 'pdf-parse';

export interface ParsedW2 {
  employerName?: string;
  employerEin?: string;
  wages?: string;
  federalWithheld?: string;
  socialSecurityWages?: string;
  socialSecurityWithheld?: string;
  medicareWages?: string;
  medicareWithheld?: string;
}

export interface Parsed1099Div {
  payerName?: string;
  payerTin?: string;
  ordinaryDividends?: string;
  qualifiedDividends?: string;
  totalCapitalGain?: string;
  foreignTaxPaid?: string;
}

export interface Parsed1099Int {
  payerName?: string;
  payerTin?: string;
  interestIncome?: string;
  earlyWithdrawalPenalty?: string;
  usBondInterest?: string;
  federalWithheld?: string;
}

export interface Parsed1099B {
  payerName?: string;
  payerTin?: string;
  description?: string;
  dateAcquired?: string;
  dateSold?: string;
  proceeds?: string;
  costBasis?: string;
  shortTermGainLoss?: string;
  longTermGainLoss?: string;
  entries?: Parsed1099BEntry[];
}

export interface Parsed1099BEntry {
  description?: string;
  dateAcquired?: string;
  dateSold?: string;
  proceeds?: string;
  costBasis?: string;
  gainLoss?: string;
  isShortTerm?: boolean;
  reportedToIrs?: boolean;
  washSale?: boolean;
}

export interface Parsed1099Misc {
  payerName?: string;
  payerTin?: string;
  rents?: string;
  royalties?: string;
  otherIncome?: string;
  federalWithheld?: string;
}

export interface ConsolidatedBrokerageStatement {
  brokerName?: string;
  brokerTin?: string;
  accountNumber?: string;
  taxYear?: string;
  divData?: Parsed1099Div;
  intData?: Parsed1099Int;
  miscData?: Parsed1099Misc;
  bData?: Parsed1099B[];
  hasDivSection?: boolean;
  hasIntSection?: boolean;
  hasMiscSection?: boolean;
  hasBSection?: boolean;
}

// Helper function to extract payer name from filename
function extractPayerNameFromFilename(fileName: string): string {
  if (!fileName) return "Unknown Payer";
  
  // Remove file extension
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  
  // Common patterns to extract company names
  const patterns = [
    // Remove common prefixes/suffixes
    /^(1099|w2|w-2|tax|form)[-_]?/i,
    /[-_](1099|w2|w-2|tax|form)$/i,
    // Remove year patterns
    /[-_]?(20\d{2})[-_]?/,
    // Remove common suffixes
    /[-_](div|int|b|misc)$/i,
    // Remove file identifiers
    /[-_]?(copy|scan|page|\d+)$/i,
  ];
  
  let cleanedName = nameWithoutExt;
  patterns.forEach(pattern => {
    cleanedName = cleanedName.replace(pattern, "");
  });
  
  // Clean up separators and capitalize
  cleanedName = cleanedName
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  // Capitalize first letter of each word
  cleanedName = cleanedName.replace(/\b\w/g, l => l.toUpperCase());
  
  return cleanedName || "Unknown Payer";
}

// Helper function to extract TIN from filename
function extractTinFromFilename(fileName: string): string | null {
  if (!fileName) return null;
  
  // Look for TIN patterns in filename (XX-XXXXXXX)
  const tinMatch = fileName.match(/(\d{2}-\d{7})/);
  return tinMatch ? tinMatch[1] : null;
}

export async function parsePDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = readFileSync(filePath);
          
      // Fallback to PDFParse class
      const parser = new PDFParse({ data: dataBuffer });
      const info = await parser.getInfo();
      const data = await parser.getText();
      await parser.destroy();

      console.log(`PDF Info: ${JSON.stringify(info)}`);
      console.log(`Extracted text length from PDF ${filePath}: ${data.text.length}`);
      
      // If text is empty, it's likely an image-based PDF, so try OCR
      if (!data.text || data.text.trim().length < 50) {
        console.log(`No meaningful text found in PDF ${filePath}, attempting OCR...`);
        return await parseImageWithOCR(filePath);
      }
      
      return data.text;
  } catch (error) {
    console.error(`Error parsing PDF ${filePath}:`, error);
    throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

export async function parseImageWithOCR(filePath: string): Promise<string> {
  const worker = await createWorker("eng");
  try {
    const { data: { text } } = await worker.recognize(filePath);
    console.log(`[OCR] Successfully recognized text from ${filePath}. Length: ${text.length}`);
    return text;
  } finally {
    await worker.terminate();
  }
}

export async function parseCSV(filePath: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}

export async function parseExcel(filePath: string): Promise<any[]> {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet);
}

export function detectDocumentType(text: string): string {
  const upperText = text.toUpperCase();
  
  // Consolidated brokerage statement detection (check this first to avoid false positives)
  if (upperText.includes("TAX REPORTING STATEMENT") ||
      upperText.includes("CONSOLIDATED") ||
      upperText.includes("BROKERAGE STATEMENT") ||
      (upperText.includes("1099") && upperText.includes("CONSOLIDATED")) ||
      (upperText.includes("DIVIDENDS") && upperText.includes("INTEREST") && upperText.includes("MISC")) ||
      (upperText.includes("FORM 1099-DIV") && upperText.includes("FORM 1099-INT") && upperText.includes("FORM 1099-MISC")) ||
      (upperText.includes("DIVIDENDS AND DISTRIBUTIONS") && upperText.includes("INTEREST INCOME") && upperText.includes("MISCELLANEOUS"))) {
    return "CONSOLIDATED-BROKERAGE";
  }
  
  // More comprehensive W-2 detection - look for patterns typical of W-2 forms
  if (upperText.includes("FORM W-2") || 
      upperText.includes("WAGE AND TAX STATEMENT") ||
      upperText.includes("W-2") ||
      upperText.includes("EMPLOYER'S") ||
      upperText.includes("EMPLOYEE'S") ||
      upperText.includes("SOCIAL SECURITY WAGES") ||
      upperText.includes("MEDICARE WAGES") ||
      upperText.includes("FEDERAL INCOME TAX WITHHELD") ||
      // Additional patterns for W-2 detection
      (upperText.includes("SOCIAL SECURITY") && upperText.includes("WAGES")) ||
      (upperText.includes("MEDICARE") && upperText.includes("WAGES")) ||
      // Look for SSN pattern followed by wage amounts
      (/\d{3}-\d{2}-\d{4}/.test(text) && /\d+\.\d{2}/.test(text) && text.includes("W")) ||
      // Look for employer/employee address patterns with wage data
      (text.includes("Inc.") && /\d+\.\d{2}/.test(text) && /\d{3}-\d{2}-\d{4}/.test(text))) {
    return "W-2";
  }
  
  // More comprehensive 1099-DIV detection
  if (upperText.includes("FORM 1099-DIV") || 
      upperText.includes("DIVIDENDS AND DISTRIBUTIONS") ||
      upperText.includes("1099-DIV") ||
      upperText.includes("ORDINARY DIVIDENDS") ||
      upperText.includes("QUALIFIED DIVIDENDS") ||
      upperText.includes("TOTAL CAPITAL GAIN")) {
    return "1099-DIV";
  }
  
  // More comprehensive 1099-INT detection
  if (upperText.includes("FORM 1099-INT") || 
      upperText.includes("INTEREST INCOME") ||
      upperText.includes("1099-INT") ||
      upperText.includes("INTEREST") ||
      upperText.includes("EARLY WITHDRAWAL PENALTY")) {
    return "1099-INT";
  }
  
  // More comprehensive 1099-B detection
  if (upperText.includes("FORM 1099-B") || 
      upperText.includes("PROCEEDS FROM BROKER") ||
      upperText.includes("1099-B") ||
      upperText.includes("PROCEEDS") ||
      upperText.includes("COST BASIS") ||
      upperText.includes("GAIN OR LOSS") ||
      upperText.includes("CAPITAL GAIN")) {
    return "1099-B";
  }
  
  // Additional document types
  if (upperText.includes("FORM 1099-MISC") || upperText.includes("1099-MISC")) {
    return "1099-MISC";
  }
  
  if (upperText.includes("FORM 1099-R") || upperText.includes("1099-R")) {
    return "1099-R";
  }
  
  if (upperText.includes("FORM 1098") || upperText.includes("MORTGAGE INTEREST")) {
    return "1098";
  }
  
  return "Unknown";
}

export function parseW2Data(text: string): ParsedW2 {
  const data: ParsedW2 = {};
  
  // Extract employer name - look for company names ending with Inc., LLC, Corp, etc.
  const employerMatch = text.match(/([A-Za-z\s&,.-]+(?:Inc\.|LLC|Corp|Corporation|Company|Co\.))/);
  if (employerMatch) data.employerName = employerMatch[1].trim();
  
  // Extract employer EIN - look for 9-digit number pattern
  const einMatch = text.match(/(\d{9})/);
  if (einMatch) data.employerEin = einMatch[1];
  
  // Extract wages - look for large dollar amounts that could be wages
  const wagesMatch = text.match(/(\d{4,}\.\d{2})/);
  if (wagesMatch) data.wages = wagesMatch[1];
  
  // Extract federal tax withheld - look for dollar amounts after wages
  const federalMatch = text.match(/(\d{4,}\.\d{2})\s+(\d{4,}\.\d{2})/);
  if (federalMatch) {
    data.wages = federalMatch[1];
    data.federalWithheld = federalMatch[2];
  }
  
  // Extract Social Security wages and withheld
  const ssMatch = text.match(/(\d{4,}\.\d{2})\s+(\d{4,}\.\d{2})/g);
  if (ssMatch && ssMatch.length >= 2) {
    // Second occurrence is likely Social Security wages
    const ssWagesMatch = ssMatch[1].match(/(\d{4,}\.\d{2})\s+(\d{4,}\.\d{2})/);
    if (ssWagesMatch) {
      data.socialSecurityWages = ssWagesMatch[1];
      data.socialSecurityWithheld = ssWagesMatch[2];
    }
  }
  
  // Extract Medicare wages and withheld
  const medicareMatch = text.match(/(\d{4,}\.\d{2})\s+(\d{4,}\.\d{2})/g);
  if (medicareMatch && medicareMatch.length >= 3) {
    // Third occurrence is likely Medicare wages
    const medWagesMatch = medicareMatch[2].match(/(\d{4,}\.\d{2})\s+(\d{4,}\.\d{2})/);
    if (medWagesMatch) {
      data.medicareWages = medWagesMatch[1];
      data.medicareWithheld = medWagesMatch[2];
    }
  }
  
  // Fallback: Simple pattern matching for W-2 data
  if (!data.wages) {
    const wagesMatch = text.match(/(?:wages|box 1)[:\s]+\$?([\d,]+\.?\d*)/i);
    if (wagesMatch) data.wages = wagesMatch[1].replace(/,/g, "");
  }
  
  if (!data.federalWithheld) {
    const federalMatch = text.match(/(?:federal.*withheld|box 2)[:\s]+\$?([\d,]+\.?\d*)/i);
    if (federalMatch) data.federalWithheld = federalMatch[1].replace(/,/g, "");
  }
  
  if (!data.socialSecurityWages) {
    const ssWagesMatch = text.match(/(?:social security wages|box 3)[:\s]+\$?([\d,]+\.?\d*)/i);
    if (ssWagesMatch) data.socialSecurityWages = ssWagesMatch[1].replace(/,/g, "");
  }
  
  if (!data.socialSecurityWithheld) {
    const ssWithheldMatch = text.match(/(?:social security.*withheld|box 4)[:\s]+\$?([\d,]+\.?\d*)/i);
    if (ssWithheldMatch) data.socialSecurityWithheld = ssWithheldMatch[1].replace(/,/g, "");
  }
  
  if (!data.medicareWages) {
    const medicareWagesMatch = text.match(/(?:medicare wages|box 5)[:\s]+\$?([\d,]+\.?\d*)/i);
    if (medicareWagesMatch) data.medicareWages = medicareWagesMatch[1].replace(/,/g, "");
  }
  
  if (!data.medicareWithheld) {
    const medicareWithheldMatch = text.match(/(?:medicare.*withheld|box 6)[:\s]+\$?([\d,]+\.?\d*)/i);
    if (medicareWithheldMatch) data.medicareWithheld = medicareWithheldMatch[1].replace(/,/g, "");
  }
  
  return data;
}

export function parse1099DivData(text: string, fileName?: string): Parsed1099Div {
  const data: Parsed1099Div = {};
  
  // Extract basic form information
  const payerNameMatch = text.match(/(?:payer|company|broker)[:\s]+([^\n\r]+)/i);
  if (payerNameMatch) data.payerName = payerNameMatch[1].trim();
  
  const payerTinMatch = text.match(/(?:tin|tax.*id)[:\s]+(\d{2}-\d{7})/i);
  if (payerTinMatch) data.payerTin = payerTinMatch[1];
  
  // If payer info not found in text, try to extract from filename
  if (!data.payerName && fileName) {
    data.payerName = extractPayerNameFromFilename(fileName);
  }
  
  if (!data.payerTin && fileName) {
    data.payerTin = extractTinFromFilename(fileName) || undefined;
  }
  
  const ordinaryMatch = text.match(/(?:ordinary dividends|box 1a)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (ordinaryMatch) data.ordinaryDividends = ordinaryMatch[1].replace(/,/g, "");
  
  const qualifiedMatch = text.match(/(?:qualified dividends|box 1b)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (qualifiedMatch) data.qualifiedDividends = qualifiedMatch[1].replace(/,/g, "");
  
  const capitalGainMatch = text.match(/(?:total capital gain|box 2a)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (capitalGainMatch) data.totalCapitalGain = capitalGainMatch[1].replace(/,/g, "");
  
  return data;
}

export function parse1099IntData(text: string, fileName?: string): Parsed1099Int {
  const data: Parsed1099Int = {};
  
  // Extract basic form information
  const payerNameMatch = text.match(/(?:payer|company|bank|broker)[:\s]+([^\n\r]+)/i);
  if (payerNameMatch) data.payerName = payerNameMatch[1].trim();
  
  const payerTinMatch = text.match(/(?:tin|tax.*id)[:\s]+(\d{2}-\d{7})/i);
  if (payerTinMatch) data.payerTin = payerTinMatch[1];
  
  // If payer info not found in text, try to extract from filename
  if (!data.payerName && fileName) {
    data.payerName = extractPayerNameFromFilename(fileName);
  }
  
  if (!data.payerTin && fileName) {
    data.payerTin = extractTinFromFilename(fileName) || undefined;
  }
  
  const interestMatch = text.match(/(?:interest income|box 1)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (interestMatch) data.interestIncome = interestMatch[1].replace(/,/g, "");
  
  const penaltyMatch = text.match(/(?:early withdrawal penalty|box 2)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (penaltyMatch) data.earlyWithdrawalPenalty = penaltyMatch[1].replace(/,/g, "");
  
  return data;
}

export function parse1099BData(text: string, fileName?: string): Parsed1099B {
  const data: Parsed1099B = {};
  
  // Extract basic form information
  const payerNameMatch = text.match(/(?:payer|broker)[:\s]+([^\n\r]+)/i);
  if (payerNameMatch) data.payerName = payerNameMatch[1].trim();
  
  const payerTinMatch = text.match(/(?:tin|tax.*id)[:\s]+(\d{2}-\d{7})/i);
  if (payerTinMatch) data.payerTin = payerTinMatch[1];
  
  // If payer info not found in text, try to extract from filename
  if (!data.payerName && fileName) {
    data.payerName = extractPayerNameFromFilename(fileName);
  }
  
  if (!data.payerTin && fileName) {
    data.payerTin = extractTinFromFilename(fileName) || undefined;
  }
  
  const proceedsMatch = text.match(/(?:proceeds|box 1d)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (proceedsMatch) data.proceeds = proceedsMatch[1].replace(/,/g, "");
  
  const costBasisMatch = text.match(/(?:cost.*basis|box 1e)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (costBasisMatch) data.costBasis = costBasisMatch[1].replace(/,/g, "");
  
  // Extract dates
  const dateAcquiredMatch = text.match(/(?:date.*acquired|acquired)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateAcquiredMatch) data.dateAcquired = dateAcquiredMatch[1];
  
  const dateSoldMatch = text.match(/(?:date.*sold|sold)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  if (dateSoldMatch) data.dateSold = dateSoldMatch[1];
  
  // Extract description
  const descriptionMatch = text.match(/(?:description|security)[:\s]+([^\n\r]+)/i);
  if (descriptionMatch) data.description = descriptionMatch[1].trim();
  
  // Calculate gains/losses
  if (data.proceeds && data.costBasis) {
    const gainLoss = parseFloat(data.proceeds) - parseFloat(data.costBasis);
    data.shortTermGainLoss = gainLoss.toString();
  }
  
  // Create entries array - for now, create one entry with the parsed data
  // In the future, this could be enhanced to parse multiple transactions
  if (data.proceeds && data.costBasis) {
    const gainLoss = parseFloat(data.proceeds) - parseFloat(data.costBasis);
    const isShortTerm = data.dateAcquired && data.dateSold ? 
      isShortTermTransaction(data.dateAcquired, data.dateSold) : true;
    
    data.entries = [{
      description: data.description || "Stock Transaction",
      dateAcquired: data.dateAcquired,
      dateSold: data.dateSold,
      proceeds: data.proceeds,
      costBasis: data.costBasis,
      gainLoss: gainLoss.toString(),
      isShortTerm,
      reportedToIrs: false, // Default to false, user can check if needed
      washSale: false, // Default to false, user can check if needed
    }];
  }
  
  return data;
}

// Helper function to determine if a transaction is short-term (< 1 year)
function isShortTermTransaction(dateAcquired: string, dateSold: string): boolean {
  try {
    const acquired = new Date(dateAcquired);
    const sold = new Date(dateSold);
    const diffTime = Math.abs(sold.getTime() - acquired.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 365;
  } catch {
    return true; // Default to short-term if dates can't be parsed
  }
}

export function parse1099MiscData(text: string, fileName?: string): Parsed1099Misc {
  const data: Parsed1099Misc = {};
  
  // Extract basic form information
  const payerNameMatch = text.match(/(?:payer|company)[:\s]+([^\n\r]+)/i);
  if (payerNameMatch) data.payerName = payerNameMatch[1].trim();
  
  const payerTinMatch = text.match(/(?:tin|tax.*id)[:\s]+(\d{2}-\d{7})/i);
  if (payerTinMatch) data.payerTin = payerTinMatch[1];
  
  // If payer info not found in text, try to extract from filename
  if (!data.payerName && fileName) {
    data.payerName = extractPayerNameFromFilename(fileName);
  }
  
  if (!data.payerTin && fileName) {
    data.payerTin = extractTinFromFilename(fileName) || undefined;
  }
  
  const rentsMatch = text.match(/(?:rents|box 1)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (rentsMatch) data.rents = rentsMatch[1].replace(/,/g, "");
  
  const royaltiesMatch = text.match(/(?:royalties|box 2)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (royaltiesMatch) data.royalties = royaltiesMatch[1].replace(/,/g, "");
  
  const otherIncomeMatch = text.match(/(?:other income|box 3)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (otherIncomeMatch) data.otherIncome = otherIncomeMatch[1].replace(/,/g, "");
  
  const federalWithheldMatch = text.match(/(?:federal.*withheld|box 4)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (federalWithheldMatch) data.federalWithheld = federalWithheldMatch[1].replace(/,/g, "");
  
  return data;
}

export function parseConsolidatedBrokerageStatement(text: string): ConsolidatedBrokerageStatement {
  const data: ConsolidatedBrokerageStatement = {};
  
  // Extract broker information
  const brokerMatch = text.match(/([A-Za-z\s&,.-]+(?:Inc\.|LLC|Corp|Corporation|Company|Co\.|Brokerage|Securities))/);
  if (brokerMatch) data.brokerName = brokerMatch[1].trim();
  
  // Extract broker TIN
  const tinMatch = text.match(/(\d{2}-\d{7})/);
  if (tinMatch) data.brokerTin = tinMatch[1];
  
  // Extract account number
  const accountMatch = text.match(/(?:account|acct)[:\s#]*(\d+)/i);
  if (accountMatch) data.accountNumber = accountMatch[1];
  
  // Extract tax year
  const yearMatch = text.match(/(?:tax year|year)[:\s]*(\d{4})/i);
  if (yearMatch) data.taxYear = yearMatch[1];
  
  // Check for different sections and parse them
  const upperText = text.toUpperCase();
  
  // Check for DIV section
  if (upperText.includes("DIVIDENDS") || upperText.includes("1099-DIV")) {
    data.hasDivSection = true;
    data.divData = parse1099DivData(text);
  }
  
  // Check for INT section
  if (upperText.includes("INTEREST") || upperText.includes("1099-INT")) {
    data.hasIntSection = true;
    data.intData = parse1099IntData(text);
  }
  
  // Check for MISC section
  if (upperText.includes("MISCELLANEOUS") || upperText.includes("1099-MISC")) {
    data.hasMiscSection = true;
    data.miscData = parse1099MiscData(text);
  }
  
  // Check for B section (broker transactions)
  if (upperText.includes("PROCEEDS") || upperText.includes("1099-B") || upperText.includes("BROKER")) {
    data.hasBSection = true;
    // For consolidated statements, there might be multiple 1099-B entries
    data.bData = [parse1099BData(text)];
  }
  
  return data;
}
