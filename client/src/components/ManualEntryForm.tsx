import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";
import type { Insert1099Div, Insert1099Int, Insert1099B } from "@shared/schema";
import { DOCUMENT_TYPES } from "@shared/schema";

interface ManualEntryFormProps {
  documentType: "1099-DIV" | "1099-INT" | "1099-B";
  onAdd: (data: Insert1099Div | Insert1099Int | Insert1099B) => void;
  taxReturnId: string;
  documentId?: string;
}

export default function ManualEntryForm({ documentType, onAdd, taxReturnId, documentId }: ManualEntryFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<any>({
    payerName: "",
    payerTin: "",
    ...(documentType === "1099-DIV" && {
      ordinaryDividends: "",
      qualifiedDividends: "",
      totalCapitalGain: "",
    }),
    ...(documentType === "1099-INT" && {
      interestIncome: "",
      earlyWithdrawalPenalty: "",
    }),
    ...(documentType === "1099-B" && {
      description: "",
      dateAcquired: "",
      dateSold: "",
      proceeds: "",
      costBasis: "",
    }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      taxReturnId,
      documentId: documentId || null,
      ...formData,
    };
    
    onAdd(submitData);
    setIsOpen(false);
    setFormData({
      payerName: "",
      payerTin: "",
      ...(documentType === "1099-DIV" && {
        ordinaryDividends: "",
        qualifiedDividends: "",
        totalCapitalGain: "",
      }),
      ...(documentType === "1099-INT" && {
        interestIncome: "",
        earlyWithdrawalPenalty: "",
      }),
      ...(documentType === "1099-B" && {
        description: "",
        dateAcquired: "",
        dateSold: "",
        proceeds: "",
        costBasis: "",
      }),
    });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const getFormFields = () => {
    switch (documentType) {
      case DOCUMENT_TYPES.FORM_1099_DIV:
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="ordinaryDividends">Ordinary Dividends</Label>
              <Input
                id="ordinaryDividends"
                type="number"
                step="0.01"
                value={formData.ordinaryDividends}
                onChange={(e) => handleInputChange("ordinaryDividends", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qualifiedDividends">Qualified Dividends</Label>
              <Input
                id="qualifiedDividends"
                type="number"
                step="0.01"
                value={formData.qualifiedDividends}
                onChange={(e) => handleInputChange("qualifiedDividends", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="totalCapitalGain">Total Capital Gain</Label>
              <Input
                id="totalCapitalGain"
                type="number"
                step="0.01"
                value={formData.totalCapitalGain}
                onChange={(e) => handleInputChange("totalCapitalGain", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </>
        );
      case DOCUMENT_TYPES.FORM_1099_INT:
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="interestIncome">Interest Income</Label>
              <Input
                id="interestIncome"
                type="number"
                step="0.01"
                value={formData.interestIncome}
                onChange={(e) => handleInputChange("interestIncome", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="earlyWithdrawalPenalty">Early Withdrawal Penalty</Label>
              <Input
                id="earlyWithdrawalPenalty"
                type="number"
                step="0.01"
                value={formData.earlyWithdrawalPenalty}
                onChange={(e) => handleInputChange("earlyWithdrawalPenalty", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </>
        );
      case DOCUMENT_TYPES.FORM_1099_B:
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Stock symbol or description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateAcquired">Date Acquired</Label>
              <Input
                id="dateAcquired"
                value={formData.dateAcquired}
                onChange={(e) => handleInputChange("dateAcquired", e.target.value)}
                placeholder="MM/DD/YYYY"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateSold">Date Sold</Label>
              <Input
                id="dateSold"
                value={formData.dateSold}
                onChange={(e) => handleInputChange("dateSold", e.target.value)}
                placeholder="MM/DD/YYYY"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proceeds">Proceeds</Label>
              <Input
                id="proceeds"
                type="number"
                step="0.01"
                value={formData.proceeds}
                onChange={(e) => handleInputChange("proceeds", e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="costBasis">Cost Basis</Label>
              <Input
                id="costBasis"
                type="number"
                step="0.01"
                value={formData.costBasis}
                onChange={(e) => handleInputChange("costBasis", e.target.value)}
                placeholder="0.00"
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add {documentType} Manually
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {documentType} Manually</DialogTitle>
          <DialogDescription>
            Enter the information for this {documentType} form manually.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="payerName">Payer Name</Label>
            <Input
              id="payerName"
              value={formData.payerName}
              onChange={(e) => handleInputChange("payerName", e.target.value)}
              placeholder="Company or broker name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payerTin">Payer TIN</Label>
            <Input
              id="payerTin"
              value={formData.payerTin}
              onChange={(e) => handleInputChange("payerTin", e.target.value)}
              placeholder="XX-XXXXXXX"
            />
          </div>
          
          {getFormFields()}
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Add {documentType}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
