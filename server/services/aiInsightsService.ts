import { llmService } from "./llmService";
import { INSIGHT_TYPE, INSIGHT_CATEGORY, INSIGHT_PRIORITY } from "@shared/schema";
import type { W2Data, Form1099Div, Form1099Int, Form1099B, TaxReturn } from "@shared/schema";

export interface TaxInsight {
  id?: string;
  taxReturnId?: string;
  documentId?: string;
  insightType: string;
  category: string;
  title: string;
  description: string;
  potentialSavings?: number;
  priority: string;
  status: string;
  metadata?: any;
}

export interface ConsolidatedTaxData {
  w2Data: W2Data[];
  divData: Form1099Div[];
  intData: Form1099Int[];
  bData: Form1099B[];
  taxReturn: TaxReturn;
}

export class AIInsightsService {
  /**
   * Generate comprehensive AI insights for a tax return
   */
  async generateInsights(
    taxData: ConsolidatedTaxData,
    userId: string
  ): Promise<TaxInsight[]> {
    const insights: TaxInsight[] = [];

    try {
      // Document-level insights
      const documentInsights = await this.generateDocumentInsights(taxData);
      insights.push(...documentInsights);

      // Consolidated insights
      const consolidatedInsights = await this.generateConsolidatedInsights(taxData, userId);
      insights.push(...consolidatedInsights);

      // Year-ahead planning
      const planningInsights = await this.generateYearAheadInsights(taxData);
      insights.push(...planningInsights);

      // Audit risk assessment
      const riskInsights = await this.generateAuditRiskInsights(taxData);
      insights.push(...riskInsights);

      return insights;
    } catch (error) {
      console.error("[AIInsightsService] Error generating insights:", error);
      return [];
    }
  }

  /**
   * Generate document-level insights
   */
  private async generateDocumentInsights(taxData: ConsolidatedTaxData): Promise<TaxInsight[]> {
    const insights: TaxInsight[] = [];

    // Analyze W-2 forms
    for (const w2 of taxData.w2Data) {
      if (w2.wages && parseFloat(w2.wages) > 200000) {
        insights.push({
          insightType: INSIGHT_TYPE.DOCUMENT,
          category: INSIGHT_CATEGORY.RISK,
          title: "High Income Alert",
          description: `Your W-2 shows wages of $${parseFloat(w2.wages).toLocaleString()}. Consider additional tax planning strategies for high earners.`,
          priority: INSIGHT_PRIORITY.MEDIUM,
          status: "pending",
          metadata: { documentType: "W-2", field: "wages", value: w2.wages },
        });
      }

      if (!w2.employerEin || w2.employerEin.length < 9) {
        insights.push({
          insightType: INSIGHT_TYPE.DOCUMENT,
          category: INSIGHT_CATEGORY.RISK,
          title: "Missing Employer EIN",
          description: "The employer EIN is missing or incomplete. This may cause issues with IRS processing.",
          priority: INSIGHT_PRIORITY.HIGH,
          status: "pending",
          metadata: { documentType: "W-2", field: "employerEin" },
        });
      }
    }

    // Analyze 1099-B forms
    for (const b1099 of taxData.bData) {
      if (b1099.costBasis && parseFloat(b1099.costBasis) === 0) {
        insights.push({
          insightType: INSIGHT_TYPE.DOCUMENT,
          category: INSIGHT_CATEGORY.OPTIMIZATION,
          title: "Zero Cost Basis Detected",
          description: `Transaction ${b1099.description || "N/A"} shows zero cost basis. This may indicate RSU or stock options that need adjustment.`,
          priority: INSIGHT_PRIORITY.HIGH,
          status: "pending",
          metadata: { documentType: "1099-B", field: "costBasis", value: b1099.costBasis },
        });
      }

      if (b1099.dateAcquired && b1099.dateSold) {
        const acquired = new Date(b1099.dateAcquired);
        const sold = new Date(b1099.dateSold);
        const daysHeld = (sold.getTime() - acquired.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysHeld <= 30) {
          insights.push({
            insightType: INSIGHT_TYPE.DOCUMENT,
            category: INSIGHT_CATEGORY.RISK,
            title: "Potential Wash Sale",
            description: `Transaction held for only ${Math.round(daysHeld)} days. Check for wash sale rules if you repurchased similar securities within 30 days.`,
            priority: INSIGHT_PRIORITY.MEDIUM,
            status: "pending",
            metadata: { documentType: "1099-B", daysHeld },
          });
        }
      }
    }

    return insights;
  }

