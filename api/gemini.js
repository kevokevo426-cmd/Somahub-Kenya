export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { question, grade, shke, brainContext, photo } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    const prompt = `You are SomaHub AI Grade ${grade} SHKE ${shke}. LEVEL LOCK Grade ${grade} only.\nALL FILES:\n${brainContext}\nQ: ${question}`;
    let parts = [{text: prompt}];
    if (photo) parts.push({inline_data:{mime_type:"image/jpeg", data: photo}});
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const gemRes = await fetch(url,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({contents:[{parts}]})});
    const data = await gemRes.json();
    if (data.error) throw new Error(JSON.stringify(data.error));
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No reply";
    const youtubeFiltered = `https://www.youtube.com/results?search_query=${encodeURIComponent(question+" "+grade+" CBC Kenya safe")}&sp=EgIQAQ%3D%3D`;
    res.json({ answer, youtubeFiltered });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
