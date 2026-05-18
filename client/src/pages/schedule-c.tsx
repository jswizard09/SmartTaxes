import { useState } from "react";
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
  Plus,
  Trash2,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Save,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface BusinessEntry {
  id: string;
  businessName: string;
  ein?: string;
  businessCode?: string;
  // Part I — Income
  grossReceipts?: string;
  returns?: string;
  otherIncome?: string;
  // Part II — Expenses
  advertising?: string;
  carTruck?: string;
  commissions?: string;
  contractLabor?: string;
  depletion?: string;
  depreciation?: string;
  employeeBenefits?: string;
  insurance?: string;
  interestMortgage?: string;
  interestOther?: string;
  legal?: string;
  meals?: string;
  officeExpense?: string;
  pensionProfit?: string;
  rent?: string;
  repairs?: string;
  supplies?: string;
  taxes?: string;
  travel?: string;
  utilities?: string;
  wages?: string;
  otherExpenses?: string;
}

interface NewBusinessForm {
  businessName: string;
  ein: string;
  businessCode: string;
}

const EMPTY_BUSINESS: Omit<BusinessEntry, "id"> = {
  businessName: "",
  ein: "",
  businessCode: "",
  grossReceipts: "",
  returns: "",
  otherIncome: "",
  advertising: "",
  carTruck: "",
  commissions: "",
  contractLabor: "",
  depletion: "",
  depreciation: "",
  employeeBenefits: "",
  insurance: "",
  interestMortgage: "",
  interestOther: "",
  legal: "",
  meals: "",
  officeExpense: "",
  pensionProfit: "",
  rent: "",
  repairs: "",
  supplies: "",
  taxes: "",
  travel: "",
  utilities: "",
  wages: "",
  otherExpenses: "",
};

const toNum = (val: string | undefined): number => parseFloat(val || "0") || 0;

