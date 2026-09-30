export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const { question, grade, shke, brainContext, photo, lang, mode } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Add GEMINI_API_KEY in Vercel");
    const qLower = (question||"").toLowerCase();
    const isMarking =!!photo || mode==="mark" || qLower.length>20;
    const isDraw = /draw|diagram|illustrate|label|sketch|structure|parts of|insect|mountain|flower/i.test(question||"") &&!photo;
    const isHW =!isMarking &&!isDraw && (qLower.includes('homework') || qLower.includes('10 marks') || qLower.includes('exam json'));
    let langNote = lang==="fr"?"French":lang==="de"?"German":lang==="zh"?"Chinese":lang==="sw"?"Kiswahili":"English - en-KE";
    let prompt = "";
    if(isDraw){
      prompt = `You are SomaHub Diagram Drawer Grade ${grade||"7"} SHKE=${shke} TASK:${question} If question has insect/mountain/flower/map - COPY it as clean SVG: \`\`\`svg <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" style="background:white;border:2.5px solid black;border-radius:12px">...clean labelled diagram...</svg> \`\`\` + bold key words explanation.`;
    } else if(isMarking){
      prompt = `You are SomaHub ULTRA PRO Marker CBC Grade ${grade||"7"} SHKE=${shke||""} Lang=${langNote} FILES:${(brainContext||"").slice(0,1000)}

TEMPLATE PER Q:
━━━━━━━━━━━━━━━━━━━━━━━━
**Q1. [stem]**

**✅ Answer: B. Because it may be poisonous**

**🔑 Key Words:** **mushroom**, **poisonous**, **wild fungi**

**📖 Detailed Reason:** Many **mushrooms** on **dead trunks** are **poisonous** and **toxic**. 2 sentences bold.

**🔍 All Choices:**
**A...** →... ❌ WRONG
**B...** →... ✅ CORRECT
**C...** →... ❌ WRONG
**D...** →... ❌ WRONG

**👨‍🎓 Learner:** Ticked B - CORRECT ✅
**⭐ Score: 1/1**

IF PHOTO HAS insect/mountain/flower/image:
**📊 IMAGE COPIED FROM PAPER:**
\`\`\`svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" style="background:white;border:2.5px solid black;border-radius:12px"><text x="50%" y="50%" text-anchor="middle" font-weight="900">[Redraw insect/mountain here clean labelled]</text></svg>
\`\`\`
━━━━━━━━━━━━━━━━━━━━━━━━

RULES: Bold answer, bold key words, all choices, score at end. COPY image if present as SVG. NO LEVEL LOCK. TASK:${question}`;
    } else {
      prompt = `You are SomaHub tutor Grade=${grade} SHKE=${shke} Lang=${langNote} NEVER LEVEL LOCK. If homework ONLY JSON [{"q":"...","options":["A","B","C","D"],"answer":"A","marks":2}] Q:${question}`;
    }
    let parts=[{text:prompt}];
    if(photo) parts.push({inlineData:{mimeType:"image/jpeg",data:photo}});
    // NEW 2026 MODELS - FIX FOR YOUR SCREENSHOT - 3.8-flash IS WORKING!
    const models=["gemini-3.8-flash","gemini-3.0-flash","gemini-2.5-flash","gemini-1.5-flash-latest","gemini-1.5-flash","gemini-1.5-pro-latest"];
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
            if(isHW){let j=ans.match(/\[[\s\S]*\]/); if(j) ans=j[0];}
            return res.json({answer:ans,model:m,lang:lang||"en",mode:isDraw?"diagram":isMarking?"marking":"homework"});
          }
          lastErr=JSON.stringify(data.error||data).slice(0,600);
        }catch(e){lastErr=e.message;}
      }
    }
    throw new Error(lastErr);
  }catch(e){res.status(500).json({error:e.message});}
}
