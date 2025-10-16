import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, DollarSign, Calendar, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import type { TaxReturn, Document } from "@shared/schema";

export default function Dashboard() {
  const { data: taxReturns, isLoading: returnsLoading } = useQuery<TaxReturn[]>({
    queryKey: ["/api/tax-returns"],
  });

  const { data: documents, isLoading: docsLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const currentReturn = taxReturns?.[0];
  const documentCount = documents?.length || 0;
  const parsedCount = documents?.filter((d) => d.status === "parsed").length || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Tax Dashboard
        </h1>
        <p className="text-lg text-muted-foreground">
          Welcome back! Let's complete your 2024 tax return.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Uploaded</CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-document-count">
              {docsLoading ? "..." : documentCount}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {parsedCount} parsed successfully
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tax Year</CardTitle>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono" data-testid="text-tax-year">
              {currentReturn?.taxYear || 2024}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Filing Status: {currentReturn?.filingStatus || "Single"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estimated Refund</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-3xl font-bold font-mono"
              data-testid="text-refund-amount"
            >
              {returnsLoading ? "..." : currentReturn?.refundOrOwed
                ? `$${parseFloat(currentReturn.refundOrOwed).toLocaleString()}`
                : "$0"}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {currentReturn?.status || "Not calculated yet"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Continue where you left off</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/upload">
              <Button className="w-full justify-start gap-3" variant="outline" data-testid="button-upload">
                <Upload className="h-5 w-5" />
                <span>Upload Tax Documents</span>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>

            <Link href="/review">
              <Button className="w-full justify-start gap-3" variant="outline" data-testid="button-review">
                <FileText className="h-5 w-5" />
                <span>Review Extracted Data</span>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>

            <Link href="/calculate">
              <Button className="w-full justify-start gap-3" variant="outline" data-testid="button-calculate">
                <DollarSign className="h-5 w-5" />
                <span>Calculate Taxes</span>
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>
              {documentCount > 0 ? "Your uploaded tax forms" : "No documents uploaded yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="text-sm text-muted-foreground">Loading documents...</div>
            ) : documentCount === 0 ? (
              <div className="text-center py-8">
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Get started by uploading your W-2 and 1099 forms
                </p>
                <Link href="/upload">
                  <Button data-testid="button-upload-first">
                    Upload Documents
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {documents?.slice(0, 5).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                    data-testid={`card-document-${doc.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {doc.documentType}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={doc.status === "parsed" ? "default" : "secondary"}
                      className="flex-shrink-0 ml-2"
                    >
                      {doc.status === "parsed" ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {doc.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tax Filing Progress</CardTitle>
          <CardDescription>Complete these steps to file your return</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className={`rounded-full p-2 ${documentCount > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {documentCount > 0 ? <CheckCircle2 className="h-5 w-5" /> : <div className="h-5 w-5 rounded-full border-2" />}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Upload Documents</h4>
                <p className="text-sm text-muted-foreground">
                  Upload all W-2 and 1099 forms for tax year 2024
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`rounded-full p-2 ${parsedCount > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {parsedCount > 0 ? <CheckCircle2 className="h-5 w-5" /> : <div className="h-5 w-5 rounded-full border-2" />}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Review Data</h4>
                <p className="text-sm text-muted-foreground">
                  Verify extracted information is accurate
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className={`rounded-full p-2 ${currentReturn?.totalTax ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {currentReturn?.totalTax ? <CheckCircle2 className="h-5 w-5" /> : <div className="h-5 w-5 rounded-full border-2" />}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">Calculate Taxes</h4>
                <p className="text-sm text-muted-foreground">
                  Generate your tax calculations and Form 1040
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