const fmt = (n: number): string =>
  `$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function computeBusiness(b: BusinessEntry) {
  const grossIncome =
    toNum(b.grossReceipts) - toNum(b.returns) + toNum(b.otherIncome);

  const totalExpenses =
    toNum(b.advertising) +
    toNum(b.carTruck) +
    toNum(b.commissions) +
    toNum(b.contractLabor) +
    toNum(b.depletion) +
    toNum(b.depreciation) +
    toNum(b.employeeBenefits) +
    toNum(b.insurance) +
    toNum(b.interestMortgage) +
    toNum(b.interestOther) +
    toNum(b.legal) +
    toNum(b.meals) +
    toNum(b.officeExpense) +
    toNum(b.pensionProfit) +
    toNum(b.rent) +
    toNum(b.repairs) +
    toNum(b.supplies) +
    toNum(b.taxes) +
    toNum(b.travel) +
    toNum(b.utilities) +
    toNum(b.wages) +
    toNum(b.otherExpenses);

  const netProfit = grossIncome - totalExpenses;
  return { grossIncome, totalExpenses, netProfit };
}

interface BusinessCardProps {
  business: BusinessEntry;
  onUpdate: (updated: BusinessEntry) => void;
  onDelete: (id: string) => void;
  isSaving: boolean;
  isDeleting: boolean;
}

function BusinessCard({ business, onUpdate, onDelete, isSaving, isDeleting }: BusinessCardProps) {
  const [expanded, setExpanded] = useState(true);
  const { grossIncome, totalExpenses, netProfit } = computeBusiness(business);
  const isProfit = netProfit >= 0;
  const seTax = isProfit ? netProfit * 0.1413 : 0;

  const set = (field: keyof BusinessEntry) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onUpdate({ ...business, [field]: e.target.value });

  const numField = (
    id: keyof BusinessEntry,
    label: string
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`${business.id}-${id}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={`${business.id}-${id}`}
        type="number"
        min="0"
        step="0.01"
        placeholder="0.00"
        value={(business[id] as string) || ""}
        onChange={set(id)}
        className="h-8 text-sm"
      />
    </div>
  );

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Briefcase className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <Input
                  value={business.businessName}
                  onChange={set("businessName")}
                  placeholder="Business Name"
                  className="font-semibold text-base border-0 px-0 h-7 focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">EIN (optional)</Label>
                <Input
                  value={business.ein || ""}
                  onChange={set("ein")}
                  placeholder="XX-XXXXXXX"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Business Code</Label>
                <Input
                  value={business.businessCode || ""}
                  onChange={set("businessCode")}
                  placeholder="e.g. 541511"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge
              className={
                isProfit
                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
              }
            >
              {isProfit ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {isProfit ? "Profit" : "Loss"} {fmt(netProfit)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* Part I: Income */}
          <div>
            <h4 className="font-medium text-foreground mb-3 text-sm uppercase tracking-wide">
              Part I — Income
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {numField("grossReceipts", "Gross Receipts / Sales")}
              {numField("returns", "Returns & Allowances (subtract)")}
              {numField("otherIncome", "Other Income")}
            </div>
            <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg mt-3">
              <span className="text-sm font-medium">Gross Income</span>
              <span className="font-mono font-semibold">{fmt(grossIncome)}</span>
            </div>
          </div>

          {/* Part II: Expenses */}
          <div>
            <h4 className="font-medium text-foreground mb-3 text-sm uppercase tracking-wide">
              Part II — Expenses
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {numField("advertising", "Advertising")}
              {numField("carTruck", "Car & Truck")}
              {numField("commissions", "Commissions & Fees")}
              {numField("contractLabor", "Contract Labor")}
              {numField("depletion", "Depletion")}
              {numField("depreciation", "Depreciation")}
              {numField("employeeBenefits", "Employee Benefits")}
              {numField("insurance", "Insurance (non-health)")}
              {numField("interestMortgage", "Interest — Mortgage")}
              {numField("interestOther", "Interest — Other")}
              {numField("legal", "Legal & Professional")}
              {numField("meals", "Meals (50% deductible)")}
              {numField("officeExpense", "Office Expense")}
              {numField("pensionProfit", "Pension & Profit-Sharing")}
              {numField("rent", "Rent / Lease")}
              {numField("repairs", "Repairs & Maintenance")}
              {numField("supplies", "Supplies")}
              {numField("taxes", "Taxes & Licenses")}
              {numField("travel", "Travel")}
              {numField("utilities", "Utilities")}
              {numField("wages", "Wages")}
              {numField("otherExpenses", "Other Expenses")}
            </div>
            <div className="flex items-center justify-between p-3 bg-accent/50 rounded-lg mt-3">
              <span className="text-sm font-medium">Total Expenses</span>
              <span className="font-mono font-semibold">{fmt(totalExpenses)}</span>
            </div>
          </div>

          {/* Net Profit/Loss */}
          <div
            className={`p-4 rounded-lg border-2 ${
              isProfit
                ? "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700"
                : "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">
                  Net {isProfit ? "Profit" : "Loss"}
                </p>
                {isProfit && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SE tax estimate (deductible half): {fmt(seTax)}
                  </p>
                )}
              </div>
              <span
                className={`font-mono font-bold text-xl ${
                  isProfit
                    ? "text-green-700 dark:text-green-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {isProfit ? "" : "-"}{fmt(netProfit)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(business.id)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete Business
            </Button>
            <Button
              size="sm"
              onClick={() => onUpdate(business)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function ScheduleCPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState<NewBusinessForm>({
    businessName: "",
    ein: "",
    businessCode: "",
  });
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: businesses = [], isLoading } = useQuery<BusinessEntry[]>({
    queryKey: ["/api/schedule-c"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: NewBusinessForm) => {
      const response = await apiRequest("POST", "/api/schedule-c", {
        ...EMPTY_BUSINESS,
        ...data,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Business added", description: "New Schedule C entry created." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-c"] });
      setShowAddForm(false);
      setNewForm({ businessName: "", ein: "", businessCode: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add business",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: BusinessEntry) => {
      const { id, ...body } = data;
      const response = await apiRequest("PUT", `/api/schedule-c/${id}`, body);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Business entry updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-c"] });
      setSavingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setSavingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/schedule-c/${id}`, undefined);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Business entry removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/schedule-c"] });
      setDeletingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
      setDeletingId(null);
    },
  });

  const handleUpdate = (business: BusinessEntry) => {
    setSavingId(business.id);
    updateMutation.mutate(business);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  const totalNetProfit = businesses.reduce((sum, b) => {
    const { netProfit } = computeBusiness(b);
    return sum + netProfit;
  }, 0);

  const totalSETax = totalNetProfit > 0 ? totalNetProfit * 0.1413 : 0;

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
        <h1 className="text-4xl font-bold text-foreground mb-2">Schedule C</h1>
        <p className="text-lg text-muted-foreground">
          Profit or Loss from Business — for freelancers, sole proprietors, and independent
          contractors. Each separate business activity gets its own Schedule C.
        </p>
      </div>

      {/* Add Business Button / Form */}
      {!showAddForm ? (
        <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Business
        </Button>
      ) : (
        <Card className="border-dashed border-2 border-primary/40">
          <CardHeader>
            <CardTitle>New Business</CardTitle>
            <CardDescription>Enter basic information to create a new Schedule C entry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="new-businessName">Business Name *</Label>
              <Input
                id="new-businessName"
                placeholder="e.g. Jane's Consulting"
                value={newForm.businessName}
                onChange={(e) => setNewForm((f) => ({ ...f, businessName: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="new-ein">EIN (optional)</Label>
                <Input
                  id="new-ein"
                  placeholder="XX-XXXXXXX"
                  value={newForm.ein}
                  onChange={(e) => setNewForm((f) => ({ ...f, ein: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-businessCode">Business Code</Label>
                <Input
                  id="new-businessCode"
                  placeholder="e.g. 541511"
                  value={newForm.businessCode}
                  onChange={(e) => setNewForm((f) => ({ ...f, businessCode: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                onClick={() => addMutation.mutate(newForm)}
                disabled={!newForm.businessName.trim() || addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Business
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Entries */}
      {businesses.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Businesses Yet</h3>
              <p className="text-sm text-muted-foreground">
                Add a business above to start tracking self-employment income and expenses.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {businesses.map((b) => (
            <BusinessCard
              key={b.id}
              business={b}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              isSaving={savingId === b.id && updateMutation.isPending}
              isDeleting={deletingId === b.id && deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Summary */}
      {businesses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Self-Employment Income Summary</CardTitle>
            <CardDescription>
              Combined results across all Schedule C businesses
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {businesses.map((b) => {
                const { netProfit } = computeBusiness(b);
                const isProfit = netProfit >= 0;
                return (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm text-foreground">
                      {b.businessName || "Unnamed Business"}
                    </span>
                    <span
                      className={`font-mono text-sm font-medium ${
                        isProfit
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isProfit ? "" : "-"}{fmt(netProfit)}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between py-3 bg-accent/50 px-4 rounded-lg mt-2">
                <span className="font-semibold text-foreground">Total Net Self-Employment Income</span>
                <span
                  className={`font-mono font-bold text-lg ${
                    totalNetProfit >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {totalNetProfit < 0 ? "-" : ""}{fmt(totalNetProfit)}
                </span>
              </div>
              {totalNetProfit > 0 && (
                <div className="flex items-center justify-between py-2 px-4 text-sm text-muted-foreground">
                  <span>Estimated SE Tax (deductible half at 14.13%)</span>
                  <span className="font-mono">{fmt(totalSETax)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
