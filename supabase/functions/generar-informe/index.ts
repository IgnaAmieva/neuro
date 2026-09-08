import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

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

/** "Valentina Carolina Gómez" → "V.C.G." */
function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + ".")
    .join("");
}

const RATE_LIMIT = 5; // max calls per minute per profesional

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Validate API key ---
    if (!ANTHROPIC_API_KEY) {
      console.error("[generar-informe] ANTHROPIC_API_KEY no está configurada en los secrets de Supabase");
      return jsonResponse({ error: "ANTHROPIC_API_KEY no configurada" }, 500);
    }

    // --- Auth: identify calling profesional ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    const supabaseAuth = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();

    if (authErr || !user) {
      console.error("[generar-informe] Auth error:", authErr?.message);
      return jsonResponse({ error: "No autenticado" }, 401);
    }

    // Service role client for DB operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: prof } = await supabase
      .from("profesionales")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!prof) {
      return jsonResponse({ error: "Profesional no encontrado" }, 403);
    }

    // --- Rate limiting ---
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

    const { count, error: countErr } = await supabase
      .from("rate_limit_informes")
      .select("*", { count: "exact", head: true })
      .eq("profesional_id", prof.id)
      .gte("created_at", oneMinuteAgo);

    if (countErr) {
      console.error("[generar-informe] Error checking rate limit:", countErr.message);
    }

    if ((count ?? 0) >= RATE_LIMIT) {
      console.warn(`[generar-informe] Rate limit alcanzado para profesional ${prof.id} (${count} en último minuto)`);
      return jsonResponse(
        { error: "Demasiados informes generados, esperá un minuto antes de intentar de nuevo." },
        429,
      );
    }

    // Record this call
    await supabase
      .from("rate_limit_informes")
      .insert({ profesional_id: prof.id });

    // --- Parse body ---
    const body = await req.json();
    const { paciente, entradas, objetivos, destinatario } = body;

    if (!paciente || !entradas) {
      console.error("[generar-informe] Payload incompleto — paciente:", !!paciente, "entradas:", !!entradas);
      return jsonResponse({ error: "Payload incompleto: se requieren paciente y entradas" }, 400);
    }

    console.log(
      `[generar-informe] Generando informe para paciente ${iniciales(paciente.nombre)} — ${entradas.length} entradas, ${(objetivos || []).length} objetivos`,
    );

    // --- Anonymize patient name for the AI prompt ---
    const pacienteAnonimo = iniciales(paciente.nombre);

    // --- Build prompts ---
    const entradasTexto = (entradas as any[])
      .map(
        (e) =>
          `[${e.fecha}] ${e.tipo_sesion} — ${e.profesional_nombre} (${e.especialidad})\n${e.contenido}${
            e.conceptos_clave?.length
              ? "\nConceptos clave: " + e.conceptos_clave.join(", ")
              : ""
          }`,
      )
      .join("\n\n---\n\n");

    const objetivosTexto =
      objetivos && objetivos.length > 0
        ? (objetivos as any[])
            .map(
              (o) =>
                `- [${o.estado}] ${o.descripcion} (plazo: ${o.plazo}, inicio: ${o.fecha_inicio})`,
            )
            .join("\n")
        : "No hay objetivos activos registrados.";

    const destinatarioCtx = destinatario?.trim()
      ? `\n\nEl informe está dirigido a: ${destinatario}. Adaptá el nivel de tecnicismo y el encuadre al destinatario indicado.`
      : "";

    const systemPrompt = `Sos una profesional de salud redactando un informe clínico interdisciplinario para una clínica de neurorehabilitación llamada Neuroestima. Escribí en español rioplatense profesional. El informe debe ser claro, conciso, con tono clínico pero accesible. Usá subtítulos para organizar la información. No inventés datos que no estén en las entradas proporcionadas. El paciente se identifica como "${pacienteAnonimo}" — usá esas iniciales, no intentes adivinar el nombre completo.`;

    const userPrompt = `Redactá un informe clínico interdisciplinario para el siguiente paciente, basándote exclusivamente en las entradas de historia clínica y los objetivos del equipo proporcionados.

DATOS DEL PACIENTE:
- Identificación: Paciente ${pacienteAnonimo}
- Fecha de nacimiento: ${paciente.fecha_nacimiento}
- Diagnóstico: ${paciente.diagnostico || "No especificado"}
${destinatarioCtx}

OBJETIVOS ACTIVOS DEL EQUIPO:
${objetivosTexto}

ENTRADAS DE HISTORIA CLÍNICA (orden cronológico):
${entradasTexto}

INSTRUCCIONES:
1. Referite al paciente como "${pacienteAnonimo}" (no uses nombre completo)
2. Comenzá con un resumen general del período
3. Detallá los avances y lo trabajado por área/especialidad
4. Relacioná el trabajo con los objetivos del equipo cuando sea pertinente
5. Cerrá con observaciones generales y recomendaciones del equipo
6. No incluyas encabezado con datos del paciente (eso va aparte en el PDF)
7. No inventes información que no esté en las entradas`;

    // --- Call Anthropic API ---
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: userPrompt }],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      // Log status and error type only — errBody may echo prompt with clinical content
      let errType = "unknown";
      try { errType = JSON.parse(errBody)?.error?.type || "unknown"; } catch { /* not JSON */ }
      console.error(
        `[generar-informe] Anthropic API respondió ${response.status} ${response.statusText} — tipo: ${errType}`,
      );
      return jsonResponse(
        { error: `Error del servicio de IA (${response.status}). Intentá de nuevo en unos segundos.` },
        502,
      );
    }

    const data = await response.json();
    const textBlock = Array.isArray(data.content)
      ? data.content.find((c: any) => c?.type === "text")
      : null;
    const informe = textBlock?.text || "";

    if (!informe) {
      const blockTypes = Array.isArray(data.content) ? data.content.map((c: any) => c?.type) : [];
      console.error("[generar-informe] Anthropic devolvió respuesta sin bloque de texto. Bloques:", blockTypes, "stop_reason:", data.stop_reason);
      return jsonResponse({ error: "La IA devolvió una respuesta vacía" }, 502);
    }

    console.log(`[generar-informe] Informe generado OK — ${informe.length} caracteres`);
    return jsonResponse({ informe });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[generar-informe] Error no manejado:", message);
    if (stack) console.error(stack);
    return jsonResponse({ error: "Error interno: " + message }, 500);
  }
});
