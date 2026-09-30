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
    const isMarking =!!photo || mode==="mark" || qLower.includes('mark') || qLower.includes('q13') || qLower.includes('english') || qLower.length>20;
    const isHW =!isMarking && (qLower.includes('homework') || qLower.includes('10 marks') || qLower.includes('exam json'));
    const isForeign = /french|german|chinese|français|deutsch/i.test(question||"") || ["fr","de","zh"].includes(lang||"");

    let langNote = lang==="fr"? "French Foreign - fr-FR + English in brackets"
                 : lang==="de"? "German Foreign - de-DE + English"
                 : lang==="zh"? "Chinese Foreign - zh-CN + Pinyin + English"
                 : lang==="sw"? "Kiswahili - sw-KE"
                 : "English - en-KE";

    let prompt = "";
    if(isMarking){
      prompt = `You are SomaHub Smart Marker - Kenyan CBC Mwalimu marking Grade ${grade||"6"} English.
SHKE=${shke||""} Lang=${langNote}
FILES: ${(brainContext||"").slice(0,1200)}

MARKING STYLE - FOLLOW THIS EXACT FORMAT - NO NAME MENTION:

For EACH question in photo, output like this:

**Q13. Meaning of bi-annual competition**

**Answer: B. Twice in a year**

**Reason:** In standard English, **bi-annual means happening twice a year**. The prefix **bi- = two**. Annual = year. So twice a year.

**All Choices:**
**A. Every year** - Means once a year, once = annual, not bi-annual ❌
**B. Twice in a year** - Correct, bi = 2 times in 12 months ✅
**C. Thrice in a year** - Thrice = 3 times, not 2 ❌
**D. Twice in a month** - That is bi-monthly, not bi-annual ❌

**Learner:** Not visible - WRONG ❌ (Should tick B)
**Score: 0/1**

---
**Q14. People who watch football match vs drama...**

**Answer: A. audience**

**Reason:** People watching **drama play = audience**. People watching **football = spectators**. Key difference: **play = audience**, **game = spectators**.

**All Choices:**
**A. an audience** - People watching a play/drama ✅ Correct for play
**B. a congregation** - People in church, religious gathering ❌
**C. a crowd** - General many people, no specific watch ❌
**D. spectators** - People watching football/game ❌ Opposite

**Learner:** Ticked C - WRONG ❌ (Should tick A)
**Score: 0/1**

---

RULES:
1. OCR all Q numbers, stems, A-D options from photo.
2. For each: **Bold Answer, Reason, All Choices analysis, Learner, Score** like above.
3. Explain WHY each wrong choice is wrong in simple Grade 6 English.
4. Use **bold** for key terms: **bi-annual, audience, spectators, idioms, spelling**.
5. Learner: if you can see tick/mark in photo, say "Ticked X - CORRECT ✅ / WRONG ❌", else "Not visible - WRONG ❌ (Should tick Y)".
6. After all:
**Score Page: 3/8 - Good try, revise idioms**
**Overall: 3/8 = 37.5% - Keep revising! You can do better!**
7. NO names like Abigail, Alexis, Niombi, Kasarani. Just Mwalimu.
8. Playground friendly, emojis ✅ ❌ only.
9. NEVER output LEVEL LOCK, SYSTEM, SOURCE.

PHOTO TASK: ${question}
Lang: ${langNote}`;
    } else {
      prompt = `You are SomaHub Kenya CBC tutor. Grade=${grade} SHKE=${shke} Lang=${langNote}.
FILES: ${(brainContext||"").slice(0,2500)}
RULES:
- NEVER output LEVEL LOCK, SYSTEM, SOURCE, SHKE header, ##.
- If homework: ONLY JSON: [{"q":"...","options":["A","B","C","D"],"answer":"A","marks":2,"strand":"...","color":"#e0f2ff"}] 5 questions.
${isForeign? `- Foreign ${langNote}` : ""}
Q: ${question}
Lang: ${langNote}`;
    }

    let parts = [{text: prompt}];
    if (photo) {
      parts.push({inlineData:{mimeType:"image/jpeg", data: photo}});
    }

    const models = [
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-3.5-flash-lite"
    ];

    let lastErr = "";
    for (let m of models) {
      for (let ver of ["v1beta","v1"]) {
        try {
          const url = `https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`;
          const r = await fetch(url,{
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({contents:[{parts}], generationConfig:{temperature:0.3, maxOutputTokens: 4000}})
          });
          const data = await r.json();
          let ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (ans) {
            ans = ans.replace(/\*\*LEVEL LOCK[\s\S]*?\*\*/gi,'').replace(/\*\*SYSTEM[\s\S]*?\*\*/gi,'').replace(/\*\*SOURCE[\s\S]*?\*\*/gi,'').replace(/LEVEL LOCK:.*$/gim,'').trim();
            if(isHW){
              let j = ans.match(/\[[\s\S]*\]/);
              if(j) ans = j[0];
            }
            return res.json({
              answer: ans,
              youtubeFiltered: `https://www.youtube.com/results?search_query=${encodeURIComponent(question+" "+grade+" CBC")}&sp=EgIQAQ%3D%3D`,
              model: m, lang: lang||"en", mode: isMarking? "marking" : "homework"
            });
          }
          lastErr = JSON.stringify(data.error||data).slice(0,500);
        } catch(e){ lastErr = e.message; }
      }
    }
    throw new Error(lastErr || "Busy, try again");
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
