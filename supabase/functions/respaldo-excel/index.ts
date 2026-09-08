import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Tables to export — order matters for readability
const TABLES = [
  "profesionales",
  "pacientes",
  "paciente_profesional",
  "entradas_historia_clinica",
  "objetivos",
  "objetivo_historial",
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!serviceRoleKey) {
      console.error("[respaldo-excel] SUPABASE_SERVICE_ROLE_KEY no configurada");
      return jsonResponse({ error: "Configuración del servidor incompleta" }, 500);
    }

    // --- Verify caller is admin ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[respaldo-excel] Sin header Authorization");
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    // Client with the caller's JWT — to check their role
    const supabaseUser = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();

    if (authErr || !user) {
      console.error("[respaldo-excel] Auth error:", authErr?.message);
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    // Use service role client to check profesional.rol (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: prof, error: profErr } = await supabase
      .from("profesionales")
      .select("id, rol")
      .eq("auth_user_id", user.id)
      .single();

    if (profErr || !prof) {
      console.error("[respaldo-excel] Profesional not found for user:", user.id);
      return jsonResponse({ error: "Profesional no encontrado" }, 403);
    }

    if (prof.rol !== "admin") {
      console.error("[respaldo-excel] Acceso denegado — rol:", prof.rol);
      return jsonResponse({ error: "Solo administradores pueden generar respaldos" }, 403);
    }

    console.log(`[respaldo-excel] Iniciando respaldo por admin ${prof.id}`);

    // --- Read all tables and build workbook ---
    const wb = XLSX.utils.book_new();

    for (const table of TABLES) {
      const { data: rows, error: queryErr } = await supabase
        .from(table)
        .select("*")
        .limit(50000);

      if (queryErr) {
        console.error(`[respaldo-excel] Error leyendo ${table}:`, queryErr.message);
        const ws = XLSX.utils.aoa_to_sheet([["Error al leer tabla"], [queryErr.message]]);
        XLSX.utils.book_append_sheet(wb, ws, table);
        continue;
      }

      const ws = XLSX.utils.json_to_sheet(rows || []);
      XLSX.utils.book_append_sheet(wb, ws, table);
      console.log(`[respaldo-excel] ${table}: ${(rows || []).length} filas`);
    }

    // --- Generate binary ---
    const xlsxBuffer: Uint8Array = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    });

    // --- Upload to storage ---
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `respaldo_neuroestima_${today}.xlsx`;

    const { error: uploadErr } = await supabase.storage
      .from("respaldos")
      .upload(fileName, xlsxBuffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true, // overwrite if same day
      });

    if (uploadErr) {
      console.error("[respaldo-excel] Error subiendo archivo:", uploadErr.message);
      return jsonResponse({ error: "Error al guardar respaldo: " + uploadErr.message }, 500);
    }

    console.log(`[respaldo-excel] Respaldo generado OK: ${fileName} (${xlsxBuffer.byteLength} bytes)`);

    return jsonResponse({
      success: true,
      fileName,
      size: xlsxBuffer.byteLength,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[respaldo-excel] Error no manejado:", message);
    if (stack) console.error(stack);
    return jsonResponse({ error: "Error interno: " + message }, 500);
  }
});
