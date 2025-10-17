import type { ParsedW2, Parsed1099Div, Parsed1099Int, Parsed1099B } from "../utils/parsers";

export interface LLMResponse {
  success: boolean;
  data: ParsedW2 | Parsed1099Div | Parsed1099Int | Parsed1099B | null;
  confidenceScore: number;
  tokensUsed: number;
  costUsd: number;
  errorMessage?: string;
}

export interface LLMOptions {
  model: "gpt-4" | "gpt-3.5-turbo" | "claude-3-sonnet";
  maxTokens: number;
  temperature: number;
}

export class LLMService {
  private apiKey: string;
  private baseUrl: string;
  private defaultOptions: LLMOptions = {
    model: "gpt-4",
    maxTokens: 2000,
    temperature: 0.1,
  };

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.baseUrl = "https://api.openai.com/v1";
    
    if (!this.apiKey) {
      console.warn("[LLMService] No OpenAI API key found. LLM features will be disabled.");
    }
  }

  /**
   * Parse tax document using LLM
   */
  async parseDocument(
    text: string,
    documentType: string,
    userId: string
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        data: null,
        confidenceScore: 0,
        tokensUsed: 0,
        costUsd: 0,
        errorMessage: "LLM service not configured - no API key",
      };
    }

    try {
      const prompt = this.buildPrompt(text, documentType);
      const response = await this.callOpenAI(prompt);
      
      if (!response.success) {
        return response;
      }

      // Parse the JSON response
      const parsedData = this.parseLLMResponse(response.data as string, documentType);
      
      return {
        success: true,
        data: parsedData.data,
        confidenceScore: parsedData.confidenceScore,
        tokensUsed: response.tokensUsed,
        costUsd: response.costUsd,
      };
    } catch (error: any) {
      console.error("[LLMService] Error parsing document:", error);
      return {
        success: false,
        data: null,
        confidenceScore: 0,
        tokensUsed: 0,
        costUsd: 0,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Build structured prompt for tax document parsing
   */
  private buildPrompt(text: string, documentType: string): string {
    const basePrompt = `You are a tax document parsing expert. Extract the following fields from the provided ${documentType} document text and return them as a JSON object.

Document Type: ${documentType}
Document Text:
${text}

Please extract the following fields and return ONLY a valid JSON object with no additional text:`;

    switch (documentType) {
      case "W-2":
        return `${basePrompt}
{
  "employerName": "string or null",
  "employerEin": "string or null (format: XX-XXXXXXX)",
  "wages": "string or null (dollar amount)",
  "federalWithheld": "string or null (dollar amount)",
  "socialSecurityWages": "string or null (dollar amount)",
  "socialSecurityWithheld": "string or null (dollar amount)",
  "medicareWages": "string or null (dollar amount)",
  "medicareWithheld": "string or null (dollar amount)"
}

Also include a "confidence" field (0.0 to 1.0) indicating how confident you are in the extraction.`;

      case "1099-DIV":
        return `${basePrompt}
{
  "payerName": "string or null",
  "payerTin": "string or null (format: XX-XXXXXXX)",
  "ordinaryDividends": "string or null (dollar amount)",
  "qualifiedDividends": "string or null (dollar amount)",
  "totalCapitalGain": "string or null (dollar amount)",
  "foreignTaxPaid": "string or null (dollar amount)"
}

Also include a "confidence" field (0.0 to 1.0) indicating how confident you are in the extraction.`;

      case "1099-INT":
        return `${basePrompt}
{
  "payerName": "string or null",
  "payerTin": "string or null (format: XX-XXXXXXX)",
  "interestIncome": "string or null (dollar amount)",
  "earlyWithdrawalPenalty": "string or null (dollar amount)",
  "usBondInterest": "string or null (dollar amount)",
  "federalWithheld": "string or null (dollar amount)"
}

Also include a "confidence" field (0.0 to 1.0) indicating how confident you are in the extraction.`;

      case "1099-B":
        return `${basePrompt}
{
  "payerName": "string or null",
  "payerTin": "string or null (format: XX-XXXXXXX)",
  "description": "string or null",
  "dateAcquired": "string or null (format: YYYY-MM-DD)",
  "dateSold": "string or null (format: YYYY-MM-DD)",
  "proceeds": "string or null (dollar amount)",
  "costBasis": "string or null (dollar amount)",
  "shortTermGainLoss": "string or null (dollar amount)",
  "longTermGainLoss": "string or null (dollar amount)"
}

Also include a "confidence" field (0.0 to 1.0) indicating how confident you are in the extraction.`;

      default:
        throw new Error(`Unsupported document type: ${documentType}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.defaultOptions.model,
          messages: [
            {
              role: "system",
              content: "You are a tax document parsing expert. Extract structured data from tax documents and return only valid JSON.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: this.defaultOptions.maxTokens,
          temperature: this.defaultOptions.temperature,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error("No content returned from OpenAI API");
      }

      // Calculate cost (approximate)
      const tokensUsed = data.usage?.total_tokens || 0;
      const costUsd = this.calculateCost(tokensUsed, this.defaultOptions.model);

      return {
        success: true,
        data: content,
        confidenceScore: 0,
        tokensUsed,
        costUsd,
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        confidenceScore: 0,
        tokensUsed: 0,
        costUsd: 0,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Parse LLM response into structured data
   */
  private parseLLMResponse(response: string, documentType: string): {
    data: ParsedW2 | Parsed1099Div | Parsed1099Int | Parsed1099B | null;
    confidenceScore: number;
  } {
    try {
      // Clean the response - remove any markdown formatting
      const cleanResponse = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const parsed = JSON.parse(cleanResponse);
      const confidenceScore = parsed.confidence || 0.5;
      
      // Remove confidence from the data object
      delete parsed.confidence;

      return {
        data: parsed as any,
        confidenceScore: Math.min(Math.max(confidenceScore, 0), 1),
      };
    } catch (error) {
      console.error("[LLMService] Error parsing LLM response:", error);
      return {
        data: null,
        confidenceScore: 0,
      };
    }
  }

  /**
   * Calculate approximate cost based on tokens used
   */
  private calculateCost(tokens: number, model: string): number {
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4": { input: 0.03 / 1000, output: 0.06 / 1000 },
      "gpt-3.5-turbo": { input: 0.001 / 1000, output: 0.002 / 1000 },
    };

    const modelPricing = pricing[model] || pricing["gpt-3.5-turbo"];
    
    // Assume 70% input tokens, 30% output tokens
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;
    
    return (inputTokens * modelPricing.input) + (outputTokens * modelPricing.output);
  }

  /**
   * Generate AI insights for tax optimization
   */
  async generateTaxInsights(
    taxData: any,
    userId: string
  ): Promise<{
    success: boolean;
    insights: Array<{
      type: string;
      category: string;
      title: string;
      description: string;
      potentialSavings?: number;
      priority: string;
    }>;
    tokensUsed: number;
    costUsd: number;
  }> {
    if (!this.apiKey) {
      return {
        success: false,
        insights: [],
        tokensUsed: 0,
        costUsd: 0,
      };
    }

    try {
      const prompt = `You are a tax optimization expert. Analyze the following tax data and provide actionable insights for tax savings and optimization.

Tax Data:
${JSON.stringify(taxData, null, 2)}

Provide insights in the following JSON format:
{
  "insights": [
    {
      "type": "deduction|optimization|planning|risk",
      "category": "specific category",
      "title": "Brief title",
      "description": "Detailed description with actionable advice",
      "potentialSavings": number (optional, estimated savings in dollars),
      "priority": "high|medium|low"
    }
  ]
}

Focus on:
1. Missing deductions or credits
2. Tax optimization strategies
3. Year-ahead planning recommendations
4. Potential audit risks
5. Capital loss harvesting opportunities
6. Retirement contribution optimization

Return only valid JSON with no additional text.`;

      const response = await this.callOpenAI(prompt);
      
      if (!response.success) {
        return {
          success: false,
          insights: [],
          tokensUsed: 0,
          costUsd: 0,
        };
      }

      const parsed = JSON.parse(response.data as string);
      
      return {
        success: true,
        insights: parsed.insights || [],
        tokensUsed: response.tokensUsed,
        costUsd: response.costUsd,
      };
    } catch (error: any) {
      console.error("[LLMService] Error generating insights:", error);
      return {
        success: false,
        insights: [],
        tokensUsed: 0,
        costUsd: 0,
      };
    }
  }

  /**
   * Check if LLM service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const llmService = new LLMService();
