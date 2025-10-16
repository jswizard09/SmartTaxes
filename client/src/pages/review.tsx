import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import type { Document, W2Data, Form1099Div, Form1099Int, Form1099B } from "@shared/schema";

export default function Review() {
  const { data: documents, isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const { data: w2Data } = useQuery<W2Data[]>({
    queryKey: ["/api/w2-data"],
  });

  const { data: div1099Data } = useQuery<Form1099Div[]>({
    queryKey: ["/api/1099-div-data"],
  });

  const { data: int1099Data } = useQuery<Form1099Int[]>({
    queryKey: ["/api/1099-int-data"],
  });

  const { data: b1099Data } = useQuery<Form1099B[]>({
    queryKey: ["/api/1099-b-data"],
  });

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "$0.00";
    return `$${parseFloat(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (docsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const parsedDocs = documents?.filter((d) => d.status === "parsed") || [];

  if (parsedDocs.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">Review Data</h1>
          <p className="text-lg text-muted-foreground">
            Verify extracted information from your tax documents.
          </p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No Parsed Documents
              </h3>
              <p className="text-sm text-muted-foreground">
                Upload and process documents first to review extracted data.
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
        <h1 className="text-4xl font-bold text-foreground mb-2">Review Data</h1>
        <p className="text-lg text-muted-foreground">
          Verify the accuracy of extracted information from your tax documents.
        </p>
      </div>

      <Tabs defaultValue="w2" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="w2" data-testid="tab-w2">
            W-2 Forms ({w2Data?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="1099-div" data-testid="tab-1099-div">
            1099-DIV ({div1099Data?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="1099-int" data-testid="tab-1099-int">
            1099-INT ({int1099Data?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="1099-b" data-testid="tab-1099-b">
            1099-B ({b1099Data?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="w2" className="space-y-4">
          {w2Data?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No W-2 data available</p>
              </CardContent>
            </Card>
          ) : (
            w2Data?.map((w2) => (
              <Card key={w2.id} data-testid={`card-w2-${w2.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{w2.employerName || "Unknown Employer"}</CardTitle>
                      <CardDescription>EIN: {w2.employerEin || "N/A"}</CardDescription>
                    </div>
                    <Badge>W-2</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Wages (Box 1)</p>
                        <p className="text-lg font-mono font-semibold" data-testid="text-wages">
                          {formatCurrency(w2.wages)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Federal Withheld (Box 2)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(w2.federalWithheld)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Social Security Wages (Box 3)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(w2.socialSecurityWages)}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Social Security Withheld (Box 4)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(w2.socialSecurityWithheld)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Medicare Wages (Box 5)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(w2.medicareWages)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Medicare Withheld (Box 6)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(w2.medicareWithheld)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="1099-div" className="space-y-4">
          {div1099Data?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No 1099-DIV data available</p>
              </CardContent>
            </Card>
          ) : (
            div1099Data?.map((div) => (
              <Card key={div.id} data-testid={`card-1099-div-${div.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{div.payerName || "Unknown Payer"}</CardTitle>
                      <CardDescription>TIN: {div.payerTin || "N/A"}</CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800">1099-DIV</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Ordinary Dividends (Box 1a)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(div.ordinaryDividends)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Qualified Dividends (Box 1b)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(div.qualifiedDividends)}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Total Capital Gain (Box 2a)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(div.totalCapitalGain)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Foreign Tax Paid (Box 7)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(div.foreignTaxPaid)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="1099-int" className="space-y-4">
          {int1099Data?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No 1099-INT data available</p>
              </CardContent>
            </Card>
          ) : (
            int1099Data?.map((int) => (
              <Card key={int.id} data-testid={`card-1099-int-${int.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{int.payerName || "Unknown Payer"}</CardTitle>
                      <CardDescription>TIN: {int.payerTin || "N/A"}</CardDescription>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">1099-INT</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Interest Income (Box 1)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(int.interestIncome)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Early Withdrawal Penalty (Box 2)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(int.earlyWithdrawalPenalty)}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">U.S. Bond Interest (Box 3)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(int.usBondInterest)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Federal Withheld (Box 4)</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(int.federalWithheld)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="1099-b" className="space-y-4">
          {b1099Data?.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No 1099-B data available</p>
              </CardContent>
            </Card>
          ) : (
            b1099Data?.map((b) => (
              <Card key={b.id} data-testid={`card-1099-b-${b.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{b.description || "Capital Gain/Loss Transaction"}</CardTitle>
                      <CardDescription>
                        {b.payerName || "Unknown Broker"} • TIN: {b.payerTin || "N/A"}
                      </CardDescription>
                    </div>
                    <Badge className="bg-orange-100 text-orange-800">1099-B</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Date Acquired</p>
                        <p className="text-sm font-medium">{b.dateAcquired || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Date Sold</p>
                        <p className="text-sm font-medium">{b.dateSold || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Proceeds</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(b.proceeds)}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Cost Basis</p>
                        <p className="text-lg font-mono font-semibold">
                          {formatCurrency(b.costBasis)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Short-Term Gain/Loss</p>
                        <p className={`text-lg font-mono font-semibold ${
                          parseFloat(b.shortTermGainLoss || "0") >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          {formatCurrency(b.shortTermGainLoss)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Long-Term Gain/Loss</p>
                        <p className={`text-lg font-mono font-semibold ${
                          parseFloat(b.longTermGainLoss || "0") >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          {formatCurrency(b.longTermGainLoss)}
                        </p>
                      </div>
                      {b.washSale && (
                        <Badge variant="destructive">Wash Sale</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
