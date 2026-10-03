// ============================================================
// SomaHub Kenya AI Teacher - RESTORED + Greeting Fix
// API endpoint: /api/gemini
// Models kept exactly as yours: gemini-3.8-flash / gpt-5-mini
// ============================================================

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

function sendJSON(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.json(data);
}

function cleanText(value, max = 12000) {
  if (value === undefined || value === null) return "";
  return String(value).slice(0, max);
}

function buildPrompt(data) {
  const { question="", originalQuestion="", grade="", role="", task="", mode="", subject="", topic="", strand="", spread="", wideSpread="", questionCount="", totalMarks="", shke="", knowledge=[], sources=[], history=[] } = data;
  let prompt = `
You are SomaHub AI Teacher, an educational assistant for Kenyan learners and teachers.
Your purpose is to provide accurate, age-appropriate, curriculum-aware and easy-to-understand educational help.

IMPORTANT RULES:
- Answer the user's educational request directly.
- Explain concepts clearly.
- Use Kenyan school terminology where appropriate.
- Match the selected grade level.
- Do not invent information from SomaHub resources.
- If SomaHub resources do not contain the answer, use your general academic knowledge.
- Be helpful and concise enough to read comfortably on a phone.

LEARNER / TEACHER DETAILS
Grade: ${cleanText(grade, 100)}
Role: ${cleanText(role, 100)}
Task: ${cleanText(task, 150)}
Mode: ${cleanText(mode, 150)}
Subject: ${cleanText(subject, 150)}
Topic: ${cleanText(topic, 200)}
Topic / Strand: ${cleanText(strand, 200)}
Spread: ${cleanText(spread, 100)}
Wide Spread: ${cleanText(wideSpread, 100)}
Number of questions: ${cleanText(questionCount, 20)}
Total marks: ${cleanText(totalMarks, 20)}
USER QUESTION: ${cleanText(question, 12000)}
`;
  if (originalQuestion) prompt += `\nORIGINAL USER QUESTION:\n${cleanText(originalQuestion, 6000)}\n`;
  if (shke) prompt += `\nADDITIONAL CURRICULUM CONTEXT:\n${cleanText(shke, 6000)}\n`;
  if (Array.isArray(knowledge) && knowledge.length>0){
    prompt += `\n\nSOMAHUB RESOURCE MATERIAL\n`;
    knowledge.slice(0,12).forEach((item,index)=>{
      if(!item) return;
      const path=item.path||`Resource ${index+1}`;
      const content=cleanText(item.content||"",7000);
      prompt += `\n--- RESOURCE ${index+1}: ${path} ---\n${content}\n--- END RESOURCE ---\n`;
    });
  }
  if (Array.isArray(sources) && sources.length>0){
    prompt += `\n\nRESOURCE FILES CONSIDERED:\n${sources.slice(0,20).map(s=>cleanText(s,500)).join("\n")}\n`;
  }
  if (Array.isArray(history) && history.length>0){
    prompt += `\n\nRECENT CONVERSATION:\n`;
    history.slice(-8).forEach((message)=>{
      if(!message) return;
      prompt += `${message.role||"user"}: ${cleanText(message.content||"",3000)}\n`;
    });
  }
  prompt += `\n\nRESPONSE RULES
FOR EXPLAIN / SOLVE: 1. Topic / Strand 2. Explanation 3. Working where needed 4. Answer 5. Key point
FOR MARK WORK: Mark each, show marks, corrections, total, teacher comment.
FOR SET HOMEWORK/EXAM: Create clear instructions matching grade/subject/topic.
Always prioritize accuracy, clarity and usefulness.
`;
  return prompt;
}

async function callGemini({prompt, photo, mimeType}){
  const apiKey=process.env.GEMINI_API_KEY;
  if(!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const parts=[{text:String(prompt||"")}];
  if(photo){
    const allowed=["image/jpeg","image/jpg","image/png","image/webp","image/heic","image/heif"];
    const type=String(mimeType||"image/jpeg").toLowerCase();
    if(!allowed.includes(type)) throw new Error("Unsupported image type.");
    const base64=String(photo).replace(/^data:[^;]+;base64,[STRIPPED],"").trim();
    if(!base64) throw new Error("The uploaded image contains no data.");
    if(base64.length>4500000) throw new Error("The uploaded image is too large.");
    parts.push({inlineData:{mimeType:type, data:base64}});
  }
  const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{temperature:0.35,maxOutputTokens:5000}})});
  const raw=await response.text(); let data; try{data=JSON.parse(raw);}catch{throw new Error(`Gemini returned a non-JSON response (${response.status}).`);}
  if(!response.ok){ const message=data?.error?.message||`Gemini request failed with status ${response.status}.`; const error=new Error(message); error.status=response.status; error.provider="Gemini"; throw error; }
  const answer=data?.candidates?.[0]?.content?.parts?.map(p=>p?.text||"").join("").trim();
  if(!answer) throw new Error("Gemini returned an empty answer.");
  return {answer, provider:"Gemini", model:GEMINI_MODEL};
}

