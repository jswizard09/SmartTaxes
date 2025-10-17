import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save } from "lucide-react";
import type { Form1099BEntry } from "@shared/schema";

interface Form1099BTableProps {
  entries: Form1099BEntry[];
  onAddEntry: (entry: Omit<Form1099BEntry, "id" | "form1099BId">) => void;
  onUpdateEntry: (id: string, entry: Partial<Form1099BEntry>) => void;
  onBatchUpdateEntries: (updates: Array<{ id: string; data: Partial<Form1099BEntry> }>) => void;
  onDeleteEntry: (id: string) => void;
  form1099BId: string;
}

export default function Form1099BTable({
  entries,
  onAddEntry,
  onUpdateEntry,
  onBatchUpdateEntries,
  onDeleteEntry,
  form1099BId,
}: Form1099BTableProps) {
  const [entryData, setEntryData] = useState<Record<string, Form1099BEntry & { washSaleAmount?: string | null }>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Get current tax year (assuming 2024 for now, but could be dynamic)
  const getCurrentTaxYear = () => {
    return "2024";
  };

  const getTaxYearRange = () => {
    const year = getCurrentTaxYear();
    return {
      startDate: `01/01/${year}`,
      endDate: `12/31/${year}`
    };
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "$0.00";
    return `$${parseFloat(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const parseCurrency = (value: string) => {
    return value.replace(/[$,]/g, "");
  };

  const formatCurrencyInput = (value: string) => {
    // Remove all non-numeric characters except decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    // Ensure only one decimal point
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      return parts[0] + "." + parts.slice(1).join("");
    }
    return cleaned;
  };

  const handleCurrencyInputChange = (entryId: string, field: string, value: string) => {
    const formattedValue = formatCurrencyInput(value);
    handleInputChange(entryId, field, formattedValue);
  };

  // Initialize entry data when entries change
  React.useEffect(() => {
    const newEntryData: Record<string, Form1099BEntry & { washSaleAmount?: string | null }> = {};
    entries.forEach(entry => {
      newEntryData[entry.id] = {
        ...entry,
        washSaleAmount: (entry as any).washSaleAmount || null,
      };
    });
    setEntryData(newEntryData);
    
    // Check if there are any changes to show save button
    const hasAnyChanges = Object.keys(newEntryData).length > 0;
    setHasChanges(hasAnyChanges);
  }, [entries]);

  const handleInputChange = (entryId: string, field: string, value: any) => {
    setEntryData(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        [field]: value,
      }
    }));
    setHasChanges(true);
  };

  const handleBatchSave = () => {
    const updates = Object.entries(entryData).map(([id, data]) => {
      const { washSaleAmount, ...updateData } = data;
      
      // Clean numeric values by removing commas and ensuring proper decimal format
      const cleanedData = {
        description: updateData.description || null,
        dateAcquired: updateData.dateAcquired || null,
        dateSold: updateData.dateSold || null,
        proceeds: updateData.proceeds ? parseCurrency(updateData.proceeds) : null,
        costBasis: updateData.costBasis ? parseCurrency(updateData.costBasis) : null,
        gainLoss: updateData.gainLoss ? parseCurrency(updateData.gainLoss) : null,
        isShortTerm: updateData.isShortTerm || false,
        reportedToIrs: updateData.reportedToIrs || false,
        washSale: updateData.washSale || false,
        washSaleAmount: washSaleAmount ? parseCurrency(washSaleAmount) : null,
      };

      // Calculate gain/loss if both proceeds and costBasis are present
      if (cleanedData.proceeds && cleanedData.costBasis) {
        const proceeds = parseFloat(cleanedData.proceeds);
        const costBasis = parseFloat(cleanedData.costBasis);
        const washSaleAmountValue = washSaleAmount ? parseFloat(parseCurrency(washSaleAmount)) : 0;
        
        // For wash sales, the wash sale amount should be subtracted from the cost basis
        // This effectively increases the gain or reduces the loss
        const adjustedCostBasis = costBasis - washSaleAmountValue;
        const gainLoss = proceeds - adjustedCostBasis;
        cleanedData.gainLoss = gainLoss.toString();
      }

      return { id, data: cleanedData };
    });

    console.log("Form1099BTable - Sending batch update:", { updates });
    onBatchUpdateEntries(updates);
    setHasChanges(false);
  };

  const handleAddNew = () => {
    // Get the last entry to prefill some common data
    const lastEntry = entries[entries.length - 1];
    const taxYearRange = getTaxYearRange();
    const newEntry: Omit<Form1099BEntry, "id" | "form1099BId"> = {
      description: lastEntry?.description || "",
      dateAcquired: taxYearRange.startDate,
      dateSold: taxYearRange.endDate,
      proceeds: "",
      costBasis: "",
      gainLoss: "",
      isShortTerm: lastEntry?.isShortTerm || true,
      reportedToIrs: lastEntry?.reportedToIrs || false,
      washSale: false,
      washSaleAmount: null,
    };
    onAddEntry(newEntry);
  };

  const calculateTotalGainLoss = () => {
    return entries.reduce((total, entry) => {
      // Recalculate gain/loss for each entry to ensure wash sale amounts are considered
      if (entry.proceeds && entry.costBasis) {
        const proceeds = parseFloat(entry.proceeds);
        const costBasis = parseFloat(entry.costBasis);
        const washSaleAmount = parseFloat((entry as any).washSaleAmount || "0");
        
        // For wash sales, subtract wash sale amount from cost basis
        const adjustedCostBasis = costBasis - washSaleAmount;
        const gainLoss = proceeds - adjustedCostBasis;
        return total + gainLoss;
      } else if (entry.gainLoss) {
        // Fallback to stored gainLoss if proceeds/costBasis not available
        return total + parseFloat(entry.gainLoss);
      }
      return total;
    }, 0);
  };

  const shortTermTotal = entries
    .filter(entry => entry.isShortTerm)
    .reduce((total, entry) => {
      // Recalculate gain/loss for each entry to ensure wash sale amounts are considered
      if (entry.proceeds && entry.costBasis) {
        const proceeds = parseFloat(entry.proceeds);
        const costBasis = parseFloat(entry.costBasis);
        const washSaleAmount = parseFloat((entry as any).washSaleAmount || "0");
        
        // For wash sales, subtract wash sale amount from cost basis
        const adjustedCostBasis = costBasis - washSaleAmount;
        const gainLoss = proceeds - adjustedCostBasis;
        return total + gainLoss;
      } else if (entry.gainLoss) {
        // Fallback to stored gainLoss if proceeds/costBasis not available
        return total + parseFloat(entry.gainLoss);
      }
      return total;
    }, 0);

  const longTermTotal = entries
    .filter(entry => !entry.isShortTerm)
    .reduce((total, entry) => {
      // Recalculate gain/loss for each entry to ensure wash sale amounts are considered
      if (entry.proceeds && entry.costBasis) {
        const proceeds = parseFloat(entry.proceeds);
        const costBasis = parseFloat(entry.costBasis);
        const washSaleAmount = parseFloat((entry as any).washSaleAmount || "0");
        
        // For wash sales, subtract wash sale amount from cost basis
        const adjustedCostBasis = costBasis - washSaleAmount;
        const gainLoss = proceeds - adjustedCostBasis;
        return total + gainLoss;
      } else if (entry.gainLoss) {
        // Fallback to stored gainLoss if proceeds/costBasis not available
        return total + parseFloat(entry.gainLoss);
      }
      return total;
    }, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>1099-B Capital Gains/Losses</CardTitle>
            <CardDescription>
              Enter summarized capital gains/losses for the tax year. Each row represents a short or long-term position.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button onClick={handleBatchSave} size="sm" variant="default">
                <Save className="h-4 w-4 mr-2" />
                Save All Changes
              </Button>
            )}
            <Button onClick={handleAddNew} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Tax Year</TableHead>
                <TableHead>Proceeds</TableHead>
                <TableHead>Cost Basis</TableHead>
                <TableHead>Gain/Loss</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Reported to IRS</TableHead>
                <TableHead>Wash Sale</TableHead>
                <TableHead>Wash Sale Amount</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    No entries yet. Click "Add Entry" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => {
                  const currentData = entryData[entry.id] || entry;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Input
                          value={currentData.description || ""}
                          onChange={(e) => handleInputChange(entry.id, "description", e.target.value)}
                          placeholder="Stock symbol or description"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {getTaxYearRange().startDate} - {getTaxYearRange().endDate}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={currentData.proceeds || ""}
                          onChange={(e) => handleCurrencyInputChange(entry.id, "proceeds", e.target.value)}
                          placeholder="0.00"
                          type="text"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={currentData.costBasis || ""}
                          onChange={(e) => handleCurrencyInputChange(entry.id, "costBasis", e.target.value)}
                          placeholder="0.00"
                          type="text"
                        />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Calculate the actual gain/loss including wash sale adjustments
                          let displayGainLoss = "0";
                          if (currentData.proceeds && currentData.costBasis) {
                            const proceeds = parseFloat(currentData.proceeds);
                            const costBasis = parseFloat(currentData.costBasis);
                            const washSaleAmount = parseFloat(currentData.washSaleAmount || "0");
                            
                            // For wash sales, subtract wash sale amount from cost basis
                            const adjustedCostBasis = costBasis - washSaleAmount;
                            const gainLoss = proceeds - adjustedCostBasis;
                            displayGainLoss = gainLoss.toString();
                          } else if (currentData.gainLoss) {
                            displayGainLoss = currentData.gainLoss;
                          }
                          
                          const gainLossValue = parseFloat(displayGainLoss);
                          return (
                            <span className={`font-mono ${gainLossValue >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {formatCurrency(displayGainLoss)}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <select
                          value={currentData.isShortTerm ? "short" : "long"}
                          onChange={(e) => handleInputChange(entry.id, "isShortTerm", e.target.value === "short")}
                          className="px-2 py-1 border rounded text-sm"
                        >
                          <option value="short">Short-term</option>
                          <option value="long">Long-term</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={currentData.reportedToIrs || false}
                          onCheckedChange={(checked) => handleInputChange(entry.id, "reportedToIrs", checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Checkbox
                          checked={currentData.washSale || false}
                          onCheckedChange={(checked) => handleInputChange(entry.id, "washSale", checked)}
                        />
                      </TableCell>
                      <TableCell>
                        {currentData.washSale ? (
                          <Input
                            value={currentData.washSaleAmount || ""}
                            onChange={(e) => handleCurrencyInputChange(entry.id, "washSaleAmount", e.target.value)}
                            placeholder="0.00"
                            className="w-20"
                            type="text"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeleteEntry(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {entries.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-center py-2 border-t">
              <span className="font-medium">Short-term Total:</span>
              <span className={`font-mono font-semibold ${shortTermTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(shortTermTotal.toString())}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-t">
              <span className="font-medium">Long-term Total:</span>
              <span className={`font-mono font-semibold ${longTermTotal >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(longTermTotal.toString())}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-t-2 border-primary">
              <span className="font-semibold text-lg">Total Gain/Loss:</span>
              <span className={`font-mono font-bold text-lg ${calculateTotalGainLoss() >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(calculateTotalGainLoss().toString())}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
