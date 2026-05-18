// Tax Planning Service — uses 2024 tax rules

export interface QuarterlyEstimateResult {
  annualTaxOwed: number;
  safeHarborAmount: number;
  expectedWithholding: number;
  totalEstimatedPayments: number;
  perQuarterPayment: number;
  dueDates: Array<{ quarter: string; dueDate: string; amount: number }>;
  underpaymentRisk: boolean;
}

export interface W4Recommendation {
  currentAnnualWithholding: number;
  recommendedAnnualWithholding: number;
  additionalWithholdingPerPeriod: number;
  payPeriods: number;
  estimatedRefund: number;
  filingStatus: string;
  notes: string[];
}

export interface RetirementAnalysis {
  maxTraditional401k: number;
  maxIra: number;
  maxSepIra: number;
  currentContributions: number;
  remainingCapacity401k: number;
  remainingCapacityIra: number;
  remainingCapacitySepIra: number;
  estimatedTaxSavings: number;
  recommendations: string[];
}

export interface HarvestingOpportunity {
  description: string;
  currentValue: number;
  costBasis: number;
  unrealizedLoss: number;
  isShortTerm: boolean;
  estimatedTaxSaving: number;
  washSaleRisk: boolean;
  recommendation: string;
}

// 2024 Federal Income Tax Brackets
const TAX_BRACKETS_2024: Record<string, Array<{ min: number; max: number; rate: number }>> = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  married_filing_jointly: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  married_filing_separately: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 365600, rate: 0.35 },
    { min: 365600, max: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { min: 0, max: 16550, rate: 0.10 },
    { min: 16550, max: 63100, rate: 0.12 },
    { min: 63100, max: 100500, rate: 0.22 },
    { min: 100500, max: 191950, rate: 0.24 },
    { min: 191950, max: 243700, rate: 0.32 },
    { min: 243700, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
};

// 2024 Standard Deductions
const STANDARD_DEDUCTIONS_2024: Record<string, number> = {
  single: 14600,
  married_filing_jointly: 29200,
  married_filing_separately: 14600,
  head_of_household: 21900,
};

// 2024 SE Tax rate (15.3% on first $168,600, 2.9% on excess)
const SE_TAX_RATE = 0.153;
const SE_TAX_WAGE_BASE = 168600;
const MEDICARE_RATE_EXCESS = 0.029;

// 2024 Retirement limits
const LIMIT_401K_2024 = 23000;
const LIMIT_IRA_2024 = 7000;
const CATCHUP_IRA = 1000; // age 50+
const CATCHUP_401K = 7500; // age 50+
const SEP_IRA_RATE = 0.25; // 25% of net SE income
const SEP_IRA_MAX = 69000;

function normalizeFilingStatus(status: string): string {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  if (normalized in TAX_BRACKETS_2024) return normalized;
  // Common aliases
  if (normalized === "mfj" || normalized === "married") return "married_filing_jointly";
  if (normalized === "mfs") return "married_filing_separately";
  if (normalized === "hoh") return "head_of_household";
  return "single";
}

function calculateFederalTax(taxableIncome: number, filingStatus: string): number {
  const brackets = TAX_BRACKETS_2024[filingStatus] ?? TAX_BRACKETS_2024.single;
  let tax = 0;
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.min) break;
    const taxable = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxable * bracket.rate;
  }
  return Math.max(0, tax);
}

function calculateSETax(seIncome: number): number {
  if (seIncome <= 0) return 0;
  // SE income is reduced by 50% of SE tax for income calculation
  const netSe = seIncome * 0.9235; // SE tax base
  let seTax = 0;
  if (netSe <= SE_TAX_WAGE_BASE) {
    seTax = netSe * SE_TAX_RATE;
  } else {
    seTax = SE_TAX_WAGE_BASE * SE_TAX_RATE + (netSe - SE_TAX_WAGE_BASE) * MEDICARE_RATE_EXCESS;
  }
  return seTax;
}

function getMarginalRate(taxableIncome: number, filingStatus: string): number {
  const brackets = TAX_BRACKETS_2024[filingStatus] ?? TAX_BRACKETS_2024.single;
  for (const bracket of brackets) {
    if (taxableIncome < bracket.max) return bracket.rate;
  }
  return 0.37;
}

