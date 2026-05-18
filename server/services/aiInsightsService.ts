import Anthropic from "@anthropic-ai/sdk";
import { INSIGHT_TYPE, INSIGHT_CATEGORY, INSIGHT_PRIORITY } from "@shared/schema";
import type { W2Data, Form1099Div, Form1099Int, Form1099B, Form1099BEntry, TaxReturn, ScheduleA, ScheduleC } from "@shared/schema";

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
  bEntries?: Form1099BEntry[];
  taxReturn: TaxReturn;
  scheduleA?: ScheduleA | null;
  scheduleC?: ScheduleC[];
  profile?: any;
}

export class AIInsightsService {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generateInsights(taxData: ConsolidatedTaxData, userId: string): Promise<TaxInsight[]> {
    const insights: TaxInsight[] = [];
    try {
      insights.push(...this.documentLevelInsights(taxData));
      insights.push(...this.deductionDiscoveryInsights(taxData));
      insights.push(...this.capitalGainsOptimizationInsights(taxData));
      insights.push(...this.yearAheadInsights(taxData));
      insights.push(...this.auditRiskInsights(taxData));

      // Augment with LLM-generated insights when available
      if (this.client) {
        const llmInsights = await this.generateLLMInsights(taxData);
        insights.push(...llmInsights);
      }
    } catch (error) {
      console.error("[AIInsightsService] Error generating insights:", error);
    }
    return insights;
  }

  // ─── Document-level validation insights ─────────────────────────────────────

  private documentLevelInsights(taxData: ConsolidatedTaxData): TaxInsight[] {
    const insights: TaxInsight[] = [];

    for (const w2 of taxData.w2Data) {
      if (!w2.employerEin || w2.employerEin.replace(/\D/g, "").length < 9) {
        insights.push({
          insightType: INSIGHT_TYPE.DOCUMENT,
          category: INSIGHT_CATEGORY.RISK,
          title: "Missing Employer EIN",
          description: `${w2.employerName || "An employer"} is missing a valid EIN. The IRS may reject your return without this. Contact your employer for a corrected W-2.`,
          priority: INSIGHT_PRIORITY.HIGH,
          status: "pending",
          metadata: { documentType: "W-2", employerName: w2.employerName },
        });
      }

      if (w2.wages && parseFloat(w2.wages) > 160200) {
        const ssWages = parseFloat(w2.socialSecurityWages || w2.wages || "0");
        const expectedSSWithheld = Math.min(ssWages, 160200) * 0.062;
        const actualSSWithheld = parseFloat(w2.socialSecurityWithheld || "0");
        if (Math.abs(actualSSWithheld - expectedSSWithheld) > 100) {
          insights.push({
            insightType: INSIGHT_TYPE.DOCUMENT,
            category: INSIGHT_CATEGORY.RISK,
            title: "Social Security Withholding May Be Incorrect",
            description: `Expected Social Security withholding is approximately $${expectedSSWithheld.toFixed(0)}, but W-2 shows $${actualSSWithheld.toFixed(0)}. Verify with your employer.`,
            priority: INSIGHT_PRIORITY.HIGH,
            status: "pending",
            metadata: { documentType: "W-2", expected: expectedSSWithheld, actual: actualSSWithheld },
          });
        }
      }
    }

    for (const b of taxData.bData) {
      if (b.costBasis !== null && parseFloat(b.costBasis ?? "0") === 0 && b.proceeds && parseFloat(b.proceeds) > 0) {
        insights.push({
          insightType: INSIGHT_TYPE.DOCUMENT,
          category: INSIGHT_CATEGORY.OPTIMIZATION,
          title: "Zero Cost Basis Needs Review",
          description: `"${b.description || "A transaction"}" shows zero cost basis with $${parseFloat(b.proceeds).toLocaleString()} in proceeds. This often happens with RSUs or stock options. Correcting the basis could reduce your taxable gain.`,
          priority: INSIGHT_PRIORITY.HIGH,
          status: "pending",
          metadata: { documentType: "1099-B", proceeds: b.proceeds },
        });
      }
    }

    // Detect missing state withholding on W-2s
    const hasStateWages = taxData.w2Data.some(w => w.stateWages && parseFloat(w.stateWages) > 0);
    const hasStateWithheld = taxData.w2Data.some(w => w.stateWithheld && parseFloat(w.stateWithheld) > 0);
    if (hasStateWages && !hasStateWithheld) {
      insights.push({
        insightType: INSIGHT_TYPE.DOCUMENT,
        category: INSIGHT_CATEGORY.RISK,
        title: "No State Withholding Found",
        description: "Your W-2 shows state wages but no state income tax withheld. If you live in a state with income tax, you may owe a large state tax bill.",
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
      });
    }

    return insights;
  }

