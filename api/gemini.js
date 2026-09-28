export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { question, grade, shke, brainContext, photo } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Add GEMINI_API_KEY in Vercel Settings → Environment Variables" });

    const LEVEL_RULES = {
      "PP1": {max:1, tag:"PP1 CBC Kenya kids learning safe"},
      "PP2": {max:2, tag:"PP2 CBC Kenya kids"},
      "Grade 1": {max:1, tag:"Grade 1 CBC Kenya KICD"},
      "Grade 2": {max:2, tag:"Grade 2 CBC Kenya"},
      "Grade 3": {max:3, tag:"Grade 3 CBC Kenya"},
      "Grade 4": {max:4, tag:"Grade 4 CBC Kenya KICD"},
      "Grade 5": {max:5, tag:"Grade 5 CBC Kenya KICD"},
      "Grade 6": {max:6, tag:"Grade 6 CBC Kenya KICD"},
      "Grade 7": {max:7, tag:"Grade 7 CBC Kenya Junior School"},
      "Grade 8": {max:8, tag:"Grade 8 CBC Kenya"},
      "Grade 9": {max:9, tag:"Grade 9 CBC Kenya"},
    };
    const rule = LEVEL_RULES[grade] || {max:6, tag:`${grade} CBC Kenya KICD safe`};

    const systemPrompt = `You are SomaHub AI - Connected to ALL FILES + Gemini.
Student SHKE ${shke}, Grade ${grade}
LEVEL LOCK CRITICAL: Only ${grade} max Grade ${rule.max}. Do NOT give Grade ${rule.max+1}+. If asked beyond, say "That's Grade ${rule.max+1}+, you're ${grade}, master ${grade} first."
YouTube filtered tag = ${rule.tag} safeSearch strict
Parents Guide: log SHKE ${shke}

ALL FILES WHERE INFO IS (Admin feeds once in admin.html):
${brainContext}

Tasks: Summarize Notes ${grade} only, Homework 10 marks FROM ${grade} 4 Qs 2+2+3+3, Exam 100 marks Sec A 20 B 30 C 50, cite "From notes.html: [title]" or "ai_brain: [title]".
User: ${question}`;

    let parts = [{text: systemPrompt}];
    if (photo) parts.push({inline_data:{mime_type:"image/jpeg", data: photo}});

    const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({contents:[{parts}]})
    });
    const data = await gemRes.json();
    if (data.error) throw new Error(data.error.message);
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || "No reply";
    const youtubeFiltered = `https://www.youtube.com/results?search_query=${encodeURIComponent(question+" "+rule.tag+" KICD safe educational")}&sp=EgIQAQ%3D%3D`;

    res.json({ answer, youtubeFiltered, level: grade, tag: rule.tag });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