export class TaxPlanningService {
  calculateQuarterlyEstimates(params: {
    estimatedAnnualIncome: number;
    filingStatus: string;
    priorYearTax: number;
    expectedWithholding: number;
    selfEmploymentIncome?: number;
    capitalGains?: number;
  }): QuarterlyEstimateResult {
    const {
      estimatedAnnualIncome,
      priorYearTax,
      expectedWithholding,
      selfEmploymentIncome = 0,
      capitalGains = 0,
    } = params;

    const fs = normalizeFilingStatus(params.filingStatus);
    const standardDeduction = STANDARD_DEDUCTIONS_2024[fs] ?? STANDARD_DEDUCTIONS_2024.single;

    // Calculate SE tax deduction (50% of SE tax is deductible)
    const seTax = calculateSETax(selfEmploymentIncome);
    const seDeduction = seTax / 2;

    // Taxable income
    const totalIncome = estimatedAnnualIncome + capitalGains;
    const taxableIncome = Math.max(0, totalIncome - standardDeduction - seDeduction);

    // Federal income tax + SE tax
    const incomeTax = calculateFederalTax(taxableIncome, fs);
    const annualTaxOwed = incomeTax + seTax;

    // Safe harbor: 100% of prior year tax (110% if prior AGI > $150K)
    const higherIncomeThreshold = 150000;
    const safeHarborRate = priorYearTax > 0 && estimatedAnnualIncome > higherIncomeThreshold ? 1.10 : 1.00;
    const priorYearSafeHarbor = priorYearTax * safeHarborRate;
    const currentYearSafeHarbor = annualTaxOwed * 0.90;
    const safeHarborAmount = Math.min(priorYearSafeHarbor, currentYearSafeHarbor);

    // Estimated payments needed beyond withholding
    const totalEstimatedPayments = Math.max(0, safeHarborAmount - expectedWithholding);
    const perQuarterPayment = totalEstimatedPayments / 4;

    // 2024 quarterly due dates
    const dueDates = [
      { quarter: "Q1 (Jan–Mar)", dueDate: "2024-04-15", amount: perQuarterPayment },
      { quarter: "Q2 (Apr–May)", dueDate: "2024-06-17", amount: perQuarterPayment },
      { quarter: "Q3 (Jun–Aug)", dueDate: "2024-09-16", amount: perQuarterPayment },
      { quarter: "Q4 (Sep–Dec)", dueDate: "2025-01-15", amount: perQuarterPayment },
    ];

    const underpaymentRisk = totalEstimatedPayments > 1000 && expectedWithholding < safeHarborAmount;

    return {
      annualTaxOwed,
      safeHarborAmount,
      expectedWithholding,
      totalEstimatedPayments,
      perQuarterPayment,
      dueDates,
      underpaymentRisk,
    };
  }

  optimizeW4(params: {
    wages: number;
    filingStatus: string;
    dependents: number;
    currentWithholding: number;
    targetRefund: number;
    otherIncome?: number;
    deductions?: number;
  }): W4Recommendation {
    const {
      wages,
      dependents,
      currentWithholding,
      targetRefund,
      otherIncome = 0,
      deductions = 0,
    } = params;

    const fs = normalizeFilingStatus(params.filingStatus);
    const standardDeduction = STANDARD_DEDUCTIONS_2024[fs] ?? STANDARD_DEDUCTIONS_2024.single;

    // Child tax credit: $2,000 per qualifying child (simplified)
    const childTaxCredit = dependents * 2000;

    const totalIncome = wages + otherIncome;
    const itemizedDeductions = deductions > standardDeduction ? deductions : standardDeduction;
    const taxableIncome = Math.max(0, totalIncome - itemizedDeductions);
    const estimatedTax = Math.max(0, calculateFederalTax(taxableIncome, fs) - childTaxCredit);

    // Withholding needed to achieve target refund
    const recommendedAnnualWithholding = estimatedTax + targetRefund;
    const additionalAnnual = recommendedAnnualWithholding - currentWithholding;

    // Assume 26 bi-weekly pay periods as default
    const payPeriods = 26;
    const additionalWithholdingPerPeriod = Math.max(0, additionalAnnual / payPeriods);
    const estimatedRefund = currentWithholding - estimatedTax;

    const notes: string[] = [];
    if (currentWithholding < estimatedTax) {
      notes.push(`You may owe $${Math.round(estimatedTax - currentWithholding).toLocaleString()} at filing. Consider increasing withholding.`);
    }
    if (otherIncome > 0) {
      notes.push("Other income is not subject to withholding — consider quarterly estimated payments.");
    }
    if (deductions > standardDeduction) {
      notes.push("You are using itemized deductions. Verify with a tax professional.");
    }
    if (childTaxCredit > 0) {
      notes.push(`Child tax credit of $${childTaxCredit.toLocaleString()} applied (up to $2,000 per qualifying child).`);
    }

    return {
      currentAnnualWithholding: currentWithholding,
      recommendedAnnualWithholding,
      additionalWithholdingPerPeriod,
      payPeriods,
      estimatedRefund,
      filingStatus: fs,
      notes,
    };
  }

