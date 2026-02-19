import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["hsl(230,70%,52%)", "hsl(152,60%,40%)", "hsl(38,92%,50%)", "hsl(0,72%,51%)", "hsl(280,60%,50%)", "hsl(190,70%,45%)"];

export default function Analytics() {
  const [vendorData, setVendorData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: invoices } = await supabase
        .from("invoice_data")
        .select("total_amount, invoice_date, vendors(name)");

      if (invoices) {
        // Vendor-wise spending
        const byVendor: Record<string, number> = {};
        invoices.forEach((inv) => {
          const name = (inv.vendors as any)?.name || "Unknown";
          byVendor[name] = (byVendor[name] || 0) + Number(inv.total_amount || 0);
        });
        setVendorData(Object.entries(byVendor).map(([name, total]) => ({ name, total })));

        // Monthly totals
        const byMonth: Record<string, number> = {};
        invoices.forEach((inv) => {
          if (inv.invoice_date) {
            const month = inv.invoice_date.substring(0, 7);
            byMonth[month] = (byMonth[month] || 0) + Number(inv.total_amount || 0);
          }
        });
        setMonthlyData(Object.entries(byMonth).sort().map(([month, total]) => ({ month, total })));
      }
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold tracking-tight">Analytics</h1></div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" /><Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground text-sm">Spending insights across vendors and time periods</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Monthly Expenses</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">No invoice data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(230,70%,52%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Vendor-wise Spending</CardTitle></CardHeader>
          <CardContent>
            {vendorData.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">No vendor data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={vendorData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {vendorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
