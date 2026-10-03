// ============================================================
// SomaHub Kenya - Auto-Detect Model + Human-like Greetings
// Models: 3.8-flash is current flagship (Sep 2026)
// ============================================================

const MODELS = {
  greeting: "soma-greeting", // No AI call
  light: process.env.GEMINI_MODEL_LITE || "gemini-3.5-flash-lite", // Fast + cheap
  flash: process.env.GEMINI_MODEL || "gemini-3.8-flash", // Main - your model
  smart: process.env.GEMINI_MODEL_SMART || "gemini-3.1-pro-preview", // Hard math/exam
  fallback: process.env.OPENAI_MODEL || "gpt-5-mini"
};

function sendJSON(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.json(data);
}
function cleanText(v, max=12000){ if(v==null) return ""; return String(v).slice(0,max); }

// ========== HUMAN-LIKE INTENT DETECTOR ==========
function detectIntent(q){
  const t = q.trim().toLowerCase();
  if(/^(hello|hi|hey|habari|mambo|niaje|sasa|good morning|good afternoon|good evening|hallo)\b/.test(t) && t.length<30) return "greeting";
  if(/^(thanks|thank you|asante|asanteni|shukrani)\b/.test(t) && t.length<30) return "thanks";
  if(/^(bye|goodbye|kwaheri|later|see you)\b/.test(t) && t.length<20) return "bye";
  if(/^(how are you|how are u|uko aje|hu jambo|mambo vipi|unajina gani|who are you|what is your name)/i.test(t)) return "smalltalk";
  if(/^(help|nisaidie|what can you do)/i.test(t) && t.length<30) return "help";
  if(t.length<4) return "greeting";
  // Complex tasks -> smart model
  if(/(set exam|create exam|mark this|total marks|solve.*exam|kcpe|kcse)/i.test(q)) return "smart";
  if(q.length>800 || /(explain deeply|step by step working|proof|derive)/i.test(q)) return "smart";
  if(/(photo|image|picture|picha)/i.test(q)) return "flash"; // vision needs flash
  return "normal";
}

function buildPrompt(data){
  const {question="", originalQuestion="", grade="", role="", task="", mode="", subject="", topic="", strand="", knowledge=[], history=[]} = data;
  let p = `You are SomaHub AI Teacher, friendly Kenyan tutor for ${cleanText(grade||"Grade 7")}. Be human, warm, concise for phone. Match grade level.\n\nUSER QUESTION: ${cleanText(question,12000)}\n`;
  if(originalQuestion) p+=`\nORIGINAL: ${cleanText(originalQuestion,6000)}`;
  if(Array.isArray(knowledge) && knowledge.length>0){ p+=`\n\nSOMAHUB RESOURCES:\n`; knowledge.slice(0,12).forEach((it,i)=>{ if(it) p+=`\n--- ${it.path||i+1} ---\n${cleanText(it.content||"",7000)}\n`; }); }
  if(Array.isArray(history)&&history.length>0){ p+=`\n\nRECENT CHAT:\n`; history.slice(-8).forEach(m=>{ p+=`${m.role||"user"}: ${cleanText(m.content||"",3000)}\n`; }); }
  p+=`\n\nRULES: Answer directly, clear explanation, show working for math, match ${cleanText(grade,50)}. If question is simple greeting/smalltalk, just be friendly human, don't force educational format.`;
  return p;
}

