import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => { fetchAlerts(); }, []);

  async function fetchAlerts() {
    const { data, error } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
    if (!error) setAlerts(data || []);
    setLoading(false);
  }

  const markRead = async (id: string) => {
    await supabase.from("alerts").update({ is_read: true }).eq("id", id);
    fetchAlerts();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        <p className="text-muted-foreground text-sm">Payment reminders and notifications</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">All Notifications</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="mx-auto h-8 w-8 mb-2" />
              <p>No alerts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <div key={a.id} className={`flex items-start justify-between rounded-lg border p-4 ${!a.is_read ? "bg-primary/5 border-primary/20" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{a.title}</p>
                      {!a.is_read && <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(a.created_at).toLocaleDateString()}</p>
                  </div>
                  {!a.is_read && (
                    <Button variant="ghost" size="sm" onClick={() => markRead(a.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
