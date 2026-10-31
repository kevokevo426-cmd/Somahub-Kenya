// api/gemini.js - SomaHub Tutor FINAL FIX v2 - Oct 2026 models
export const config = { 
  api: { bodyParser: { sizeLimit: "12mb" } },
  maxDuration: 30 // FIX 1: Stop Vercel killing after 10s
};

function sendJSON(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(obj));
}

function cleanBase64Photo(photo) {
  if (!photo) return "";
  let s = String(photo).trim();
  if (s.startsWith("data:")) {
    const idx = s.indexOf(",");
    if (idx !== -1) s = s.slice(idx + 1);
  }
  s = s.replace(/\s/g, "");
  return s;
}

function buildPrompt({ grade, role, question, task, history }) {
  const lang = String(task || "").toUpperCase().includes("SW") || /habari|kiswahili|eleza/i.test(question) ? "SW" : "EN";
  const hist = (history || []).slice(-6).map(h => `${h.role}: ${h.content}`).join("\n").slice(0,3000);

  return `You are SomaHub Tutor, a friendly CBC tutor for Kenya.
Grade: ${grade || "Grade 7"}
User Role: ${role || "Student"}
Language: ${lang === "SW" ? "Kiswahili sanifu, but explain terms in English where helpful" : "English"}
History:
${hist}

Question: ${question}

Rules:
- Be concise, clear, correct for CBC.
- If Math, show steps.
- If Kiswahili word detected, answer in Kiswahili.
- Format: 
Topic: ...
Explanation: ...
- No markdown symbols like ###.
- Keep answer under 400 words.
`;
}

function localGreetingReply(q) {
  if (!q) return null;
  const t = q.toLowerCase().trim();
  if (t.length > 25) return null;
  if (["habari","mambo","habari yako","poa","sasa","hello","hi","hey","niaje"].some(w => t === w || t.startsWith(w+" "))) {
    if (t.includes("habari") || t.includes("mambo") || t.includes("poa")) {
      return "Habari! Mimi ni Mwalimu wa SomaHub. Niko tayari kukusaidia na masomo yako leo. Una swali gani?";
    }
    return "Hello! I'm SomaHub Tutor. Ready to help you learn today. What's your question?";
  }
  return null;
}

async function callGemini({ key, model, prompt, photoB64, mime }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  
  const parts = [{ text: prompt }];
  if (photoB64) {
    parts.push({ inlineData: { mimeType: mime || "image/jpeg", data: photoB64 } });
  }

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1200 }
    })
  });

  const raw = await r.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { raw }; }

  if (!r.ok) {
    const msg = data?.error?.message || raw;
    throw new Error(`${r.status} ${model}: ${msg}`.slice(0, 800));
  }

  const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!answer) throw new Error(`Empty from ${model}: ${raw.slice(0,500)}`);
  return answer;
}

async function callOpenAI({ key, prompt, photoB64, mime }) {
  const models = ["gpt-4o-mini", "gpt-4o"];
  let lastErr = "";
  for (const m of models) {
    try {
      const content = [];
      content.push({ type: "text", text: prompt });
      if (photoB64) {
        content.push({ type: "image_url", image_url: { url: `data:${mime || "image/jpeg"};base64,${photoB64}` } });
      }
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({ model: m, messages: [{ role: "user", content }], temperature: 0.6, max_tokens: 1200 })
      });
      const raw = await r.text();
      let data; try { data = JSON.parse(raw); } catch { data = {} }
      if (!r.ok) throw new Error(`${r.status} ${m}: ${data?.error?.message || raw}`.slice(0,800));
      const ans = data?.choices?.[0]?.message?.content;
      if (!ans) throw new Error(`Empty from ${m}`);
      return ans;
    } catch (e) {
      lastErr = e.message;
      continue;
    }
  }
  throw new Error(lastErr);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return sendJSON(res, 405, { error: "POST only" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const question = (body.question || body.originalQuestion || body.prompt || "").toString().trim();
    const grade = body.grade || "Grade 7";
    const role = body.role || "Student";
    const task = body.task || body.mode || "EN";
    const history = body.history || [];
    const photoRaw = body.photo || "";
    const mime = body.mimeType || "image/jpeg";

    if (!question && !photoRaw) return sendJSON(res, 400, { error: "No question or photo" });

    const local = localGreetingReply(question);
    if (local && !photoRaw) return sendJSON(res, 200, { answer: local });

    const photoB64 = cleanBase64Photo(photoRaw);
    const prompt = buildPrompt({ grade, role, question: question || "Explain this image", task, history });

    const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
    const openaiKey = (process.env.OPENAI_API_KEY || "").trim();

    // FIX 2: NEW MODELS - old 1.5/2.0 are retired
    const GEMINI_MODELS = [
      "gemini-2.5-flash-lite",      // Works for free keys
      "gemini-flash-latest",        // Alias that always points to working model
      "gemini-flash-lite-latest",
      "gemini-2.5-flash"            // Last try if user has paid key
    ];

    let lastError = "";

    if (geminiKey) {
      for (const model of GEMINI_MODELS) {
        try {
          console.log(`Trying Gemini ${model}`);
          const ans = await callGemini({ key: geminiKey, model, prompt, photoB64, mime });
          return sendJSON(res, 200, { answer: ans, model });
        } catch (e) {
          lastError = e.message;
          console.log(`Gemini ${model} failed:`, lastError);
          
          // FIX 3: Retry on quota error with wait
          if (/429|RESOURCE_EXHAUSTED|quota/i.test(lastError)) {
            await new Promise(r => setTimeout(r, 2000));
          }
          
          if (/API_KEY_INVALID|PERMISSION_DENIED/i.test(lastError)) break;
          continue;
        }
      }
    } else {
      lastError = "No GEMINI_API_KEY in Vercel env";
    }

    if (openaiKey) {
      try {
        const ans = await callOpenAI({ key: openaiKey, prompt, photoB64, mime });
        return sendJSON(res, 200, { answer: ans, model: "openai-fallback" });
      } catch (e) {
        lastError += " | OpenAI: " + e.message;
      }
    }

    console.error("All models failed:", lastError);
    
    return sendJSON(res, 500, { 
      error: lastError.includes("404") && lastError.includes("not found")
        ? "Model retired by Google. Code updated but needs redeploy."
        : lastError.includes("429") || lastError.includes("quota")
        ? "AI quota finished today. Admin add billing at aistudio.google.com or wait 1 hour"
        : "model unavailable",
      details: lastError.slice(0, 1000),
      hint: lastError.includes("404") ? "Redeploy with new models list" : "Add GEMINI_API_KEY in Vercel"
    });

  } catch (e) {
    console.error("Handler crash:", e);
    return sendJSON(res, 500, { error: "Server error", details: String(e.message || e).slice(0,1000) });
  }
}
