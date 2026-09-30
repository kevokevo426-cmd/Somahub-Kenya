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
    const isMarking =!!photo || mode==="mark" || (qLower.includes('mark') && qLower.length>15);
    const isDraw = /draw|diagram|illustrate|label|sketch|structure of|parts of/i.test(question||"");
    const isHW =!isMarking && !isDraw && (qLower.includes('homework') || qLower.includes('10 marks') || qLower.includes('exam json'));

    let langNote = lang==="fr"? "French - fr-FR + English" : lang==="de"? "German - de-DE + English" : lang==="zh"? "Chinese - zh-CN + English" : lang==="sw"? "Kiswahili" : "English - en-KE";

    let prompt = "";
    if(isDraw){
      prompt = `You are SomaHub PRO Diagram Drawer + CBC Tutor Grade ${grade||"7"} SHKE=${shke} Lang=${langNote}
FILES: ${(brainContext||"").slice(0,1000)}

TASK: Draw DIAGRAM for: ${question}

RULES - MUST FOLLOW:
1. First give organized explanation with bold key words.
2. Then give DIAGRAM as clean SVG code inside \`\`\`svg ... \`\`\` - simple, clear, CBC Grade 6-7 style.
3. SVG must be 400x300 viewBox, white background, black stroke 2.5, bold labels, colorful fills.
4. For photosynthesis: show sun, leaf, CO2 arrow, water arrow, oxygen out, chlorophyll label.
5. For flower: show petals, sepal, stamen, pistil labeled.
6. For water cycle: evaporation, condensation, precipitation arrows.
7. For digestive system: mouth, esophagus, stomach, intestines labeled.
8. Keep labels bold and readable.
9. After SVG, give 3 key points with bold key words.

OUTPUT FORMAT:
**📚 Topic: Photosynthesis**

**🔑 Key Words:** **sunlight**, **chlorophyll**, **carbon dioxide**, **water**, **oxygen**

**📖 Explanation:** Plants make food using **sunlight**... etc 2-3 sentences bold key words.

**📊 DIAGRAM:**
\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" style="background:white;border:2.5px solid black;border-radius:12px">
... your diagram here ...
</svg>
\`\`\`

**✅ Key Points:**
1. **Sunlight** needed...
2. **Chlorophyll** traps...

NO LEVEL LOCK. Playground friendly.`;
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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOUR RULES:
1. OCR Q numbers, stems, A-D options from photo 100% accurate.
2. Use EXACT template above for EACH Q - with ━━━ lines.
3. ALWAYS bold: **✅ Answer: X....**, **🔑 Key Words:** with **word** bold for each science term.
4. Detailed Reason = 2-3 full sentences, simple Grade 6-7 English, bold key words inside.
5. All Choices = One line per choice, bold key term, explain WHY wrong, with ❌ ✅ at end.
6. Learner: If tick visible: "Ticked X - CORRECT ✅ / WRONG ❌ (Should be Y)", else "Not visible - WRONG ❌ (Should be Y)".
7. After ALL Qs:
---
**📊 SCORE BREAKDOWN** Q1:1/1 | Q2:1/1 | Q3:0/1
**📊 Score Page: 5/6**
**💯 Overall: 5/6 = 83% - Very Good! Keep revising! 🌟**
**📝 Teacher Feedback: Brilliant effort!**
---
8. NO names: Abigail, Alexis, Niombi, Kasarani. Only Mwalimu.
9. NEVER output LEVEL LOCK, SYSTEM, SOURCE.

TASK: ${question} Lang: ${langNote}
If question also says draw/diagram, add after marking: 
**📊 DIAGRAM:** with \`\`\`svg code as described in draw prompt.`;
    } else {
      prompt = `You are SomaHub tutor Grade=${grade} SHKE=${shke} Lang=${langNote} FILES: ${(brainContext||"").slice(0,2000)} NEVER output LEVEL LOCK. If homework: ONLY JSON [{"q":"...","options":["A","B","C","D"],"answer":"A","marks":2}] Q: ${question}`;
    }

    let parts = [{text: prompt}];
    if (photo) parts.push({inlineData:{mimeType:"image/jpeg", data: photo}});

    const models = ["gemini-1.5-flash-latest","gemini-1.5-flash","gemini-2.0-flash"];
    let lastErr="";
    for(let m of models){
      for(let ver of ["v1beta","v1"]){
        try{
          const url=`https://generativelanguage.googleapis.com/${ver}/models/${m}:generateContent?key=${apiKey}`;
          const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0.25,maxOutputTokens:6500}})});
          const data=await r.json();
          let ans=data.candidates?.[0]?.content?.parts?.[0]?.text;
          if(ans){
            ans=ans.replace(/\*\*LEVEL LOCK[\s\S]*?\*\*/gi,'').trim();
            if(isHW){ let j=ans.match(/\[[\s\S]*\]/); if(j) ans=j[0]; }
            return res.json({answer:ans,model:m,lang:lang||"en",mode:isDraw?"diagram":isMarking?"marking":"homework"});
          }
          lastErr=JSON.stringify(data.error||data).slice(0,400);
        }catch(e){ lastErr=e.message; }
      }
    }
    throw new Error(lastErr);
  }catch(e){ res.status(500).json({error:e.message}); }
}
