// api/gemini.js - SomaHub Tutor - TIMEOUT FIXED
// Use ONE fast model, no loop

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

    if (!geminiKey) return sendJSON(res, 500, { error: "Add GEMINI_API_KEY in Vercel > Settings > Env Vars" });

    // FIX: Use ONE fast model only, no loop - prevents timeout
    const model = "gemini-flash-lite-latest"; // Fastest, works on free keys
    
    const parts = [{ text: prompt }];
    if (photoB64) parts.push({ inlineData: { mimeType: mime, data: photoB64 } });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // Abort at 8s to avoid Vercel 10s kill

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 800 } // smaller = faster
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    const raw = await r.text();
    let data; try { data = JSON.parse(raw); } catch { data = {}; }

    if (!r.ok) {
      const msg = data?.error?.message || raw;
      console.log("Gemini error:", msg);
      if (r.status === 429) return sendJSON(res, 429, { error: "AI is busy, try again in 30 sec", details: msg });
      if (r.status === 404) return sendJSON(res, 500, { error: "Model not found, redeploy with new model name", details: msg });
      return sendJSON(res, 500, { error: "model unavailable", details: msg.slice(0,500) });
    }

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) return sendJSON(res, 500, { error: "Empty answer", details: raw.slice(0,500) });

    return sendJSON(res, 200, { answer, model });

  } catch (e) {
    if (e.name === 'AbortError') {
      return sendJSON(res, 500, { error: "AI took too long, please ask shorter question" });
    }
    console.error(e);
    return sendJSON(res, 500, { error: "Server error", details: String(e.message).slice(0,500) });
  }
}
