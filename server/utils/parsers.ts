import * as XLSX from "xlsx";
import { createReadStream, readFileSync } from "fs";
import csvParser from "csv-parser";
import { createWorker } from "tesseract.js";

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
}

export async function parsePDF(filePath: string): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const dataBuffer = readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

export async function parseImageWithOCR(filePath: string): Promise<string> {
  const worker = await createWorker("eng");
  try {
    const { data: { text } } = await worker.recognize(filePath);
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
  
  if (upperText.includes("FORM W-2") || upperText.includes("WAGE AND TAX STATEMENT")) {
    return "W-2";
  }
  if (upperText.includes("FORM 1099-DIV") || upperText.includes("DIVIDENDS AND DISTRIBUTIONS")) {
    return "1099-DIV";
  }
  if (upperText.includes("FORM 1099-INT") || upperText.includes("INTEREST INCOME")) {
    return "1099-INT";
  }
  if (upperText.includes("FORM 1099-B") || upperText.includes("PROCEEDS FROM BROKER")) {
    return "1099-B";
  }
  
  return "Unknown";
}

export function parseW2Data(text: string): ParsedW2 {
  const data: ParsedW2 = {};
  
  // Simple pattern matching for W-2 data
  const wagesMatch = text.match(/(?:wages|box 1)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (wagesMatch) data.wages = wagesMatch[1].replace(/,/g, "");
  
  const federalMatch = text.match(/(?:federal.*withheld|box 2)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (federalMatch) data.federalWithheld = federalMatch[1].replace(/,/g, "");
  
  const ssWagesMatch = text.match(/(?:social security wages|box 3)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (ssWagesMatch) data.socialSecurityWages = ssWagesMatch[1].replace(/,/g, "");
  
  const ssWithheldMatch = text.match(/(?:social security.*withheld|box 4)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (ssWithheldMatch) data.socialSecurityWithheld = ssWithheldMatch[1].replace(/,/g, "");
  
  const medicareWagesMatch = text.match(/(?:medicare wages|box 5)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (medicareWagesMatch) data.medicareWages = medicareWagesMatch[1].replace(/,/g, "");
  
  const medicareWithheldMatch = text.match(/(?:medicare.*withheld|box 6)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (medicareWithheldMatch) data.medicareWithheld = medicareWithheldMatch[1].replace(/,/g, "");
  
  return data;
}

export function parse1099DivData(text: string): Parsed1099Div {
  const data: Parsed1099Div = {};
  
  const ordinaryMatch = text.match(/(?:ordinary dividends|box 1a)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (ordinaryMatch) data.ordinaryDividends = ordinaryMatch[1].replace(/,/g, "");
  
  const qualifiedMatch = text.match(/(?:qualified dividends|box 1b)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (qualifiedMatch) data.qualifiedDividends = qualifiedMatch[1].replace(/,/g, "");
  
  const capitalGainMatch = text.match(/(?:total capital gain|box 2a)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (capitalGainMatch) data.totalCapitalGain = capitalGainMatch[1].replace(/,/g, "");
  
  return data;
}

export function parse1099IntData(text: string): Parsed1099Int {
  const data: Parsed1099Int = {};
  
  const interestMatch = text.match(/(?:interest income|box 1)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (interestMatch) data.interestIncome = interestMatch[1].replace(/,/g, "");
  
  const penaltyMatch = text.match(/(?:early withdrawal penalty|box 2)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (penaltyMatch) data.earlyWithdrawalPenalty = penaltyMatch[1].replace(/,/g, "");
  
  return data;
}

export function parse1099BData(text: string): Parsed1099B {
  const data: Parsed1099B = {};
  
  const proceedsMatch = text.match(/(?:proceeds|box 1d)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (proceedsMatch) data.proceeds = proceedsMatch[1].replace(/,/g, "");
  
  const costBasisMatch = text.match(/(?:cost.*basis|box 1e)[:\s]+\$?([\d,]+\.?\d*)/i);
  if (costBasisMatch) data.costBasis = costBasisMatch[1].replace(/,/g, "");
  
  // Calculate gains/losses
  if (data.proceeds && data.costBasis) {
    const gainLoss = parseFloat(data.proceeds) - parseFloat(data.costBasis);
    data.shortTermGainLoss = gainLoss.toString();
  }
  
  return data;
}
