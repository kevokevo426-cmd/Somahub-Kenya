export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({answer: "SomaHub API Ready"});

  // SAFE PARSE - fixes Unexpected token R
  let body = {};
  try {
    if (typeof req.body === 'string') body = JSON.parse(req.body);
    else body = req.body || {};
  } catch { body = {}; }

  try {
    const question = (body.question || "").slice(0,8000);
    const grade = body.grade || "Grade 7";
    const photo = body.photo || "";
    const lang = body.lang || "en";
    const mode = body.mode || "mark";
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({answer: `**Demo Mode - No API Key**
**Q1.** Marking works but needs GEMINI_API_KEY in Vercel > Settings > Env
**Answer: B. Sample**
**Reason: Add key to get live marking**
**Score: 1/1

Add GEMINI_API_KEY in Vercel`});
    }

    if (photo && photo.length > 1000000) {
      return res.status(200).json({answer: "Photo too large for OLD Gemini - Retake closer, crop paper only, use Gallery button. Current: "+Math.round(photo.length/1024)+"KB, max 800KB"});
    }

    const prompt = `You are SomaHub PRO Marker Grade ${grade}. Mark this photo - well organized, detailed, bold Answer, bold Key Words, All Choices A-D analysed, Score per Q, Overall. If photo has insect/mountain/flower/image, copy it as SVG. TASK: ${question || "Mark photo"} Language: ${lang} Mode: ${mode}`;

    let parts = [{text: prompt}];
    if (photo) parts.push({inlineData:{mimeType:"image/jpeg", data: photo}});

    // YOUR MODELS - SAME AS YOUR FILE - TESTED
    const models = ["gemini-1.5-flash","gemini-2.0-flash","gemini-2.5-flash","gemini-3-flash-preview"];
    let lastErr = "";
    for (let m of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const r = await fetch(url,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            contents:[{parts}],
            generationConfig:{temperature:0.2, maxOutputTokens:6000}
          })
        });
        const text = await r.text();
        let data;
        try { data = JSON.parse(text); } catch { data = {candidates:[{content:{parts:[{text: text}]}}]}; }
        let ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (ans) return res.status(200).json({answer: ans, youtubeFiltered: "https://www.youtube.com/results?search_query="+encodeURIComponent(grade+" CBC")});
        lastErr = JSON.stringify(data.error || data).slice(0,600);
      } catch(e){ lastErr = e.message; }
    }
    // If all models fail - return 200 not 500 - fixes FUNCTION_INVOCATION_FAILED
    return res.status(200).json({answer: `All models failed: ${lastErr.slice(0,500)} - Check GEMINI_API_KEY, model access`});

  } catch(e){
    // NEVER return 500 - always 200 JSON
    return res.status(200).json({answer: `SomaHub caught error but not crash: ${e.message} - Retake photo closer, paper only, use Gallery`});
  }
}
