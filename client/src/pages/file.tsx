import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Download, 
  Send, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  CreditCard,
  Building2,
  Shield,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import type { TaxReturn, Form1040 } from "@shared/schema";

interface FilingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface BankAccount {
  routingNumber: string;
  accountNumber: string;
  accountType: "checking" | "savings";
}

export default function File() {
  const [currentStep, setCurrentStep] = useState(0);
  const [filingMethod, setFilingMethod] = useState<"efile" | "download" | "print">("efile");
  const [bankAccount, setBankAccount] = useState<BankAccount>({
    routingNumber: "",
    accountNumber: "",
    accountType: "checking",
  });
  const [signatureConsent, setSignatureConsent] = useState(false);
  const [refundPreference, setRefundPreference] = useState<"direct_deposit" | "check" | "savings_bond">("direct_deposit");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: taxReturns, isLoading: returnsLoading } = useQuery<TaxReturn[]>({
    queryKey: ["/api/tax-returns"],
  });

  const { data: form1040, isLoading: formLoading } = useQuery<Form1040 | null>({
    queryKey: ["/api/form1040"],
    enabled: !!taxReturns && taxReturns.length > 0,
  });

  const efileMutation = useMutation({
    mutationFn: async (data: { bankAccount?: BankAccount; signatureConsent: boolean }) => {
      const response = await apiRequest("POST", "/api/efile/submit", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Tax return submitted successfully",
        description: `Your return has been submitted to the IRS. Acknowledgment: ${data.acknowledgmentNumber}`,
      });
      setCurrentStep(3); // Move to confirmation step
    },
    onError: (error: any) => {
      toast({
        title: "E-file submission failed",
        description: error.message || "Failed to submit tax return. Please try again.",
        variant: "destructive",
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/forms/generate-pdf", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          includeInstructions: true,
          includeCoverLetter: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TaxForms_${taxReturns?.[0]?.taxYear || 2024}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast({
        title: "PDF downloaded successfully",
        description: "Your tax forms have been downloaded to your computer.",
      });
      setCurrentStep(3);
    },
    onError: (error: any) => {
      toast({
        title: "Download failed",
        description: error.message || "Failed to download PDF. Please try again.",
        variant: "destructive",
      });
    },
  });

  const steps: FilingStep[] = [
    {
      id: "method",
      title: "Choose Filing Method",
      description: "Select how you want to file your tax return",
      completed: currentStep > 0,
    },
    {
      id: "details",
      title: "Provide Details",
      description: "Enter required information for filing",
      completed: currentStep > 1,
    },
    {
      id: "review",
      title: "Review & Submit",
      description: "Review your information and submit",
      completed: currentStep > 2,
    },
    {
      id: "confirmation",
      title: "Confirmation",
      description: "Your filing is complete",
      completed: currentStep > 3,
    },
  ];

  const currentReturn = taxReturns?.[0];
  const refundOrOwed = parseFloat(form1040?.refundOrOwed || "0");
  const isRefund = refundOrOwed >= 0;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if (filingMethod === "efile") {
      efileMutation.mutate({
        bankAccount: isRefund ? bankAccount : undefined,
        signatureConsent,
      });
    } else if (filingMethod === "download") {
      downloadMutation.mutate();
    } else {
      // Print method - just move to confirmation
      setCurrentStep(3);
    }
  };

  const validateBankAccount = (): boolean => {
    if (!isRefund) return true; // No bank account needed if owing money
    
    return (
      bankAccount.routingNumber.length === 9 &&
      bankAccount.accountNumber.length >= 4 &&
      bankAccount.accountNumber.length <= 17
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return filingMethod !== "";
      case 1:
        if (filingMethod === "efile") {
          return signatureConsent && validateBankAccount();
        }
        return true;
      case 2:
        return true;
      default:
        return false;
    }
  };

  if (returnsLoading || formLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentReturn || !form1040) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          Please complete your tax return before filing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">
          File Your Tax Return
        </h1>
        <p className="text-lg text-muted-foreground">
          Choose your filing method and complete your {currentReturn.taxYear} tax return.
        </p>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  step.completed 
                    ? "bg-primary text-primary-foreground" 
                    : index === currentStep 
                    ? "bg-primary/20 text-primary" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  {step.completed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground mx-4" />
                )}
              </div>
            ))}
          </div>
          <Progress value={(currentStep / (steps.length - 1)) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[currentStep].title}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 0: Choose Filing Method */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <RadioGroup value={filingMethod} onValueChange={(value: any) => setFilingMethod(value)}>
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50">
                  <RadioGroupItem value="efile" id="efile" />
                  <Label htmlFor="efile" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Send className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">E-file (Recommended)</p>
                        <p className="text-sm text-muted-foreground">
                          Submit directly to IRS - fastest processing and confirmation
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50">
                  <RadioGroupItem value="download" id="download" />
                  <Label htmlFor="download" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Download className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Download PDF</p>
                        <p className="text-sm text-muted-foreground">
                          Download forms to file manually or with tax software
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
                
                <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-accent/50">
                  <RadioGroupItem value="print" id="print" />
                  <Label htmlFor="print" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Printer className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Print & Mail</p>
                        <p className="text-sm text-muted-foreground">
                          Print forms and mail to IRS (slower processing)
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Step 1: Provide Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {filingMethod === "efile" && (
                <>
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Bank Account Information</h3>
                    <p className="text-sm text-muted-foreground">
                      {isRefund 
                        ? "Enter your bank account details for direct deposit of your refund."
                        : "Bank account information is optional when you owe taxes."
                      }
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="routing">Routing Number</Label>
                        <Input
                          id="routing"
                          value={bankAccount.routingNumber}
                          onChange={(e) => setBankAccount(prev => ({ ...prev, routingNumber: e.target.value }))}
                          placeholder="123456789"
                          maxLength={9}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="account">Account Number</Label>
                        <Input
                          id="account"
                          value={bankAccount.accountNumber}
                          onChange={(e) => setBankAccount(prev => ({ ...prev, accountNumber: e.target.value }))}
                          placeholder="1234567890"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Account Type</Label>
                      <RadioGroup value={bankAccount.accountType} onValueChange={(value: any) => setBankAccount(prev => ({ ...prev, accountType: value }))}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="checking" id="checking" />
                          <Label htmlFor="checking">Checking</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="savings" id="savings" />
                          <Label htmlFor="savings">Savings</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="signature"
                      checked={signatureConsent}
                      onCheckedChange={(checked) => setSignatureConsent(checked as boolean)}
                    />
                    <Label htmlFor="signature" className="text-sm">
                      I consent to electronically sign this tax return and understand that this signature has the same legal effect as a handwritten signature.
                    </Label>
                  </div>
                </>
              )}
              
              {filingMethod === "download" && (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Your PDF will be generated with all necessary forms and instructions.
                  </p>
                </div>
              )}
              
              {filingMethod === "print" && (
                <div className="text-center py-8">
                  <Printer className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    You'll receive instructions for printing and mailing your forms.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Review & Submit */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Tax Return Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Tax Year:</span>
                    <span className="ml-2 font-medium">{currentReturn.taxYear}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Filing Status:</span>
                    <span className="ml-2 font-medium">{currentReturn.filingStatus.replace(/_/g, " ")}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Income:</span>
                    <span className="ml-2 font-medium">${parseFloat(form1040.totalIncome || "0").toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Tax:</span>
                    <span className="ml-2 font-medium">${parseFloat(form1040.totalTax || "0").toLocaleString()}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">
                      {isRefund ? "Refund Amount:" : "Amount Owed:"}
                    </span>
                    <span className={`ml-2 font-medium ${isRefund ? "text-green-600" : "text-red-600"}`}>
                      ${Math.abs(refundOrOwed).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <h3 className="font-medium mb-2">Filing Method</h3>
                <div className="flex items-center gap-2">
                  {filingMethod === "efile" && <Send className="h-4 w-4" />}
                  {filingMethod === "download" && <Download className="h-4 w-4" />}
                  {filingMethod === "print" && <Printer className="h-4 w-4" />}
                  <span className="capitalize">{filingMethod.replace("_", " ")}</span>
                </div>
              </div>
              
              {filingMethod === "efile" && bankAccount.routingNumber && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Bank Account</h3>
                  <p className="text-sm text-muted-foreground">
                    ****{bankAccount.accountNumber.slice(-4)} ({bankAccount.accountType})
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirmation */}
          {currentStep === 3 && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-xl font-medium mb-2">
                {filingMethod === "efile" ? "Tax Return Submitted Successfully!" : "Tax Forms Ready!"}
              </h3>
              <p className="text-muted-foreground mb-6">
                {filingMethod === "efile" 
                  ? "Your tax return has been submitted to the IRS. You'll receive confirmation within 24 hours."
                  : "Your tax forms are ready for filing. Follow the instructions provided."
                }
              </p>
              
              {filingMethod === "efile" && (
                <div className="bg-muted/50 p-4 rounded-lg max-w-md mx-auto">
                  <p className="text-sm text-muted-foreground">
                    Keep your acknowledgment number for your records.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        
        {currentStep < steps.length - 1 ? (
          <Button
            onClick={currentStep === 2 ? handleSubmit : handleNext}
            disabled={!canProceed() || efileMutation.isPending || downloadMutation.isPending}
          >
            {currentStep === 2 ? (
              <>
                {(efileMutation.isPending || downloadMutation.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {filingMethod === "efile" ? "Submit to IRS" : 
                 filingMethod === "download" ? "Download PDF" : 
                 "Complete"}
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button onClick={() => window.location.href = "/dashboard"}>
            Return to Dashboard
          </Button>
        )}
      </div>
    </div>
  );
}
