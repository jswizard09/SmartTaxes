import type { StateTaxReturn, TaxReturn, Form1040 } from "@shared/schema";

export interface StateTaxCalculation {
  state: string;
  stateIncome: number;
  stateTax: number;
  stateWithheld: number;
  stateRefundOrOwed: number;
  effectiveRate: number;
  marginalRate: number;
}

export interface StateTaxBrackets {
  [key: string]: Array<{
    min: number;
    max: number;
    rate: number;
  }>;
}

export class StateTaxService {
  private stateTaxBrackets: StateTaxBrackets = {
    CA: [
      { min: 0, max: 10099, rate: 0.01 },
      { min: 10099, max: 23942, rate: 0.02 },
      { min: 23942, max: 37788, rate: 0.04 },
      { min: 37788, max: 52455, rate: 0.06 },
      { min: 52455, max: 66295, rate: 0.08 },
      { min: 66295, max: 338639, rate: 0.093 },
      { min: 338639, max: 406364, rate: 0.103 },
      { min: 406364, max: 677275, rate: 0.113 },
      { min: 677275, max: Infinity, rate: 0.123 },
    ],
    NY: [
      { min: 0, max: 8500, rate: 0.04 },
      { min: 8500, max: 11700, rate: 0.045 },
      { min: 11700, max: 13900, rate: 0.0525 },
      { min: 13900, max: 21400, rate: 0.059 },
      { min: 21400, max: 80650, rate: 0.0621 },
      { min: 80650, max: 215400, rate: 0.0649 },
      { min: 215400, max: 1077550, rate: 0.0685 },
      { min: 1077550, max: Infinity, rate: 0.0882 },
    ],
    TX: [], // No state income tax
  };

  private stateStandardDeductions: Record<string, Record<string, number>> = {
    CA: {
      single: 5202,
      married_joint: 10404,
      married_separate: 5202,
      head_of_household: 10404,
    },
    NY: {
      single: 8000,
      married_joint: 16000,
      married_separate: 8000,
      head_of_household: 11000,
    },
    TX: {
      single: 0,
      married_joint: 0,
      married_separate: 0,
      head_of_household: 0,
    },
  };

  /**
   * Calculate state tax for a given state
   */
  async calculateStateTax(
    state: string,
    federalTaxReturn: TaxReturn,
    federalForm1040: Form1040,
    filingStatus: string
  ): Promise<StateTaxCalculation> {
    if (state === "TX") {
      return this.calculateTexasTax(); // No state income tax
    }

    const brackets = this.stateTaxBrackets[state];
    if (!brackets) {
      throw new Error(`State tax brackets not available for ${state}`);
    }

    const stateIncome = this.calculateStateIncome(federalForm1040, state);
    const standardDeduction = this.getStateStandardDeduction(state, filingStatus);
    const taxableIncome = Math.max(0, stateIncome - standardDeduction);
    
    const stateTax = this.calculateTaxFromBrackets(taxableIncome, brackets);
    const stateWithheld = this.calculateStateWithheld(federalTaxReturn, state);
    const stateRefundOrOwed = stateWithheld - stateTax;
    
    const effectiveRate = stateIncome > 0 ? (stateTax / stateIncome) : 0;
    const marginalRate = this.getMarginalRate(taxableIncome, brackets);

    return {
      state,
      stateIncome,
      stateTax,
      stateWithheld,
      stateRefundOrOwed,
      effectiveRate,
      marginalRate,
    };
  }

  /**
   * Calculate state income (may differ from federal)
   */
  private calculateStateIncome(form1040: Form1040, state: string): number {
    const federalIncome = parseFloat(form1040.totalIncome || "0");
    
    // Most states start with federal AGI, but some have modifications
    switch (state) {
      case "CA":
        // California has some modifications to federal income
        return federalIncome;
      case "NY":
        // New York starts with federal AGI
        return federalIncome;
      default:
        return federalIncome;
    }
  }

  /**
   * Calculate tax from brackets
   */
  private calculateTaxFromBrackets(taxableIncome: number, brackets: Array<{ min: number; max: number; rate: number }>): number {
    let tax = 0;

    for (const bracket of brackets) {
      if (taxableIncome > bracket.min) {
        const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
        tax += taxableInBracket * bracket.rate;
      }
      if (taxableIncome <= bracket.max) break;
    }

    return Math.round(tax * 100) / 100;
  }

