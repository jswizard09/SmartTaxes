import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, AlertCircle, Edit2, Save, X } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import Form1099BTable from "@/components/Form1099BTable";
import ManualEntryForm from "@/components/ManualEntryForm";
import type { Document, W2Data, Form1099Div, Form1099Int, Form1099B, Form1099BEntry } from "@shared/schema";

export default function Review() {
  const queryClient = useQueryClient();
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({});
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [isEditingTab, setIsEditingTab] = useState<Record<string, boolean>>({});

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

  const { data: b1099Entries } = useQuery<Form1099BEntry[]>({
    queryKey: ["/api/1099-b-entries"],
  });

  // Batch update mutations for each document type
  const batchUpdateW2Mutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; data: Partial<W2Data> }>) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/w2-data/batch`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) throw new Error('Failed to update W-2 data');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/w2-data"] });
      toast({ title: "W-2 data updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update W-2 data", variant: "destructive" });
    },
  });

  const batchUpdate1099DivMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; data: Partial<Form1099Div> }>) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/1099-div-data/batch`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) throw new Error('Failed to update 1099-DIV data');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-div-data"] });
      toast({ title: "1099-DIV data updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update 1099-DIV data", variant: "destructive" });
    },
  });

  const batchUpdate1099IntMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; data: Partial<Form1099Int> }>) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/1099-int-data/batch`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) throw new Error('Failed to update 1099-INT data');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-int-data"] });
      toast({ title: "1099-INT data updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update 1099-INT data", variant: "destructive" });
    },
  });

  const batchUpdate1099BMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; data: Partial<Form1099B> }>) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/1099-b-data/batch`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) throw new Error('Failed to update 1099-B data');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-b-data"] });
      toast({ title: "1099-B data updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update 1099-B data", variant: "destructive" });
    },
  });

  // Mutations for 1099-B entries
  const add1099BEntryMutation = useMutation({
    mutationFn: async ({ form1099BId, data }: { form1099BId: string; data: Omit<Form1099BEntry, "id" | "form1099BId"> }) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/1099-b-entries', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ form1099BId, ...data }),
      });
      if (!response.ok) throw new Error('Failed to add 1099-B entry');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-b-entries"] });
      toast({ title: "1099-B entry added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add 1099-B entry", variant: "destructive" });
    },
  });

  const update1099BEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Form1099BEntry> }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/1099-b-entries/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update 1099-B entry');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-b-entries"] });
      toast({ title: "1099-B entry updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update 1099-B entry", variant: "destructive" });
    },
  });

  const delete1099BEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/1099-b-entries/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        },
      });
      if (!response.ok) throw new Error('Failed to delete 1099-B entry');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-b-entries"] });
      toast({ title: "1099-B entry deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete 1099-B entry", variant: "destructive" });
    },
  });

  const batchUpdate1099BEntriesMutation = useMutation({
    mutationFn: async (updates: Array<{ id: string; data: Partial<Form1099BEntry> }>) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/1099-b-entries/batch`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) throw new Error('Failed to update 1099-B entries');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-b-entries"] });
      toast({ title: "1099-B entries updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update 1099-B entries", variant: "destructive" });
    },
  });

  // Mutations for manual entry creation
  const createManual1099DivMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/1099-div-data', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create 1099-DIV');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-div-data"] });
      toast({ title: "1099-DIV created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create 1099-DIV", variant: "destructive" });
    },
  });

  const createManual1099IntMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/1099-int-data', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create 1099-INT');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-int-data"] });
      toast({ title: "1099-INT created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create 1099-INT", variant: "destructive" });
    },
  });

  const createManual1099BMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/1099-b-data', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create 1099-B');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/1099-b-data"] });
      toast({ title: "1099-B created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create 1099-B", variant: "destructive" });
    },
  });

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "$0.00";
    return `$${parseFloat(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Helper functions for editing
  const startTabEditing = useCallback((tabName: string, data: any[]) => {
    setIsEditingTab(prev => ({ ...prev, [tabName]: true }));
    
    // Initialize all field values for this tab
    const initialValues: Record<string, any> = {};
    data.forEach((item) => {
      Object.keys(item).forEach((key) => {
        if (key !== 'id' && key !== 'documentId' && key !== 'documentName') {
          const fieldKey = `${tabName}-${item.id}-${key}`;
          initialValues[fieldKey] = item[key] || "";
        }
      });
    });
    setEditValues(prev => ({ ...prev, ...initialValues }));
  }, []);

  const cancelTabEditing = useCallback((tabName: string) => {
    setIsEditingTab(prev => ({ ...prev, [tabName]: false }));
    
    // Clear all field values for this tab
    setEditValues(prev => {
      const newValues = { ...prev };
      Object.keys(newValues).forEach(key => {
        if (key.startsWith(`${tabName}-`)) {
          delete newValues[key];
        }
      });
      return newValues;
    });
  }, []);

  const saveTabEdits = useCallback(async (tabName: string, data: any[]) => {
    try {
      console.log('saveTabEdits called with:', { tabName, data, editValues });
      
      // Group edits by document ID
      const editsByDocument: Record<string, Record<string, any>> = {};
      
      Object.keys(editValues).forEach(fieldKey => {
        if (fieldKey.startsWith(`${tabName}-`)) {
          // Handle different tab name patterns
          let documentId: string;
          let fieldName: string;
          
          if (tabName === '1099-div' || tabName === '1099-int' || tabName === '1099-b') {
            // For patterns like "1099-div-{uuid}-fieldName"
            // Remove the tab prefix first, then split by the first occurrence of the UUID pattern
            const withoutPrefix = fieldKey.substring(`${tabName}-`.length);
            // UUIDs are 36 characters long (8-4-4-4-12), so we need to find the UUID pattern
            const uuidMatch = withoutPrefix.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-(.+)$/);
            if (uuidMatch) {
              documentId = uuidMatch[1];
              fieldName = uuidMatch[2];
            } else {
              console.warn('Could not parse UUID from field key:', fieldKey);
              return;
            }
          } else {
            // For patterns like "w2-{uuid}-fieldName"
            const withoutPrefix = fieldKey.substring(`${tabName}-`.length);
            const uuidMatch = withoutPrefix.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-(.+)$/);
            if (uuidMatch) {
              documentId = uuidMatch[1];
              fieldName = uuidMatch[2];
            } else {
              console.warn('Could not parse UUID from field key:', fieldKey);
              return;
            }
          }
          
          console.log('Processing field:', { fieldKey, documentId, fieldName, value: editValues[fieldKey] });
          
          if (!editsByDocument[documentId]) {
            editsByDocument[documentId] = {};
          }
          editsByDocument[documentId][fieldName] = editValues[fieldKey];
        }
      });

      console.log('Edits grouped by document:', editsByDocument);

      // Convert to batch update format
      const batchUpdates = Object.entries(editsByDocument).map(([documentId, updateData]) => {
        // Filter out empty strings and convert them to null for numeric fields
        const cleanedUpdateData = Object.entries(updateData).reduce((acc, [key, value]) => {
          // If the value is an empty string, set it to null
          if (value === '') {
            acc[key] = null;
          } else {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, any>);

        return { id: documentId, data: cleanedUpdateData };
      });

      console.log('Batch updates:', batchUpdates);

      // Make single batch API call
      if (batchUpdates.length > 0) {
        switch (tabName) {
          case 'w2':
            await batchUpdateW2Mutation.mutateAsync(batchUpdates);
            break;
          case '1099-div':
            await batchUpdate1099DivMutation.mutateAsync(batchUpdates);
            break;
          case '1099-int':
            await batchUpdate1099IntMutation.mutateAsync(batchUpdates);
            break;
          case '1099-b':
            await batchUpdate1099BMutation.mutateAsync(batchUpdates);
            break;
        }
      }
      
      // Clear editing state
      setIsEditingTab(prev => ({ ...prev, [tabName]: false }));
      setEditValues(prev => {
        const newValues = { ...prev };
        Object.keys(newValues).forEach(key => {
          if (key.startsWith(`${tabName}-`)) {
            delete newValues[key];
          }
        });
        return newValues;
      });
      
      toast({ title: `${tabName.toUpperCase()} data updated successfully` });
    } catch (error) {
      console.error('Failed to save tab edits:', error);
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  }, [editValues, batchUpdateW2Mutation, batchUpdate1099DivMutation, batchUpdate1099IntMutation, batchUpdate1099BMutation]);

  // Editable field component
  const EditableField = useCallback(({ 
    fieldKey, 
    documentId, 
    documentType, 
    fieldName, 
    value, 
    label, 
    type = "text",
    tabName
  }: {
    fieldKey: string;
    documentId: string;
    documentType: string;
    fieldName: string;
    value: string | null | undefined;
    label: string;
    type?: "text" | "number" | "currency";
    tabName: string;
  }) => {
    const isTabEditing = isEditingTab[tabName];
    const displayValue = useMemo(() => 
      type === "currency" ? formatCurrency(value) : (value || "N/A"), 
      [type, value]
    );

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setEditValues(prev => ({ 
        ...prev, 
        [fieldKey]: e.target.value 
      }));
    }, [fieldKey]);

    const isPending = batchUpdateW2Mutation.isPending || batchUpdate1099DivMutation.isPending || batchUpdate1099IntMutation.isPending || batchUpdate1099BMutation.isPending;

    if (isTabEditing) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <Input
            type={type === "currency" ? "number" : type}
            step={type === "currency" ? "0.01" : undefined}
            value={editValues[fieldKey] || ""}
            onChange={handleInputChange}
            className="w-full"
            placeholder={type === "currency" ? "0.00" : ""}
            disabled={isPending}
          />
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-lg font-mono font-semibold ${type === "currency" ? "" : "text-sm font-medium"}`}>
          {displayValue}
        </p>
      </div>
    );
  }, [isEditingTab, editValues, batchUpdateW2Mutation.isPending, batchUpdate1099DivMutation.isPending, batchUpdate1099IntMutation.isPending, batchUpdate1099BMutation.isPending]);

  // Handler functions for 1099-B entries table
  const handleAdd1099BEntry = useCallback((form1099BId: string, data: Omit<Form1099BEntry, "id" | "form1099BId">) => {
    add1099BEntryMutation.mutate({ form1099BId, data });
  }, [add1099BEntryMutation]);

  const handleUpdate1099BEntry = useCallback((id: string, data: Partial<Form1099BEntry>) => {
    update1099BEntryMutation.mutate({ id, data });
  }, [update1099BEntryMutation]);

  const handleDelete1099BEntry = useCallback((id: string) => {
    delete1099BEntryMutation.mutate(id);
  }, [delete1099BEntryMutation]);

  // Handler functions for manual entry forms
  const handleCreateManual1099Div = useCallback((data: any) => {
    createManual1099DivMutation.mutate(data);
  }, [createManual1099DivMutation]);

  const handleCreateManual1099Int = useCallback((data: any) => {
    createManual1099IntMutation.mutate(data);
  }, [createManual1099IntMutation]);

  const handleCreateManual1099B = useCallback((data: any) => {
    createManual1099BMutation.mutate(data);
  }, [createManual1099BMutation]);

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
            <>
              <div className="flex justify-end gap-2 mb-4">
                {isEditingTab['w2'] ? (
                  <>
                    <Button
                      onClick={() => saveTabEdits('w2', w2Data || [])}
                      disabled={batchUpdateW2Mutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save All Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => cancelTabEditing('w2')}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => startTabEditing('w2', w2Data || [])}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit All Fields
                  </Button>
                )}
              </div>
              {w2Data?.map((w2) => (
              <Card key={w2.id} data-testid={`card-w2-${w2.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {isEditingTab['w2'] ? (
                          <Input
                            value={editValues[`w2-${w2.id}-employerName`] || w2.employerName || ""}
                            onChange={(e) => setEditValues(prev => ({ 
                              ...prev, 
                              [`w2-${w2.id}-employerName`]: e.target.value 
                            }))}
                            placeholder="Employer Name"
                            className="text-lg font-semibold"
                          />
                        ) : (
                          w2.employerName || "Unknown Employer"
                        )}
                      </CardTitle>
                      <CardDescription>
                        EIN: {w2.employerEin || "N/A"}
                        {(w2 as any).documentName && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            • Source: {(w2 as any).documentName}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Badge>W-2</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <EditableField
                        fieldKey={`w2-${w2.id}-wages`}
                        documentId={w2.id}
                        documentType="w2"
                        fieldName="wages"
                        value={w2.wages}
                        label="Wages (Box 1)"
                        type="currency"
                        tabName="w2"
                      />
                      <EditableField
                        fieldKey={`w2-${w2.id}-federalWithheld`}
                        documentId={w2.id}
                        documentType="w2"
                        fieldName="federalWithheld"
                        value={w2.federalWithheld}
                        label="Federal Withheld (Box 2)"
                        type="currency"
                        tabName="w2"
                      />
                      <EditableField
                        fieldKey={`w2-${w2.id}-socialSecurityWages`}
                        documentId={w2.id}
                        documentType="w2"
                        fieldName="socialSecurityWages"
                        value={w2.socialSecurityWages}
                        label="Social Security Wages (Box 3)"
                        type="currency"
                        tabName="w2"
                      />
                    </div>
                    <div className="space-y-4">
                      <EditableField
                        fieldKey={`w2-${w2.id}-socialSecurityWithheld`}
                        documentId={w2.id}
                        documentType="w2"
                        fieldName="socialSecurityWithheld"
                        value={w2.socialSecurityWithheld}
                        label="Social Security Withheld (Box 4)"
                        type="currency"
                        tabName="w2"
                      />
                      <EditableField
                        fieldKey={`w2-${w2.id}-medicareWages`}
                        documentId={w2.id}
                        documentType="w2"
                        fieldName="medicareWages"
                        value={w2.medicareWages}
                        label="Medicare Wages (Box 5)"
                        type="currency"
                        tabName="w2"
                      />
                      <EditableField
                        fieldKey={`w2-${w2.id}-medicareWithheld`}
                        documentId={w2.id}
                        documentType="w2"
                        fieldName="medicareWithheld"
                        value={w2.medicareWithheld}
                        label="Medicare Withheld (Box 6)"
                        type="currency"
                        tabName="w2"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </>
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
            <>
              <div className="flex justify-end gap-2 mb-4">
                <ManualEntryForm
                  documentType="1099-DIV"
                  onAdd={handleCreateManual1099Div}
                  taxReturnId={documents?.[0]?.taxReturnId || ""}
                />
                {isEditingTab['1099-div'] ? (
                  <>
                    <Button
                      onClick={() => saveTabEdits('1099-div', div1099Data || [])}
                      disabled={batchUpdate1099DivMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save All Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => cancelTabEditing('1099-div')}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => startTabEditing('1099-div', div1099Data || [])}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit All Fields
                  </Button>
                )}
              </div>
              {div1099Data?.map((div) => (
              <Card key={div.id} data-testid={`card-1099-div-${div.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {isEditingTab['1099-div'] ? (
                          <Input
                            value={editValues[`1099-div-${div.id}-payerName`] || div.payerName || ""}
                            onChange={(e) => setEditValues(prev => ({ 
                              ...prev, 
                              [`1099-div-${div.id}-payerName`]: e.target.value 
                            }))}
                            placeholder="Payer Name"
                            className="text-lg font-semibold"
                          />
                        ) : (
                          div.payerName || "Unknown Payer"
                        )}
                      </CardTitle>
                      <CardDescription>
                        TIN: {div.payerTin || "N/A"}
                        {(div as any).documentName && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            • Source: {(div as any).documentName}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Badge className="bg-green-100 text-green-800">1099-DIV</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <EditableField
                        fieldKey={`1099-div-${div.id}-ordinaryDividends`}
                        documentId={div.id}
                        documentType="1099-div"
                        fieldName="ordinaryDividends"
                        value={div.ordinaryDividends}
                        label="Ordinary Dividends (Box 1a)"
                        type="currency"
                        tabName="1099-div"
                      />
                      <EditableField
                        fieldKey={`1099-div-${div.id}-qualifiedDividends`}
                        documentId={div.id}
                        documentType="1099-div"
                        fieldName="qualifiedDividends"
                        value={div.qualifiedDividends}
                        label="Qualified Dividends (Box 1b)"
                        type="currency"
                        tabName="1099-div"
                      />
                    </div>
                    <div className="space-y-4">
                      <EditableField
                        fieldKey={`1099-div-${div.id}-totalCapitalGain`}
                        documentId={div.id}
                        documentType="1099-div"
                        fieldName="totalCapitalGain"
                        value={div.totalCapitalGain}
                        label="Total Capital Gain (Box 2a)"
                        type="currency"
                        tabName="1099-div"
                      />
                      <EditableField
                        fieldKey={`1099-div-${div.id}-foreignTaxPaid`}
                        documentId={div.id}
                        documentType="1099-div"
                        fieldName="foreignTaxPaid"
                        value={div.foreignTaxPaid}
                        label="Foreign Tax Paid (Box 7)"
                        type="currency"
                        tabName="1099-div"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </>
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
            <>
              <div className="flex justify-end gap-2 mb-4">
                <ManualEntryForm
                  documentType="1099-INT"
                  onAdd={handleCreateManual1099Int}
                  taxReturnId={documents?.[0]?.taxReturnId || ""}
                />
                {isEditingTab['1099-int'] ? (
                  <>
                    <Button
                      onClick={() => saveTabEdits('1099-int', int1099Data || [])}
                      disabled={batchUpdate1099IntMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save All Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => cancelTabEditing('1099-int')}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => startTabEditing('1099-int', int1099Data || [])}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit All Fields
                  </Button>
                )}
              </div>
              {int1099Data?.map((int) => (
              <Card key={int.id} data-testid={`card-1099-int-${int.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>
                        {isEditingTab['1099-int'] ? (
                          <Input
                            value={editValues[`1099-int-${int.id}-payerName`] || int.payerName || ""}
                            onChange={(e) => setEditValues(prev => ({ 
                              ...prev, 
                              [`1099-int-${int.id}-payerName`]: e.target.value 
                            }))}
                            placeholder="Payer Name"
                            className="text-lg font-semibold"
                          />
                        ) : (
                          int.payerName || "Unknown Payer"
                        )}
                      </CardTitle>
                      <CardDescription>
                        TIN: {int.payerTin || "N/A"}
                        {(int as any).documentName && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            • Source: {(int as any).documentName}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800">1099-INT</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <EditableField
                        fieldKey={`1099-int-${int.id}-interestIncome`}
                        documentId={int.id}
                        documentType="1099-int"
                        fieldName="interestIncome"
                        value={int.interestIncome}
                        label="Interest Income (Box 1)"
                        type="currency"
                        tabName="1099-int"
                      />
                      <EditableField
                        fieldKey={`1099-int-${int.id}-earlyWithdrawalPenalty`}
                        documentId={int.id}
                        documentType="1099-int"
                        fieldName="earlyWithdrawalPenalty"
                        value={int.earlyWithdrawalPenalty}
                        label="Early Withdrawal Penalty (Box 2)"
                        type="currency"
                        tabName="1099-int"
                      />
                    </div>
                    <div className="space-y-4">
                      <EditableField
                        fieldKey={`1099-int-${int.id}-usBondInterest`}
                        documentId={int.id}
                        documentType="1099-int"
                        fieldName="usBondInterest"
                        value={int.usBondInterest}
                        label="U.S. Bond Interest (Box 3)"
                        type="currency"
                        tabName="1099-int"
                      />
                      <EditableField
                        fieldKey={`1099-int-${int.id}-federalWithheld`}
                        documentId={int.id}
                        documentType="1099-int"
                        fieldName="federalWithheld"
                        value={int.federalWithheld}
                        label="Federal Withheld (Box 4)"
                        type="currency"
                        tabName="1099-int"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </>
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
            <>
              <div className="flex justify-end gap-2 mb-4">
                <ManualEntryForm
                  documentType="1099-B"
                  onAdd={handleCreateManual1099B}
                  taxReturnId={documents?.[0]?.taxReturnId || ""}
                />
              </div>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  Use the individual "Save All Changes" buttons within each account to edit entries.
                </p>
              </div>
              {b1099Data?.map((b) => (
                <div key={b.id}>
                  <Card data-testid={`card-1099-b-${b.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>
                            {isEditingTab['1099-b'] ? (
                              <Input
                                value={editValues[`1099-b-${b.id}-payerName`] || b.payerName || ""}
                                onChange={(e) => setEditValues(prev => ({ 
                                  ...prev, 
                                  [`1099-b-${b.id}-payerName`]: e.target.value 
                                }))}
                                placeholder="Broker/Payer Name"
                                className="text-lg font-semibold"
                              />
                            ) : (
                              b.payerName || "Unknown Broker"
                            )}
                          </CardTitle>
                          <CardDescription>
                            {b.description || "Capital Gain/Loss Transaction"}
                            {b.payerTin && ` • TIN: ${b.payerTin}`}
                            {(b as any).documentName && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                • Source: {(b as any).documentName}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800">1099-B</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Form1099BTable
                        entries={b1099Entries?.filter(entry => entry.form1099BId === b.id) || []}
                        onAddEntry={(data) => handleAdd1099BEntry(b.id, data)}
                        onUpdateEntry={handleUpdate1099BEntry}
                        onBatchUpdateEntries={batchUpdate1099BEntriesMutation.mutate}
                        onDeleteEntry={handleDelete1099BEntry}
                        form1099BId={b.id}
                      />
                    </CardContent>
                  </Card>
                </div>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
