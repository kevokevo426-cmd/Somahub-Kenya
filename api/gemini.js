// api/gemini.js - SomaHub - FINAL: Timeout fix + Gemini + OpenRouter FREE backup (photos work)
export const config = { 
  api: { bodyParser: { sizeLimit: "5mb" } },
  maxDuration: 30
};

function sendJSON(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(obj));
}
function cleanBase64Photo(photo) {
  if (!photo) return "";
  let s = String(photo).trim();
  if (s.startsWith("data:")) {
    const idx = s.indexOf(",");
    if (idx !== -1) s = s.slice(idx + 1);
  }
  return s.replace(/\s/g, "");
}
function buildPrompt({ grade, role, question, task, history }) {
  const isSW = /habari|mambo|kiswahili|eleza|soma/i.test(question) || String(task).includes("SW");
  const hist = (history || []).slice(-4).map(h => `${h.role}: ${h.content}`).join("\n").slice(0,1500);
  return `You are SomaHub CBC Tutor Kenya. Grade: ${grade}. Lang: ${isSW ? "Kiswahili" : "English"}. History: ${hist}\nQ: ${question}\nAnswer concisely <250 words, CBC style. Topic: Explanation:`;
}
function localGreetingReply(q) {
  if (!q) return null;
  const t = q.toLowerCase().trim();
  if (t.length > 25) return null;
  if (["habari","mambo","hello","hi","hey","niaje","poa"].some(w => t===w || t.startsWith(w+" "))) {
    return t.includes("habari")||t.includes("mambo") ? "Habari! Mimi ni Mwalimu wa SomaHub. Una swali gani?" : "Hello! I'm SomaHub Tutor. What's your question?";
  }
  return null;
}

// Gemini call with 8s timeout
async function callGemini({ key, prompt, photoB64, mime }) {
  const model = "gemini-flash-lite-latest";
  const parts = [{ text: prompt }];
  if (photoB64) parts.push({ inlineData: { mimeType: mime || "image/jpeg", data: photoB64 } });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.5, maxOutputTokens: 800 } }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch { data = {}; }
    if (!r.ok) throw new Error(`${r.status}: ${data?.error?.message || raw}`.slice(0,600));
    const ans = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!ans) throw new Error("Empty");
    return ans;
  } finally { clearTimeout(timeout); }
}

// OpenRouter FREE backup - supports photos
async function callOpenRouter({ key, prompt, photoB64, mime }) {
  const models = ["qwen/qwen2.5-vl-32b-instruct:free", "google/gemini-2.0-flash-exp:free"];
  let lastErr = "";
  for (const model of models) {
    try {
      const content = [{ type: "text", text: prompt }];
      if (photoB64) content.push({ type: "image_url", image_url: { url: `data:${mime || "image/jpeg"};base64,${photoB64}` } });
      const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "HTTP-Referer": "https://somahub-kenya.vercel.app", "X-Title": "SomaHub" },
        body: JSON.stringify({ model, messages: [{ role: "user", content }], max_tokens: 1000, temperature: 0.5 })
      });
      const raw = await r.text();
      let data; try { data = JSON.parse(raw); } catch { data = {}; }
      if (!r.ok) throw new Error(`${r.status} ${model}: ${data?.error?.message || raw}`.slice(0,600));
      const ans = data?.choices?.[0]?.message?.content;
      if (!ans) throw new Error("Empty OR");
      return ans;
    } catch (e) { lastErr = e.message; continue; }
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
    const question = (body.question || body.prompt || "").toString().trim();
    const grade = body.grade || "Grade 7";
    const history = body.history || [];
    const task = body.task || "EN";
    const photoB64 = cleanBase64Photo(body.photo || "");
    const mime = body.mimeType || "image/jpeg";
    if (!question && !photoB64) return sendJSON(res, 400, { error: "No question" });
    const local = localGreetingReply(question);
    if (local && !photoB64) return sendJSON(res, 200, { answer: local });

    const prompt = buildPrompt({ grade, role: body.role, question: question || "Explain image", task, history });
    const geminiKey = (process.env.GEMINI_API_KEY || "").trim();
    const orKey = (process.env.OPENROUTER_API_KEY || "").trim();

    let lastErr = "";

    if (geminiKey) {
      try {
        const ans = await callGemini({ key: geminiKey, prompt, photoB64, mime });
        return sendJSON(res, 200, { answer: ans, model: "gemini" });
      } catch (e) { lastErr = e.message; console.log("Gemini failed:", lastErr); }
    }
    if (orKey) {
      try {
        const ans = await callOpenRouter({ key: orKey, prompt, photoB64, mime });
        return sendJSON(res, 200, { answer: ans, model: "openrouter-free" });
      } catch (e) { lastErr += " | OR: " + e.message; console.log("OR failed:", e.message); }
    }
    return sendJSON(res, 500, { error: "All APIs failed", details: lastErr.slice(0,800) });
  } catch (e) {
    if (e.name === 'AbortError') return sendJSON(res, 500, { error: "AI took too long, try again" });
    console.error(e);
    return sendJSON(res, 500, { error: "Server error", details: String(e.message).slice(0,500) });
  }
}
