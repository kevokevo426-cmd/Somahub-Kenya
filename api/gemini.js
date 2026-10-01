export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({answer: "SomaHub API Ready"});

  let body = {};
  try { body = typeof req.body === 'string'? JSON.parse(req.body) : (req.body||{}); } catch { body={}; }

  try {
    const question = (body.question||"Mark this exam").slice(0,8000);
    const grade = body.grade||"Grade 7";
    const photo = body.photo||"";
    const KEY = process.env.GEMINI_API_KEY;

    if (!KEY) return res.status(200).json({answer: "Demo mode - Add GEMINI_API_KEY in Vercel Settings"});

    if (photo && photo.length > 900000) {
      return res.status(200).json({answer: "📸 Photo too large - Retake closer, crop paper only, use Gallery. Max 800KB"});
    }

    const prompt = `You are SomaHub PRO Marker Grade ${grade}. Mark photo - bold Answer, Key Words, All A-D analysed, Score per Q, Overall. If has diagram, describe it. TASK: ${question}`;

    let parts = [{text: prompt}];
    if (photo) parts.push({inlineData:{mimeType:"image/jpeg", data: photo}});

    // FIX: Use only 1 stable model + retry 3 times for 503
    const models = ["gemini-1.5-flash","gemini-1.5-flash-8b"];

    for (let attempt=0; attempt<3; attempt++) {
      for (let m of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`;
          const r = await fetch(url,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0.2,maxOutputTokens:5000}})
          });
          if (r.status===503) { // busy - wait and retry
            await new Promise(r=>setTimeout(r, 1500 * (attempt+1)));
            continue;
          }
          const txt = await r.text();
          let data; try{ data=JSON.parse(txt); }catch{ data={}; }
          let ans = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (ans) return res.status(200).json({answer: ans});
        } catch(e){ continue; }
      }
      await new Promise(r=>setTimeout(r, 1000));
    }

    // After retries - friendly message, not code
    return res.status(200).json({answer: `⏳ **SomaHub is busy - Google is full**

Google Gemini says: High demand, try again later.

**What to do:**
1. Wait 30 seconds then tap Mark Exam again
2. Or try smaller photo - crop paper only
3. Use Gallery not Camera

SomaHub will work - Google just busy now. Pole Mwalimu! 🙏`});

  } catch(e){
    return res.status(200).json({answer: `❌ SomaHub error: ${e.message} - Retake photo closer`});
  }
}
