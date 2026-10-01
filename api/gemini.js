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

    if (!KEY) return res.status(200).json({answer: "Demo - Add GEMINI_API_KEY in Vercel"});
    if (photo && photo.length > 900000) {
      return res.status(200).json({answer: "📸 Photo too large - retake closer, paper only"});
    }

    let parts = [{text: `You are SomaHub PRO Marker ${grade}. Mark: ${question}`}];
    if (photo) parts.push({inlineData:{mimeType:"image/jpeg", data: photo}});

    // Retry 3x for 503 busy
    for (let attempt=0; attempt<3; attempt++) {
      for (let m of ["gemini-1.5-flash","gemini-1.5-flash-8b"]) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${KEY}`;
          const r = await fetch(url,{
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({contents:[{parts}],generationConfig:{temperature:0.2,maxOutputTokens:5000}})
          });
          if (r.status===503) { await new Promise(x=>setTimeout(x,1500)); continue; }
          const txt = await r.text();
          let j; try{ j=JSON.parse(txt); }catch{ j={}; }
          let ans = j.candidates?.[0]?.content?.parts?.[0]?.text;
          if (ans) return res.status(200).json({answer: ans});
        } catch(e){ continue; }
      }
    }

    return res.status(200).json({answer: "⏳ **SomaHub busy - Google full, wait 30 sec then tap Mark again**\n\nGoogle Gemini high demand. Pole Mwalimu 🙏 - Try smaller photo, crop paper only."});

  } catch(e){
    return res.status(200).json({answer: "Error: "+e.message});
  }
}