  /**
   * Generate consolidated insights using LLM
   */
  private async generateConsolidatedInsights(
    taxData: ConsolidatedTaxData,
    userId: string
  ): Promise<TaxInsight[]> {
    if (!llmService.isAvailable()) {
      return this.generateBasicConsolidatedInsights(taxData);
    }

    try {
      const consolidatedData = {
        totalWages: taxData.w2Data.reduce((sum, w2) => sum + parseFloat(w2.wages || "0"), 0),
        totalDividends: taxData.divData.reduce((sum, div) => sum + parseFloat(div.ordinaryDividends || "0"), 0),
        totalInterest: taxData.intData.reduce((sum, int) => sum + parseFloat(int.interestIncome || "0"), 0),
        totalCapitalGains: taxData.bData.reduce((sum, b) => {
          const shortTerm = parseFloat(b.shortTermGainLoss || "0");
          const longTerm = parseFloat(b.longTermGainLoss || "0");
          return sum + shortTerm + longTerm;
        }, 0),
        filingStatus: taxData.taxReturn.filingStatus,
        taxYear: taxData.taxReturn.taxYear,
      };

      const llmResponse = await llmService.generateTaxInsights(consolidatedData, userId);
      
      if (!llmResponse.success) {
        return this.generateBasicConsolidatedInsights(taxData);
      }

      return llmResponse.insights.map(insight => ({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: insight.type,
        title: insight.title,
        description: insight.description,
        potentialSavings: insight.potentialSavings,
        priority: insight.priority,
        status: "pending",
        metadata: { llmGenerated: true, tokensUsed: llmResponse.tokensUsed },
      }));
    } catch (error) {
      console.error("[AIInsightsService] Error generating LLM insights:", error);
      return this.generateBasicConsolidatedInsights(taxData);
    }
  }

  /**
   * Generate basic consolidated insights without LLM
   */
  private generateBasicConsolidatedInsights(taxData: ConsolidatedTaxData): TaxInsight[] {
    const insights: TaxInsight[] = [];
    
    const totalIncome = taxData.w2Data.reduce((sum, w2) => sum + parseFloat(w2.wages || "0"), 0) +
                       taxData.divData.reduce((sum, div) => sum + parseFloat(div.ordinaryDividends || "0"), 0) +
                       taxData.intData.reduce((sum, int) => sum + parseFloat(int.interestIncome || "0"), 0);

    // Standard deduction optimization
    if (totalIncome > 50000) {
      insights.push({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: INSIGHT_CATEGORY.DEDUCTION,
        title: "Consider Itemized Deductions",
        description: "With your income level, you may benefit from itemizing deductions instead of taking the standard deduction. Consider mortgage interest, property taxes, and charitable contributions.",
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
      });
    }

    // Capital loss harvesting
    const totalCapitalLosses = taxData.bData.reduce((sum, b) => {
      const shortTerm = parseFloat(b.shortTermGainLoss || "0");
      const longTerm = parseFloat(b.longTermGainLoss || "0");
      return sum + (shortTerm < 0 ? shortTerm : 0) + (longTerm < 0 ? longTerm : 0);
    }, 0);

    if (totalCapitalLosses < -3000) {
      insights.push({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: INSIGHT_CATEGORY.OPTIMIZATION,
        title: "Capital Loss Carryforward",
        description: `You have capital losses of $${Math.abs(totalCapitalLosses).toLocaleString()}. You can deduct up to $3,000 against ordinary income and carry forward the remaining losses to future years.`,
        potentialSavings: Math.min(Math.abs(totalCapitalLosses), 3000) * 0.22, // Approximate tax savings
        priority: INSIGHT_PRIORITY.HIGH,
        status: "pending",
      });
    }

    return insights;
  }

  /**
   * Generate year-ahead planning insights
   */
  private async generateYearAheadInsights(taxData: ConsolidatedTaxData): Promise<TaxInsight[]> {
    const insights: TaxInsight[] = [];
    const currentYear = taxData.taxReturn.taxYear;
    const nextYear = currentYear + 1;

    const totalWages = taxData.w2Data.reduce((sum, w2) => sum + parseFloat(w2.wages || "0"), 0);

    // Retirement contribution optimization
    if (totalWages > 50000) {
      insights.push({
        insightType: INSIGHT_TYPE.YEAR_AHEAD,
        category: INSIGHT_CATEGORY.PLANNING,
        title: "Maximize 401(k) Contributions",
        description: `For ${nextYear}, consider maximizing your 401(k) contributions (up to $23,000 for under 50, $30,500 for 50+). This can reduce your taxable income significantly.`,
        potentialSavings: Math.min(totalWages * 0.15, 23000) * 0.22, // Approximate savings
        priority: INSIGHT_PRIORITY.HIGH,
        status: "pending",
      });
    }

    // HSA contribution planning
    insights.push({
      insightType: INSIGHT_TYPE.YEAR_AHEAD,
      category: INSIGHT_CATEGORY.PLANNING,
      title: "Health Savings Account (HSA)",
      description: `For ${nextYear}, consider contributing to an HSA if you have a high-deductible health plan. Contributions are tax-deductible and withdrawals for medical expenses are tax-free.`,
      potentialSavings: 4150 * 0.22, // Approximate savings for single coverage
      priority: INSIGHT_PRIORITY.MEDIUM,
      status: "pending",
    });

    // Estimated tax payments
    const estimatedTax = parseFloat(taxData.taxReturn.totalTax || "0");
    if (estimatedTax > 1000) {
      insights.push({
        insightType: INSIGHT_TYPE.YEAR_AHEAD,
        category: INSIGHT_CATEGORY.PLANNING,
        title: "Consider Estimated Tax Payments",
        description: `Based on your ${currentYear} tax liability of $${estimatedTax.toLocaleString()}, consider making quarterly estimated tax payments for ${nextYear} to avoid penalties.`,
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
      });
    }

    return insights;
  }

