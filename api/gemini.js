// ============================================================
// SomaHub Kenya - AI Teacher API - FIXED AUTO-SELECT
// api/gemini.js
// ============================================================

const GEMINI_MODELS_TRY_ORDER = [
  process.env.GEMINI_MODEL_LITE,
  process.env.GEMINI_MODEL,
  process.env.GEMINI_MODEL_SMART,
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
].filter(Boolean);

const OPENAI_MODELS_TRY_ORDER = [
  process.env.OPENAI_MODEL,
  "gpt-4o-mini",
  "gpt-4o",
].filter(Boolean);

const MODELS = {
  greeting: "soma-greeting",
  light: GEMINI_MODELS_TRY_ORDER[0],
  flash: GEMINI_MODELS_TRY_ORDER[1] || GEMINI_MODELS_TRY_ORDER[0],
  smart: GEMINI_MODELS_TRY_ORDER[GEMINI_MODELS_TRY_ORDER.length - 1],
  fallback: OPENAI_MODELS_TRY_ORDER[0],
};

// HELPERS
function sendJSON(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.json(data);
}
function cleanText(value, max = 12000) {
  if (value == null) return "";
  return String(value).replace(/\u0000/g, "").slice(0, max);
}
function isQuotaError(error) {
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || 0);
  return status === 429 || /quota|rate.?limit|resource.?exhausted|too many requests|usage limit|credits remaining|billing/.test(message);
}
function isModelError(error) {
  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || 0);
  return status === 400 || status === 404 || /model.*not found|not supported|invalid.*model/.test(message);
}
function publicProviderError(error) {
  const message = String(error?.message || "Unknown error");
  if (isQuotaError(error)) return "usage limit or quota reached";
  if (isModelError(error)) return "model unavailable";
  return message.slice(0, 500);
}

// LANGUAGE
const SW_WORDS = ["habari","mambo","nisaidie","hesabu","hisabati","sayansi","kiswahili","shule","mwalimu","asante","eleza","soma","darasa","mtihani","swali","masomo","tafadhali","nini","vipi","kwa nini","naomba","nomino","sentensi","methali","kiwakilishi","kitenzi"];
function detectLang(text) {
  if (!text) return "EN";
  const value = String(text).toLowerCase();
  const matches = SW_WORDS.filter(word => value.includes(word)).length;
  return matches > 0 ? "SW" : "EN";
}

// INTENT
function detectIntent(question) {
  const q = String(question || "").trim();
  const t = q.toLowerCase();
  if (/^(hello|hi|hey|habari|mambo|niaje|sasa|good morning|good afternoon|good evening|hallo)\b/.test(t) && t.length < 40) return "greeting";
  if (/^(thanks|thank you|asante|asanteni|shukrani)\b/.test(t) && t.length < 40) return "thanks";
  if (/^(bye|goodbye|kwaheri|later|see you)\b/.test(t) && t.length < 30) return "bye";
  if (/^(how are you|how are u|uko aje|hujambo|hu jambo|mambo vipi|who are you|what is your name|unajina gani)/.test(t)) return "smalltalk";
  if (/^(help|nisaidie|what can you do|unaweza kufanya nini)/.test(t) && t.length < 50) return "help";
  if (/(create homework|make homework|generate homework|give me homework|set homework|my homework|homework questions|generate questions)/i.test(t)) return "homework";
  if (/(set exam|create exam|make an exam|generate exam|create paper|make paper|assessment paper|weekly exam|revision paper)/i.test(t)) return "exam";
  if (/(mark this|mark my work|marking scheme|marking guide|total marks|grade my work)/i.test(t)) return "smart";
  if (/(solve.*exam|kcpe|kcse|kbsea|assessment|paper 1|paper 2)/i.test(t)) return "smart";
  if (q.length > 800 || /(explain deeply|step by step working|proof|derive|detailed explanation|show all working)/i.test(t)) return "smart";
  if (/(photo|image|picture|picha|attached|attachment)/i.test(t)) return "flash";
  return "normal";
}

