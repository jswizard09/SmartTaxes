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

export interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface StateTaxBrackets {
  [key: string]: TaxBracket[];
}

// States with no income tax
const NO_INCOME_TAX_STATES = new Set([
  "TX", "FL", "WA", "NV", "SD", "WY", "AK", "TN", "NH",
]);

// 2024 state tax brackets (single filer as default; MFJ noted where different)
const STATE_BRACKETS: Record<string, TaxBracket[]> = {
  // ---- No income tax states ----
  TX: [],
  FL: [],
  WA: [],
  NV: [],
  SD: [],
  WY: [],
  AK: [],
  TN: [],
  NH: [],

  // ---- California (2024, single) ----
  CA: [
    { min: 0,       max: 10412,   rate: 0.01  },
    { min: 10412,   max: 24684,   rate: 0.02  },
    { min: 24684,   max: 38959,   rate: 0.04  },
    { min: 38959,   max: 54081,   rate: 0.06  },
    { min: 54081,   max: 68350,   rate: 0.08  },
    { min: 68350,   max: 349137,  rate: 0.093 },
    { min: 349137,  max: 418961,  rate: 0.103 },
    { min: 418961,  max: 698271,  rate: 0.113 },
    { min: 698271,  max: 1000000, rate: 0.123 },
    { min: 1000000, max: Infinity, rate: 0.133 },
  ],

  // ---- New York (2024, single) ----
  NY: [
    { min: 0,       max: 8500,    rate: 0.04   },
    { min: 8500,    max: 11700,   rate: 0.045  },
    { min: 11700,   max: 13900,   rate: 0.0525 },
    { min: 13900,   max: 21400,   rate: 0.059  },
    { min: 21400,   max: 80650,   rate: 0.0621 },
    { min: 80650,   max: 215400,  rate: 0.0649 },
    { min: 215400,  max: 1077550, rate: 0.0685 },
    { min: 1077550, max: 5000000, rate: 0.0965 },
    { min: 5000000, max: 25000000, rate: 0.103 },
    { min: 25000000, max: Infinity, rate: 0.109 },
  ],

  // ---- Illinois – flat 4.95% ----
  IL: [
    { min: 0, max: Infinity, rate: 0.0495 },
  ],

  // ---- Pennsylvania – flat 3.07% ----
  PA: [
    { min: 0, max: Infinity, rate: 0.0307 },
  ],

  // ---- Ohio (2024) ----
  OH: [
    { min: 0,      max: 26050,  rate: 0      },
    { min: 26050,  max: 100000, rate: 0.02765},
    { min: 100000, max: Infinity, rate: 0.03990},
  ],

  // ---- Georgia (2024) – flat 5.49% ----
  GA: [
    { min: 0, max: Infinity, rate: 0.0549 },
  ],

  // ---- North Carolina – flat 4.5% ----
  NC: [
    { min: 0, max: Infinity, rate: 0.045 },
  ],

  // ---- Michigan – flat 4.25% ----
  MI: [
    { min: 0, max: Infinity, rate: 0.0425 },
  ],

  // ---- New Jersey (2024, single) ----
  NJ: [
    { min: 0,      max: 20000,  rate: 0.014  },
    { min: 20000,  max: 35000,  rate: 0.0175 },
    { min: 35000,  max: 40000,  rate: 0.035  },
    { min: 40000,  max: 75000,  rate: 0.05525},
    { min: 75000,  max: 500000, rate: 0.0637 },
    { min: 500000, max: 1000000, rate: 0.0897},
    { min: 1000000, max: Infinity, rate: 0.1075},
  ],

  // ---- Virginia (2024) ----
  VA: [
    { min: 0,     max: 3000,   rate: 0.02  },
    { min: 3000,  max: 5000,   rate: 0.03  },
    { min: 5000,  max: 17000,  rate: 0.05  },
    { min: 17000, max: Infinity, rate: 0.0575},
  ],

  // ---- Arizona (2024) – flat 2.5% ----
  AZ: [
    { min: 0, max: Infinity, rate: 0.025 },
  ],

  // ---- Massachusetts – flat 5% (standard income) ----
  MA: [
    { min: 0, max: Infinity, rate: 0.05 },
  ],

  // ---- Indiana – flat 3.15% ----
  IN: [
    { min: 0, max: Infinity, rate: 0.0315 },
  ],

  // ---- Missouri (2024) ----
  MO: [
    { min: 0,     max: 1207,   rate: 0      },
    { min: 1207,  max: 2414,   rate: 0.015  },
    { min: 2414,  max: 3621,   rate: 0.02   },
    { min: 3621,  max: 4828,   rate: 0.025  },
    { min: 4828,  max: 6035,   rate: 0.03   },
    { min: 6035,  max: 7242,   rate: 0.035  },
    { min: 7242,  max: 8449,   rate: 0.04   },
    { min: 8449,  max: 9656,   rate: 0.045  },
    { min: 9656,  max: Infinity, rate: 0.048 },
  ],

  // ---- Maryland (2024, single) ----
  MD: [
    { min: 0,      max: 1000,   rate: 0.02   },
    { min: 1000,   max: 2000,   rate: 0.03   },
    { min: 2000,   max: 3000,   rate: 0.04   },
    { min: 3000,   max: 100000, rate: 0.0475 },
    { min: 100000, max: 125000, rate: 0.05   },
    { min: 125000, max: 150000, rate: 0.0525 },
    { min: 150000, max: 250000, rate: 0.055  },
    { min: 250000, max: Infinity, rate: 0.0575},
  ],

  // ---- Wisconsin (2024, single) ----
  WI: [
    { min: 0,      max: 13810,  rate: 0.0354 },
    { min: 13810,  max: 27630,  rate: 0.0465 },
    { min: 27630,  max: 304170, rate: 0.053  },
    { min: 304170, max: Infinity, rate: 0.0765},
  ],

  // ---- Minnesota (2024, single) ----
  MN: [
    { min: 0,      max: 30070,  rate: 0.0535 },
    { min: 30070,  max: 98760,  rate: 0.068  },
    { min: 98760,  max: 183340, rate: 0.0785 },
    { min: 183340, max: Infinity, rate: 0.0985},
  ],

  // ---- Colorado – flat 4.4% ----
  CO: [
    { min: 0, max: Infinity, rate: 0.044 },
  ],

  // ---- Alabama (2024, single) ----
  AL: [
    { min: 0,     max: 500,    rate: 0.02  },
    { min: 500,   max: 3000,   rate: 0.04  },
    { min: 3000,  max: Infinity, rate: 0.05 },
  ],

  // ---- South Carolina (2024) ----
  SC: [
    { min: 0,     max: 3460,   rate: 0      },
    { min: 3460,  max: 17330,  rate: 0.03   },
    { min: 17330, max: Infinity, rate: 0.064 },
  ],

  // ---- Louisiana (2024, single) ----
  LA: [
    { min: 0,      max: 12500,  rate: 0.0185 },
    { min: 12500,  max: 50000,  rate: 0.035  },
    { min: 50000,  max: Infinity, rate: 0.0425},
  ],

  // ---- Kentucky – flat 4.0% ----
  KY: [
    { min: 0, max: Infinity, rate: 0.04 },
  ],

  // ---- Oregon (2024, single) ----
  OR: [
    { min: 0,      max: 4050,   rate: 0.0475 },
    { min: 4050,   max: 10200,  rate: 0.0675 },
    { min: 10200,  max: 125000, rate: 0.0875 },
    { min: 125000, max: Infinity, rate: 0.099 },
  ],

  // ---- Oklahoma (2024) ----
  OK: [
    { min: 0,     max: 1000,   rate: 0.0025 },
    { min: 1000,  max: 2500,   rate: 0.0075 },
    { min: 2500,  max: 3750,   rate: 0.0175 },
    { min: 3750,  max: 4900,   rate: 0.0275 },
    { min: 4900,  max: 7200,   rate: 0.0375 },
    { min: 7200,  max: Infinity, rate: 0.0475},
  ],

  // ---- Connecticut (2024, single) ----
  CT: [
    { min: 0,      max: 10000,  rate: 0.03   },
    { min: 10000,  max: 50000,  rate: 0.05   },
    { min: 50000,  max: 100000, rate: 0.055  },
    { min: 100000, max: 200000, rate: 0.06   },
    { min: 200000, max: 250000, rate: 0.065  },
    { min: 250000, max: 500000, rate: 0.069  },
    { min: 500000, max: Infinity, rate: 0.0699},
  ],

  // ---- Iowa (2024) – flat 5.7% (transitioning) ----
  IA: [
    { min: 0,      max: 6210,   rate: 0.044  },
    { min: 6210,   max: 31050,  rate: 0.0482 },
    { min: 31050,  max: Infinity, rate: 0.057 },
  ],

  // ---- Mississippi (2024) ----
  MS: [
    { min: 0,     max: 10000,  rate: 0      },
    { min: 10000, max: Infinity, rate: 0.047 },
  ],

  // ---- Arkansas (2024) ----
  AR: [
    { min: 0,     max: 4300,   rate: 0.02   },
    { min: 4300,  max: 8500,   rate: 0.04   },
    { min: 8500,  max: Infinity, rate: 0.047 },
  ],

  // ---- Kansas (2024) ----
  KS: [
    { min: 0,      max: 15000,  rate: 0.031  },
    { min: 15000,  max: 30000,  rate: 0.0525 },
    { min: 30000,  max: Infinity, rate: 0.057 },
  ],

  // ---- Utah – flat 4.65% ----
  UT: [
    { min: 0, max: Infinity, rate: 0.0465 },
  ],

  // ---- New Mexico (2024, single) ----
  NM: [
    { min: 0,      max: 5500,   rate: 0.017  },
    { min: 5500,   max: 11000,  rate: 0.032  },
    { min: 11000,  max: 16000,  rate: 0.047  },
    { min: 16000,  max: 210000, rate: 0.049  },
    { min: 210000, max: Infinity, rate: 0.059 },
  ],

  // ---- Nebraska (2024, single) ----
  NE: [
    { min: 0,      max: 3700,   rate: 0.0246 },
    { min: 3700,   max: 22170,  rate: 0.0351 },
    { min: 22170,  max: 35730,  rate: 0.0501 },
    { min: 35730,  max: Infinity, rate: 0.0664},
  ],

  // ---- West Virginia (2024) ----
  WV: [
    { min: 0,      max: 10000,  rate: 0.03   },
    { min: 10000,  max: 25000,  rate: 0.04   },
    { min: 25000,  max: 40000,  rate: 0.045  },
    { min: 40000,  max: 60000,  rate: 0.06   },
    { min: 60000,  max: Infinity, rate: 0.065 },
  ],

  // ---- Idaho (2024) – flat 5.8% ----
  ID: [
    { min: 0, max: Infinity, rate: 0.058 },
  ],

  // ---- Hawaii (2024, single) ----
  HI: [
    { min: 0,      max: 2400,   rate: 0.014  },
    { min: 2400,   max: 4800,   rate: 0.032  },
    { min: 4800,   max: 9600,   rate: 0.055  },
    { min: 9600,   max: 14400,  rate: 0.064  },
    { min: 14400,  max: 19200,  rate: 0.068  },
    { min: 19200,  max: 24000,  rate: 0.072  },
    { min: 24000,  max: 36000,  rate: 0.076  },
    { min: 36000,  max: 48000,  rate: 0.079  },
    { min: 48000,  max: 150000, rate: 0.0825 },
    { min: 150000, max: 175000, rate: 0.09   },
    { min: 175000, max: 200000, rate: 0.10   },
    { min: 200000, max: Infinity, rate: 0.11  },
  ],

  // ---- Maine (2024, single) ----
  ME: [
    { min: 0,      max: 24500,  rate: 0.058  },
    { min: 24500,  max: 58050,  rate: 0.0675 },
    { min: 58050,  max: Infinity, rate: 0.0715},
  ],

  // ---- Rhode Island (2024) ----
  RI: [
    { min: 0,      max: 77450,  rate: 0.0375 },
    { min: 77450,  max: 176050, rate: 0.0475 },
    { min: 176050, max: Infinity, rate: 0.0599},
  ],

  // ---- Montana (2024) ----
  MT: [
    { min: 0,      max: 20500,  rate: 0.047  },
    { min: 20500,  max: Infinity, rate: 0.059 },
  ],

  // ---- Delaware (2024) ----
  DE: [
    { min: 0,     max: 2000,   rate: 0      },
    { min: 2000,  max: 5000,   rate: 0.022  },
    { min: 5000,  max: 10000,  rate: 0.039  },
    { min: 10000, max: 20000,  rate: 0.048  },
    { min: 20000, max: 25000,  rate: 0.052  },
    { min: 25000, max: 60000,  rate: 0.0555 },
    { min: 60000, max: Infinity, rate: 0.066 },
  ],

  // ---- North Dakota (2024, single) ----
  ND: [
    { min: 0,      max: 44725,  rate: 0.011  },
    { min: 44725,  max: 225975, rate: 0.0204 },
    { min: 225975, max: Infinity, rate: 0.029 },
  ],

  // ---- Vermont (2024, single) ----
  VT: [
    { min: 0,      max: 45400,  rate: 0.0335 },
    { min: 45400,  max: 110050, rate: 0.066  },
    { min: 110050, max: 229550, rate: 0.076  },
    { min: 229550, max: Infinity, rate: 0.0875},
  ],

  // ---- DC (2024) ----
  DC: [
    { min: 0,       max: 10000,  rate: 0.04   },
    { min: 10000,   max: 40000,  rate: 0.06   },
    { min: 40000,   max: 60000,  rate: 0.065  },
    { min: 60000,   max: 250000, rate: 0.085  },
    { min: 250000,  max: 500000, rate: 0.0925 },
    { min: 500000,  max: 1000000, rate: 0.0975},
    { min: 1000000, max: Infinity, rate: 0.1075},
  ],
};

