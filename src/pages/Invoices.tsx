import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Download, Search, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 10;

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => { fetchInvoices(); }, []);

  async function fetchInvoices() {
    const { data, error } = await supabase
      .from("invoice_data")
      .select("*, vendors(name), documents(file_path, file_name)")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else setInvoices(data || []);
    setLoading(false);
  }

  const handleDownload = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
    if (error) toast({ title: "Download failed", description: error.message, variant: "destructive" });
    else if (data) window.open(data.signedUrl, "_blank");
  };

  const filtered = invoices.filter((inv) => {
    const vendorName = (inv.vendors as any)?.name || "";
    const invNumber = inv.invoice_number || "";
    const q = search.toLowerCase();
    return vendorName.toLowerCase().includes(q) || invNumber.toLowerCase().includes(q);
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const statusColor = (s: string) => {
    if (s === "paid") return "default";
    if (s === "overdue") return "destructive";
    return "secondary";
  };

  const confidencePercent = (s: number | null) => s ? Math.round(s * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground text-sm">Manage and view all extracted invoices</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">All Invoices</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow>
                  ) : (
                    paginated.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{inv.invoice_number || "—"}</TableCell>
                        <TableCell>{(inv.vendors as any)?.name || "—"}</TableCell>
                        <TableCell>{inv.invoice_date || "—"}</TableCell>
                        <TableCell>${Number(inv.total_amount || 0).toFixed(2)}</TableCell>
                        <TableCell><Badge variant={statusColor(inv.payment_status)}>{inv.payment_status}</Badge></TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(inv)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(inv.documents as any)?.file_path && (
                            <Button variant="ghost" size="sm" onClick={() => handleDownload((inv.documents as any).file_path)}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-xs text-muted-foreground">
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
            <DialogDescription>
              {detail?.invoice_number || "No number"} · Confidence: {confidencePercent(detail?.confidence_score)}%
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Vendor</span><p className="font-medium">{(detail.vendors as any)?.name || "—"}</p></div>
                <div><span className="text-muted-foreground">Status</span><p><Badge variant={statusColor(detail.payment_status)}>{detail.payment_status}</Badge></p></div>
                <div><span className="text-muted-foreground">Invoice Date</span><p className="font-medium">{detail.invoice_date || "—"}</p></div>
                <div><span className="text-muted-foreground">Due Date</span><p className="font-medium">{detail.due_date || "—"}</p></div>
                <div><span className="text-muted-foreground">Total Amount</span><p className="font-medium">${Number(detail.total_amount || 0).toFixed(2)}</p></div>
                <div><span className="text-muted-foreground">Tax Amount</span><p className="font-medium">${Number(detail.tax_amount || 0).toFixed(2)}</p></div>
              </div>

              {detail.items && (detail.items as any[]).length > 0 && (
                <div>
                  <p className="font-semibold mb-2">Line Items</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs">Qty</TableHead>
                        <TableHead className="text-xs">Price</TableHead>
                        <TableHead className="text-xs">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.items as any[]).map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{item.description}</TableCell>
                          <TableCell className="text-xs">{item.quantity}</TableCell>
                          <TableCell className="text-xs">${Number(item.unit_price || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-xs">${Number(item.amount || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {detail.summary_text && (
                <div>
                  <p className="text-muted-foreground">AI Summary</p>
                  <p className="mt-1 text-sm">{detail.summary_text}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