async function callOpenAI({prompt, photo, mimeType}){
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const content=[{type:"input_text",text:String(prompt||"")}];
  if(photo){
    const type=String(mimeType||"image/jpeg").toLowerCase();
    const allowed=["image/jpeg","image/jpg","image/png","image/webp"];
    if(!allowed.includes(type)) throw new Error("OpenAI does not support this image type in this request.");
    const cleanBase64=String(photo).replace(/^data:[^;]+;base64,[STRIPPED],"").trim();
    if(!cleanBase64) throw new Error("The uploaded image contains no data.");
    if(cleanBase64.length>4500000) throw new Error("The uploaded image is too large.");
    content.push({type:"input_image",image_url:`data:${type};base64,${cleanBase64}`,detail:"auto"});
  }
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},body:JSON.stringify({model:OPENAI_MODEL,input:[{role:"user",content}],max_output_tokens:5000})});
  const raw=await response.text(); let data; try{data=JSON.parse(raw);}catch{throw new Error(`OpenAI returned a non-JSON response (${response.status}).`);}
  if(!response.ok){ const message=data?.error?.message||`OpenAI request failed with status ${response.status}.`; const error=new Error(message); error.status=response.status; error.provider="OpenAI"; throw error; }
  let answer=data?.output_text;
  if(!answer && Array.isArray(data?.output)){ answer=data.output.flatMap(item=>Array.isArray(item?.content)?item.content:[]).map(part=>part?.text||"").filter(Boolean).join("\n").trim(); }
  if(!answer) throw new Error("OpenAI returned an empty answer.");
  return {answer, provider:"OpenAI", model:OPENAI_MODEL};
}

function publicError(error, provider){
  const message=String(error?.message||"Unknown error.");
  if(/quota|rate limit|too many requests|resource exhausted|429/i.test(message)) return `${provider} is temporarily unavailable because its usage limit has been reached.`;
  if(/api key|authentication|unauthorized|permission|forbidden|invalid.*key/i.test(message)) return `${provider} is not configured correctly. Check the API key in Vercel Environment Variables.`;
  if(/model.*not found|does not exist|not found/i.test(message)) return `${provider} model is unavailable. Check that the selected API model is available to your account.`;
  return message.slice(0,1000);
}

export default async function handler(req, res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method==="GET"){
    return sendJSON(res,200,{ok:true,service:"SomaHub AI Teacher",endpoint:"/api/gemini",geminiConfigured:Boolean(process.env.GEMINI_API_KEY),openaiConfigured:Boolean(process.env.OPENAI_API_KEY),geminiModel:GEMINI_MODEL,openaiModel:OPENAI_MODEL,primaryProvider:"Gemini",fallbackProvider:"OpenAI"});
  }
  if(req.method!=="POST") return sendJSON(res,405,{ok:false,error:"Method not allowed."});

  try{
    let body=typeof req.body==="string"?JSON.parse(req.body||"{}"):req.body||{};
    if(!body||typeof body!=="object") body={};
    const question=cleanText(body.question,12000);
    if(!question) return sendJSON(res,400,{ok:false,error:"Please enter a question or task."});

    // === FIX FOR HELLO - Human-like greeting without calling AI ===
    if(/^(hello|hi|hey|habari|mambo|sasa|niaje|good morning|good afternoon)\b/i.test(question.trim()) && question.trim().length<30){
      return sendJSON(res,200,{ok:true,answer:`Hello! 👋 Karibu SomaHub Tutor!\n\nI'm ready to help with ${cleanText(body.grade||"Grade 7")} work. You can ask about photosynthesis, matter, math, or upload a photo of your work.\n\nHow can I help you today?`,provider:"SomaHub",model:"greeting",hasImage:Boolean(body.photo)});
    }

    const payload={...body,question};
    const prompt=buildPrompt(payload);
    const provider=String(body.provider||"auto").toLowerCase();
    const errors=[];

    if(provider==="gemini"){
      try{ const result=await callGemini({prompt,photo:body.photo,mimeType:body.mimeType}); return sendJSON(res,200,{ok:true,...result,hasImage:Boolean(body.photo)}); }
      catch(error){ console.error("Gemini error:",error); return sendJSON(res,503,{ok:false,error:publicError(error,"Gemini"),provider:"Gemini"}); }
    }
    if(provider==="openai"){
      try{ const result=await callOpenAI({prompt,photo:body.photo,mimeType:body.mimeType}); return sendJSON(res,200,{ok:true,...result,hasImage:Boolean(body.photo)}); }
      catch(error){ console.error("OpenAI error:",error); return sendJSON(res,503,{ok:false,error:publicError(error,"OpenAI"),provider:"OpenAI"}); }
    }

    // AUTO - Try Gemini first, then OpenAI (this was missing and caused crash)
    try{
      const result=await callGemini({prompt,photo:body.photo,mimeType:body.mimeType});
      return sendJSON(res,200,{ok:true,...result,hasImage:Boolean(body.photo)});
    }catch(error){ console.error("Gemini error:",error); errors.push({provider:"Gemini", error:error.message}); }

    try{
      const result=await callOpenAI({prompt,photo:body.photo,mimeType:body.mimeType});
      return sendJSON(res,200,{ok:true,...result,hasImage:Boolean(body.photo),fallbackFrom:"Gemini"});
    }catch(error){ console.error("OpenAI error:",error); errors.push({provider:"OpenAI", error:error.message}); return sendJSON(res,503,{ok:false,error:publicError(error, error.provider||"OpenAI"),provider:error.provider||"OpenAI",errors}); }

  }catch(error){
    console.error("Handler error:",error);
    return sendJSON(res,500,{ok:false,error:error?.message||"Internal server error."});
  }
}