// 2024 state standard deductions (single / married_joint / married_separate / head_of_household)
const STATE_STANDARD_DEDUCTIONS: Record<string, Record<string, number>> = {
  CA: { single: 5363, married_joint: 10726, married_separate: 5363, head_of_household: 10726 },
  NY: { single: 8000, married_joint: 16050, married_separate: 8000, head_of_household: 11200 },
  IL: { single: 2775, married_joint: 5550, married_separate: 2775, head_of_household: 2775 },
  PA: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  OH: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  GA: { single: 12000, married_joint: 24000, married_separate: 12000, head_of_household: 18000 },
  NC: { single: 10750, married_joint: 21500, married_separate: 10750, head_of_household: 16125 },
  MI: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  NJ: { single: 1000, married_joint: 2000, married_separate: 1000, head_of_household: 1500 },
  VA: { single: 8000, married_joint: 16000, married_separate: 8000, head_of_household: 8000 },
  AZ: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  MA: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  IN: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  MO: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  MD: { single: 2400, married_joint: 4850, married_separate: 2400, head_of_household: 3200 },
  WI: { single: 12480, married_joint: 23010, married_separate: 11505, head_of_household: 15590 },
  MN: { single: 14575, married_joint: 29150, married_separate: 14575, head_of_household: 21800 },
  CO: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  AL: { single: 3000, married_joint: 8500, married_separate: 4250, head_of_household: 4700 },
  SC: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  LA: { single: 4500, married_joint: 9000, married_separate: 4500, head_of_household: 4500 },
  KY: { single: 3160, married_joint: 3160, married_separate: 3160, head_of_household: 3160 },
  OR: { single: 2420, married_joint: 4840, married_separate: 2420, head_of_household: 3870 },
  OK: { single: 7350, married_joint: 14700, married_separate: 7350, head_of_household: 7350 },
  CT: { single: 15750, married_joint: 24500, married_separate: 12250, head_of_household: 19000 },
  IA: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  MS: { single: 2300, married_joint: 4600, married_separate: 2300, head_of_household: 3400 },
  AR: { single: 2340, married_joint: 4680, married_separate: 2340, head_of_household: 2340 },
  KS: { single: 3500, married_joint: 8000, married_separate: 4000, head_of_household: 6000 },
  UT: { single: 888, married_joint: 1776, married_separate: 888, head_of_household: 888 },
  NM: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  NE: { single: 7900, married_joint: 15800, married_separate: 7900, head_of_household: 7900 },
  WV: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  ID: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  HI: { single: 2200, married_joint: 4400, married_separate: 2200, head_of_household: 3212 },
  ME: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  RI: { single: 10550, married_joint: 21200, married_separate: 10550, head_of_household: 15875 },
  MT: { single: 5540, married_joint: 11080, married_separate: 5540, head_of_household: 5540 },
  DE: { single: 3250, married_joint: 6500, married_separate: 3250, head_of_household: 3250 },
  ND: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  VT: { single: 7000, married_joint: 14000, married_separate: 7000, head_of_household: 10500 },
  DC: { single: 14600, married_joint: 29200, married_separate: 14600, head_of_household: 21900 },
  // No-tax states (deduction irrelevant but kept for completeness)
  TX: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  FL: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  WA: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  NV: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  SD: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  WY: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  AK: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  TN: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
  NH: { single: 0, married_joint: 0, married_separate: 0, head_of_household: 0 },
};

