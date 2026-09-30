export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { question, grade, shke, brainContext, photo, lang, mode } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Add GEMINI_API_KEY in Vercel → Redeploy");

    const qLower = (question||"").toLowerCase();
    const isMarking =!!photo || mode==="mark" || qLower.length>20;
    const isDraw = /draw|diagram|illustrate|label|sketch|structure|parts of|insect|mountain|flower|map|circuit/i.test(question||"") && !photo;
    const isMarkWithImage = !!photo && /insect|mountain|flower|leaf|diagram|image|picture|shown/i.test(question||"") || !!photo;
    const isHW =!isMarking &&!isDraw && (qLower.includes('homework') || qLower.includes('10 marks') || qLower.includes('exam json'));

    let langNote = lang==="fr"? "French" : lang==="de"? "German" : lang==="zh"? "Chinese" : lang==="sw"? "Kiswahili" : "English - en-KE";

    let prompt = "";
    if(isDraw){
      prompt = `You are SomaHub PRO Diagram Drawer - CBC Grade ${grade||"7"} SHKE=${shke} Lang=${langNote} FILES:${(brainContext||"").slice(0,800)}

TASK: ${question}

MUST OUTPUT:
**📚 Topic: [topic]**
**🔑 Key Words:** **word1**, **word2**, bold all science terms
**📖 Explanation:** 2-3 sentences Grade 6-7 simple, bold key words

**📊 DIAGRAM:**
\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" style="background:white;border:2.5px solid black;border-radius:12px">
<!-- SIMPLE CLEAR CBC DIAGRAM - use circles, rects, paths, text labels bold -->
<!-- Example for insect: coiled body, label legs, etc -->
</svg>
\`\`\`

**✅ Key Points:** 3 points bold.

For insect: draw coiled millipede/6 legs/spiral etc. For mountain: peak/valley. Keep SVG simple readable.
NEVER LEVEL LOCK.`;
    } else if(isMarking){
      prompt = `You are SomaHub ULTRA PRO Marker - Kenyan CBC Expert, Grade ${grade||"7"}.
SHKE=${shke||""} Lang=${langNote} FILES: ${(brainContext||"").slice(0,1000)}

OUTPUT MUST BE ULTRA ORGANIZED, DETAILED, BOLD - FOLLOW THIS EXACT TEMPLATE FOR EVERY QUESTION:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Q1. During a nature walk, Grade 6 learners observed a mushroom growing on a dead tree trunk. Nancy quickly told her classmates not to touch it. Why did she warn them?**

**✅ Answer: B. Because it may be poisonous**

**🔑 Key Words:** **mushroom**, **dead tree trunk**, **poisonous**, **wild fungi**, **toxic**, **safety**

**📖 Detailed Reason:**
Many **mushrooms** growing on **dead tree trunks** in the wild are **poisonous** and **toxic**. When **touched or eaten**, they can cause serious harm. Nancy warned her classmates for **safety during nature walks** because **wild fungi** are not safe like farm mushrooms.

**🔍 All Choices Analysis:**
**A. Because it is soft and smooth** → **Softness** does not mean safe. A **soft mushroom** can still be **poisonous** ❌ WRONG
**B. Because it may be poisonous** → **Correct**. **Wild mushrooms** on **dead trunks** may contain **poison**, **toxic chemicals** ✅ CORRECT
**C. Because it can be eaten as food** → **Wild mushrooms** are NOT safe for **food**. Only controlled farm **mushrooms** are edible ❌ WRONG
**D. Because it has a sweet smell** → **Sweet smell** does not prove a **wild fungus** is safe to touch ❌ WRONG

**👨‍🎓 Learner:** Ticked B - **CORRECT ✅**
**⭐ Score: 1/1**

IF PHOTO CONTAINS IMAGE (insect, mountain, flower, leaf, map, circuit, animal):
**📊 IMAGE COPIED FROM PAPER:**
\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" style="background:white;border:2.5px solid black;border-radius:12px">
<!-- Redraw the image seen in photo - clean, labelled, bold labels - e.g. millipede coiled, 8 legs etc -->
</svg>
\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR RULES:
1. OCR Q numbers, stems, A-D options from photo 100% accurate.
2. Use EXACT template above for EACH Q - with ━━━ lines.
3. ALWAYS bold: **✅ Answer**, **🔑 Key Words:** with **word** bold: **mushroom, poisonous, millipede, coil, spiral, 6 legs, 8 legs, arachnids, chlorophyll, photosynthesis, mountain, peak, valley, flower, petals, stamen, pistil**.
4. Detailed Reason = 2-3 sentences, bold key words.
5. All Choices = One line per choice, bold key term, ❌ ✅
6. If photo has insect/mountain/flower/map/image: AFTER All Choices, COPY it as clean SVG labelled diagram in \`\`\`svg\`\`\` block.
7. After ALL Qs: Score Breakdown, Overall %, Feedback.
8. NO names, NO LEVEL LOCK.

TASK: ${question} Lang: ${langNote}`;
    } else {
      prompt = `You are SomaHub tutor Grade=${grade} SHKE=${shke} Lang=${langNote} FILES: ${(brainContext||"").slice(0,2000)} NEVER output LEVEL LOCK. If homework: ONLY JSON [{"q":"...","options":["A","B","C","D"],"answer":"A","marks":2}] Q: ${question}`;
    }

    let parts = [{text: prompt}];
    if (photo) parts.push({inlineData:{mimeType:"image/jpeg", data: photo}});

    // FIXED MODELS 2026 - NO 2.0-flash - NO 404!
    const models = ["gemini-1.5-flash-latest","gemini-1.5-flash","gemini-1.5-pro-latest","gemini-2.5-flash","gemini-3.0-flash"];
    let lastErr="";
    for(let m of models){
      for(let ver of ["v1beta","v1"]){
        try{
          const url=`https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`;
          const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0.25,maxOutputTokens:7000}})});
          const data=await r.json();
          let ans=data.candidates?.[0]?.content?.parts?.[0]?.text;
          if(ans){
            ans=ans.replace(/\*\*LEVEL LOCK[\s\S]*?\*\*/gi,'').trim();
            if(isHW){ let j=ans.match(/\[[\s\S]*\]/); if(j) ans=j[0]; }
            return res.json({answer:ans,model:m,lang:lang||"en",mode:isDraw?"diagram":isMarking?"marking":"homework"});
          }
          lastErr=JSON.stringify(data.error||data).slice(0,500);
        }catch(e){ lastErr=e.message; }
      }
    }
    throw new Error(lastErr);
  }catch(e){ res.status(500).json({error:e.message}); }
}