  // ─── Proactive deduction discovery ──────────────────────────────────────────

  private deductionDiscoveryInsights(taxData: ConsolidatedTaxData): TaxInsight[] {
    const insights: TaxInsight[] = [];
    const totalWages = taxData.w2Data.reduce((s, w) => s + parseFloat(w.wages || "0"), 0);
    const filingStatus = taxData.taxReturn.filingStatus;
    const standardDeduction = filingStatus === "married_joint" ? 29200 : filingStatus === "head_of_household" ? 21900 : 14600;

    // Student loan interest
    if (totalWages > 0 && totalWages < 85000) {
      insights.push({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: INSIGHT_CATEGORY.DEDUCTION,
        title: "Student Loan Interest Deduction",
        description: "If you paid student loan interest, you may deduct up to $2,500 (above-the-line) even without itemizing. Check Form 1098-E from your loan servicer.",
        potentialSavings: 2500 * 0.22,
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
      });
    }

    // IRA deductibility
    if (totalWages > 0) {
      const iraLimit = 7000;
      insights.push({
        insightType: INSIGHT_TYPE.YEAR_AHEAD,
        category: INSIGHT_CATEGORY.DEDUCTION,
        title: "Traditional IRA Contribution",
        description: `You can contribute up to $${iraLimit.toLocaleString()} to a Traditional IRA for 2024 (or $8,000 if age 50+) and may deduct it, reducing taxable income by up to $${iraLimit.toLocaleString()}.`,
        potentialSavings: iraLimit * 0.22,
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
      });
    }

    // Health insurance self-employed
    if (taxData.scheduleC && taxData.scheduleC.length > 0) {
      const totalSEIncome = taxData.scheduleC.reduce((s, c) => s + parseFloat(c.netProfit || "0"), 0);
      if (totalSEIncome > 0) {
        insights.push({
          insightType: INSIGHT_TYPE.CONSOLIDATED,
          category: INSIGHT_CATEGORY.DEDUCTION,
          title: "Self-Employed Health Insurance Deduction",
          description: "As a self-employed person, you can deduct 100% of health insurance premiums you pay for yourself and family. This is an above-the-line deduction — no need to itemize.",
          priority: INSIGHT_PRIORITY.HIGH,
          status: "pending",
          metadata: { totalSEIncome },
        });

        const sepLimit = Math.min(totalSEIncome * 0.25 * 0.9296, 69000);
        insights.push({
          insightType: INSIGHT_TYPE.CONSOLIDATED,
          category: INSIGHT_CATEGORY.DEDUCTION,
          title: "SEP-IRA Contribution Opportunity",
          description: `Based on your self-employment income of $${totalSEIncome.toLocaleString()}, you may contribute up to $${sepLimit.toLocaleString()} to a SEP-IRA, reducing your federal taxable income significantly.`,
          potentialSavings: sepLimit * 0.22,
          priority: INSIGHT_PRIORITY.HIGH,
          status: "pending",
        });
      }
    }

    // Charitable giving optimization
    const hasCharitable = taxData.scheduleA && parseFloat(taxData.scheduleA.charitableCash || "0") > 0;
    if (!hasCharitable && totalWages > 60000) {
      insights.push({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: INSIGHT_CATEGORY.DEDUCTION,
        title: "Charitable Giving Could Exceed Standard Deduction",
        description: `With $${standardDeduction.toLocaleString()} as your standard deduction, bunching two years of charitable giving into one year (via a Donor-Advised Fund) could push you over the threshold and create a larger net deduction.`,
        priority: INSIGHT_PRIORITY.LOW,
        status: "pending",
      });
    }

    // SALT cap awareness
    if (taxData.scheduleA) {
      const saltTotal = parseFloat(taxData.scheduleA.stateLocalIncomeTax || "0") +
        parseFloat(taxData.scheduleA.realEstateTax || "0") +
        parseFloat(taxData.scheduleA.personalPropertyTax || "0");
      if (saltTotal > 10000) {
        insights.push({
          insightType: INSIGHT_TYPE.CONSOLIDATED,
          category: INSIGHT_CATEGORY.RISK,
          title: "SALT Deduction Capped at $10,000",
          description: `Your state and local taxes total $${saltTotal.toLocaleString()}, but the federal deduction is capped at $10,000. You cannot deduct the remaining $${(saltTotal - 10000).toLocaleString()}.`,
          priority: INSIGHT_PRIORITY.MEDIUM,
          status: "pending",
          metadata: { saltTotal, capped: 10000 },
        });
      }
    }

    return insights;
  }

