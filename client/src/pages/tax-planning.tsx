import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  AlertTriangle,
  Calendar,
  TrendingUp,
  DollarSign,
  PiggyBank,
  BarChart2,
  CheckCircle2,
  Info,
} from "lucide-react";

interface TaxPlanningSummary {
  quarterlyPayments?: {
    q1Amount?: number;
    q2Amount?: number;
    q3Amount?: number;
    q4Amount?: number;
    currentQuarter?: number;
    behind?: boolean;
  };
  annualIncome?: number;
  estimatedTax?: number;
}

interface BrokerageEntry {
  id: string;
  description?: string;
  proceeds?: string;
  costBasis?: string;
  currentValue?: string;
}

const QUARTERS = [
  { label: "Q1", due: "April 15, 2025", key: "q1Amount" as const },
  { label: "Q2", due: "June 16, 2025", key: "q2Amount" as const },
  { label: "Q3", due: "September 15, 2025", key: "q3Amount" as const },
  { label: "Q4", due: "January 15, 2026", key: "q4Amount" as const },
];

const LIMIT_401K = 23000;
const LIMIT_IRA = 7000;

const fmt = (n: number): string =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtD = (n: number): string =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TaxPlanningPage() {
  const { toast: _toast } = useToast();

  // W-4 Withholding optimizer state
  const [currentWithholding, setCurrentWithholding] = useState("");
  const [targetRefund, setTargetRefund] = useState<number[]>([0]);

  // Retirement tracker state
  const [contrib401k, setContrib401k] = useState("");
  const [contribIra, setContribIra] = useState("");

  // Current value overrides for tax-loss harvesting
  const [currentValues, setCurrentValues] = useState<Record<string, string>>({});

  const { data: summary, isLoading: isLoadingSummary } = useQuery<TaxPlanningSummary>({
    queryKey: ["/api/tax-planning/summary"],
  });

  const { data: brokerageEntries = [], isLoading: isLoadingBrokerage } = useQuery<BrokerageEntry[]>({
    queryKey: ["/api/1099-b-entries"],
  });

  // W-4 calculation
  const paychecksLeft = 26; // biweekly assumption
  const estimatedTax = summary?.estimatedTax || 0;
  const withheld = parseFloat(currentWithholding || "0") || 0;
  const target = targetRefund[0] ?? 0;
  const neededTotal = estimatedTax + target;
  const additionalPerPaycheck =
    withheld > 0 && paychecksLeft > 0
      ? Math.max(0, (neededTotal - withheld) / paychecksLeft)
      : 0;

  // Retirement calculation
  const contrib401kNum = parseFloat(contrib401k || "0") || 0;
  const contribIraNum = parseFloat(contribIra || "0") || 0;
  const headroom401k = Math.max(0, LIMIT_401K - contrib401kNum);
  const headroomIra = Math.max(0, LIMIT_IRA - contribIraNum);
  // Estimate 22% marginal rate for savings estimate
  const retirementSavings = (headroom401k + headroomIra) * 0.22;

  // Tax-loss harvesting
  const losses = brokerageEntries
    .map((entry) => {
      const basis = parseFloat(entry.costBasis || "0") || 0;
      const current =
        parseFloat(currentValues[entry.id] || entry.currentValue || "0") || 0;
      const unrealizedLoss = current > 0 ? current - basis : 0;
      return { ...entry, basis, current, unrealizedLoss };
    })
    .filter((e) => e.unrealizedLoss < 0);

  const totalLoss = losses.reduce((sum, e) => sum + e.unrealizedLoss, 0);
  // Estimate 15% LT cap gains rate
  const harvestSavings = Math.abs(totalLoss) * 0.15;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Tax Planning</h1>
        <p className="text-lg text-muted-foreground">
          Year-round tools to minimize your tax bill, avoid penalties, and plan ahead.
        </p>
      </div>

      <Tabs defaultValue="quarterly">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="quarterly" className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Quarterly
          </TabsTrigger>
          <TabsTrigger value="w4" className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" />
            W-4 Optimizer
          </TabsTrigger>
          <TabsTrigger value="retirement" className="flex items-center gap-1.5">
            <PiggyBank className="h-4 w-4" />
            Retirement
          </TabsTrigger>
          <TabsTrigger value="harvesting" className="flex items-center gap-1.5">
            <BarChart2 className="h-4 w-4" />
            Tax-Loss
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Quarterly Estimated Taxes */}
        <TabsContent value="quarterly" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Quarterly Estimated Taxes
              </CardTitle>
              <CardDescription>
                Self-employed taxpayers and those with income not subject to withholding must pay
                quarterly estimates to avoid underpayment penalties.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {summary?.quarterlyPayments?.behind && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800 dark:text-red-200">
                          Potential Underpayment Penalty
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-0.5">
                          You appear to be behind on estimated tax payments. Consider making a catch-up
                          payment to avoid IRS penalties (currently 8% annualized).
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {QUARTERS.map((q, idx) => {
                      const amount =
                        summary?.quarterlyPayments?.[q.key] ?? (estimatedTax / 4);
                      const isPast = idx < (summary?.quarterlyPayments?.currentQuarter ?? 0) - 1;
                      const isCurrent = idx === (summary?.quarterlyPayments?.currentQuarter ?? 1) - 1;
                      return (
                        <div
                          key={q.label}
                          className={`p-4 rounded-lg border-2 ${
                            isCurrent
                              ? "border-primary bg-primary/5"
                              : isPast
                              ? "border-muted bg-muted/30"
                              : "border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-foreground">{q.label}</span>
                            {isPast && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                            {isCurrent && (
                              <Badge variant="default" className="text-xs">Due Soon</Badge>
                            )}
                          </div>
                          <p className="text-2xl font-mono font-bold text-foreground">
                            {fmt(amount || 0)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Due {q.due}</p>
                        </div>
                      );
                    })}
                  </div>

                  {estimatedTax > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg text-sm mt-2">
                      <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>
                        Total estimated tax for the year: <strong>{fmt(estimatedTax)}</strong>.
                        Pay via EFTPS or IRS Direct Pay.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: W-4 Withholding Optimizer */}
        <TabsContent value="w4" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                W-4 Withholding Optimizer
              </CardTitle>
              <CardDescription>
                Fine-tune your paycheck withholding so you hit your target refund (or payment)
                at filing time. Use Box 4(c) on your W-4 for additional per-paycheck withholding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="currentWithholding">
                    Total Federal Tax Withheld This Year (so far)
                  </Label>
                  <Input
                    id="currentWithholding"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0"
                    value={currentWithholding}
                    onChange={(e) => setCurrentWithholding(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Find this on your most recent pay stub (YTD federal withheld)
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>
                    Target Year-End Refund (negative = you owe):{" "}
                    <strong>{targetRefund[0] >= 0 ? "+" : ""}{fmt(targetRefund[0])}</strong>
                  </Label>
                  <Slider
                    min={-500}
                    max={2000}
                    step={50}
                    value={targetRefund}
                    onValueChange={setTargetRefund}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>-$500 (owe)</span>
                    <span>$0 break-even</span>
                    <span>+$2,000 refund</span>
                  </div>
                </div>
              </div>

              {withheld > 0 && (
                <div className="p-5 rounded-lg border-2 border-primary/30 bg-primary/5">
                  <p className="text-sm text-muted-foreground mb-1">Recommendation</p>
                  {additionalPerPaycheck > 0 ? (
                    <>
                      <p className="text-2xl font-bold text-foreground font-mono">
                        +{fmtD(additionalPerPaycheck)}/paycheck
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add this amount to Box 4(c) on your W-4 for additional withholding per
                        paycheck (assuming {paychecksLeft} remaining pay periods).
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400 font-mono">
                        On track
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your current withholding is projected to meet your target. No changes needed.
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg text-sm">
                <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span>
                  This is an estimate. Your actual refund or amount owed may differ based on
                  deductions, credits, and other income not reflected here.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Retirement Contribution Tracker */}
        <TabsContent value="retirement" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                Retirement Contribution Tracker
              </CardTitle>
              <CardDescription>
                Track contributions to tax-advantaged retirement accounts and see how much tax you
                can save by maximizing them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 401(k) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">401(k) / 403(b)</p>
                    <p className="text-xs text-muted-foreground">2025 limit: {fmt(LIMIT_401K)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      contrib401kNum >= LIMIT_401K
                        ? "text-green-600 border-green-500"
                        : "text-muted-foreground"
                    }
                  >
                    {contrib401kNum >= LIMIT_401K ? "Maxed" : `${fmt(headroom401k)} left`}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contrib401k">Your YTD Contributions</Label>
                  <Input
                    id="contrib401k"
                    type="number"
                    min="0"
                    max={LIMIT_401K}
                    step="100"
                    placeholder="0"
                    value={contrib401k}
                    onChange={(e) => setContrib401k(e.target.value)}
                  />
                </div>
                <Progress
                  value={Math.min(100, (contrib401kNum / LIMIT_401K) * 100)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {Math.round((contrib401kNum / LIMIT_401K) * 100)}% of annual limit used
                </p>
              </div>

              {/* IRA */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">Traditional / Roth IRA</p>
                    <p className="text-xs text-muted-foreground">2025 limit: {fmt(LIMIT_IRA)}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      contribIraNum >= LIMIT_IRA
                        ? "text-green-600 border-green-500"
                        : "text-muted-foreground"
                    }
                  >
                    {contribIraNum >= LIMIT_IRA ? "Maxed" : `${fmt(headroomIra)} left`}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contribIra">Your YTD Contributions</Label>
                  <Input
                    id="contribIra"
                    type="number"
                    min="0"
                    max={LIMIT_IRA}
                    step="100"
                    placeholder="0"
                    value={contribIra}
                    onChange={(e) => setContribIra(e.target.value)}
                  />
                </div>
                <Progress
                  value={Math.min(100, (contribIraNum / LIMIT_IRA) * 100)}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {Math.round((contribIraNum / LIMIT_IRA) * 100)}% of annual limit used
                </p>
              </div>

              {/* Savings estimate */}
              {(headroom401k > 0 || headroomIra > 0) && (
                <div className="p-5 rounded-lg border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        Maximizing would save you approximately
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                        Based on 22% estimated marginal tax rate on {fmt(headroom401k + headroomIra)} remaining headroom
                      </p>
                    </div>
                    <span className="text-3xl font-bold font-mono text-green-700 dark:text-green-300">
                      {fmt(retirementSavings)}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 p-3 bg-accent/50 rounded-lg text-sm">
                <Info className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <span>
                  Roth IRA contributions are not tax-deductible now but grow tax-free. Income limits
                  apply to Roth IRA eligibility and Traditional IRA deductibility.
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Tax-Loss Harvesting */}
        <TabsContent value="harvesting" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Tax-Loss Harvesting
              </CardTitle>
              <CardDescription>
                Selling investments at a loss offsets capital gains and reduces your tax bill.
                Enter current market values for your 1099-B holdings to find opportunities.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingBrokerage ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : brokerageEntries.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No 1099-B entries found. Upload your brokerage statements to see harvesting
                    opportunities.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {brokerageEntries.map((entry) => {
                    const basis = parseFloat(entry.costBasis || "0") || 0;
                    const current =
                      parseFloat(currentValues[entry.id] || entry.currentValue || "0") || 0;
                    const unrealizedLoss = current > 0 ? current - basis : null;
                    const isLoss = unrealizedLoss !== null && unrealizedLoss < 0;

                    return (
                      <div key={entry.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-foreground">
                              {entry.description || "Investment"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Cost basis: {fmtD(basis)}
                            </p>
                          </div>
                          {unrealizedLoss !== null && (
                            <Badge
                              className={
                                isLoss
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                  : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                              }
                            >
                              {isLoss ? "Loss" : "Gain"}{" "}
                              {isLoss ? "-" : "+"}{fmtD(Math.abs(unrealizedLoss))}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Label
                            htmlFor={`cv-${entry.id}`}
                            className="text-xs text-muted-foreground whitespace-nowrap"
                          >
                            Current Value
                          </Label>
                          <Input
                            id={`cv-${entry.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={entry.currentValue || "Enter current value"}
                            value={currentValues[entry.id] || ""}
                            onChange={(e) =>
                              setCurrentValues((cv) => ({
                                ...cv,
                                [entry.id]: e.target.value,
                              }))
                            }
                            className="h-8 text-sm max-w-[200px]"
                          />
                        </div>
                      </div>
                    );
                  })}

                  {losses.length > 0 ? (
                    <div className="p-5 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 mt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-orange-800 dark:text-orange-200">
                            Potential Tax Savings from Harvesting
                          </p>
                          <p className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                            {losses.length} position{losses.length !== 1 ? "s" : ""} with unrealized losses
                            totaling {fmtD(Math.abs(totalLoss))} — estimated savings at 15% LT cap gains rate
                          </p>
                        </div>
                        <span className="text-3xl font-bold font-mono text-orange-800 dark:text-orange-200">
                          {fmt(harvestSavings)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg text-sm mt-2">
                      <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span>
                        No unrealized losses detected. Enter current values above to identify
                        harvesting opportunities.
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-3 bg-accent/50 rounded-lg text-sm">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <span>
                      Beware of wash-sale rules: repurchasing the same or substantially identical
                      security within 30 days before or after the sale disallows the loss.
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
