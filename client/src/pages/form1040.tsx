import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Form1040 } from "@shared/schema";

export default function Form1040Page() {
  const { toast } = useToast();
  const { data: form1040, isLoading } = useQuery<Form1040>({
    queryKey: ["/api/form1040"],
  });

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "$0.00";
    return `$${parseFloat(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch("/api/form1040/export", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Form1040_2024.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Downloaded",
        description: "Your Form 1040 has been downloaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form1040) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Form 1040</h1>
          <p className="text-lg text-muted-foreground">
            U.S. Individual Income Tax Return for 2024
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Form Not Generated
              </h3>
              <p className="text-sm text-muted-foreground">
                Calculate your taxes first to generate Form 1040
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">Form 1040</h1>
        <p className="text-lg text-muted-foreground">
          U.S. Individual Income Tax Return for 2024
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Form 1040 Preview</CardTitle>
              <CardDescription>
                Review your completed tax form before filing
              </CardDescription>
            </div>
            <Button onClick={handleDownloadPDF} data-testid="button-download-pdf">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border rounded-lg p-6 bg-card space-y-6">
            <div className="text-center border-b pb-4">
              <h2 className="text-2xl font-bold text-foreground">
                U.S. Individual Income Tax Return
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Form 1040 • Tax Year 2024
              </p>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-lg mb-4">Income</h3>
              
              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">1</div>
                <div className="col-span-8 text-sm">
                  Wages, salaries, tips, etc.
                </div>
                <div className="col-span-3 text-right font-mono text-sm" data-testid="text-form-wages">
                  {formatCurrency(form1040.wages)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">2a</div>
                <div className="col-span-8 text-sm">
                  Tax-exempt interest
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  $0.00
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">2b</div>
                <div className="col-span-8 text-sm">
                  Taxable interest
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.interestIncome)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">3a</div>
                <div className="col-span-8 text-sm">
                  Qualified dividends
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.qualifiedDividends)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">3b</div>
                <div className="col-span-8 text-sm">
                  Ordinary dividends
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.dividendIncome)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">7</div>
                <div className="col-span-8 text-sm">
                  Capital gain or (loss)
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.capitalGains)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-3 bg-accent/30 rounded-lg px-4 mt-2">
                <div className="col-span-1 text-sm font-mono font-semibold">9</div>
                <div className="col-span-8 text-sm font-semibold">
                  Total income
                </div>
                <div className="col-span-3 text-right font-mono font-bold" data-testid="text-form-total-income">
                  {formatCurrency(form1040.totalIncome)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-lg mb-4">
                Adjusted Gross Income
              </h3>
              
              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">10</div>
                <div className="col-span-8 text-sm">
                  Adjustments to income
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.adjustments)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-3 bg-accent/30 rounded-lg px-4 mt-2">
                <div className="col-span-1 text-sm font-mono font-semibold">11</div>
                <div className="col-span-8 text-sm font-semibold">
                  Adjusted gross income
                </div>
                <div className="col-span-3 text-right font-mono font-bold">
                  {formatCurrency(form1040.adjustedGrossIncome)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-lg mb-4">
                Tax and Credits
              </h3>
              
              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">12</div>
                <div className="col-span-8 text-sm">
                  Standard deduction
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.standardDeduction)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-3 bg-accent/30 rounded-lg px-4 mt-2">
                <div className="col-span-1 text-sm font-mono font-semibold">15</div>
                <div className="col-span-8 text-sm font-semibold">
                  Taxable income
                </div>
                <div className="col-span-3 text-right font-mono font-bold" data-testid="text-form-taxable-income">
                  {formatCurrency(form1040.taxableIncome)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-2 border-b mt-4">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">16</div>
                <div className="col-span-8 text-sm">
                  Tax
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.tax)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">19</div>
                <div className="col-span-8 text-sm">
                  Credits
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.credits)}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-4 py-3 bg-accent/30 rounded-lg px-4 mt-2">
                <div className="col-span-1 text-sm font-mono font-semibold">24</div>
                <div className="col-span-8 text-sm font-semibold">
                  Total tax
                </div>
                <div className="col-span-3 text-right font-mono font-bold" data-testid="text-form-total-tax">
                  {formatCurrency(form1040.totalTax)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="font-semibold text-foreground text-lg mb-4">
                Payments
              </h3>
              
              <div className="grid grid-cols-12 gap-4 py-2 border-b">
                <div className="col-span-1 text-sm font-mono text-muted-foreground">25</div>
                <div className="col-span-8 text-sm">
                  Federal income tax withheld
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {formatCurrency(form1040.federalWithheld)}
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-4 border-t-2">
              <h3 className="font-semibold text-foreground text-lg mb-4">
                Refund or Amount Owed
              </h3>
              
              <div className="grid grid-cols-12 gap-4 py-4 bg-primary/10 rounded-lg px-4">
                <div className="col-span-1 text-sm font-mono font-bold">34</div>
                <div className="col-span-8 text-base font-bold">
                  {parseFloat(form1040.refundOrOwed || "0") >= 0
                    ? "Refund"
                    : "Amount you owe"}
                </div>
                <div
                  className={`col-span-3 text-right font-mono text-xl font-bold ${
                    parseFloat(form1040.refundOrOwed || "0") >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                  data-testid="text-form-refund-owed"
                >
                  {formatCurrency(form1040.refundOrOwed)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
