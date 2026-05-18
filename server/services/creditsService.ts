/**
 * creditsService.ts
 *
 * Calculates major federal tax credits and adjustments for 2024.
 * All figures use 2024 IRS published values.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditCalculationParams {
  agi: number;
  filingStatus: string;          // 'single' | 'married_joint' | 'married_separate' | 'head_of_household'
  qualifyingChildren: number;    // total qualifying children (for CTC)
  childrenUnder17: number;       // children under 17 (for refundable CTC portion)
  numEITCChildren: number;       // qualifying children for EITC
  wages: number;                 // earned wages / salaries
  careExpenses: number;          // qualifying child & dependent care expenses paid
  numQualifyingPersons: number;  // # of qualifying persons for child care credit
  qualifiedEducationExpenses: number;
  educationCreditType: 'aotc' | 'llc';
  retirementContributions: number;
  amtPreferences: number;        // AMT preference items (ISO spreads, etc.)
  netSEIncome: number;           // net self-employment income
  taxableIncome: number;         // for AMT calculation
  itemizedDeductions: number;    // claimed itemized deductions
}

export interface CreditResults {
  childTaxCredit: number;
  additionalChildTaxCredit: number;   // refundable portion
  eitcCredit: number;
  childCareCredit: number;
  educationCredit: number;
  saverCredit: number;
  altMinimumTax: number;
  selfEmploymentTax: number;
  selfEmploymentTaxDeduction: number; // deductible half of SE tax
  totalNonRefundableCredits: number;
  totalRefundableCredits: number;
  totalCredits: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Clamp a value between a minimum and maximum. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Phase-out reduction: reduces the base amount linearly over a phase-out range. */
function phaseOut(
  baseAmount: number,
  agi: number,
  phaseOutStart: number,
  phaseOutRate: number  // reduction per dollar over threshold (e.g. 0.05 = 5 cents per dollar)
): number {
  if (agi <= phaseOutStart) return baseAmount;
  const reduction = Math.floor((agi - phaseOutStart) / 1) * phaseOutRate;
  return Math.max(0, baseAmount - reduction);
}

// ---------------------------------------------------------------------------
// 2024 EITC Tables (IRS Rev. Proc. 2023-34)
// ---------------------------------------------------------------------------

interface EITCRule {
  maxCredit: number;
  singlePhaseOutStart: number;
  singlePhaseOutEnd: number;
  mfjPhaseOutStart: number;
  mfjPhaseOutEnd: number;
  minEarnedIncome: number;
}

const EITC_2024: Record<number, EITCRule> = {
  0: { maxCredit: 632,   singlePhaseOutStart: 9525,  singlePhaseOutEnd: 18591, mfjPhaseOutStart: 16810, mfjPhaseOutEnd: 25511, minEarnedIncome: 0 },
  1: { maxCredit: 4213,  singlePhaseOutStart: 21115, singlePhaseOutEnd: 49084, mfjPhaseOutStart: 27638, mfjPhaseOutEnd: 56004, minEarnedIncome: 0 },
  2: { maxCredit: 6960,  singlePhaseOutStart: 21115, singlePhaseOutEnd: 55768, mfjPhaseOutStart: 27638, mfjPhaseOutEnd: 62688, minEarnedIncome: 0 },
  3: { maxCredit: 7830,  singlePhaseOutStart: 21115, singlePhaseOutEnd: 59899, mfjPhaseOutStart: 27638, mfjPhaseOutEnd: 66819, minEarnedIncome: 0 },
};

// Maximum investment income for EITC (2024)
const EITC_MAX_INVESTMENT_INCOME = 11600;

// ---------------------------------------------------------------------------
// 2024 AMT exemptions and phase-out amounts
// ---------------------------------------------------------------------------

interface AMTExemption {
  exemption: number;
  phaseOutStart: number;
}

const AMT_2024: Record<string, AMTExemption> = {
  single:           { exemption: 85700,  phaseOutStart: 609350 },
  married_joint:    { exemption: 133300, phaseOutStart: 1218700 },
  married_separate: { exemption: 66650,  phaseOutStart: 609350 },
  head_of_household:{ exemption: 85700,  phaseOutStart: 609350 },
};

// ---------------------------------------------------------------------------
// 2024 Saver's Credit thresholds
// ---------------------------------------------------------------------------