function buildQuestionPrompt(data, type = "homework") {
  const { grade = "Grade 7", role = "Student", subject = "General", topic = "", strand = "", questionCount = type === "exam" ? 20 : 5, marks = type === "exam" ? 40 : 10, language = "EN", knowledge = [], history = [] } = data;
  let prompt = `You are SomaHub AI Teacher. Create ORIGINAL Kenyan curriculum learning questions. Twist and own the knowledge. Grade: ${cleanText(grade,50)} Role: ${cleanText(role,50)} Subject: ${cleanText(subject,100)} Topic: ${cleanText(topic,150)} Strand: ${cleanText(strand,150)} Language: ${cleanText(language,20)} NUMBER: ${Number(questionCount)||5} TOTAL MARKS: ${Number(marks)||10} IMPORTANT: Match grade/subject, Kenyan context, fresh examples, marks for every question, return ONLY valid JSON.`;
  if (type === "exam") prompt += ` THIS IS WEEKLY EXAM. Mix MCQ, short answer, structured.`;
  else prompt += ` THIS IS DAILY HOMEWORK. Learner-friendly.`;
  if (Array.isArray(knowledge) && knowledge.length > 0) {
    prompt += `\n\nSOMAHUB RESOURCES:\n`;
    knowledge.slice(0,15).forEach((item,i)=>{ const c=cleanText(item.content||item.somahubContent||"",7000); if(c) prompt+=`\n--- ${cleanText(item.path||item.name||`Res ${i+1}`,200)} ---\n${c}\n`; });
  }
  prompt += `\nRETURN JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"answer":"...","acceptedAnswers":["..."],"marks":2,"type":"mcq","strand":"...","explanation":"..."}]} Rules: MCQ=4 options, answer in options, no markdown.`;
  return prompt;
}
function buildPrompt(data) {
  const { question = "", originalQuestion = "", grade = "", role = "", subject = "", topic = "", strand = "", knowledge = [], history = [] } = data;
  let prompt = `You are SomaHub AI Teacher, friendly Kenyan tutor. Grade: ${cleanText(grade||"Grade 7",50)} Role: ${cleanText(role||"Student",50)} Subject: ${cleanText(subject||"General",100)} Topic: ${cleanText(topic||"",150)} Strand: ${cleanText(strand||"",150)} USER QUESTION: ${cleanText(question,12000)}`;
  if (originalQuestion) prompt += `\nORIGINAL: ${cleanText(originalQuestion,6000)}`;
  if (Array.isArray(knowledge) && knowledge.length > 0) {
    prompt += `\n\nSOMAHUB RESOURCES:`; knowledge.slice(0,12).forEach((item,i)=>{ const c=cleanText(item.content||item.somahubContent||"",7000); if(c) prompt+=`\n--- ${cleanText(item.path||item.name||`Res ${i+1}`,200)} ---\n${c}\n`; });
  }
  if (Array.isArray(history) && history.length > 0) {
    prompt += `\n\nRECENT CONVERSATION:\n`; history.slice(-8).forEach(m=>{ if(m) prompt+=`${cleanText(m.role||"user",30)}: ${cleanText(m.content||"",3000)}\n`; });
  }
  prompt += `\nTEACHING RULES: Direct answer, grade level, simple language, show working for math, if SW respond in SW, phone readable.`;
  return prompt;
}
function cleanBase64Photo(photo) {
  if (!photo) return ""; let v=String(photo).trim(); v=v.replace(/^data:[^;]+;base64,/,""); return v.trim();
}

