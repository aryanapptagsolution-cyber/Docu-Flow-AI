import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileUp, Loader2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DocumentReviewDialog } from "@/components/DocumentReviewDialog";

export default function UploadDocument() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<"invoice" | "contract">("invoice");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewDoc, setReviewDoc] = useState<any>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === "application/pdf" || droppedFile.type.startsWith("image/"))) {
      setFile(droppedFile);
    } else {
      toast({ title: "Invalid file", description: "Please upload a PDF or image file.", variant: "destructive" });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const pollForReady = (docId: string) => {
    pollingRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("id", docId)
        .maybeSingle();

      if (data?.status === "ready") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setUploading(false);
        setReviewDoc(data);
        setReviewOpen(true);
      } else if (data?.status === "error") {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setUploading(false);
        toast({ title: "Processing failed", description: "AI extraction encountered an error.", variant: "destructive" });
      }
    }, 2000);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);

    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: doc, error: dbError } = await supabase
        .from("documents")
        .insert({ user_id: user.id, file_name: file.name, file_path: filePath, file_type: fileType, status: "processing" })
        .select()
        .single();
      if (dbError) throw dbError;

      toast({ title: "File uploaded", description: "Processing document with AI..." });
      setFile(null);

      // Trigger AI processing
      supabase.functions.invoke("process-document", { body: { documentId: doc.id } });

      // Poll for ready status
      pollForReady(doc.id);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setUploading(false);
    }
  };

  const handleReviewClose = () => {
    setReviewOpen(false);
    setReviewDoc(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload Document</h1>
        <p className="text-muted-foreground text-sm">Upload invoices, receipts, or contracts for AI-powered extraction</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Document Type</Label>
            <Select value={fileType} onValueChange={(v) => setFileType(v as "invoice" | "contract")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="invoice">Invoice / Receipt</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input id="file-input" type="file" className="hidden" accept=".pdf,image/*" onChange={handleFileSelect} />
            <FileUp className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Drag & drop your file here</p>
            <p className="text-xs text-muted-foreground mt-1">PDF or image files (max 20MB)</p>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-3">
                <Upload className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button className="w-full gap-2" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Processing..." : "Upload & Process"}
          </Button>
        </CardContent>
      </Card>

      <DocumentReviewDialog open={reviewOpen} onClose={handleReviewClose} document={reviewDoc} />
    </div>
  );
}
