import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Save,
  FileText,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Info,
} from "lucide-react";
import type { TaxReturn } from "@shared/schema";
import { FILING_STATUS } from "@shared/schema";

interface ScheduleAData {
  // Medical & Dental
  medicalExpenses?: string;
  // Taxes Paid
  stateLocalIncomeTax?: string;
  realEstateTax?: string;
  personalPropertyTax?: string;
  // Interest Paid
  mortgageInterest1098?: string;
  mortgagePoints?: string;
  investmentInterest?: string;
  // Gifts to Charity
  cashContributions?: string;
  nonCashContributions?: string;
  // Casualty & Theft
  casualtyTheftLoss?: string;
  // Other
  otherDeductions?: string;
}

function getStandardDeduction(filingStatus: string): number {
  switch (filingStatus) {
    case FILING_STATUS.MARRIED_JOINT:
    case FILING_STATUS.QUALIFYING_WIDOW:
      return 29200;
    case FILING_STATUS.HEAD_OF_HOUSEHOLD:
      return 21900;
    default:
      return 14600;
  }
}

function getStandardDeductionLabel(filingStatus: string): string {
  switch (filingStatus) {
    case FILING_STATUS.MARRIED_JOINT:
      return "Married Filing Jointly";
    case FILING_STATUS.QUALIFYING_WIDOW:
      return "Qualifying Widow(er)";
    case FILING_STATUS.HEAD_OF_HOUSEHOLD:
      return "Head of Household";
    case FILING_STATUS.MARRIED_SEPARATE:
      return "Married Filing Separately";
    default:
      return "Single";
  }
}

const toNum = (val: string | undefined): number =>
  parseFloat(val || "0") || 0;

