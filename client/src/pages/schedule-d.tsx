import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Calculator, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ScheduleD, Form8949 } from "@shared/schema";

export default function ScheduleDPage() {
  const { toast } = useToast();

  const { data: activeYear } = useQuery<{ year: number } | null>({
    queryKey: ["/api/tax-config/active-year"],
    enabled: !!localStorage.getItem("token"),
  });

  const currentYear = activeYear?.year || new Date().getFullYear();

  const { data: scheduleD, isLoading: scheduleDLoading } = useQuery<ScheduleD>({
    queryKey: ["/api/schedule-d"],
  });

  const { data: form8949Data, isLoading: form8949Loading } = useQuery<Form8949[]>({
    queryKey: ["/api/form8949"],
  });

  const calculateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/schedule-d/calculate", {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-d"] });
      queryClient.invalidateQueries({ queryKey: ["/api/form8949"] });
      queryClient.invalidateQueries({ queryKey: ["/api/form1040"] });
      toast({
        title: "Schedule D Calculated",
        description: `Generated ${data.form8949Count} Form 8949 entries. Total capital gain/loss: $${data.totalCapitalGainLoss.toFixed(2)}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Calculation Failed",
        description: error.message || "Failed to calculate Schedule D",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "$0.00";
    const num = parseFloat(value);
    return `$${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const isLoading = scheduleDLoading || form8949Loading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Schedule D</h1>
          <p className="text-lg text-muted-foreground">
            Capital Gains and Losses for {currentYear}
          </p>
        </div>
        <Button 
          onClick={() => calculateMutation.mutate()} 
          disabled={calculateMutation.isPending}
          data-testid="button-calculate-schedule-d"
        >
          {calculateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Calculate Schedule D
            </>
          )}
        </Button>
      </div>

      {!scheduleD ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Schedule D Generated
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Click "Calculate Schedule D" to generate your capital gains/losses report from 1099-B data
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  Short-Term Capital Gains/Losses
                </CardTitle>
                <CardDescription>
                  Assets held for 1 year or less
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Proceeds:</span>
                  <span className="font-mono font-semibold">{formatCurrency(scheduleD.shortTermTotalProceeds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Cost Basis:</span>
                  <span className="font-mono font-semibold">{formatCurrency(scheduleD.shortTermTotalCostBasis)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">Net Gain/Loss:</span>
                  <span className={`font-mono font-bold ${parseFloat(scheduleD.shortTermTotalGainLoss || "0") >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(scheduleD.shortTermTotalGainLoss)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-blue-500" />
                  Long-Term Capital Gains/Losses
                </CardTitle>
                <CardDescription>
                  Assets held for more than 1 year
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Proceeds:</span>
                  <span className="font-mono font-semibold">{formatCurrency(scheduleD.longTermTotalProceeds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Cost Basis:</span>
                  <span className="font-mono font-semibold">{formatCurrency(scheduleD.longTermTotalCostBasis)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">Net Gain/Loss:</span>
                  <span className={`font-mono font-bold ${parseFloat(scheduleD.longTermTotalGainLoss || "0") >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(scheduleD.longTermTotalGainLoss)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Total Capital Gain or Loss</CardTitle>
              <CardDescription>
                Combined short-term and long-term results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono text-center p-6 rounded-lg bg-muted">
                <span className={parseFloat(scheduleD.totalCapitalGainLoss || "0") >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatCurrency(scheduleD.totalCapitalGainLoss)}
                </span>
              </div>
            </CardContent>
          </Card>

          {form8949Data && form8949Data.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Form 8949 Transactions</CardTitle>
                <CardDescription>
                  Detailed list of {form8949Data.length} capital gain/loss transactions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 text-sm font-semibold">Description</th>
                        <th className="text-left p-2 text-sm font-semibold">Acquired</th>
                        <th className="text-left p-2 text-sm font-semibold">Sold</th>
                        <th className="text-right p-2 text-sm font-semibold">Proceeds</th>
                        <th className="text-right p-2 text-sm font-semibold">Cost Basis</th>
                        <th className="text-right p-2 text-sm font-semibold">Gain/Loss</th>
                        <th className="text-center p-2 text-sm font-semibold">Term</th>
                      </tr>
                    </thead>
                    <tbody>
                      {form8949Data.map((transaction) => (
                        <tr key={transaction.id} className="border-b hover:bg-muted/50">
                          <td className="p-2 text-sm">{transaction.description}</td>
                          <td className="p-2 text-sm text-muted-foreground">{transaction.dateAcquired || "Various"}</td>
                          <td className="p-2 text-sm text-muted-foreground">{transaction.dateSold}</td>
                          <td className="p-2 text-sm text-right font-mono">{formatCurrency(transaction.proceeds)}</td>
                          <td className="p-2 text-sm text-right font-mono">{formatCurrency(transaction.costBasis)}</td>
                          <td className={`p-2 text-sm text-right font-mono font-semibold ${parseFloat(transaction.gainOrLoss) >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {formatCurrency(transaction.gainOrLoss)}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${transaction.isShortTerm ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                              {transaction.isShortTerm ? "Short" : "Long"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
