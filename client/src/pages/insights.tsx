import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  DollarSign,
  Target,
  ArrowRight,
  Loader2
} from "lucide-react";
import type { TaxReturn } from "@shared/schema";

interface TaxInsight {
  id?: string;
  insightType: string;
  category: string;
  title: string;
  description: string;
  potentialSavings?: number;
  priority: string;
  status: string;
  metadata?: any;
}

export default function Insights() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: taxReturns } = useQuery<TaxReturn[]>({
    queryKey: ["/api/tax-returns"],
  });

  const { data: insights, isLoading } = useQuery<TaxInsight[]>({
    queryKey: ["/api/ai/insights"],
    enabled: !!taxReturns && taxReturns.length > 0,
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai/optimize-taxes", {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Tax optimization complete",
        description: `Generated ${data.insights?.length || 0} insights for your tax return.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights"] });
    },
    onError: (error: any) => {
      toast({
        title: "Optimization failed",
        description: error.message || "Failed to generate tax insights. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateInsightMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // This would typically call an API to update the insight status
      console.log(`Updating insight ${id} to ${status}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/insights"] });
    },
  });

  const categories = [
    { id: "all", label: "All Insights", icon: Lightbulb },
    { id: "deduction", label: "Deductions", icon: DollarSign },
    { id: "optimization", label: "Optimization", icon: TrendingUp },
    { id: "planning", label: "Year Ahead", icon: Calendar },
    { id: "risk", label: "Audit Risks", icon: AlertTriangle },
  ];

  const filteredInsights = insights?.filter(insight => 
    selectedCategory === "all" || insight.category === selectedCategory
  ) || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "deduction":
        return DollarSign;
      case "optimization":
        return TrendingUp;
      case "planning":
        return Calendar;
      case "risk":
        return AlertTriangle;
      default:
        return Lightbulb;
    }
  };

  const getInsightTypeLabel = (type: string) => {
    switch (type) {
      case "document":
        return "Document Analysis";
      case "consolidated":
        return "Tax Optimization";
      case "year_ahead":
        return "Year Ahead Planning";
      case "audit_risk":
        return "Audit Risk Assessment";
      default:
        return "General Insight";
    }
  };

  const totalPotentialSavings = filteredInsights.reduce((sum, insight) => 
    sum + (insight.potentialSavings || 0), 0
  );

  const acceptedInsights = filteredInsights.filter(i => i.status === "accepted").length;
  const totalInsights = filteredInsights.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">
          AI Tax Insights
        </h1>
        <p className="text-lg text-muted-foreground">
          Discover opportunities to optimize your tax return and plan for next year.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
            <Lightbulb className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {isLoading ? "..." : totalInsights}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {acceptedInsights} accepted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            <DollarSign className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-green-600">
              ${totalPotentialSavings.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Across all insights
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono text-red-600">
              {filteredInsights.filter(i => i.priority === "high").length}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion</CardTitle>
            <Target className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">
              {totalInsights > 0 ? Math.round((acceptedInsights / totalInsights) * 100) : 0}%
            </div>
            <Progress 
              value={totalInsights > 0 ? (acceptedInsights / totalInsights) * 100 : 0} 
              className="mt-2" 
            />
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button 
          onClick={() => optimizeMutation.mutate()} 
          disabled={optimizeMutation.isPending}
          className="flex items-center gap-2"
        >
          {optimizeMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TrendingUp className="h-4 w-4" />
          )}
          Generate New Insights
        </Button>
      </div>

      {/* Category Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Insights</CardTitle>
          <CardDescription>View insights by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {category.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Insights List */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Insights</CardTitle>
          <CardDescription>
            {isLoading 
              ? "Loading insights..." 
              : `${filteredInsights.length} insight(s) found`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInsights.length === 0 ? (
            <div className="text-center py-8">
              <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No insights available yet. Generate insights to get started.
              </p>
              <Button onClick={() => optimizeMutation.mutate()}>
                Generate Insights
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInsights.map((insight, index) => {
                const CategoryIcon = getCategoryIcon(insight.category);
                return (
                  <div
                    key={insight.id || index}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover-elevate"
                  >
                    <div className="flex-shrink-0">
                      <div className="rounded-full p-2 bg-primary/10">
                        <CategoryIcon className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-foreground">{insight.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {insight.description}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {insight.potentialSavings && insight.potentialSavings > 0 && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              Save ${insight.potentialSavings.toLocaleString()}
                            </Badge>
                          )}
                          <Badge className={getPriorityColor(insight.priority)}>
                            {insight.priority}
                          </Badge>
                          <Badge variant="outline">
                            {getInsightTypeLabel(insight.insightType)}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3">
                        {insight.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateInsightMutation.mutate({ 
                                id: insight.id || index.toString(), 
                                status: "accepted" 
                              })}
                              className="flex items-center gap-1"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateInsightMutation.mutate({ 
                                id: insight.id || index.toString(), 
                                status: "dismissed" 
                              })}
                              className="flex items-center gap-1"
                            >
                              <XCircle className="h-3 w-3" />
                              Dismiss
                            </Button>
                          </>
                        )}
                        
                        {insight.status === "accepted" && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Accepted
                          </Badge>
                        )}
                        
                        {insight.status === "dismissed" && (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Dismissed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <CardDescription>Recommended actions based on your insights</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Review and accept high-priority insights</span>
            </div>
            <div className="flex items-center gap-3">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Update your tax calculations with accepted recommendations</span>
            </div>
            <div className="flex items-center gap-3">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Plan for next year using year-ahead insights</span>
            </div>
            <div className="flex items-center gap-3">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Address any audit risk concerns</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