  /**
   * Generate audit risk assessment insights
   */
  private generateAuditRiskInsights(taxData: ConsolidatedTaxData): TaxInsight[] {
    const insights: TaxInsight[] = [];
    
    const totalIncome = taxData.w2Data.reduce((sum, w2) => sum + parseFloat(w2.wages || "0"), 0) +
                       taxData.divData.reduce((sum, div) => sum + parseFloat(div.ordinaryDividends || "0"), 0) +
                       taxData.intData.reduce((sum, int) => sum + parseFloat(int.interestIncome || "0"), 0);

    // High income risk
    if (totalIncome > 200000) {
      insights.push({
        insightType: INSIGHT_TYPE.AUDIT_RISK,
        category: INSIGHT_CATEGORY.RISK,
        title: "Higher Audit Risk",
        description: "Taxpayers with income over $200,000 have a higher audit risk. Ensure all deductions are properly documented and supported.",
        priority: INSIGHT_PRIORITY.HIGH,
        status: "pending",
      });
    }

    // Large charitable deductions
    const totalCapitalGains = taxData.bData.reduce((sum, b) => {
      const shortTerm = parseFloat(b.shortTermGainLoss || "0");
      const longTerm = parseFloat(b.longTermGainLoss || "0");
      return sum + shortTerm + longTerm;
    }, 0);

    if (totalCapitalGains > 50000) {
      insights.push({
        insightType: INSIGHT_TYPE.AUDIT_RISK,
        category: INSIGHT_CATEGORY.RISK,
        title: "Large Capital Gains",
        description: "Large capital gains may attract IRS attention. Ensure all transactions are properly reported and cost basis is accurately calculated.",
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
      });
    }

    // Multiple 1099 forms
    const total1099Forms = taxData.divData.length + taxData.intData.length + taxData.bData.length;
    if (total1099Forms > 10) {
      insights.push({
        insightType: INSIGHT_TYPE.AUDIT_RISK,
        category: INSIGHT_CATEGORY.RISK,
        title: "Multiple Investment Forms",
        description: `You have ${total1099Forms} investment forms. Ensure all are properly reported and consider consolidating accounts to simplify future filings.`,
        priority: INSIGHT_PRIORITY.LOW,
        status: "pending",
      });
    }

    return insights;
  }

  /**
   * Analyze expense patterns for deduction opportunities
   */
  analyzeExpensePatterns(expenseData: any[]): TaxInsight[] {
    const insights: TaxInsight[] = [];

    // This would analyze expense patterns if we had expense data
    // For now, provide general guidance
    insights.push({
      insightType: INSIGHT_TYPE.CONSOLIDATED,
      category: INSIGHT_CATEGORY.DEDUCTION,
      title: "Track Business Expenses",
      description: "If you have business expenses, home office use, or unreimbursed employee expenses, consider tracking them for potential deductions.",
      priority: INSIGHT_PRIORITY.MEDIUM,
      status: "pending",
    });

    return insights;
  }

  /**
   * Detect wash sale violations
   */
  detectWashSales(b1099Data: Form1099B[]): TaxInsight[] {
    const insights: TaxInsight[] = [];
    const transactions: Array<{ date: Date; symbol: string; type: 'buy' | 'sell'; amount: number }> = [];

    // Parse transactions (simplified - would need more sophisticated parsing)
    for (const b1099 of b1099Data) {
      if (b1099.dateAcquired && b1099.dateSold) {
        transactions.push({
          date: new Date(b1099.dateAcquired),
          symbol: b1099.description || "UNKNOWN",
          type: 'buy',
          amount: parseFloat(b1099.costBasis || "0"),
        });
        transactions.push({
          date: new Date(b1099.dateSold),
          symbol: b1099.description || "UNKNOWN",
          type: 'sell',
          amount: parseFloat(b1099.proceeds || "0"),
        });
      }
    }

    // Check for wash sales (simplified logic)
    for (let i = 0; i < transactions.length; i++) {
      const sell = transactions[i];
      if (sell.type === 'sell') {
        for (let j = i + 1; j < transactions.length; j++) {
          const buy = transactions[j];
          if (buy.type === 'buy' && 
              buy.symbol === sell.symbol && 
              (buy.date.getTime() - sell.date.getTime()) <= 30 * 24 * 60 * 60 * 1000) {
            insights.push({
              insightType: INSIGHT_TYPE.DOCUMENT,
              category: INSIGHT_CATEGORY.RISK,
              title: "Potential Wash Sale Detected",
              description: `Possible wash sale for ${sell.symbol} - sold on ${sell.date.toLocaleDateString()} and repurchased within 30 days.`,
              priority: INSIGHT_PRIORITY.HIGH,
              status: "pending",
              metadata: { symbol: sell.symbol, sellDate: sell.date, buyDate: buy.date },
            });
          }
        }
      }
    }

    return insights;
  }
}

// Export singleton instance
export const aiInsightsService = new AIInsightsService();