async function callGemini({prompt, photo, mimeType, modelId}){
  const apiKey=process.env.GEMINI_API_KEY; if(!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const parts=[{text:String(prompt||"")}];
  if(photo){
    const b64=String(photo).replace(/^data:[^;]+;base64,[STRIPPED],"").trim();
    if(!b64) throw new Error("Image no data"); if(b64.length>4500000) throw new Error("Image too large");
    parts.push({inlineData:{mimeType:String(mimeType||"image/jpeg").toLowerCase(), data:b64}});
  }
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{temperature:0.4,maxOutputTokens:5000}})});
  const raw=await r.text(); let d; try{d=JSON.parse(raw);}catch{throw new Error(`Gemini ${r.status} non-JSON`);}
  if(!r.ok){ const e=new Error(d?.error?.message||`Gemini ${r.status}`); e.status=r.status; throw e; }
  const ans=d?.candidates?.[0]?.content?.parts?.map(p=>p?.text||"").join("").trim();
  if(!ans) throw new Error("Gemini empty answer");
  return {answer:ans, provider:"Gemini", model:modelId};
}
async function callOpenAI({prompt, photo, mimeType, modelId}){
  const apiKey=process.env.OPENAI_API_KEY; if(!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const content=[{type:"input_text",text:String(prompt||"")}];
  if(photo){ const b64=String(photo).replace(/^data:[^;]+;base64,[STRIPPED],"").trim(); content.push({type:"input_image",image_url:`data:${String(mimeType||"image/jpeg").toLowerCase()};base64,${b64}`,detail:"auto"}); }
  const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:modelId,input:[{role:"user",content}],max_output_tokens:5000})});
  const raw=await r.text(); let d; try{d=JSON.parse(raw);}catch{throw new Error(`OpenAI ${r.status} non-JSON`);}
  if(!r.ok){ const e=new Error(d?.error?.message||`OpenAI ${r.status}`); e.status=r.status; throw e; }
  let ans=d?.output_text; if(!ans && Array.isArray(d?.output)) ans=d.output.flatMap(i=>Array.isArray(i?.content)?i.content:[]).map(p=>p?.text||"").join("\n").trim();
  if(!ans) throw new Error("OpenAI empty");
  return {answer:ans, provider:"OpenAI", model:modelId};
}
function publicError(e, provider){
  const m=String(e?.message||""); 
  if(/quota|429/i.test(m)) return `${provider} limit reached, trying fallback...`;
  if(/model.*not found/i.test(m)) return `${provider} model not found, trying fallback...`;
  return m.slice(0,800);
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method==="GET") return sendJSON(res,200,{ok:true,service:"SomaHub AI Teacher",models:MODELS,gemini:!!process.env.GEMINI_API_KEY,openai:!!process.env.OPENAI_API_KEY});

  if(req.method!=="POST") return sendJSON(res,405,{ok:false,error:"Method not allowed"});
  try{
    let body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{}; if(!body||typeof body!=="object") body={};
    const question=cleanText(body.question,12000);
    if(!question) return sendJSON(res,400,{ok:false,error:"Please enter a question"});

    const intent = detectIntent(question);
    const lang = /[a-z]*habari|mambo|asante|kiswahili|shule/i.test(question) ? "SW" : "EN";

    // 1. HUMAN-LIKE RESPONSES - No AI needed
    if(intent==="greeting"){
      return sendJSON(res,200,{ok:true,answer: lang==="SW"?`Habari! 👋 Karibu SomaHub Tutor!\n\nMimi niko tayari kukusaidia na masomo ya ${cleanText(body.grade||"Grade 7")}. Uliza chochote - hisabati, sayansi, Kiswahili...\n\nNikoje kukusaidia leo?`:`Hello! 👋 Welcome to SomaHub Tutor!\n\nI'm ready to help with ${cleanText(body.grade||"Grade 7")} work. Ask anything - math, science, English, homework...\n\nHow can I help you today?`,provider:"SomaHub",model:MODELS.greeting,hasImage:Boolean(body.photo)});
    }
    if(intent==="thanks"){
      return sendJSON(res,200,{ok:true,answer: lang==="SW"?"Karibu sana! 😊 Uliza tena ukihitaji msaada.":"You're most welcome! 😊 Ask again anytime you need help.",provider:"SomaHub",model:MODELS.greeting});
    }
    if(intent==="bye"){
      return sendJSON(res,200,{ok:true,answer: lang==="SW"?"Kwaheri! Soma vizuri! 👋":"Goodbye! Keep learning! 👋",provider:"SomaHub",model:MODELS.greeting});
    }
    if(intent==="smalltalk"){
      return sendJSON(res,200,{ok:true,answer:`I'm SomaHub Tutor, your Kenyan learning friend! 🎓 I help with homework, explain topics, mark work, and set exams for ${cleanText(body.grade||"learners")}. What would you like to learn?`,provider:"SomaHub",model:MODELS.greeting});
    }
    if(intent==="help"){
      return sendJSON(res,200,{ok:true,answer:`I can help you with:\n\n1. Explain any topic (Math, Science, English, Kiswahili, etc.)\n2. Solve questions with working\n3. Mark your work\n4. Create homework / exams\n5. Check photos of work\n\nJust type your question or upload a photo! For ${cleanText(body.grade||"Grade 7")}.`,provider:"SomaHub",model:MODELS.greeting});
    }

    // 2. AUTO-DETECT MODEL based on intent
    let chosenModel = MODELS.flash; // default your 3.8-flash
    if(intent==="smart") chosenModel = MODELS.smart;
    if(intent==="normal" && question.length<100) chosenModel = MODELS.light; // short Q -> faster lite

    const payload={...body,question};
    const prompt=buildPrompt(payload);
    const errors=[];

    // Try chosen model first
    try{
      const r=await callGemini({prompt, photo:body.photo, mimeType:body.mimeType, modelId:chosenModel});
      return sendJSON(res,200,{ok:true,...r,hasImage:Boolean(body.photo),intent});
    }catch(e){ errors.push({model:chosenModel, error:e.message}); }

    // Fallback to main 3.8-flash if lite failed
    if(chosenModel!==MODELS.flash){
      try{
        const r=await callGemini({prompt, photo:body.photo, mimeType:body.mimeType, modelId:MODELS.flash});
        return sendJSON(res,200,{ok:true,...r,hasImage:Boolean(body.photo),intent, fallbackFrom:chosenModel});
      }catch(e){ errors.push({model:MODELS.flash, error:e.message}); }
    }

    // Final fallback to OpenAI
    try{
      const r=await callOpenAI({prompt, photo:body.photo, mimeType:body.mimeType, modelId:MODELS.fallback});
      return sendJSON(res,200,{ok:true,...r,hasImage:Boolean(body.photo),intent, fallbackFrom:chosenModel});
    }catch(e){ errors.push({model:MODELS.fallback, error:e.message}); }

    return sendJSON(res,503,{ok:false,error:`All models busy. ${publicError(errors[0],"AI")}. Try again.`,providers:errors});

  }catch(e){
    return sendJSON(res,500,{ok:false,error:e.message});
  }
}