export class StateTaxService {
  private stateTaxBrackets: StateTaxBrackets = STATE_BRACKETS;

  private stateStandardDeductions: Record<string, Record<string, number>> = STATE_STANDARD_DEDUCTIONS;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Calculate state income tax for a filer.
   */
  async calculateStateTax(
    state: string,
    federalTaxReturn: TaxReturn,
    federalForm1040: Form1040,
    filingStatus: string
  ): Promise<StateTaxCalculation> {
    const upperState = state.toUpperCase();

    if (NO_INCOME_TAX_STATES.has(upperState)) {
      return this.buildZeroTaxResult(upperState);
    }

    const brackets = this.stateTaxBrackets[upperState];
    if (!brackets) {
      throw new Error(`State tax brackets not available for ${upperState}`);
    }

    const stateIncome = this.calculateStateIncome(federalForm1040, upperState);
    const standardDeduction = this.getStateStandardDeduction(upperState, filingStatus);
    const taxableIncome = Math.max(0, stateIncome - standardDeduction);

    const stateTax = this.calculateTaxFromBrackets(taxableIncome, brackets);
    const stateWithheld = this.calculateStateWithheld(federalTaxReturn, upperState);
    const stateRefundOrOwed = stateWithheld - stateTax;

    const effectiveRate = stateIncome > 0 ? stateTax / stateIncome : 0;
    const marginalRate = this.getMarginalRate(taxableIncome, brackets);

    return {
      state: upperState,
      stateIncome,
      stateTax,
      stateWithheld,
      stateRefundOrOwed,
      effectiveRate,
      marginalRate,
    };
  }

