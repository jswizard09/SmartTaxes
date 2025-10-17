import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar, Loader2, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TaxYear {
  id: string;
  year: number;
  isActive: boolean;
  federalDeadline: string;
  stateDeadlines: Record<string, string | null>;
}

export function YearSelector() {
  const queryClient = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newYear, setNewYear] = useState("");

  const { data: activeYear, isLoading: activeYearLoading } = useQuery<TaxYear | null>({
    queryKey: ["/api/tax-config/active-year"],
    enabled: !!localStorage.getItem("token"),
  });

  const { data: availableYears, isLoading: yearsLoading } = useQuery<TaxYear[]>({
    queryKey: ["/api/tax-config/years"],
    enabled: !!localStorage.getItem("token"),
  });

  const setActiveYearMutation = useMutation({
    mutationFn: async (year: number) => {
      const response = await fetch("/api/tax-config/set-active-year", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ year }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to set active year");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate and refetch active year and available years
      queryClient.invalidateQueries({ queryKey: ["/api/tax-config/active-year"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tax-config/years"] });
      toast({
        title: "Tax Year Updated",
        description: `Successfully switched to ${data.year} tax year`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleYearChange = async (year: string) => {
    const yearNum = parseInt(year);
    if (yearNum === activeYear?.year) return;

    setIsChanging(true);
    try {
      await setActiveYearMutation.mutateAsync(yearNum);
    } finally {
      setIsChanging(false);
    }
  };

  const handleAddYear = async () => {
    const yearNum = parseInt(newYear);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2030) {
      toast({
        title: "Invalid Year",
        description: "Please enter a valid year between 2000 and 2030",
        variant: "destructive",
      });
      return;
    }

    setIsChanging(true);
    try {
      await setActiveYearMutation.mutateAsync(yearNum);
      setIsAddDialogOpen(false);
      setNewYear("");
    } finally {
      setIsChanging(false);
    }
  };

  if (activeYearLoading || yearsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading tax years...</span>
      </div>
    );
  }

  if (!availableYears || availableYears.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Calendar className="h-4 w-4" />
        <span>No tax years available</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select
        value={activeYear?.year?.toString() || ""}
        onValueChange={handleYearChange}
        disabled={isChanging}
      >
        <SelectTrigger className="w-32 h-8">
          <SelectValue placeholder="Select year" />
        </SelectTrigger>
        <SelectContent>
          {availableYears.map((year) => (
            <SelectItem key={year.id} value={year.year.toString()}>
              {year.year}
              {year.isActive && " (Active)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Tax Year</DialogTitle>
            <DialogDescription>
              Add a new tax year to work with. The system will create basic tax brackets and deductions for this year.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="year" className="text-right">
                Year
              </label>
              <Input
                id="year"
                type="number"
                min="2000"
                max="2030"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="col-span-3"
                placeholder="e.g., 2023"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddYear} disabled={isChanging || !newYear}>
              {isChanging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Year"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {isChanging && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
