import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calculator, DollarSign, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import type { TaxReturn } from "@shared/schema";
import { FILING_STATUS } from "@shared/schema";

export default function Calculate() {
  const [filingStatus, setFilingStatus] = useState<string>("single");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: taxReturns, isLoading } = useQuery<TaxReturn[]>({
    queryKey: ["/api/tax-returns"],
  });

  const calculateMutation = useMutation({
    mutationFn: async (status: string) => {
      const response = await apiRequest("POST", "/api/calculate", { filingStatus: status });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Calculation complete",
        description: "Your tax return has been calculated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/form1040"] });
    },
    onError: (error: any) => {
      toast({
        title: "Calculation failed",
        description: error.message || "Failed to calculate taxes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const currentReturn = taxReturns?.[0];

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "$0.00";
    return `$${parseFloat(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleCalculate = () => {
    calculateMutation.mutate(filingStatus);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Tax Calculation
        </h1>
        <p className="text-lg text-muted-foreground">
          Calculate your 2024 federal income tax based on uploaded documents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filing Information</CardTitle>
          <CardDescription>
            Select your filing status to calculate taxes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="filing-status">Filing Status</Label>
            <Select value={filingStatus} onValueChange={setFilingStatus}>
              <SelectTrigger id="filing-status" data-testid="select-filing-status">
                <SelectValue placeholder="Select filing status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILING_STATUS.SINGLE}>Single</SelectItem>
                <SelectItem value={FILING_STATUS.MARRIED_JOINT}>Married Filing Jointly</SelectItem>
                <SelectItem value={FILING_STATUS.MARRIED_SEPARATE}>Married Filing Separately</SelectItem>
                <SelectItem value={FILING_STATUS.HEAD_OF_HOUSEHOLD}>Head of Household</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCalculate}
            disabled={calculateMutation.isPending}
            className="w-full"
            size="lg"
            data-testid="button-calculate"
          >
            {calculateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-5 w-5" />
                Calculate Taxes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {currentReturn && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono" data-testid="text-total-income">
                  {formatCurrency(currentReturn.totalIncome)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  From all sources
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tax</CardTitle>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-mono" data-testid="text-total-tax">
                  {formatCurrency(currentReturn.totalTax)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Federal income tax
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {parseFloat(currentReturn.refundOrOwed || "0") >= 0 ? "Refund" : "Amount Owed"}
                </CardTitle>
                {parseFloat(currentReturn.refundOrOwed || "0") >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </CardHeader>
              <CardContent>
                <div
                  className={`text-3xl font-bold font-mono ${
                    parseFloat(currentReturn.refundOrOwed || "0") >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                  data-testid="text-refund-owed"
                >
                  {formatCurrency(currentReturn.refundOrOwed)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {parseFloat(currentReturn.refundOrOwed || "0") >= 0
                    ? "You're getting money back"
                    : "Payment required"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Income Breakdown</CardTitle>
              <CardDescription>Detailed breakdown of your income sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium text-foreground">Wages and Salaries</p>
                    <p className="text-sm text-muted-foreground">Form W-2</p>
                  </div>
                  <p className="text-lg font-mono font-semibold">
                    {formatCurrency(currentReturn.totalIncome)}
                  </p>
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium text-foreground">Interest Income</p>
                    <p className="text-sm text-muted-foreground">Form 1099-INT</p>
                  </div>
                  <p className="text-lg font-mono font-semibold">$0.00</p>
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium text-foreground">Dividend Income</p>
                    <p className="text-sm text-muted-foreground">Form 1099-DIV</p>
                  </div>
                  <p className="text-lg font-mono font-semibold">$0.00</p>
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium text-foreground">Capital Gains</p>
                    <p className="text-sm text-muted-foreground">Form 1099-B</p>
                  </div>
                  <p className="text-lg font-mono font-semibold">$0.00</p>
                </div>

                <div className="flex items-center justify-between py-4 bg-accent/50 px-4 rounded-lg mt-4">
                  <p className="font-semibold text-foreground text-lg">Total Income</p>
                  <p className="text-2xl font-mono font-bold">
                    {formatCurrency(currentReturn.totalIncome)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tax Calculation Summary</CardTitle>
              <CardDescription>How your tax was calculated</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3">
                  <p className="text-foreground">Total Income</p>
                  <p className="font-mono font-medium">
                    {formatCurrency(currentReturn.totalIncome)}
                  </p>
                </div>

                <div className="flex items-center justify-between py-3">
                  <p className="text-foreground">Standard Deduction</p>
                  <p className="font-mono font-medium">
                    -{formatCurrency(currentReturn.totalDeductions)}
                  </p>
                </div>

                <div className="flex items-center justify-between py-3 border-t">
                  <p className="font-semibold text-foreground">Taxable Income</p>
                  <p className="font-mono font-semibold">
                    {formatCurrency(currentReturn.taxableIncome)}
                  </p>
                </div>

                <div className="flex items-center justify-between py-3">
                  <p className="text-foreground">Federal Tax</p>
                  <p className="font-mono font-medium">
                    {formatCurrency(currentReturn.totalTax)}
                  </p>
                </div>

                <div className="flex items-center justify-between py-3">
                  <p className="text-foreground">Federal Tax Withheld</p>
                  <p className="font-mono font-medium">
                    -{formatCurrency(currentReturn.withheld)}
                  </p>
                </div>

                <div className="flex items-center justify-between py-4 bg-accent/50 px-4 rounded-lg mt-4">
                  <p className="font-semibold text-foreground text-lg">
                    {parseFloat(currentReturn.refundOrOwed || "0") >= 0
                      ? "Refund Amount"
                      : "Amount Owed"}
                  </p>
                  <p
                    className={`text-2xl font-mono font-bold ${
                      parseFloat(currentReturn.refundOrOwed || "0") >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCurrency(currentReturn.refundOrOwed)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && !currentReturn && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Tax Calculation Yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Calculate your taxes to see detailed results
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
