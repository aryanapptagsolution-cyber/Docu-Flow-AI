import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Building2, DollarSign, Clock, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Stats {
  totalInvoices: number;
  pendingPayments: number;
  totalVendors: number;
  upcomingDue: number;
}

export default function DashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentDocs, setRecentDocs] = useState<any[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchStats() {
      const [invoices, pending, vendors, upcoming] = await Promise.all([
        supabase.from("invoice_data").select("id", { count: "exact", head: true }),
        supabase.from("invoice_data").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
        supabase.from("vendors").select("id", { count: "exact", head: true }),
        supabase.from("invoice_data").select("id", { count: "exact", head: true }).gte("due_date", new Date().toISOString().split("T")[0]).lte("due_date", new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]),
      ]);
      setStats({
        totalInvoices: invoices.count ?? 0,
        pendingPayments: pending.count ?? 0,
        totalVendors: vendors.count ?? 0,
        upcomingDue: upcoming.count ?? 0,
      });
      setLoading(false);
    }

    async function fetchRecent() {
      const { data } = await supabase
        .from("documents")
        .select("id, file_name, file_type, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentDocs(data || []);
      setRecentLoading(false);
    }

    fetchStats();
    fetchRecent();
  }, []);

  const cards = [
    { label: "Total Invoices", value: stats?.totalInvoices, icon: FileText, color: "text-primary" },
    { label: "Pending Payments", value: stats?.pendingPayments, icon: DollarSign, color: "text-[hsl(var(--warning))]" },
    { label: "Total Vendors", value: stats?.totalVendors, icon: Building2, color: "text-[hsl(var(--success))]" },
    { label: "Due This Week", value: stats?.upcomingDue, icon: Clock, color: "text-destructive" },
  ];

  const statusBadge = (s: string) => {
    if (s === "saved") return <Badge variant="default">Saved</Badge>;
    if (s === "ready") return <Badge variant="secondary">Ready</Badge>;
    if (s === "processing") return <Badge variant="outline">Processing</Badge>;
    return <Badge variant="destructive">{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Overview of your AI Document Intelligence & Business Automation Platform</p>
        </div>
        <Button onClick={() => navigate("/dashboard/upload")} className="gap-2">
          <Upload className="h-4 w-4" /> Upload Document
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-16" /> : <p className="text-3xl font-bold">{card.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-1" onClick={() => navigate("/dashboard/upload")}>
          <Upload className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Upload Invoice</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-1" onClick={() => navigate("/dashboard/vendors")}>
          <Building2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">Manage Vendors</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex flex-col gap-1" onClick={() => navigate("/dashboard/analytics")}>
          <FileText className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">View Analytics</span>
        </Button>
      </div>

      {/* Recent Uploads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Uploads</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/invoices")} className="gap-1 text-xs">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : recentDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {recentDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_type} · {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {statusBadge(doc.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
