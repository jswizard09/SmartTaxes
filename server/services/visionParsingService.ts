import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

export interface VisionParseResult {
  success: boolean;
  documentType: string;
  data: Record<string, any>;
  rawText: string;
  confidenceScore: number;
  tokensUsed: number;
  errorMessage?: string;
}

const SYSTEM_PROMPT = `You are a tax document parser. Extract all fields from this tax document into a JSON object. Return ONLY valid JSON with no other text. Use these field names for W-2: employerName, employerEin, wages, federalWithheld, socialSecurityWages, socialSecurityWithheld, medicareWages, medicareWithheld, stateWages, stateWithheld. For 1099-DIV: payerName, payerTin, ordinaryDividends, qualifiedDividends, totalCapitalGain, foreignTaxPaid. For 1099-INT: payerName, payerTin, interestIncome, earlyWithdrawalPenalty, usBondInterest, federalWithheld. For 1099-B: payerName, description, dateAcquired, dateSold, proceeds, costBasis, shortTermGainLoss, longTermGainLoss. For 1099-MISC: payerName, payerTin, rents, royalties, otherIncome, federalWithheld. For 1098: lenderName, lenderTin, mortgageInterest, outstandingPrincipal, propertyAddress. For Schedule K-1: partnershipName, ein, partnerShare, ordinaryBusinessIncome, rentalRealEstateIncome, interestIncome, ordinaryDividends, capitalGains. For 1099-R: payerName, payerTin, grossDistribution, taxableAmount, federalWithheld, distributionCode. First line of your response must be the document type (e.g., 'W-2'), then a newline, then the JSON.`;

// Expected fields per document type for confidence scoring
const EXPECTED_FIELDS: Record<string, string[]> = {
  "W-2": ["employerName", "employerEin", "wages", "federalWithheld", "socialSecurityWages", "socialSecurityWithheld", "medicareWages", "medicareWithheld"],
  "1099-DIV": ["payerName", "payerTin", "ordinaryDividends", "qualifiedDividends", "totalCapitalGain", "foreignTaxPaid"],
  "1099-INT": ["payerName", "payerTin", "interestIncome", "earlyWithdrawalPenalty", "usBondInterest", "federalWithheld"],
  "1099-B": ["payerName", "description", "dateAcquired", "dateSold", "proceeds", "costBasis"],
  "1099-MISC": ["payerName", "payerTin", "rents", "royalties", "otherIncome"],
  "1098": ["lenderName", "lenderTin", "mortgageInterest", "outstandingPrincipal"],
  "Schedule K-1": ["partnershipName", "ein", "partnerShare", "ordinaryBusinessIncome"],
  "1099-R": ["payerName", "payerTin", "grossDistribution", "taxableAmount", "federalWithheld"],
};

// Claude vision supports jpeg, png, gif, webp only — tiff must be pre-converted
const CLAUDE_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ClaudeImageMimeType = typeof CLAUDE_IMAGE_MIME_TYPES[number];

