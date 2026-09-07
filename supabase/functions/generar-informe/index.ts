import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

    // --- Parse body ---
    const body = await req.json();
    const { paciente, entradas, objetivos, destinatario } = body;

    if (!paciente || !entradas) {
      console.error("[generar-informe] Payload incompleto — paciente:", !!paciente, "entradas:", !!entradas);
      return jsonResponse({ error: "Payload incompleto: se requieren paciente y entradas" }, 400);
    }

    console.log(
      `[generar-informe] Generando informe para "${paciente.nombre}" — ${entradas.length} entradas, ${(objetivos || []).length} objetivos`,
    );

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

    const systemPrompt = `Sos una profesional de salud redactando un informe clínico interdisciplinario para una clínica de neurorehabilitación llamada Neuroestima. Escribí en español rioplatense profesional. El informe debe ser claro, conciso, con tono clínico pero accesible. Usá subtítulos para organizar la información. No inventés datos que no estén en las entradas proporcionadas.`;

    const userPrompt = `Redactá un informe clínico interdisciplinario para el siguiente paciente, basándote exclusivamente en las entradas de historia clínica y los objetivos del equipo proporcionados.

DATOS DEL PACIENTE:
- Nombre: ${paciente.nombre}
- Fecha de nacimiento: ${paciente.fecha_nacimiento}
- Diagnóstico: ${paciente.diagnostico || "No especificado"}
${destinatarioCtx}

OBJETIVOS ACTIVOS DEL EQUIPO:
${objetivosTexto}

ENTRADAS DE HISTORIA CLÍNICA (orden cronológico):
${entradasTexto}

INSTRUCCIONES:
1. Comenzá con un resumen general del período
2. Detallá los avances y lo trabajado por área/especialidad
3. Relacioná el trabajo con los objetivos del equipo cuando sea pertinente
4. Cerrá con observaciones generales y recomendaciones del equipo
5. No incluyas encabezado con datos del paciente (eso va aparte en el PDF)
6. No inventes información que no esté en las entradas`;

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
      console.error(
        `[generar-informe] Anthropic API respondió ${response.status} ${response.statusText}:`,
        errBody,
      );
      return jsonResponse(
        { error: `Error de Anthropic API (${response.status})`, details: errBody },
        502,
      );
    }

    const data = await response.json();
    const textBlock = Array.isArray(data.content)
      ? data.content.find((c: any) => c?.type === "text")
      : null;
    const informe = textBlock?.text || "";

    if (!informe) {
      console.error("[generar-informe] Anthropic devolvió respuesta vacía:", JSON.stringify(data));
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
