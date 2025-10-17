import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calculator, DollarSign, TrendingUp, TrendingDown, Loader2, User, AlertCircle } from "lucide-react";
import type { TaxReturn, UserProfile } from "@shared/schema";
import { FILING_STATUS } from "@shared/schema";

interface IncomeBreakdown {
  wages: number;
  federalWithheld: number;
  dividends: number;
  qualifiedDividends: number;
  interest: number;
  capitalGains: number;
  totalIncome: number;
  w2Count: number;
  divCount: number;
  intCount: number;
  bCount: number;
}

export default function Calculate() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: taxReturns, isLoading } = useQuery<TaxReturn[]>({
    queryKey: ["/api/tax-returns"],
  });

  const { data: profile, isLoading: isLoadingProfile } = useQuery<UserProfile>({
    queryKey: ["/api/profile"],
  });

  const currentReturn = taxReturns?.[0];

  const { data: incomeBreakdown, isLoading: isLoadingBreakdown } = useQuery<IncomeBreakdown>({
    queryKey: [`/api/income-breakdown/${currentReturn?.id}`],
    enabled: !!currentReturn?.id,
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/calculate", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Calculation complete",
        description: "Your tax return has been calculated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-returns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/form1040"] });
      if (currentReturn?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/income-breakdown/${currentReturn.id}`] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Calculation failed",
        description: error.message || "Failed to calculate taxes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "$0.00";
    return `$${parseFloat(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatFilingStatus = (status: string) => {
    switch (status) {
      case FILING_STATUS.SINGLE:
        return "Single";
      case FILING_STATUS.MARRIED_JOINT:
        return "Married Filing Jointly";
      case FILING_STATUS.MARRIED_SEPARATE:
        return "Married Filing Separately";
      case FILING_STATUS.HEAD_OF_HOUSEHOLD:
        return "Head of Household";
      case FILING_STATUS.QUALIFYING_WIDOW:
        return "Qualifying Widow(er)";
      default:
        return "Single";
    }
  };

  const handleCalculate = () => {
    calculateMutation.mutate();
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
            Your tax calculation will use the filing status from your profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoadingProfile ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : profile ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">Filing Status</p>
                    <p className="text-sm text-muted-foreground">
                      {profile.firstName && profile.lastName 
                        ? `${profile.firstName} ${profile.lastName}` 
                        : "Taxpayer"
                      }
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-sm">
                  {formatFilingStatus(profile.filingStatus)}
                </Badge>
              </div>
              
              {profile.dependents && Array.isArray(profile.dependents) && profile.dependents.length > 0 ? (
                <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Dependents</p>
                      <p className="text-sm text-muted-foreground">
                        {profile.dependents.length} dependent{profile.dependents.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-sm">
                    {profile.dependents.filter((dep: any) => dep.isQualifyingChild).length} qualifying children
                  </Badge>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Profile Required</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Please complete your tax profile to calculate taxes accurately.
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleCalculate}
            disabled={calculateMutation.isPending || !profile}
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
              {isLoadingBreakdown ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-foreground">Wages and Salaries</p>
                      <p className="text-sm text-muted-foreground">
                        Form W-2 ({incomeBreakdown?.w2Count || 0} form{incomeBreakdown?.w2Count !== 1 ? 's' : ''})
                      </p>
                    </div>
                    <p className="text-lg font-mono font-semibold">
                      {formatCurrency(incomeBreakdown?.wages?.toString())}
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-foreground">Interest Income</p>
                      <p className="text-sm text-muted-foreground">
                        Form 1099-INT ({incomeBreakdown?.intCount || 0} form{incomeBreakdown?.intCount !== 1 ? 's' : ''})
                      </p>
                    </div>
                    <p className="text-lg font-mono font-semibold">
                      {formatCurrency(incomeBreakdown?.interest?.toString())}
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-foreground">Dividend Income</p>
                      <p className="text-sm text-muted-foreground">
                        Form 1099-DIV ({incomeBreakdown?.divCount || 0} form{incomeBreakdown?.divCount !== 1 ? 's' : ''})
                      </p>
                    </div>
                    <p className="text-lg font-mono font-semibold">
                      {formatCurrency(incomeBreakdown?.dividends?.toString())}
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b">
                    <div>
                      <p className="font-medium text-foreground">Capital Gains</p>
                      <p className="text-sm text-muted-foreground">
                        Form 1099-B ({incomeBreakdown?.bCount || 0} form{incomeBreakdown?.bCount !== 1 ? 's' : ''})
                      </p>
                    </div>
                    <p className="text-lg font-mono font-semibold">
                      {formatCurrency(incomeBreakdown?.capitalGains?.toString())}
                    </p>
                  </div>

                  <div className="flex items-center justify-between py-4 bg-accent/50 px-4 rounded-lg mt-4">
                    <p className="font-semibold text-foreground text-lg">Total Income</p>
                    <p className="text-2xl font-mono font-bold">
                      {formatCurrency(incomeBreakdown?.totalIncome?.toString())}
                    </p>
                  </div>
                </div>
              )}
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