  // ─── Capital gains optimization ──────────────────────────────────────────────

  private capitalGainsOptimizationInsights(taxData: ConsolidatedTaxData): TaxInsight[] {
    const insights: TaxInsight[] = [];

    const entries = taxData.bEntries ?? [];
    const allBData = taxData.bData;

    // Net short vs. long-term position
    const totalShortTerm = allBData.reduce((s, b) => s + parseFloat(b.shortTermGainLoss || "0"), 0);
    const totalLongTerm = allBData.reduce((s, b) => s + parseFloat(b.longTermGainLoss || "0"), 0);
    const netCapitalGain = totalShortTerm + totalLongTerm;

    // Short-term losses can offset short-term gains (taxed at ordinary rates)
    if (totalShortTerm > 5000 && totalLongTerm < -1000) {
      const offset = Math.min(totalShortTerm, Math.abs(totalLongTerm));
      insights.push({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: INSIGHT_CATEGORY.OPTIMIZATION,
        title: "Long-Term Losses Can Offset Short-Term Gains",
        description: `Your long-term losses of $${Math.abs(totalLongTerm).toLocaleString()} can offset your short-term gains taxed at ordinary rates. This could save you the difference between your ordinary rate and the 15% long-term rate on $${offset.toLocaleString()}.`,
        potentialSavings: offset * 0.15,
        priority: INSIGHT_PRIORITY.HIGH,
        status: "pending",
      });
    }

    // Capital loss carryforward opportunity
    if (netCapitalGain < -3000) {
      const carryforward = Math.abs(netCapitalGain) - 3000;
      insights.push({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: INSIGHT_CATEGORY.OPTIMIZATION,
        title: "Capital Loss Carryforward Available",
        description: `You can deduct $3,000 of your $${Math.abs(netCapitalGain).toLocaleString()} net capital loss against ordinary income this year. The remaining $${carryforward.toLocaleString()} carries forward to offset future gains.`,
        potentialSavings: 3000 * 0.22,
        priority: INSIGHT_PRIORITY.HIGH,
        status: "pending",
      });
    }

    // Harvest-ready losses from individual entries
    const lossEntries = entries.filter(e => {
      const gl = parseFloat(e.gainLoss || "0");
      return gl < -500 && !e.washSale;
    });
    if (lossEntries.length > 0) {
      const totalHarvestable = lossEntries.reduce((s, e) => s + Math.abs(parseFloat(e.gainLoss || "0")), 0);
      const taxSavings = lossEntries.reduce((s, e) => {
        const loss = Math.abs(parseFloat(e.gainLoss || "0"));
        const rate = e.isShortTerm ? 0.22 : 0.15;
        return s + loss * rate;
      }, 0);
      insights.push({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: INSIGHT_CATEGORY.OPTIMIZATION,
        title: `Tax-Loss Harvesting: ${lossEntries.length} Position${lossEntries.length > 1 ? "s" : ""} Available`,
        description: `You have unrealized losses totaling ~$${totalHarvestable.toLocaleString()} across ${lossEntries.length} position(s). Selling them before year-end could offset gains and save approximately $${taxSavings.toLocaleString()} in taxes. Beware of wash sale rules (30-day repurchase window).`,
        potentialSavings: taxSavings,
        priority: INSIGHT_PRIORITY.HIGH,
        status: "pending",
        metadata: { lossPositions: lossEntries.length, totalHarvestable },
      });
    }

    // Qualified dividends vs. ordinary dividends ratio
    for (const div of taxData.divData) {
      const ordinary = parseFloat(div.ordinaryDividends || "0");
      const qualified = parseFloat(div.qualifiedDividends || "0");
      if (ordinary > 0 && qualified / ordinary < 0.5 && ordinary > 2000) {
        insights.push({
          insightType: INSIGHT_TYPE.CONSOLIDATED,
          category: INSIGHT_CATEGORY.OPTIMIZATION,
          title: "Low Qualified Dividend Ratio",
          description: `Only ${((qualified / ordinary) * 100).toFixed(0)}% of your $${ordinary.toLocaleString()} in dividends from ${div.payerName || "this account"} are qualified (taxed at lower rates). Consider funds that produce more qualified dividends to reduce tax.`,
          priority: INSIGHT_PRIORITY.LOW,
          status: "pending",
          metadata: { payerName: div.payerName, ratio: qualified / ordinary },
        });
      }
    }

    // Foreign tax credit opportunity
    const totalForeignTax = taxData.divData.reduce((s, d) => s + parseFloat(d.foreignTaxPaid || "0"), 0);
    if (totalForeignTax > 100) {
      insights.push({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: INSIGHT_CATEGORY.DEDUCTION,
        title: "Foreign Tax Credit Available",
        description: `You paid $${totalForeignTax.toLocaleString()} in foreign taxes on dividends. You can claim a Foreign Tax Credit (Form 1116) which directly reduces your US tax dollar-for-dollar — better than a deduction.`,
        potentialSavings: totalForeignTax,
        priority: INSIGHT_PRIORITY.HIGH,
        status: "pending",
      });
    }

    return insights;
  }

