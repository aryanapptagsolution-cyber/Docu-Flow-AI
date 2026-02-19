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
    const { documentId } = await req.json();
    if (!documentId) throw new Error("documentId is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch document record
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (docError || !doc) throw new Error("Document not found");

    // Download the file from storage
    const { data: fileData, error: dlError } = await supabase.storage
      .from("documents")
      .download(doc.file_path);
    if (dlError || !fileData) throw new Error("Failed to download file");

    // Convert to base64 for vision API
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    const mimeType = doc.file_name.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "image/jpeg";

    const fileType = doc.file_type || "invoice";

    const systemPrompt = fileType === "contract"
      ? `You are a document analysis AI. Extract structured data from this contract document. Return JSON with these fields:
        - parties: array of party names involved
        - start_date: contract start date (YYYY-MM-DD or null)
        - end_date: contract end date (YYYY-MM-DD or null)
        - payment_amount: total payment amount as number or null
        - summary_text: brief summary of the contract
        - confidence_score: your confidence 0-1`
      : `You are a document analysis AI. Extract structured data from this invoice/receipt. Return JSON with these fields:
        - invoice_number: string or null
        - invoice_date: date (YYYY-MM-DD or null)
        - due_date: date (YYYY-MM-DD or null)
        - total_amount: number or null
        - tax_amount: number or null
        - items: array of {description, quantity, unit_price, amount}
        - summary_text: brief summary
        - confidence_score: your confidence 0-1
        Do NOT include vendor information.`;

    // Call Google Gemini API directly
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiParts: any[] = [
      { text: "Extract the structured data from this document." },
      {
        inline_data: {
          mime_type: mimeType,
          data: base64,
        },
      },
    ];

    const toolDeclaration = fileType === "contract"
      ? {
        name: "extract_document_data",
        description: "Extract structured data from the document",
        parameters: {
          type: "object",
          properties: {
            parties: { type: "array", items: { type: "string" } },
            start_date: { type: "string" },
            end_date: { type: "string" },
            payment_amount: { type: "number" },
            summary_text: { type: "string" },
            confidence_score: { type: "number" },
          },
          required: ["summary_text", "confidence_score"],
        },
      }
      : {
        name: "extract_document_data",
        description: "Extract structured data from the document",
        parameters: {
          type: "object",
          properties: {
            invoice_number: { type: "string" },
            invoice_date: { type: "string" },
            due_date: { type: "string" },
            total_amount: { type: "number" },
            tax_amount: { type: "number" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  quantity: { type: "number" },
                  unit_price: { type: "number" },
                  amount: { type: "number" },
                },
                required: ["description"],
              },
            },
            summary_text: { type: "string" },
            confidence_score: { type: "number" },
          },
          required: ["summary_text", "confidence_score"],
        },
      };

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: geminiParts }],
        tools: [{ function_declarations: [toolDeclaration] }],
        tool_config: { function_calling_config: { mode: "ANY", allowed_function_names: ["extract_document_data"] } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", aiResponse.status, errText);
      throw new Error(`AI processing failed: ${aiResponse.status}`);
    }

    const aiResult = await aiResponse.json();

    let extractedData: Record<string, unknown>;
    // Gemini returns function calls in candidates[0].content.parts
    const parts = aiResult.candidates?.[0]?.content?.parts || [];
    const fnCall = parts.find((p: any) => p.functionCall);
    if (fnCall?.functionCall?.args) {
      extractedData = fnCall.functionCall.args;
    } else {
      // Fallback: try to parse from text content
      const textPart = parts.find((p: any) => p.text);
      const jsonMatch = textPart?.text?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not extract structured data from AI response");
      }
    }

    // Save draft data to document
    await supabase
      .from("documents")
      .update({
        draft_data: extractedData,
        status: "ready",
      })
      .eq("id", documentId);

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
