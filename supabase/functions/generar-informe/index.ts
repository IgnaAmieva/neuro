import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const { paciente, entradas, objetivos, destinatario } = await req.json();

    const entradasTexto = entradas
      .map(
        (e: any) =>
          `[${e.fecha}] ${e.tipo_sesion} — ${e.profesional_nombre} (${e.especialidad})\n${e.contenido}${
            e.conceptos_clave?.length
              ? "\nConceptos clave: " + e.conceptos_clave.join(", ")
              : ""
          }`,
      )
      .join("\n\n---\n\n");

    const objetivosTexto = objetivos.length > 0
      ? objetivos
          .map(
            (o: any) =>
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
        messages: [
          { role: "user", content: userPrompt },
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return new Response(
        JSON.stringify({ error: "Error de Anthropic API", details: errBody }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const informe = data.content?.[0]?.text || "";

    return new Response(
      JSON.stringify({ informe }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
