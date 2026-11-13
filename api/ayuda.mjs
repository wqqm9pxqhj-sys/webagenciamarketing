// Vercel function behind the site's help assistant. It answers visitors' questions with Claude,
// from the facts below and nothing else. Needs ANTHROPIC_API_KEY in Vercel; AYUDA_MODEL is optional.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.AYUDA_MODEL || "claude-opus-5-5";
const MAX_CHARS = 600;      // per visitor message
const MAX_TURNS = 12;       // messages kept from the conversation
const WINDOW_MS = 10 * 60 * 1000, MAX_PER_WINDOW = 20;   // per address and server instance: a brake, not a wall

// Everything the assistant may say about the business. Keep it in step with the site: if a price or a
// condition changes there, change it here too. The text is fixed, so it is cached between requests.
const SYSTEM = `Eres el asistente de ayuda de la web de AXIONA Systems. Respondes a dueños de clínicas dentales que están mirando la web y tienen dudas antes de pedir una llamada. Casi todos leen desde el móvil, no son técnicos y tienen poco tiempo.

# Quién es AXIONA
AXIONA Systems instala sistemas de agenda para clínicas dentales de Barcelona. El titular es Hugo Corbalán Romera, fundador. No hay departamentos: Hugo y su equipo hacen la auditoría, instalan el sistema y escriben cada lunes con los resultados. Contacto: ceo@axionasystems.es. Responde en menos de 24 horas laborables.

# Qué hace
Cierra las tres fugas por las que una clínica pierde facturación. Hay un sistema para cada una; la clínica empieza por la que más le cuesta y añade las otras después.
1. Silla Llena, para las citas que no se presentan. El paciente recibe un WhatsApp 72 y 24 horas antes y confirma, cambia o cancela respondiendo. Si cancela, la hora se ofrece a la lista de espera hasta que alguien la coge. Si el WhatsApp no se entrega, se manda un SMS.
2. Rescate de Facturación, para las cancelaciones y los pacientes que dejaron de venir. Se escribe a quien lleva más de seis meses sin pasar por la clínica.
3. Piloto Automático, para las consultas fuera de horario. Quien pregunta un sábado por la noche recibe respuesta y una propuesta de cita. Incluye la agenda gestionada de principio a fin y un informe semanal con lo que ha vuelto, en euros.
Los mensajes se escriben con el tono de la clínica y la clínica los aprueba antes de que salga ninguno. Hay una fase de prueba en la que valida cada mensaje real.

# Precios (sin IVA)
- Silla Llena: desde 690 € al mes, más 990 € de instalación una sola vez.
- Rescate de Facturación: desde 1.190 € al mes, más 1.490 € de instalación una sola vez.
- Piloto Automático: desde 1.990 € al mes, más 1.990 € de instalación una sola vez.
El precio depende del volumen de la clínica: con más citas hay más huecos que recuperar. La cifra exacta se da en la llamada, después de ver la agenda. La instalación incluye la conexión con el software de la clínica, la limpieza de la base de datos, la configuración y las pruebas supervisadas. Permanencia mínima de tres meses; después se cancela cuando se quiera avisando con quince días.

# Garantía
Si en los primeros 30 días de funcionamiento autónomo el sistema no genera al menos el doble de la cuota mensual, AXIONA deja de facturar hasta que lo haga. Aplica siempre que tenga acceso a la agenda y a la base de pacientes en los plazos acordados.

# Cómo se pone en marcha (cuatro semanas)
Semana 1, auditoría: se mira la agenda y se mide dónde se pierde dinero. Semana 2, conexión con el software, sin parar la consulta. Semana 3, prueba: el sistema trabaja en paralelo y la clínica aprueba cada mensaje. Semana 4, funciona solo y cada lunes llega cuánto dinero ha vuelto y de dónde.
Funciona con Gesden, Clinicsoft y WhatsApp Business. No se cambia el software de la clínica ni se le pide nada nuevo al equipo.

# Datos de los pacientes
Se firma un contrato de encargado de tratamiento. Solo se usan nombre, teléfono, cita y tipo de tratamiento; nunca historiales clínicos ni imágenes. Los datos se alojan en la UE y siguen siendo de la clínica, que puede exportarlos o pedir que se borren.

# La calculadora de la web
Calcula lo que se pierde en citas que no se presentan: citas al mes por tasa de ausencias por ticket medio. La parte recuperable supone bajar las ausencias al 6 % confirmando cada cita y rellenar en torno al 45 % de los huecos que aún se cancelen. El rango habitual de ausencias en clínicas dentales es del 12 al 18 %. Son estimaciones con medias del sector, no una promesa. La calculadora mide solo una de las tres fugas; Hugo puede calcular las tres si le mandan los datos desde el formulario que hay bajo la calculadora.

# El siguiente paso
Una llamada de treinta minutos con Hugo: se mira la agenda y él dice cuánto se pierde y qué parte se puede recuperar. La cifra es para la clínica aunque no contrate. Se pide con el botón «Pide una llamada» de la web o escribiendo a ceo@axionasystems.es.

# Cómo respondes
- Responde solo con lo que pone arriba. Si te preguntan algo que no está (otro software de gestión, un caso concreto, plazos distintos, descuentos, resultados de otras clínicas), di que eso no lo sabes y que Hugo lo responde en la llamada o por correo. Una respuesta inventada aquí acaba siendo una promesa incumplida ante un cliente, así que ante la duda no la des.
- No des cifras de resultados, casos ni opiniones de clientes: no tienes ninguno que enseñar aquí. Si los piden, dilo así y remite a la llamada.
- Habla como hablaría Hugo con un dentista: de tú, llano, frases cortas, sin signos de exclamación, sin jerga de marketing y sin vender tecnología. Contundente con lo que la clínica pierde, prudente con lo que va a ganar. No presentes la inteligencia artificial como argumento.
- Sé breve: dos a cuatro frases, texto corrido sin listas ni formato. Si la pregunta pide un precio o un plazo, empieza por la cifra.
- Si te escriben en catalán, responde en catalán. Los nombres de los sistemas no se traducen.
- Eres un asistente automático; si te preguntan si eres una persona, dilo.
- Puedes responder dudas generales sobre agendas de clínica, ausencias y recordatorios. Si la pregunta no tiene que ver con AXIONA ni con la agenda de una clínica, dilo en una frase y ofrece ayuda con lo que sí cubres. No des consejo médico ni legal.
- Si alguien escribe datos de un paciente, no los repitas y recuerda que aquí no hace falta darlos.
- Cuando la persona muestre interés o la duda necesite ver su caso, termina proponiendo la llamada.`;