async function callGemini({ prompt, photo, mimeType, modelId }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { const e=new Error("GEMINI_API_KEY not configured"); e.provider="Gemini"; throw e; }
  const parts=[{text:String(prompt||"")}];
  if (photo) {
    const base64=cleanBase64Photo(photo);
    if (!base64) { const e=new Error("Image contains no usable data"); e.provider="Gemini"; throw e; }
    if (base64.length > 4500000) { const e=new Error("Image too large"); e.provider="Gemini"; throw e; }
    parts.push({ inlineData:{ mimeType:String(mimeType||"image/jpeg").toLowerCase(), data: base64 }});
  }
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
  const response=await fetch(url,{ method:"POST", headers:{ "Content-Type":"application/json", "x-goog-api-key": apiKey }, body:JSON.stringify({ contents:[{ role:"user", parts }], generationConfig:{ maxOutputTokens:5000 } }) });
  const raw=await response.text(); let data; try{ data=JSON.parse(raw); }catch{ const e=new Error(`Gemini ${response.status}: non-JSON`); e.status=response.status; e.provider="Gemini"; throw e; }
  if (!response.ok) { const e=new Error(data?.error?.message||`Gemini failed ${response.status}`); e.status=response.status; e.provider="Gemini"; throw e; }
  const answer=data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||"").join("").trim();
  if (!answer) { const e=new Error("Gemini empty answer"); e.provider="Gemini"; throw e; }
  return { answer, provider:"Gemini", model:modelId };
}
async function callOpenAI({ prompt, photo, mimeType, modelId }) {
  const apiKey=process.env.OPENAI_API_KEY; if(!apiKey){ const e=new Error("OPENAI_API_KEY not configured"); e.provider="OpenAI"; throw e; }
  const content=[{ type:"input_text", text:String(prompt||"") }];
  if (photo) {
    const base64=cleanBase64Photo(photo); if(!base64){ const e=new Error("Image no data"); e.provider="OpenAI"; throw e; }
    content.push({ type:"input_image", image_url:`data:${String(mimeType||"image/jpeg").toLowerCase()};base64,${base64}` });
  }
  const response=await fetch("https://api.openai.com/v1/responses",{ method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${apiKey}` }, body:JSON.stringify({ model:modelId, input:[{ role:"user", content }], max_output_tokens:5000 }) });
  const raw=await response.text(); let data; try{ data=JSON.parse(raw); }catch{ const e=new Error(`OpenAI ${response.status}: non-JSON`); e.status=response.status; e.provider="OpenAI"; throw e; }
  if (!response.ok) { const e=new Error(data?.error?.message||`OpenAI failed ${response.status}`); e.status=response.status; e.provider="OpenAI"; throw e; }
  let answer=data?.output_text; if(!answer && Array.isArray(data?.output)){ answer=data.output.flatMap(i=>Array.isArray(i?.content)?i.content:[]).map(p=>p?.text||"").join("\n").trim(); }
  if(!answer){ const e=new Error("OpenAI empty"); e.provider="OpenAI"; throw e; }
  return { answer, provider:"OpenAI", model:modelId };
}
function extractJSON(text){ if(!text) return null; let v=String(text).trim(); v=v.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim(); try{ return JSON.parse(v); }catch{} const f=v.indexOf("{"); const l=v.lastIndexOf("}"); if(f>=0 && l>f){ try{ return JSON.parse(v.slice(f,l+1)); }catch{} } return null; }

// AUTO ROTATION
async function callGeminiWithAutoFallback({ prompt, photo, mimeType, preferredModel }) {
  const tried=new Set(); const modelsToTry=[preferredModel, ...GEMINI_MODELS_TRY_ORDER].filter(m=>{ if(!m||tried.has(m)) return false; tried.add(m); return true; });
  let lastError;
  for (const modelId of modelsToTry) {
    try { return await callGemini({ prompt, photo, mimeType, modelId }); }
    catch (e) { lastError=e; console.warn(`Gemini ${modelId} failed: ${e.message}`); if(isQuotaError(e)) break; if(!isModelError(e) && e.status!==404 && e.status!==400) break; }
  }
  throw lastError;
}

function getGreetingAnswer(lang) {
  if (lang==="SW") return "Habari! Mimi ni Mwalimu wa SomaHub. Niko tayari kukusaidia na masomo yako leo. Una swali gani?";
  return "Hello! I'm SomaHub AI Teacher. Ready to help you learn today. What would you like to learn?";
}

export default async function handler(req, res) {
  if (req.method==="OPTIONS") return sendJSON(res,200,{ok:true});
  if (req.method!=="POST") return sendJSON(res,405,{error:"POST only"});

  try {
    const body=req.body || {};
    const question=cleanText(body.question || body.prompt || "",12000);
    const grade=body.grade||"Grade 7";
    const role=body.role||"Student";
    const subject=body.subject||"General";
    const topic=body.topic||"";
    const strand=body.strand||"";
    const knowledge=Array.isArray(body.knowledge)?body.knowledge:[];
    const history=Array.isArray(body.history)?body.history:[];
    const photo=body.photo||body.image||"";
    const mimeType=body.mimeType||"image/jpeg";
    const language=body.language||detectLang(question);
    const intent=detectIntent(question);

    // Fast path - no AI call
    if (intent==="greeting" || intent==="thanks" || intent==="bye" || intent==="smalltalk" || intent==="help") {
      if (intent==="greeting") return sendJSON(res,200,{ answer:getGreetingAnswer(language), provider:"soma-greeting", model:MODELS.greeting });
      if (intent==="thanks") return sendJSON(res,200,{ answer: language==="SW" ? "Karibu sana! Endelea kuuliza maswali." : "You're welcome! Keep asking, I'm here to help." , provider:"soma-greeting" });
      if (intent==="bye") return sendJSON(res,200,{ answer: language==="SW" ? "Kwaheri! Kusoma kwingi!" : "Goodbye! Happy learning!" , provider:"soma-greeting" });
      if (intent==="help") return sendJSON(res,200,{ answer: language==="SW" ? "Naweza kukusaidia na homework, mitihani, maelezo ya masomo, na kupiga picha ya swali. Uliza tu!" : "I can help with homework, create exams, explain topics, and read photos of questions. Just ask!" , provider:"soma-greeting" });
    }

    const isQuestionGen = intent==="homework" || intent==="exam";
    const finalPrompt = isQuestionGen ? buildQuestionPrompt({ grade, role, subject, topic, strand, questionCount: body.questionCount, marks: body.marks, language, knowledge, history }, intent) : buildPrompt({ question, originalQuestion: body.originalQuestion, grade, role, subject, topic, strand, knowledge, history });

    let preferredModel = MODELS.flash;
    if (intent==="smart") preferredModel = MODELS.smart;
    if (intent==="light" || question.length < 100) preferredModel = MODELS.light;

    let result;
    try {
      result = await callGeminiWithAutoFallback({ prompt: finalPrompt, photo, mimeType, preferredModel });
    } catch (geminiError) {
      console.error("All Gemini failed:", publicProviderError(geminiError));
      // Try OpenAI as final fallback
      for (const om of OPENAI_MODELS_TRY_ORDER) {
        try {
          result = await callOpenAI({ prompt: finalPrompt, photo, mimeType, modelId: om });
          break;
        } catch (e) { console.warn(`OpenAI ${om} failed: ${e.message}`); }
      }
      if (!result) throw geminiError;
    }

    if (isQuestionGen) {
      const json = extractJSON(result.answer);
      if (json) return sendJSON(res,200,{ ...json, provider: result.provider, model: result.model, rawAnswer: result.answer });
    }

    return sendJSON(res,200,{ answer: result.answer, provider: result.provider, model: result.model });

  } catch (error) {
    console.error("API Error:", error);
    return sendJSON(res,500,{ error: publicProviderError(error), details: error?.message?.slice(0,1000) });
  }
}