  // ─── Year-ahead planning ─────────────────────────────────────────────────────

  private yearAheadInsights(taxData: ConsolidatedTaxData): TaxInsight[] {
    const insights: TaxInsight[] = [];
    const totalWages = taxData.w2Data.reduce((s, w) => s + parseFloat(w.wages || "0"), 0);
    const currentYear = taxData.taxReturn.taxYear;
    const nextYear = currentYear + 1;
    const totalTax = parseFloat(taxData.taxReturn.totalTax || "0");

    if (totalWages > 50000) {
      const k401Headroom = Math.max(0, 23000 - totalWages * 0.06);
      if (k401Headroom > 2000) {
        insights.push({
          insightType: INSIGHT_TYPE.YEAR_AHEAD,
          category: INSIGHT_CATEGORY.PLANNING,
          title: "Increase 401(k) Contributions",
          description: `For ${nextYear}, consider increasing 401(k) contributions. The limit is $23,000 ($30,500 age 50+). Contributing an additional $${k401Headroom.toLocaleString()} would reduce taxable income by that amount.`,
          potentialSavings: k401Headroom * 0.22,
          priority: INSIGHT_PRIORITY.HIGH,
          status: "pending",
        });
      }
    }

    if (totalTax > 1000) {
      const quarterlyPayment = Math.ceil(totalTax / 4);
      insights.push({
        insightType: INSIGHT_TYPE.YEAR_AHEAD,
        category: INSIGHT_CATEGORY.PLANNING,
        title: "Make Quarterly Estimated Tax Payments",
        description: `Based on your ${currentYear} tax of $${totalTax.toLocaleString()}, make quarterly payments of ~$${quarterlyPayment.toLocaleString()} for ${nextYear} (due Apr 15, Jun 16, Sep 15, Jan 15) to avoid underpayment penalties.`,
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
        metadata: { totalTax, quarterlyPayment },
      });
    }

    insights.push({
      insightType: INSIGHT_TYPE.YEAR_AHEAD,
      category: INSIGHT_CATEGORY.PLANNING,
      title: "HSA Contribution Opportunity",
      description: `For ${nextYear}, if you have a High-Deductible Health Plan, contribute to an HSA: $4,150 (individual) or $8,300 (family). Contributions are pre-tax, growth is tax-free, and withdrawals for medical expenses are tax-free — triple tax advantage.`,
      potentialSavings: 4150 * 0.22,
      priority: INSIGHT_PRIORITY.MEDIUM,
      status: "pending",
    });

    return insights;
  }

  // ─── Audit risk ──────────────────────────────────────────────────────────────

  private auditRiskInsights(taxData: ConsolidatedTaxData): TaxInsight[] {
    const insights: TaxInsight[] = [];
    const totalIncome = taxData.w2Data.reduce((s, w) => s + parseFloat(w.wages || "0"), 0) +
      taxData.divData.reduce((s, d) => s + parseFloat(d.ordinaryDividends || "0"), 0) +
      taxData.intData.reduce((s, i) => s + parseFloat(i.interestIncome || "0"), 0);
    const totalCapGains = taxData.bData.reduce((s, b) => s + parseFloat(b.shortTermGainLoss || "0") + parseFloat(b.longTermGainLoss || "0"), 0);

    if (totalIncome > 200000) {
      insights.push({
        insightType: INSIGHT_TYPE.AUDIT_RISK,
        category: INSIGHT_CATEGORY.RISK,
        title: "Elevated Audit Risk — High Income",
        description: "Returns with AGI above $200,000 face 2-4× higher audit rates. Ensure every deduction has documentation: receipts, bank statements, mileage logs, and charitable acknowledgment letters.",
        priority: INSIGHT_PRIORITY.HIGH,
        status: "pending",
      });
    }

    if (taxData.scheduleC && taxData.scheduleC.length > 0) {
      insights.push({
        insightType: INSIGHT_TYPE.AUDIT_RISK,
        category: INSIGHT_CATEGORY.RISK,
        title: "Schedule C Increases Audit Probability",
        description: "Self-employment Schedule C filings are audited at higher rates, especially with large expense deductions. Keep receipts for every business expense and maintain a mileage log if claiming car expenses.",
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
      });
    }

    if (Math.abs(totalCapGains) > 50000) {
      insights.push({
        insightType: INSIGHT_TYPE.AUDIT_RISK,
        category: INSIGHT_CATEGORY.RISK,
        title: "Large Capital Gains — Document Cost Basis",
        description: `Your capital gain/loss activity of $${Math.abs(totalCapGains).toLocaleString()} may draw scrutiny. Ensure cost basis is accurate and documented, especially for any inherited securities, stock splits, or reinvested dividends.`,
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
      });
    }

    const total1099s = taxData.divData.length + taxData.intData.length + taxData.bData.length;
    if (total1099s > 15) {
      insights.push({
        insightType: INSIGHT_TYPE.AUDIT_RISK,
        category: INSIGHT_CATEGORY.RISK,
        title: "Many Information Returns — Cross-Check All",
        description: `With ${total1099s} investment forms, ensure every 1099 received is reported. IRS computers match 1099s to returns; unreported income is a common automatic audit trigger.`,
        priority: INSIGHT_PRIORITY.MEDIUM,
        status: "pending",
        metadata: { total1099s },
      });
    }

    return insights;
  }

