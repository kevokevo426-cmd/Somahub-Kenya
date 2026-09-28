export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { question, grade, shke, brainContext, photo } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY missing in Vercel");

    const prompt = `You are SomaHub AI Grade ${grade} SHKE ${shke}. LEVEL LOCK ${grade} only.
FILES: ${brainContext}
Q: ${question}`;

    let parts = [{text: prompt}];
    if (photo) parts.push({inline_data:{mime_type:"image/jpeg", data: photo}});

    // For new users - only Gemini 3.x allowed per Google Sep 2026
    const models = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
    let lastErr = "";
    for (let m of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const r = await fetch(url,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({contents:[{parts}]})
      });
      const data = await r.json();
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return res.json({ 
          answer: data.candidates[0].content.parts[0].text,
          youtubeFiltered: `https://www.youtube.com/results?search_query=${encodeURIComponent(question+" "+grade+" CBC Kenya safe")}&sp=EgIQAQ%3D%3D`,
          model: m
        });
      }
      lastErr = JSON.stringify(data.error||data);
    }
    throw new Error(lastErr);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