  /**
   * Validate that the given state code is supported.
   */
  validateState(state: string): { isValid: boolean; message?: string } {
    const upperState = state.toUpperCase();
    if (!this.stateTaxBrackets.hasOwnProperty(upperState)) {
      return {
        isValid: false,
        message: `State ${upperState} is not supported for tax calculation`,
      };
    }
    return { isValid: true };
  }

  /**
   * Return all supported state codes.
   */
  getSupportedStates(): string[] {
    return Object.keys(this.stateTaxBrackets).sort();
  }

  /**
   * Return a human-readable tax summary for a state.
   */
  getStateTaxSummary(state: string): {
    hasIncomeTax: boolean;
    taxRate: string;
    standardDeduction: string;
    filingDeadline: string;
    specialNotes: string[];
  } {
    const upperState = state.toUpperCase();

    if (NO_INCOME_TAX_STATES.has(upperState)) {
      return {
        hasIncomeTax: false,
        taxRate: "0%",
        standardDeduction: "N/A",
        filingDeadline: "N/A",
        specialNotes: ["No state income tax"],
      };
    }

    const brackets = this.stateTaxBrackets[upperState];
    const topBracket = brackets ? brackets[brackets.length - 1] : undefined;
    const topRate = topBracket?.rate ?? 0;
    const singleDeduction = this.stateStandardDeductions[upperState]?.single ?? 0;

    const flatStates = ["IL", "PA", "MI", "GA", "NC", "AZ", "CO", "MA", "IN", "KY", "UT", "ID"];
    const isFlat = flatStates.includes(upperState);

    const notes: string[] = [];
    if (isFlat) {
      notes.push("Flat rate – same rate applies to all income levels");
    } else {
      notes.push("Progressive brackets – rates increase with income");
    }
    notes.push("Check for state-specific deductions and credits");

    return {
      hasIncomeTax: true,
      taxRate: isFlat ? `${(topRate * 100).toFixed(2)}% (flat)` : `Up to ${(topRate * 100).toFixed(2)}%`,
      standardDeduction: `$${singleDeduction.toLocaleString()} (single)`,
      filingDeadline: this.getFilingDeadline(upperState),
      specialNotes: notes,
    };
  }