  /**
   * Get marginal tax rate
   */
  private getMarginalRate(taxableIncome: number, brackets: Array<{ min: number; max: number; rate: number }>): number {
    for (const bracket of brackets) {
      if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
        return bracket.rate;
      }
    }
    return brackets[brackets.length - 1]?.rate || 0;
  }

  /**
   * Get state standard deduction
   */
  private getStateStandardDeduction(state: string, filingStatus: string): number {
    const deductions = this.stateStandardDeductions[state];
    if (!deductions) return 0;
    
    return deductions[filingStatus] || deductions.single || 0;
  }

  /**
   * Calculate state tax withheld (simplified)
   */
  private calculateStateWithheld(taxReturn: TaxReturn, state: string): number {
    // This would typically come from W-2 forms
    // For now, estimate based on federal withholding
    const federalWithheld = parseFloat(taxReturn.withheld || "0");
    
    // Rough estimation - states typically withhold 3-10% of federal withholding
    const stateWithholdingRates: Record<string, number> = {
      CA: 0.05,
      NY: 0.06,
      TX: 0,
    };
    
    return federalWithheld * (stateWithholdingRates[state] || 0.05);
  }

  /**
   * Calculate Texas tax (no state income tax)
   */
  private calculateTexasTax(): StateTaxCalculation {
    return {
      state: "TX",
      stateIncome: 0,
      stateTax: 0,
      stateWithheld: 0,
      stateRefundOrOwed: 0,
      effectiveRate: 0,
      marginalRate: 0,
    };
  }

  /**
   * Get supported states
   */
  getSupportedStates(): string[] {
    return Object.keys(this.stateTaxBrackets);
  }

  /**
   * Get state-specific deductions and credits
   */
  getStateDeductions(state: string): Array<{
    name: string;
    description: string;
    maxAmount: number;
    eligibility: string;
  }> {
    const deductions: Record<string, Array<any>> = {
      CA: [
        {
          name: "California Earned Income Tax Credit",
          description: "Refundable credit for low to moderate income earners",
          maxAmount: 3000,
          eligibility: "Income under $30,000",
        },
        {
          name: "Renters Credit",
          description: "Credit for renters",
          maxAmount: 120,
          eligibility: "All renters",
        },
      ],
      NY: [
        {
          name: "New York Earned Income Credit",
          description: "Refundable credit based on federal EIC",
          maxAmount: 2000,
          eligibility: "Based on federal EIC eligibility",
        },
        {
          name: "Child and Dependent Care Credit",
          description: "Credit for child care expenses",
          maxAmount: 3000,
          eligibility: "Working parents",
        },
      ],
      TX: [],
    };

    return deductions[state] || [];
  }

  /**
   * Calculate state-specific credits
   */
  calculateStateCredits(
    state: string,
    income: number,
    filingStatus: string,
    dependents: number = 0
  ): number {
    const deductions = this.getStateDeductions(state);
    let totalCredits = 0;

    for (const deduction of deductions) {
      // Simplified credit calculation
      if (deduction.name.includes("Earned Income")) {
        if (income < 30000) {
          totalCredits += Math.min(deduction.maxAmount, income * 0.1);
        }
      } else if (deduction.name.includes("Renters")) {
        totalCredits += deduction.maxAmount;
      } else if (deduction.name.includes("Child")) {
        totalCredits += deduction.maxAmount * dependents;
      }
    }

    return totalCredits;
  }

  /**
   * Get state filing deadlines
   */
  getStateDeadlines(): Record<string, string> {
    return {
      CA: "April 15th",
      NY: "April 15th",
      TX: "N/A (no state income tax)",
      FL: "N/A (no state income tax)",
      WA: "N/A (no state income tax)",
      NV: "N/A (no state income tax)",
      SD: "N/A (no state income tax)",
      WY: "N/A (no state income tax)",
      TN: "N/A (no state income tax)",
      NH: "N/A (no state income tax)",
    };
  }

  /**
   * Validate state for tax calculation
   */
  validateState(state: string): { isValid: boolean; message?: string } {
    const supportedStates = this.getSupportedStates();
    
    if (!supportedStates.includes(state)) {
      return {
        isValid: false,
        message: `State ${state} is not supported for tax calculation`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get state tax summary
   */
  getStateTaxSummary(state: string): {
    hasIncomeTax: boolean;
    taxRate: string;
    standardDeduction: string;
    filingDeadline: string;
    specialNotes: string[];
  } {
    const noIncomeTaxStates = ["TX", "FL", "WA", "NV", "SD", "WY", "TN", "NH"];
    
    if (noIncomeTaxStates.includes(state)) {
      return {
        hasIncomeTax: false,
        taxRate: "0%",
        standardDeduction: "N/A",
        filingDeadline: "N/A",
        specialNotes: ["No state income tax"],
      };
    }

    const brackets = this.stateTaxBrackets[state];
    const topRate = brackets[brackets.length - 1]?.rate || 0;
    
    return {
      hasIncomeTax: true,
      taxRate: `${(topRate * 100).toFixed(1)}% (top rate)`,
      standardDeduction: `$${this.stateStandardDeductions[state]?.single || 0}`,
      filingDeadline: this.getStateDeadlines()[state] || "April 15th",
      specialNotes: [
        "Rates vary by income bracket",
        "Check for state-specific deductions and credits",
      ],
    };
  }
}

// Export singleton instance
export const stateTaxService = new StateTaxService();
