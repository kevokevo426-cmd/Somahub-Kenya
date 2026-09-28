export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { question, grade, shke, brainContext, photo, lang } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Add GEMINI_API_KEY in Vercel Env → Redeploy");

    const isHW = (question||"").toLowerCase().includes('homework') || (question||"").toLowerCase().includes('10 marks') || (question||"").toLowerCase().includes('exam');
    const isForeign = /french|german|chinese|français|deutsch/i.test(question||"") || ["fr","de","zh"].includes(lang||"");

    // NEW PROMPT - NO LEVEL LOCK HEADER, NO Oxford name, PLAYGROUND JSON FOR HW
    let langNote = lang==="fr"? "French Foreign Language - use fr-FR, include English translation in brackets"
                 : lang==="de"? "German Foreign Language - de-DE, include English translation"
                 : lang==="zh"? "Chinese Foreign Language - zh-CN, include Pinyin + English"
                 : lang==="sw"? "Kiswahili - sw-KE"
                 : "English - en-KE";

    let prompt = `You are SomaHub Kenya CBC tutor. Grade=${grade} SHKE=${shke} Lang=${langNote}.
FILES: ${(brainContext||"").slice(0,2500)}

RULES - MUST FOLLOW:
- NEVER output LEVEL LOCK, SYSTEM, SOURCE, SHKE code header, **, ##.
- NEVER say "LEVEL LOCK: GRADE X ACTIVE" - forbidden.
- If homework 10 marks or exam: return ONLY JSON array, no extra text:
[{"q":"Question?","options":["A","B","C","D"],"answer":"A","marks":2,"strand":"Topic","color":"#e0f2ff"}]
5 questions, MCQ with 4 options where possible, colorful, playground friendly for all ages.
${isForeign? `- Foreign ${langNote}: questions in foreign language + English translation` : ""}
- If normal explanation: short clear paragraphs, simple formatting, no ** headers, playground friendly.
- 10 marks total if homework.

Q: ${question}
Lang: ${langNote} ${isForeign? "(Foreign Language mode ON)" : ""}`;

    let parts = [{text: prompt}];
    if (photo) parts.push({inline_data:{mime_type:"image/jpeg", data: photo}});

    // Sep 2026: 3.8 overloaded 503, try lightest first
    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-2.5-flash-lite"
    ];

    let lastErr = "";
    for (let m of models) {
      for (let ver of ["v1beta","v1"]) {
        try {
          const url = `https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`;
          const r = await fetch(url,{
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({contents:[{parts}]})
          });
          const data = await r.json();
          let ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (ans) {
            // CLEAN old headers just in case model still adds them
            ans = ans.replace(/\*\*LEVEL LOCK[\s\S]*?\*\*/gi,'')
                    .replace(/\*\*SYSTEM[\s\S]*?\*\*/gi,'')
                    .replace(/\*\*SOURCE[\s\S]*?\*\*/gi,'')
                    .replace(/##\s*GRADE.*$/gim,'')
                    .replace(/LEVEL LOCK:.*$/gim,'')
                    .replace(/SYSTEM:.*$/gim,'')
                    .trim();

            // Keep JSON as is for homework
            if(isHW){
              // If not JSON, force extract JSON or return cleaned
              let j = ans.match(/\[[\s\S]*\]/);
              if(j) ans = j[0];
            }

            return res.json({
              answer: ans,
              youtubeFiltered: `https://www.youtube.com/results?search_query=${encodeURIComponent(question+" "+grade+" CBC Kenya safe")}&sp=EgIQAQ%3D%3D`,
              model: m,
              lang: lang||"en"
            });
          }
          if (data.error?.code === 503) { lastErr = `503 ${m} busy`; continue; }
          lastErr = JSON.stringify(data.error||data).slice(0,300);
        } catch(e){ lastErr = e.message; }
      }
    }
    throw new Error(lastErr || "All models busy, try again in 10 sec");

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