interface SaverThreshold {
  rate50: number;  // AGI ceiling for 50% credit rate
  rate20: number;  // AGI ceiling for 20% credit rate
  rate10: number;  // AGI ceiling for 10% credit rate
}

const SAVERS_2024: Record<string, SaverThreshold> = {
  married_joint:     { rate50: 46500,  rate20: 50750,  rate10: 76500  },
  head_of_household: { rate50: 34875,  rate20: 38063,  rate10: 57375  },
  single:            { rate50: 23250,  rate20: 25375,  rate10: 38250  },
  married_separate:  { rate50: 23250,  rate20: 25375,  rate10: 38250  },
};

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class CreditsService {

  // -------------------------------------------------------------------------
  // Child Tax Credit (CTC) – 2024
  // $2,000 per qualifying child under 17
  // Phase-out: $200K single, $400K MFJ (reduction of $50 per $1,000 over threshold)
  // Refundable ACTC: 15% of earned income over $2,500, up to $1,700 per child
  // -------------------------------------------------------------------------
  calculateChildTaxCredit(
    agi: number,
    filingStatus: string,
    qualifyingChildren: number,
    childrenUnder17: number
  ): number {
    if (childrenUnder17 <= 0) return 0;

    const baseCredit = 2000 * childrenUnder17;

    const phaseOutThreshold = filingStatus === 'married_joint' ? 400000 : 200000;
    const excess = Math.max(0, agi - phaseOutThreshold);
    // $50 reduction for each $1,000 (or fraction) over threshold
    const reduction = Math.ceil(excess / 1000) * 50;
    const nonRefundable = Math.max(0, baseCredit - reduction);

    return Math.round(nonRefundable * 100) / 100;
  }

  /**
   * Additional (refundable) Child Tax Credit.
   * 15% of earned income over $2,500, limited to $1,700 per qualifying child under 17.
   */
  calculateAdditionalChildTaxCredit(
    wages: number,
    childrenUnder17: number,
    nonRefundableCTC: number,
    ctcBeforePhaseOut: number
  ): number {
    if (childrenUnder17 <= 0) return 0;

    const maxRefundable = 1700 * childrenUnder17;
    const unusedCTC = Math.max(0, ctcBeforePhaseOut - nonRefundableCTC);
    const earnedIncomeBase = Math.max(0, wages - 2500) * 0.15;

    return Math.round(Math.min(unusedCTC, Math.min(earnedIncomeBase, maxRefundable)) * 100) / 100;
  }

  // -------------------------------------------------------------------------
  // Earned Income Tax Credit (EITC) – 2024
  // -------------------------------------------------------------------------
  calculateEITC(
    agi: number,
    filingStatus: string,
    numChildren: number,
    wages: number
  ): number {
    const children = clamp(numChildren, 0, 3);
    const rule = EITC_2024[children];
    if (!rule) return 0;

    // Must have earned income; investment income limit
    if (wages <= 0) return 0;

    // Determine effective income: use higher of wages or AGI only if consistent
    // IRS uses the GREATER of earned income or AGI for phase-out evaluation
    const effectiveIncome = Math.max(wages, agi);

    const isMFJ = filingStatus === 'married_joint';
    const phaseOutStart = isMFJ ? rule.mfjPhaseOutStart : rule.singlePhaseOutStart;
    const phaseOutEnd   = isMFJ ? rule.mfjPhaseOutEnd   : rule.singlePhaseOutEnd;

    if (effectiveIncome >= phaseOutEnd) return 0;

    // Build-up phase: credit grows with earned income up to max
    // Phase-out: credit decreases above phaseOutStart
    const credit = effectiveIncome <= phaseOutStart
      ? rule.maxCredit                                     // simplified: at/below start, full credit
      : rule.maxCredit * (1 - (effectiveIncome - phaseOutStart) / (phaseOutEnd - phaseOutStart));

    return Math.round(Math.max(0, credit) * 100) / 100;
  }

  // -------------------------------------------------------------------------
  // Child and Dependent Care Credit – 2024
  // 20-35% of up to $3,000 (1 person) / $6,000 (2+ persons)
  // Phase-out of the higher rate: credit percentage phases from 35% down to 20%
  //   as AGI rises from $15,000 to $43,000
  // -------------------------------------------------------------------------
  calculateChildCareCredit(
    agi: number,
    careExpenses: number,
    numQualifyingPersons: number
  ): number {
    if (numQualifyingPersons <= 0 || careExpenses <= 0) return 0;

    const expenseCap = numQualifyingPersons === 1 ? 3000 : 6000;
    const eligibleExpenses = Math.min(careExpenses, expenseCap);

    // Credit percentage: 35% minus 1% for each $2,000 (or fraction) of AGI over $15,000
    // Floor is 20%
    const excessOver15K = Math.max(0, agi - 15000);
    const reductionSteps = Math.ceil(excessOver15K / 2000);
    const creditRate = Math.max(0.20, 0.35 - reductionSteps * 0.01);

    return Math.round(eligibleExpenses * creditRate * 100) / 100;
  }

  // -------------------------------------------------------------------------
  // Education Credits – 2024
  // AOTC: 100% of first $2,000 + 25% of next $2,000 = max $2,500
  //   Phase-out: $80K–$90K single, $160K–$180K MFJ
  // LLC: 20% of up to $10,000 = max $2,000
  //   Phase-out: $80K–$90K single, $160K–$180K MFJ
  // -------------------------------------------------------------------------
  calculateEducationCredit(
    agi: number,
    filingStatus: string,
    qualifiedExpenses: number,
    creditType: 'aotc' | 'llc'
  ): number {
    if (qualifiedExpenses <= 0) return 0;

    const isMFJ = filingStatus === 'married_joint';

    if (creditType === 'aotc') {
      const phaseOutStart = isMFJ ? 160000 : 80000;
      const phaseOutEnd   = isMFJ ? 180000 : 90000;

      if (agi >= phaseOutEnd) return 0;

      const maxCredit = Math.min(qualifiedExpenses, 2000) + Math.min(Math.max(0, qualifiedExpenses - 2000), 2000) * 0.25;
      // max possible = $2,500

      if (agi <= phaseOutStart) return Math.round(Math.min(maxCredit, 2500) * 100) / 100;

      const phaseFraction = 1 - (agi - phaseOutStart) / (phaseOutEnd - phaseOutStart);
      return Math.round(Math.min(maxCredit, 2500) * phaseFraction * 100) / 100;

    } else {
      // LLC
      const phaseOutStart = isMFJ ? 160000 : 80000;
      const phaseOutEnd   = isMFJ ? 180000 : 90000;

      if (agi >= phaseOutEnd) return 0;

      const maxCredit = Math.min(qualifiedExpenses, 10000) * 0.20; // max $2,000

      if (agi <= phaseOutStart) return Math.round(maxCredit * 100) / 100;

      const phaseFraction = 1 - (agi - phaseOutStart) / (phaseOutEnd - phaseOutStart);
      return Math.round(maxCredit * phaseFraction * 100) / 100;
    }
  }

  // -------------------------------------------------------------------------
  // Saver's Credit – 2024
  // 10%, 20%, or 50% of up to $2,000 in retirement contributions
  // -------------------------------------------------------------------------
  calculateSaversCredit(
    agi: number,
    filingStatus: string,
    retirementContributions: number
  ): number {
    if (retirementContributions <= 0) return 0;

    const thresholds = SAVERS_2024[filingStatus] ?? SAVERS_2024.single;
    const eligible = Math.min(retirementContributions, 2000);

    let rate = 0;
    if (agi <= thresholds.rate50) {
      rate = 0.50;
    } else if (agi <= thresholds.rate20) {
      rate = 0.20;
    } else if (agi <= thresholds.rate10) {
      rate = 0.10;
    }

    return Math.round(eligible * rate * 100) / 100;
  }

  // -------------------------------------------------------------------------
  // Alternative Minimum Tax (AMT) – 2024
  // Exemption: $85,700 single / $133,300 MFJ
  // Phase-out of exemption: 25 cents per dollar over $609,350 single / $1,218,700 MFJ
  // AMT rates: 26% up to $116,300 AMTI; 28% above
  // -------------------------------------------------------------------------
  calculateAMT(
    taxableIncome: number,
    filingStatus: string,
    preferences: number
  ): number {
    const config = AMT_2024[filingStatus] ?? AMT_2024.single;

    // AMTI = taxable income + preference items
    const amti = taxableIncome + preferences;

    // Phase-out of exemption: 25 cents per dollar over threshold
    const excessOverThreshold = Math.max(0, amti - config.phaseOutStart);
    const exemptionReduction = excessOverThreshold * 0.25;
    const exemption = Math.max(0, config.exemption - exemptionReduction);

    const amtBase = Math.max(0, amti - exemption);

    // 26% on first $116,300; 28% above
    const amtBracketBreak = 116300;
    let amtTax: number;
    if (amtBase <= amtBracketBreak) {
      amtTax = amtBase * 0.26;
    } else {
      amtTax = amtBracketBreak * 0.26 + (amtBase - amtBracketBreak) * 0.28;
    }

    return Math.round(amtTax * 100) / 100;
  }

  // -------------------------------------------------------------------------
  // Self-Employment Tax – 2024
  // 15.3% on net SE income up to the Social Security wage base ($168,600)
  //   - SS: 12.4% on first $168,600
  //   - Medicare: 2.9% on all net SE income
  // Additional Medicare: 0.9% on net SE income over $200K single / $250K MFJ
  // Half of SE tax is deductible from gross income
  // -------------------------------------------------------------------------
  calculateSelfEmploymentTax(netSEIncome: number): { seTax: number; deductibleHalf: number } {
    if (netSEIncome <= 0) return { seTax: 0, deductibleHalf: 0 };

    // SE income is reduced by 7.65% for computing tax (equivalent of employer share)
    const seBase = netSEIncome * 0.9235;

    const ssWageBase = 168600;
    const ssTax = Math.min(seBase, ssWageBase) * 0.124;
    const medicareTax = seBase * 0.029;

    const seTax = Math.round((ssTax + medicareTax) * 100) / 100;
    const deductibleHalf = Math.round(seTax * 0.5 * 100) / 100;

    return { seTax, deductibleHalf };
  }

  // -------------------------------------------------------------------------
  // Calculate all credits at once
  // -------------------------------------------------------------------------
  calculateAllCredits(params: CreditCalculationParams): CreditResults {
    const {
      agi,
      filingStatus,
      qualifyingChildren,
      childrenUnder17,
      numEITCChildren,
      wages,
      careExpenses,
      numQualifyingPersons,
      qualifiedEducationExpenses,
      educationCreditType,
      retirementContributions,
      amtPreferences,
      netSEIncome,
      taxableIncome,
    } = params;

    // Child Tax Credit
    const ctcBase = 2000 * Math.max(0, childrenUnder17);
    const childTaxCredit = this.calculateChildTaxCredit(agi, filingStatus, qualifyingChildren, childrenUnder17);
    const additionalChildTaxCredit = this.calculateAdditionalChildTaxCredit(wages, childrenUnder17, childTaxCredit, ctcBase);

    // EITC
    const eitcCredit = this.calculateEITC(agi, filingStatus, numEITCChildren, wages);

    // Child & Dependent Care
    const childCareCredit = this.calculateChildCareCredit(agi, careExpenses, numQualifyingPersons);

    // Education
    const educationCredit = this.calculateEducationCredit(agi, filingStatus, qualifiedEducationExpenses, educationCreditType);

    // Saver's Credit
    const saverCredit = this.calculateSaversCredit(agi, filingStatus, retirementContributions);

    // AMT
    const altMinimumTax = this.calculateAMT(taxableIncome, filingStatus, amtPreferences);

    // SE Tax
    const { seTax: selfEmploymentTax, deductibleHalf: selfEmploymentTaxDeduction } =
      this.calculateSelfEmploymentTax(netSEIncome);

    // Aggregate
    const totalNonRefundableCredits = childTaxCredit + childCareCredit + educationCredit + saverCredit;
    const totalRefundableCredits = additionalChildTaxCredit + eitcCredit;
    const totalCredits = totalNonRefundableCredits + totalRefundableCredits;

    return {
      childTaxCredit,
      additionalChildTaxCredit,
      eitcCredit,
      childCareCredit,
      educationCredit,
      saverCredit,
      altMinimumTax,
      selfEmploymentTax,
      selfEmploymentTaxDeduction,
      totalNonRefundableCredits: Math.round(totalNonRefundableCredits * 100) / 100,
      totalRefundableCredits: Math.round(totalRefundableCredits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
    };
  }
}

export const creditsService = new CreditsService();