  // ─── LLM-powered narrative insights ─────────────────────────────────────────

  private async generateLLMInsights(taxData: ConsolidatedTaxData): Promise<TaxInsight[]> {
    if (!this.client) return [];

    const totalWages = taxData.w2Data.reduce((s, w) => s + parseFloat(w.wages || "0"), 0);
    const totalDividends = taxData.divData.reduce((s, d) => s + parseFloat(d.ordinaryDividends || "0"), 0);
    const totalInterest = taxData.intData.reduce((s, i) => s + parseFloat(i.interestIncome || "0"), 0);
    const netCapGains = taxData.bData.reduce((s, b) => s + parseFloat(b.shortTermGainLoss || "0") + parseFloat(b.longTermGainLoss || "0"), 0);
    const selfEmployed = (taxData.scheduleC?.length ?? 0) > 0;
    const totalSEIncome = (taxData.scheduleC ?? []).reduce((s, c) => s + parseFloat(c.netProfit || "0"), 0);

    const prompt = `You are a senior CPA reviewing a client's tax situation. Provide 2-3 specific, actionable tax planning insights based on this data. Return ONLY a JSON array with no other text.

Tax Data:
- Filing Status: ${taxData.taxReturn.filingStatus}
- Tax Year: ${taxData.taxReturn.taxYear}
- W-2 Wages: $${totalWages.toLocaleString()}
- Dividend Income: $${totalDividends.toLocaleString()}
- Interest Income: $${totalInterest.toLocaleString()}
- Net Capital Gains: $${netCapGains.toLocaleString()}
- Self-Employed: ${selfEmployed} (net income: $${totalSEIncome.toLocaleString()})
- Has Itemized Deductions: ${!!taxData.scheduleA}
- Number of Dependents: ${taxData.profile?.dependents?.length ?? 0}

Return format (JSON array only):
[
  {
    "title": "...",
    "description": "...",
    "category": "deduction|optimization|planning|risk",
    "priority": "high|medium|low",
    "potentialSavings": 0
  }
]`;

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        title: string;
        description: string;
        category: string;
        priority: string;
        potentialSavings?: number;
      }>;

      return parsed.map(item => ({
        insightType: INSIGHT_TYPE.CONSOLIDATED,
        category: item.category,
        title: item.title,
        description: item.description,
        potentialSavings: item.potentialSavings,
        priority: item.priority,
        status: "pending",
        metadata: { llmGenerated: true },
      }));
    } catch (error) {
      console.error("[AIInsightsService] LLM insight generation failed:", error);
      return [];
    }
  }

  detectWashSales(b1099Data: Form1099B[]): TaxInsight[] {
    const insights: TaxInsight[] = [];
    for (const b of b1099Data) {
      if (b.washSale) {
        insights.push({
          insightType: INSIGHT_TYPE.DOCUMENT,
          category: INSIGHT_CATEGORY.RISK,
          title: "Wash Sale Reported",
          description: `"${b.description || "A transaction"}" is flagged as a wash sale. The disallowed loss adds to the cost basis of the replacement security and cannot be claimed this year.`,
          priority: INSIGHT_PRIORITY.HIGH,
          status: "pending",
          metadata: { documentType: "1099-B", description: b.description },
        });
      }
    }
    return insights;
  }
}

export const aiInsightsService = new AIInsightsService();