const fmt = (n: number): string =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ScheduleAPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scheduleA, isLoading } = useQuery<ScheduleAData>({
    queryKey: ["/api/schedule-a"],
  });

  const { data: taxReturns } = useQuery<TaxReturn[]>({
    queryKey: ["/api/tax-returns"],
  });

  const currentReturn = taxReturns?.[0];
  const agi = parseFloat(currentReturn?.totalIncome || "0") || 0;
  const filingStatus = currentReturn?.filingStatus || FILING_STATUS.SINGLE;
  const standardDeduction = getStandardDeduction(filingStatus);

  const [form, setForm] = useState<ScheduleAData>({
    medicalExpenses: "",
    stateLocalIncomeTax: "",
    realEstateTax: "",
    personalPropertyTax: "",
    mortgageInterest1098: "",
    mortgagePoints: "",
    investmentInterest: "",
    cashContributions: "",
    nonCashContributions: "",
    casualtyTheftLoss: "",
    otherDeductions: "",
  });

  useEffect(() => {
    if (scheduleA) {
      setForm({
        medicalExpenses: scheduleA.medicalExpenses || "",
        stateLocalIncomeTax: scheduleA.stateLocalIncomeTax || "",
        realEstateTax: scheduleA.realEstateTax || "",
        personalPropertyTax: scheduleA.personalPropertyTax || "",
        mortgageInterest1098: scheduleA.mortgageInterest1098 || "",
        mortgagePoints: scheduleA.mortgagePoints || "",
        investmentInterest: scheduleA.investmentInterest || "",
        cashContributions: scheduleA.cashContributions || "",
        nonCashContributions: scheduleA.nonCashContributions || "",
        casualtyTheftLoss: scheduleA.casualtyTheftLoss || "",
        otherDeductions: scheduleA.otherDeductions || "",
      });
    }
  }, [scheduleA]);

  const saveMutation = useMutation({
    mutationFn: async (data: ScheduleAData) => {
      const response = await apiRequest("PUT", "/api/schedule-a", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Schedule A saved",
        description: "Your itemized deductions have been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-a"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-returns"] });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Failed to save Schedule A. Please try again.",
        variant: "destructive",
      });
    },
  });

  const set = (field: keyof ScheduleAData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Computed values
  const medicalFloor = agi * 0.075;
  const medicalRaw = toNum(form.medicalExpenses);
  const medicalDeductible = Math.max(0, medicalRaw - medicalFloor);

  const saltRaw =
    toNum(form.stateLocalIncomeTax) +
    toNum(form.realEstateTax) +
    toNum(form.personalPropertyTax);
  const saltCapped = Math.min(saltRaw, 10000);

  const interestTotal =
    toNum(form.mortgageInterest1098) +
    toNum(form.mortgagePoints) +
    toNum(form.investmentInterest);

  const charityCash = toNum(form.cashContributions);
  const charityNonCash = toNum(form.nonCashContributions);
  const charityTotal = charityCash + charityNonCash;

  const casualty = toNum(form.casualtyTheftLoss);
  const other = toNum(form.otherDeductions);

  const itemizedTotal =
    medicalDeductible + saltCapped + interestTotal + charityTotal + casualty + other;

  const itemizedBetter = itemizedTotal > standardDeduction;
  const difference = Math.abs(itemizedTotal - standardDeduction);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Schedule A</h1>
        <p className="text-lg text-muted-foreground">
          Itemized Deductions — you can deduct actual expenses instead of the standard deduction
          if they exceed the standard amount for your filing status.
        </p>
      </div>

      {/* Comparison banner */}
      <div
        className={`rounded-lg p-5 border-2 flex items-center justify-between gap-4 ${
          itemizedBetter
            ? "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700"
            : "bg-blue-50 border-blue-300 dark:bg-blue-900/20 dark:border-blue-700"
        }`}
      >
        <div className="flex items-center gap-3">
          {itemizedBetter ? (
            <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0" />
          ) : (
            <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold text-foreground">
              {itemizedBetter
                ? `Itemizing saves you ${fmt(difference)}`
                : `Standard deduction is better by ${fmt(difference)}`}
            </p>
            <p className="text-sm text-muted-foreground">
              Your itemized total: {fmt(itemizedTotal)} &nbsp;|&nbsp; Standard deduction (
              {getStandardDeductionLabel(filingStatus)}): {fmt(standardDeduction)}
            </p>
          </div>
        </div>
        <Badge
          className={
            itemizedBetter
              ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
              : "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
          }
        >
          {itemizedBetter ? "Use Itemized" : "Use Standard"}
        </Badge>
      </div>

      {/* Medical & Dental */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Medical &amp; Dental Expenses
          </CardTitle>
          <CardDescription>
            Only the amount exceeding 7.5% of your AGI ({fmt(medicalFloor)}) is deductible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="medicalExpenses">Total Medical &amp; Dental Expenses</Label>
            <Input
              id="medicalExpenses"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.medicalExpenses}
              onChange={set("medicalExpenses")}
            />
          </div>
          {medicalRaw > 0 && (
            <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg text-sm">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>
                {fmt(medicalRaw)} &minus; {fmt(medicalFloor)} floor = {" "}
                <strong>{fmt(medicalDeductible)} deductible</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Taxes Paid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Taxes Paid
          </CardTitle>
          <CardDescription>
            State &amp; Local Taxes (SALT) are capped at $10,000 combined ($5,000 if married
            filing separately).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="stateLocalIncomeTax">State &amp; Local Income Tax (or Sales Tax)</Label>
            <Input
              id="stateLocalIncomeTax"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.stateLocalIncomeTax}
              onChange={set("stateLocalIncomeTax")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="realEstateTax">Real Estate Taxes</Label>
            <Input
              id="realEstateTax"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.realEstateTax}
              onChange={set("realEstateTax")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="personalPropertyTax">Personal Property Tax</Label>
            <Input
              id="personalPropertyTax"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.personalPropertyTax}
              onChange={set("personalPropertyTax")}
            />
          </div>
          {saltRaw > 0 && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                saltRaw > 10000
                  ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700"
                  : "bg-accent/50"
              }`}
            >
              <AlertCircle
                className={`h-4 w-4 flex-shrink-0 ${
                  saltRaw > 10000
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
              <span>
                Total SALT: {fmt(saltRaw)}
                {saltRaw > 10000 && (
                  <> &rarr; <strong>capped at {fmt(saltCapped)}</strong> (SALT limit)</>
                )}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interest Paid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Interest Paid
          </CardTitle>
          <CardDescription>
            Mortgage interest from Form 1098, points paid on home purchase, and investment interest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="mortgageInterest1098">Home Mortgage Interest (Form 1098)</Label>
            <Input
              id="mortgageInterest1098"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.mortgageInterest1098}
              onChange={set("mortgageInterest1098")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mortgagePoints">Points Paid on Home Purchase</Label>
            <Input
              id="mortgagePoints"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.mortgagePoints}
              onChange={set("mortgagePoints")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="investmentInterest">Investment Interest</Label>
            <Input
              id="investmentInterest"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.investmentInterest}
              onChange={set("investmentInterest")}
            />
          </div>
          {interestTotal > 0 && (
            <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg text-sm">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>Interest subtotal: <strong>{fmt(interestTotal)}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gifts to Charity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gifts to Charity
          </CardTitle>
          <CardDescription>
            Cash and non-cash charitable contributions to qualified organizations.
            Non-deductible amounts (e.g., raffle tickets) should not be included.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cashContributions">Cash Contributions</Label>
            <Input
              id="cashContributions"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.cashContributions}
              onChange={set("cashContributions")}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nonCashContributions">Non-Cash Contributions (fair market value)</Label>
            <Input
              id="nonCashContributions"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.nonCashContributions}
              onChange={set("nonCashContributions")}
            />
          </div>
          {charityTotal > 0 && (
            <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg text-sm">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>Charity subtotal: <strong>{fmt(charityTotal)}</strong></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Casualty & Theft */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Casualty &amp; Theft Losses
          </CardTitle>
          <CardDescription>
            Only losses from a federally declared disaster area qualify after 2017 tax law changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="casualtyTheftLoss">Disaster-Declared Casualty &amp; Theft Loss</Label>
            <Input
              id="casualtyTheftLoss"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.casualtyTheftLoss}
              onChange={set("casualtyTheftLoss")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Other Deductions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Other Itemized Deductions
          </CardTitle>
          <CardDescription>
            Gambling losses (to extent of winnings), impairment-related work expenses, and other
            allowed deductions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="otherDeductions">Other Deductions</Label>
            <Input
              id="otherDeductions"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.otherDeductions}
              onChange={set("otherDeductions")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Total Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Deduction Summary</CardTitle>
          <CardDescription>Computed totals for your Schedule A</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: "Medical & Dental (after 7.5% AGI floor)", value: medicalDeductible },
              { label: "Taxes Paid (SALT, capped at $10K)", value: saltCapped },
              { label: "Interest Paid", value: interestTotal },
              { label: "Gifts to Charity", value: charityTotal },
              { label: "Casualty & Theft Losses", value: casualty },
              { label: "Other Deductions", value: other },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm text-foreground">{label}</span>
                <span className="font-mono text-sm font-medium">{fmt(value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-3 bg-accent/50 px-4 rounded-lg mt-2">
              <span className="font-semibold text-foreground text-base">Total Itemized Deductions</span>
              <span className="font-mono font-bold text-lg">{fmt(itemizedTotal)}</span>
            </div>
            <div className="flex items-center justify-between py-2 px-4">
              <span className="text-sm text-muted-foreground">
                Standard Deduction ({getStandardDeductionLabel(filingStatus)})
              </span>
              <span className="font-mono text-sm text-muted-foreground">{fmt(standardDeduction)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          size="lg"
          onClick={() => saveMutation.mutate(form)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Schedule A
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
