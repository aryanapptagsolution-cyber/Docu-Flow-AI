import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface DocumentReviewDialogProps {
  open: boolean;
  onClose: () => void;
  document: {
    id: string;
    file_name: string;
    file_path: string;
    file_type: string;
    draft_data: any;
  } | null;
}

export function DocumentReviewDialog({ open, onClose, document }: DocumentReviewDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorPopoverOpen, setVendorPopoverOpen] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [newVendorName, setNewVendorName] = useState("");

  // Invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [summaryText, setSummaryText] = useState("");
  const [confidenceScore, setConfidenceScore] = useState<number>(0);

  // Contract fields
  const [parties, setParties] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  useEffect(() => {
    if (open) {
      fetchVendors();
      if (document?.draft_data) {
        const d = document.draft_data as any;
        setConfidenceScore(d.confidence_score || 0);
        setSummaryText(d.summary_text || "");
        // Always reset vendor
        setSelectedVendorId(null);
        setNewVendorName("");
        setVendorSearch("");

        if (document.file_type === "invoice") {
          setInvoiceNumber(d.invoice_number || "");
          setInvoiceDate(d.invoice_date || "");
          setDueDate(d.due_date || "");
          setTotalAmount(d.total_amount?.toString() || "");
          setTaxAmount(d.tax_amount?.toString() || "");
          setItems(d.items || []);
        } else {
          setParties(d.parties || []);
          setStartDate(d.start_date || "");
          setEndDate(d.end_date || "");
          setPaymentAmount(d.payment_amount?.toString() || "");
        }
      }
    }
  }, [open, document]);

  async function fetchVendors() {
    const { data } = await supabase.from("vendors").select("id, name").order("name");
    setVendors(data || []);
  }

  const getVendorDisplay = () => {
    if (selectedVendorId) {
      return vendors.find((v) => v.id === selectedVendorId)?.name || "";
    }
    return newVendorName || "";
  };

  const handleSave = async () => {
    if (!user || !document) return;
    const vendorDisplay = getVendorDisplay();
    if (!vendorDisplay.trim()) {
      toast({ title: "Vendor required", description: "Please select or enter a vendor name.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let vendorId = selectedVendorId;

      // Create new vendor if typed manually
      if (!vendorId && newVendorName.trim()) {
        const { data: newVendor, error } = await supabase
          .from("vendors")
          .insert({ name: newVendorName.trim(), user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        vendorId = newVendor.id;
      }

      if (document.file_type === "invoice") {
        const { error } = await supabase.from("invoice_data").insert({
          user_id: user.id,
          document_id: document.id,
          vendor_id: vendorId,
          invoice_number: invoiceNumber || null,
          invoice_date: invoiceDate || null,
          due_date: dueDate || null,
          total_amount: totalAmount ? parseFloat(totalAmount) : null,
          tax_amount: taxAmount ? parseFloat(taxAmount) : null,
          items: items,
          summary_text: summaryText || null,
          confidence_score: confidenceScore,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contract_data").insert({
          user_id: user.id,
          document_id: document.id,
          vendor_id: vendorId,
          parties: parties,
          start_date: startDate || null,
          end_date: endDate || null,
          payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
          summary_text: summaryText || null,
          confidence_score: confidenceScore,
        });
        if (error) throw error;
      }

      // Update document status
      await supabase.from("documents").update({ status: "saved" }).eq("id", document.id);

      toast({ title: "Saved successfully", description: `${document.file_type === "invoice" ? "Invoice" : "Contract"} data has been stored.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!document) return;
    setCancelling(true);
    try {
      await supabase.storage.from("documents").remove([document.file_path]);
      await supabase.from("documents").delete().eq("id", document.id);
      toast({ title: "Cancelled", description: "Upload discarded and file deleted." });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: field === "description" ? value : parseFloat(value) || 0 };
    setItems(updated);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const addItem = () => setItems([...items, { description: "", quantity: 1, unit_price: 0, amount: 0 }]);

  if (!document) return null;

  const isInvoice = document.file_type === "invoice";
  const confidencePercent = Math.round(confidenceScore * 100);
  const confidenceColor = confidencePercent >= 80 ? "text-[hsl(var(--success))]" : confidencePercent >= 50 ? "text-[hsl(var(--warning))]" : "text-destructive";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review Extracted Data
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {document.file_name}
            <Badge variant="outline" className="ml-2">{isInvoice ? "Invoice" : "Contract"}</Badge>
            <span className={`text-xs font-semibold ${confidenceColor}`}>
              AI Confidence: {confidencePercent}%
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Vendor Combobox */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Vendor / Company Name *</Label>
            <Popover open={vendorPopoverOpen} onOpenChange={setVendorPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  {getVendorDisplay() || "Select or type vendor..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search vendors..." value={vendorSearch} onValueChange={setVendorSearch} />
                  <CommandList>
                    <CommandEmpty>
                      <button
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent rounded"
                        onClick={() => {
                          setSelectedVendorId(null);
                          setNewVendorName(vendorSearch);
                          setVendorPopoverOpen(false);
                        }}
                      >
                        + Create "{vendorSearch}"
                      </button>
                    </CommandEmpty>
                    <CommandGroup>
                      {vendors.map((v) => (
                        <CommandItem
                          key={v.id}
                          value={v.name}
                          onSelect={() => {
                            setSelectedVendorId(v.id);
                            setNewVendorName("");
                            setVendorPopoverOpen(false);
                          }}
                        >
                          {v.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {isInvoice ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Invoice Number</Label>
                  <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Invoice Date</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Total Amount</Label>
                  <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tax Amount</Label>
                  <Input type="number" step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Line Items</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={addItem} className="gap-1 text-xs">
                    <Plus className="h-3 w-3" /> Add Item
                  </Button>
                </div>
                {items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_60px_80px_80px_32px] gap-2 items-end">
                    <Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} className="text-xs" />
                    <Input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} className="text-xs" />
                    <Input type="number" placeholder="Price" value={item.unit_price} onChange={(e) => updateItem(i, "unit_price", e.target.value)} className="text-xs" />
                    <Input type="number" placeholder="Amount" value={item.amount} onChange={(e) => updateItem(i, "amount", e.target.value)} className="text-xs" />
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-8 w-8 text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Parties</Label>
                {parties.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={p}
                      onChange={(e) => {
                        const updated = [...parties];
                        updated[i] = e.target.value;
                        setParties(updated);
                      }}
                    />
                    <Button variant="ghost" size="icon" onClick={() => setParties(parties.filter((_, j) => j !== i))} className="text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setParties([...parties, ""])} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" /> Add Party
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Amount</Label>
                  <Input type="number" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label className="text-xs">AI Summary</Label>
            <Textarea value={summaryText} onChange={(e) => setSummaryText(e.target.value)} rows={3} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="destructive" onClick={handleCancel} disabled={cancelling || saving} className="gap-2">
            {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
            Cancel & Delete
          </Button>
          <Button onClick={handleSave} disabled={saving || cancelling} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