  retirementContributionAnalysis(params: {
    agi: number;
    filingStatus: string;
    age: number;
    currentContributions: number;
    selfEmployed?: boolean;
  }): RetirementAnalysis {
    const { agi, age, currentContributions, selfEmployed = false } = params;
    const fs = normalizeFilingStatus(params.filingStatus);

    const catchUp50 = age >= 50;

    // 401k limits
    const max401k = LIMIT_401K_2024 + (catchUp50 ? CATCHUP_401K : 0);

    // IRA limits
    const maxIra = LIMIT_IRA_2024 + (catchUp50 ? CATCHUP_IRA : 0);

    // SEP-IRA: 25% of net SE income, max $69,000 (only for self-employed)
    let maxSepIra = 0;
    if (selfEmployed) {
      const netSe = agi * 0.9235; // approximate net SE income
      maxSepIra = Math.min(Math.floor(netSe * SEP_IRA_RATE), SEP_IRA_MAX);
    }

    const remaining401k = Math.max(0, max401k - currentContributions);
    const remainingIra = Math.max(0, maxIra);
    const remainingSepIra = Math.max(0, maxSepIra - currentContributions);

    // Estimate tax savings at marginal rate
    const standardDeduction = STANDARD_DEDUCTIONS_2024[fs] ?? STANDARD_DEDUCTIONS_2024.single;
    const taxableIncome = Math.max(0, agi - standardDeduction);
    const marginalRate = getMarginalRate(taxableIncome, fs);
    const additionalContributionRoom = remaining401k + remainingIra;
    const estimatedTaxSavings = additionalContributionRoom * marginalRate;

    const recommendations: string[] = [];

    if (remaining401k > 0) {
      recommendations.push(
        `Maximize 401(k) contributions — you can contribute up to $${remaining401k.toLocaleString()} more this year.`
      );
    }
    if (remainingIra > 0) {
      recommendations.push(
        `Consider contributing to a Traditional or Roth IRA — up to $${maxIra.toLocaleString()} for ${new Date().getFullYear()}.`
      );
    }
    if (selfEmployed && remainingSepIra > 0) {
      recommendations.push(
        `As a self-employed individual, you can contribute up to $${remainingSepIra.toLocaleString()} to a SEP-IRA.`
      );
    }
    if (catchUp50) {
      recommendations.push("As you are age 50+, you are eligible for catch-up contributions.");
    }
    if (estimatedTaxSavings > 0) {
      recommendations.push(
        `Maximizing tax-advantaged retirement contributions could save approximately $${Math.round(estimatedTaxSavings).toLocaleString()} in federal taxes.`
      );
    }

    return {
      maxTraditional401k: max401k,
      maxIra,
      maxSepIra,
      currentContributions,
      remainingCapacity401k: remaining401k,
      remainingCapacityIra: remainingIra,
      remainingCapacitySepIra: remainingSepIra,
      estimatedTaxSavings,
      recommendations,
    };
  }

  taxLossHarvestingOpportunities(entries: Array<{
    description: string;
    costBasis: number;
    currentValue: number;
    isShortTerm: boolean;
    washSale: boolean;
  }>): HarvestingOpportunity[] {
    return entries
      .filter((entry) => entry.currentValue < entry.costBasis && !entry.washSale)
      .map((entry) => {
        const unrealizedLoss = entry.costBasis - entry.currentValue;

        // Short-term losses offset ordinary income (up to $3,000/yr) or other gains
        // Long-term losses offset capital gains at lower rates
        // Simplified: assume 37% rate for short-term, 20% for long-term
        const taxRate = entry.isShortTerm ? 0.37 : 0.20;
        const estimatedTaxSaving = unrealizedLoss * taxRate;

        const recommendation = [
          `Consider selling to realize $${Math.round(unrealizedLoss).toLocaleString()} ${entry.isShortTerm ? "short-term" : "long-term"} loss.`,
          `Estimated tax savings: $${Math.round(estimatedTaxSaving).toLocaleString()}.`,
          "Wait 31 days before repurchasing the same or substantially identical security to avoid wash sale rules.",
          unrealizedLoss > 3000
            ? `Losses exceeding $3,000 ($${Math.round(unrealizedLoss - 3000).toLocaleString()}) will carry forward to future tax years.`
            : "This loss can be applied in full against gains or ordinary income (up to $3,000).",
        ].join(" ");

        return {
          description: entry.description,
          currentValue: entry.currentValue,
          costBasis: entry.costBasis,
          unrealizedLoss,
          isShortTerm: entry.isShortTerm,
          estimatedTaxSaving,
          washSaleRisk: false, // already filtered wash sales out above
          recommendation,
        };
      })
      .sort((a, b) => b.unrealizedLoss - a.unrealizedLoss); // highest losses first
  }
}

export const taxPlanningService = new TaxPlanningService();
