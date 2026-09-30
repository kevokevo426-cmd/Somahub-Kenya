export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { question, grade, photo, lang, mode } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    const prompt = `You are SomaHub PRO Marker Grade ${grade||7}. Mark this photo - well organized, detailed, bold Answer, bold Key Words, All Choices A-D analysed, Score per Q, Overall. If photo has insect/mountain/flower/image, copy it as SVG. TASK: ${question||"Mark photo"}`;
    let parts = [{text: prompt}];
    if (photo) parts.push({inlineData:{mimeType:"image/jpeg", data: photo}});

    // THESE ARE THE ONLY MODELS THAT WORK TODAY - TESTED
    const models = ["gemini-1.5-flash","gemini-2.0-flash","gemini-2.5-flash","gemini-3-flash-preview"];
    let lastErr = "";
    for (let m of models) {
      try {
        // Use v1beta - v1 blocks...-latest and 1.5-pro
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const r = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0.2,maxOutputTokens:6000}})});
        const data = await r.json();
        let ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (ans) return res.json({answer: ans});
        lastErr = JSON.stringify(data.error).slice(0,500);
      } catch(e){ lastErr = e.message; }
    }
    throw new Error(lastErr);
  } catch(e){ res.status(500).json({error: e.message}); }
}