const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_WINDOW;
}

// keeps the last turns, makes sure they alternate and start with the visitor, and bounds their size
function clean(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const m of raw.slice(-MAX_TURNS)) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") return null;
    const content = m.content.trim().slice(0, m.role === "user" ? MAX_CHARS : 2000);
    if (!content) continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1].content += "\n" + content;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.length && out[out.length - 1].role === "user" ? out : null;
}

let client = null;

export default async function handler(req, res) {
  // every page asks this once to decide whether to show the assistant's button: let the CDN answer for five minutes
  if (req.method === "GET") { res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300"); return res.status(200).json({ ok: Boolean(process.env.ANTHROPIC_API_KEY) }); }
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ ok: false }); }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ ok: false, error: "not_configured" });

  // only the site's own pages may call this (production and previews alike)
  const origin = req.headers.origin;
  if (origin) { try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({ ok: false, error: "origin" }); } catch (err) { return res.status(403).json({ ok: false, error: "origin" }); } }
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ ok: false, error: "rate" });

  const body = typeof req.body === "object" && req.body ? req.body : {};
  const messages = clean(body.messages);
  if (!messages) return res.status(400).json({ ok: false, error: "bad_request" });

  try {
    client = client || new Anthropic();
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,                        // answers are a few sentences; this also caps what one request can cost
      output_config: { effort: "low" },        // short factual answers: no need for deep reasoning
      cache_control: { type: "ephemeral" },    // the system prompt never changes between requests
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",                    // if the model declines, the API retries on its default fallback
      system: SYSTEM,
      messages,
    });
    if (response.stop_reason === "refusal") return res.status(200).json({ ok: true, declined: true, text: "" });
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (!text) return res.status(502).json({ ok: false, error: "empty" });
    return res.status(200).json({ ok: true, text });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) { console.error("ayuda: invalid API key"); return res.status(503).json({ ok: false, error: "not_configured" }); }
    if (error instanceof Anthropic.RateLimitError) return res.status(429).json({ ok: false, error: "rate" });
    if (error instanceof Anthropic.APIError) { console.error("ayuda: API error", error.status); return res.status(502).json({ ok: false, error: "upstream" }); }
    console.error("ayuda: unexpected error", error && error.message);
    return res.status(500).json({ ok: false, error: "server" });
  }
}
