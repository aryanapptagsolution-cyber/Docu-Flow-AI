import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey);

    // Find invoices due within 3 days that are still pending
    const today = new Date();
    const threeDaysLater = new Date(today.getTime() + 3 * 86400000);

    const { data: dueInvoices, error: queryError } = await supabase
      .from("invoice_data")
      .select("*, vendors(name)")
      .eq("payment_status", "pending")
      .gte("due_date", today.toISOString().split("T")[0])
      .lte("due_date", threeDaysLater.toISOString().split("T")[0]);

    if (queryError) throw queryError;

    console.log(`Found ${dueInvoices?.length || 0} invoices due within 3 days`);

    const alerts: any[] = [];

    for (const invoice of dueInvoices || []) {
      const vendorName = (invoice.vendors as any)?.name || "Unknown Vendor";
      const daysUntilDue = Math.ceil(
        (new Date(invoice.due_date).getTime() - today.getTime()) / 86400000
      );

      const title = `Invoice ${invoice.invoice_number || invoice.id.slice(0, 8)} due ${daysUntilDue === 0 ? "today" : `in ${daysUntilDue} day(s)`}`;
      const message = `Invoice from ${vendorName} for $${Number(invoice.total_amount || 0).toFixed(2)} is due on ${invoice.due_date}.`;

      // Insert alert
      alerts.push({
        user_id: invoice.user_id,
        title,
        message,
        type: "reminder",
        related_invoice_id: invoice.id,
      });

      // Send email if Resend is configured
      if (resendApiKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "DocuFlow AI <onboarding@resend.dev>",
              to: ["delivered@resend.dev"], // Uses Resend test address
              subject: title,
              html: `<p>${message}</p><p>Please ensure timely payment to avoid late fees.</p>`,
            }),
          });
        } catch (emailErr) {
          console.error("Email send failed:", emailErr);
        }
      }
    }

    // Batch insert alerts
    if (alerts.length > 0) {
      const { error: alertError } = await supabase.from("alerts").insert(alerts);
      if (alertError) console.error("Alert insert error:", alertError);
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: alerts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-reminders error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
