import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { Document } from "@shared/schema";

export default function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Upload successful",
        description: `${selectedFiles.length} file(s) uploaded and processing started.`,
      });
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload files. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/documents/${id}`, undefined);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "The document has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
  });

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      const validTypes = [
        "application/pdf",
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      return validTypes.includes(file.type);
    });

    if (validFiles.length < files.length) {
      toast({
        title: "Invalid file type",
        description: "Only PDF, CSV, and Excel files are supported.",
        variant: "destructive",
      });
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length === 0) return;
    uploadMutation.mutate(selectedFiles);
  };

  const getDocumentTypeBadgeColor = (type: string) => {
    switch (type) {
      case "W-2":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "1099-DIV":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "1099-INT":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "1099-B":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-foreground mb-2">
          Upload Tax Documents
        </h1>
        <p className="text-lg text-muted-foreground">
          Upload your W-2, 1099-DIV, 1099-INT, and 1099-B forms to begin processing.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Supported formats: PDF, CSV, Excel (.xlsx, .xls)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-accent/5"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            data-testid="dropzone-upload"
          >
            <UploadIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Drag and drop files here
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              or click to browse from your computer
            </p>
            <input
              type="file"
              multiple
              accept=".pdf,.csv,.xls,.xlsx"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              data-testid="input-file"
            />
            <label htmlFor="file-upload">
              <Button asChild>
                <span data-testid="button-browse">Browse Files</span>
              </Button>
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium text-foreground">
                Selected Files ({selectedFiles.length})
              </h4>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  data-testid={`file-preview-${index}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    data-testid={`button-remove-${index}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                className="w-full"
                data-testid="button-upload"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>Upload {selectedFiles.length} File(s)</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uploaded Documents</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading..."
              : documents?.length
              ? `${documents.length} document(s) uploaded`
              : "No documents uploaded yet"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documents?.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No documents uploaded yet. Upload your first document above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents?.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                  data-testid={`card-document-${doc.id}`}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <FileText className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString()} •{" "}
                        {(doc.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge
                      className={getDocumentTypeBadgeColor(doc.documentType)}
                    >
                      {doc.documentType}
                    </Badge>
                    <Badge
                      variant={doc.status === "parsed" ? "default" : "secondary"}
                    >
                      {doc.status === "parsed" ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : doc.status === "processing" ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {doc.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