function isClaudeImageType(mimeType: string): mimeType is ClaudeImageMimeType {
  return (CLAUDE_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

export class VisionParsingService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("[VisionParsingService] No ANTHROPIC_API_KEY found. Vision parsing will be disabled.");
    }
  }

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async parseDocumentFromFile(filePath: string, mimeType: string): Promise<VisionParseResult> {
    if (!this.isAvailable()) {
      return {
        success: false,
        documentType: "unknown",
        data: {},
        rawText: "",
        confidenceScore: 0,
        tokensUsed: 0,
        errorMessage: "VisionParsingService not configured — no API key",
      };
    }

    try {
      let responseText: string;
      let tokensUsed = 0;

      if (mimeType === "application/pdf") {
        // For PDFs, extract text first then pass as text to Claude
        const { default: pdfParse } = await import("pdf-parse") as any;
        const fileBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(fileBuffer);
        const extractedText = pdfData.text;

        const response = await this.client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `Parse this tax document text:\n\n${extractedText}`,
            },
          ],
        });

        tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
        const textBlock = response.content.find((b) => b.type === "text");
        responseText = textBlock && textBlock.type === "text" ? textBlock.text : "";
      } else if (isClaudeImageType(mimeType)) {
        // For images, pass directly as vision input
        const imageData = fs.readFileSync(filePath).toString("base64");

        const response = await this.client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType,
                    data: imageData,
                  },
                },
                {
                  type: "text",
                  text: "Parse this tax document and extract all fields.",
                },
              ],
            },
          ],
        });

        tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
        const textBlock = response.content.find((b) => b.type === "text");
        responseText = textBlock && textBlock.type === "text" ? textBlock.text : "";
      } else {
        return {
          success: false,
          documentType: "unknown",
          data: {},
          rawText: "",
          confidenceScore: 0,
          tokensUsed: 0,
          errorMessage: `Unsupported MIME type: ${mimeType}`,
        };
      }

      return this.parseResponse(responseText, tokensUsed);
    } catch (error: any) {
      console.error("[VisionParsingService] Error parsing document:", error);
      return {
        success: false,
        documentType: "unknown",
        data: {},
        rawText: "",
        confidenceScore: 0,
        tokensUsed: 0,
        errorMessage: error.message,
      };
    }
  }

  async detectDocumentType(filePath: string): Promise<string> {
    if (!this.isAvailable()) {
      return "unknown";
    }

    try {
      const mimeType = this.inferMimeType(filePath);
      let content: Anthropic.MessageParam["content"];

      if (mimeType === "application/pdf") {
        const { default: pdfParse } = await import("pdf-parse") as any;
        const fileBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(fileBuffer);
        content = `What type of tax document is this? Reply with just the form type (e.g. W-2, 1099-DIV, 1099-INT, 1099-B, 1099-MISC, 1098, Schedule K-1, 1099-R). Document text:\n\n${pdfData.text.slice(0, 2000)}`;
      } else if (isClaudeImageType(mimeType)) {
        const imageData = fs.readFileSync(filePath).toString("base64");
        content = [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: mimeType,
              data: imageData,
            },
          },
          {
            type: "text" as const,
            text: "What type of tax document is this? Reply with just the form type (e.g. W-2, 1099-DIV, 1099-INT, 1099-B, 1099-MISC, 1098, Schedule K-1, 1099-R).",
          },
        ];
      } else {
        return "unknown";
      }

      const response = await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 64,
        messages: [{ role: "user", content }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock && textBlock.type === "text" ? textBlock.text.trim() : "unknown";
    } catch (error: any) {
      console.error("[VisionParsingService] Error detecting document type:", error);
      return "unknown";
    }
  }

  private inferMimeType(filePath: string): string {
    const ext = filePath.toLowerCase().split(".").pop();
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      tiff: "image/tiff",
      tif: "image/tiff",
      webp: "image/webp",
    };
    return mimeMap[ext ?? ""] ?? "application/octet-stream";
  }

  private parseResponse(responseText: string, tokensUsed: number): VisionParseResult {
    try {
      const lines = responseText.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("Response format invalid — expected document type on first line");
      }

      const documentType = lines[0].trim();
      const jsonText = lines.slice(1).join("\n").trim();

      // Strip any markdown code fences if present
      const cleanJson = jsonText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      const data = JSON.parse(cleanJson);
      const confidenceScore = this.calculateConfidence(documentType, data);

      return {
        success: true,
        documentType,
        data,
        rawText: responseText,
        confidenceScore,
        tokensUsed,
      };
    } catch (error: any) {
      console.error("[VisionParsingService] Error parsing Claude response:", error);
      return {
        success: false,
        documentType: "unknown",
        data: {},
        rawText: responseText,
        confidenceScore: 0,
        tokensUsed,
        errorMessage: `Failed to parse response: ${error.message}`,
      };
    }
  }

  private calculateConfidence(documentType: string, data: Record<string, any>): number {
    const expectedFields = EXPECTED_FIELDS[documentType];
    if (!expectedFields || expectedFields.length === 0) {
      return 0.5; // Unknown document type — neutral confidence
    }

    const foundFields = expectedFields.filter(
      (field) => data[field] !== null && data[field] !== undefined && data[field] !== ""
    );

    return foundFields.length / expectedFields.length;
  }
}

export const visionParsingService = new VisionParsingService();