  /**
   * Return notable state-specific deductions and credits.
   */
  getStateDeductions(state: string): Array<{
    name: string;
    description: string;
    maxAmount: number;
    eligibility: string;
  }> {
    const deductions: Record<string, Array<{ name: string; description: string; maxAmount: number; eligibility: string }>> = {
      CA: [
        { name: "California Earned Income Tax Credit (CalEITC)", description: "Refundable credit for low to moderate income earners", maxAmount: 3529, eligibility: "Income under $30,931 (2024)" },
        { name: "Young Child Tax Credit", description: "$1,117 credit per qualifying child under age 6", maxAmount: 1117, eligibility: "Child under 6, income limit applies" },
        { name: "Renters Credit", description: "Nonrefundable credit for renters who paid rent for principal residence", maxAmount: 120, eligibility: "Income under $50,746 single / $101,492 MFJ" },
      ],
      NY: [
        { name: "New York Earned Income Credit", description: "30% of federal EITC, refundable", maxAmount: 2800, eligibility: "Based on federal EITC eligibility" },
        { name: "Child and Dependent Care Credit", description: "20–110% of federal credit depending on income", maxAmount: 2310, eligibility: "Working parents with qualifying care expenses" },
        { name: "College Tuition Credit", description: "$400 credit per eligible student (or deduction option)", maxAmount: 400, eligibility: "Tuition at qualifying NY college" },
      ],
      OR: [
        { name: "Oregon Earned Income Credit", description: "9% of federal EITC, refundable", maxAmount: 600, eligibility: "Based on federal EITC eligibility" },
        { name: "Oregon Kids Credit", description: "Credit for qualifying children under 5", maxAmount: 1000, eligibility: "Children under 5, income limit applies" },
      ],
      MN: [
        { name: "Minnesota Working Family Credit", description: "Refundable credit for lower-income workers", maxAmount: 1070, eligibility: "Income under $59,913" },
        { name: "K-12 Education Credit", description: "Credit for qualifying K-12 education expenses", maxAmount: 1000, eligibility: "Income under $76,000" },
      ],
      MD: [
        { name: "Maryland Earned Income Credit", description: "50% of federal EITC, partially refundable", maxAmount: 3200, eligibility: "Based on federal EITC eligibility" },
        { name: "Child and Dependent Care Credit", description: "Up to 32.5% of federal credit", maxAmount: 1300, eligibility: "Working parents with care expenses" },
      ],
      MA: [
        { name: "Earned Income Credit", description: "30% of federal EITC, refundable", maxAmount: 2700, eligibility: "Based on federal EITC eligibility" },
        { name: "Child Care Expenses Credit", description: "Credit for a portion of child care costs", maxAmount: 240, eligibility: "Qualifying child care expenses paid" },
      ],
      NJ: [
        { name: "New Jersey Earned Income Tax Credit", description: "40% of federal EITC, refundable", maxAmount: 3200, eligibility: "Based on federal EITC eligibility" },
        { name: "Child and Dependent Care Credit", description: "Credit for child and dependent care costs", maxAmount: 500, eligibility: "Income under $150,000" },
      ],
      IL: [
        { name: "Illinois Earned Income Credit", description: "20% of federal EITC, refundable", maxAmount: 1500, eligibility: "Based on federal EITC eligibility" },
        { name: "Property Tax Credit", description: "5% of Illinois property tax paid", maxAmount: 750, eligibility: "Illinois homeowners" },
      ],
      CO: [
        { name: "Colorado Earned Income Tax Credit", description: "38% of federal EITC for 2024, refundable", maxAmount: 3000, eligibility: "Based on federal EITC eligibility" },
        { name: "Child Care Expenses Credit", description: "Credit for a portion of child care costs", maxAmount: 500, eligibility: "Qualifying child care expenses" },
      ],
      VA: [
        { name: "Virginia Earned Income Credit", description: "15% of federal EITC, refundable", maxAmount: 1200, eligibility: "Based on federal EITC eligibility" },
      ],
      WI: [
        { name: "Wisconsin Earned Income Credit", description: "4–11% of federal EITC depending on children", maxAmount: 600, eligibility: "Based on federal EITC eligibility" },
      ],
    };

    return deductions[state.toUpperCase()] ?? [];
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private calculateStateIncome(form1040: Form1040, _state: string): number {
    // Most states start with federal AGI; override per-state as needed.
    return parseFloat(form1040.totalIncome ?? "0");
  }

  private calculateTaxFromBrackets(
    taxableIncome: number,
    brackets: TaxBracket[]
  ): number {
    if (brackets.length === 0) return 0;

    let tax = 0;
    for (const bracket of brackets) {
      if (taxableIncome <= bracket.min) break;
      const ceiling = bracket.max === Infinity ? taxableIncome : Math.min(taxableIncome, bracket.max);
      tax += (ceiling - bracket.min) * bracket.rate;
    }
    return Math.round(tax * 100) / 100;
  }

  private getMarginalRate(
    taxableIncome: number,
    brackets: TaxBracket[]
  ): number {
    if (brackets.length === 0) return 0;
    for (const bracket of brackets) {
      if (taxableIncome >= bracket.min && taxableIncome <= bracket.max) {
        return bracket.rate;
      }
    }
    return brackets[brackets.length - 1]?.rate ?? 0;
  }

  private getStateStandardDeduction(state: string, filingStatus: string): number {
    const deductions = this.stateStandardDeductions[state];
    if (!deductions) return 0;
    return deductions[filingStatus] ?? deductions.single ?? 0;
  }

  private calculateStateWithheld(taxReturn: TaxReturn, state: string): number {
    const federalWithheld = parseFloat(taxReturn.withheld ?? "0");

    // Approximate state withholding rates as a fraction of federal withholding
    const withholdingFractions: Record<string, number> = {
      CA: 0.055, NY: 0.065, IL: 0.05,  PA: 0.03,  OH: 0.04,
      GA: 0.055, NC: 0.045, MI: 0.043, NJ: 0.064, VA: 0.058,
      AZ: 0.025, MA: 0.05,  IN: 0.032, MO: 0.048, MD: 0.058,
      WI: 0.053, MN: 0.068, CO: 0.044, AL: 0.05,  SC: 0.064,
      LA: 0.043, KY: 0.04,  OR: 0.09,  OK: 0.048, CT: 0.063,
      IA: 0.057, MS: 0.047, AR: 0.047, KS: 0.057, UT: 0.047,
      NM: 0.049, NE: 0.066, WV: 0.065, ID: 0.058, HI: 0.083,
      ME: 0.072, RI: 0.06,  MT: 0.059, DE: 0.066, ND: 0.029,
      VT: 0.077, DC: 0.085,
    };

    return Math.round(federalWithheld * (withholdingFractions[state] ?? 0.05) * 100) / 100;
  }

  private buildZeroTaxResult(state: string): StateTaxCalculation {
    return {
      state,
      stateIncome: 0,
      stateTax: 0,
      stateWithheld: 0,
      stateRefundOrOwed: 0,
      effectiveRate: 0,
      marginalRate: 0,
    };
  }

  private getFilingDeadline(state: string): string {
    const exceptions: Record<string, string> = {
      DE: "April 30th",
      IA: "April 30th",
      VA: "May 1st",
      HI: "April 20th",
    };
    return exceptions[state] ?? "April 15th";
  }

  /**
   * Calculate state-specific credits (simplified estimate).
   */
  calculateStateCredits(
    state: string,
    income: number,
    _filingStatus: string,
    dependents: number = 0
  ): number {
    const deductions = this.getStateDeductions(state);
    let totalCredits = 0;

    for (const deduction of deductions) {
      if (deduction.name.includes("Earned Income")) {
        if (income < 60000) {
          totalCredits += Math.min(deduction.maxAmount, income * 0.05);
        }
      } else if (deduction.name.includes("Child") || deduction.name.includes("Kid")) {
        totalCredits += deduction.maxAmount * Math.max(dependents, 0);
      } else if (deduction.name.includes("Renter")) {
        totalCredits += deduction.maxAmount;
      }
    }

    return Math.round(totalCredits * 100) / 100;
  }

  /**
   * Get state filing deadlines map.
   */
  getStateDeadlines(): Record<string, string> {
    const deadlines: Record<string, string> = {};
    for (const state of this.getSupportedStates()) {
      if (NO_INCOME_TAX_STATES.has(state)) {
        deadlines[state] = "N/A (no state income tax)";
      } else {
        deadlines[state] = this.getFilingDeadline(state);
      }
    }
    return deadlines;
  }
}

// Export singleton instance
export const stateTaxService = new StateTaxService();
