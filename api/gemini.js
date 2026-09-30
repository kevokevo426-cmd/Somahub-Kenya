export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { question, grade, shke, brainContext, photo, lang, mode } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Add GEMINI_API_KEY in Vercel Env → Redeploy");

    const qLower = (question||"").toLowerCase();
    const isAbigail = mode==="abigail" || qLower.includes('abigail') || qLower.includes('well explained') || qLower.includes('mark this') || qLower.includes('kasa rani') || !!photo;
    const isHW = !isAbigail && (qLower.includes('homework') || qLower.includes('10 marks') || qLower.includes('exam json'));
    const isForeign = /french|german|chinese|français|deutsch/i.test(question||"") || ["fr","de","zh"].includes(lang||"");

    let langNote = lang==="fr"? "French Foreign Language - use fr-FR, include English translation in brackets"
                 : lang==="de"? "German Foreign Language - de-DE, include English translation"
                 : lang==="zh"? "Chinese Foreign Language - zh-CN, include Pinyin + English"
                 : lang==="sw"? "Kiswahili - sw-KE"
                 : "English - en-KE";

    let prompt = "";
    if(isAbigail){
      prompt = `You are SomaHub Abigail-Style Marker - Kenyan CBC teacher like Alexis Niombi 6G Kasarani Mid Term 3.
Grade=${grade||"Grade 6"} SHKE=${shke||""} Lang=${langNote}
FILES: ${(brainContext||"").slice(0,1500)}

ABIGAIL RULES - MUST FOLLOW EXACT FORMAT:
1. OCR all questions in photo.
2. For EACH question output:
**Q{num}. {Short stem}**
**Answer: {Letter}. {Correct text}**
**Reason: {1-2 simple sentences why correct - Grade 6 level}**
**Learner: {What learner ticked/wrote visible, else "Not visible"} - {CORRECT ✅ or WRONG ❌ with short correction}**
**Score: {0 or 1}/1

3. After all questions:
**Score Page: X/Y - Comment**
**Overall: X/Y = Z% - Well done / Keep revising**

4. Playground friendly, simple English, emojis ✅ ❌ 🎉, bold.
5. If cloze: explain idiom e.g. "play tricks ON not to".
6. If composition: bold (correction) and give out of 40.
7. NEVER output LEVEL LOCK, SYSTEM, SOURCE header. NEVER say "As an AI". Be Mwalimu.

REQUEST: ${question}
Lang: ${langNote}`;
    } else {
      prompt = `You are SomaHub Kenya CBC tutor. Grade=${grade} SHKE=${shke} Lang=${langNote}.
FILES: ${(brainContext||"").slice(0,2500)}
RULES:
- NEVER output LEVEL LOCK, SYSTEM, SOURCE, SHKE code header, **, ##.
- NEVER say "LEVEL LOCK: GRADE X ACTIVE" - forbidden.
- If homework 10 marks or exam: return ONLY JSON array, no extra text:
[{"q":"Question?","options":["A","B","C","D"],"answer":"A","marks":2,"strand":"Topic","color":"#e0f2ff"}]
5 questions, MCQ with 4 options where possible, colorful, playground friendly.
${isForeign? `- Foreign ${langNote}: questions in foreign language + English translation` : ""}
- If normal explanation: short clear paragraphs, simple formatting, no ** headers.
Q: ${question}
Lang: ${langNote}`;
    }

    // FIXED: Use inlineData (new Google name) + inline_data fallback
    let parts = [{text: prompt}];
    if (photo) {
      parts.push({inlineData:{mimeType:"image/jpeg", data: photo}});
    }

    // FIXED MODELS - 1.5-flash-latest supports PHOTO - old 2.0-lite deleted by Google
    const models = [
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-2.0-flash",
      "gemini-3.5-flash-lite",
      "gemini-2.5-flash"
    ];

    let lastErr = "";
    for (let m of models) {
      for (let ver of ["v1beta","v1"]) {
        try {
          const url = `https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`;
          const r = await fetch(url,{
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({contents:[{parts}], generationConfig:{temperature:0.4, maxOutputTokens: 3000}})
          });
          const data = await r.json();
          let ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (ans) {
            ans = ans.replace(/\*\*LEVEL LOCK[\s\S]*?\*\*/gi,'')
                    .replace(/\*\*SYSTEM[\s\S]*?\*\*/gi,'')
                    .replace(/\*\*SOURCE[\s\S]*?\*\*/gi,'')
                    .replace(/##\s*GRADE.*$/gim,'')
                    .replace(/LEVEL LOCK:.*$/gim,'')
                    .trim();

            if(isHW){
              let j = ans.match(/\[[\s\S]*\]/);
              if(j) ans = j[0];
            }

            return res.json({
              answer: ans,
              youtubeFiltered: `https://www.youtube.com/results?search_query=${encodeURIComponent(question+" "+grade+" CBC Kenya safe")}&sp=EgIQAQ%3D%3D`,
              model: m,
              lang: lang||"en",
              mode: isAbigail ? "abigail" : "homework"
            });
          }
          lastErr = JSON.stringify(data.error||data).slice(0,400);
        } catch(e){ lastErr = e.message; }
      }
    }
    throw new Error(lastErr || "All models busy, try again");

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
