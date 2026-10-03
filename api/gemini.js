// ============================================================
// SomaHub Kenya - AI Teacher API
// api/gemini.js
//
// Features:
// • Human-friendly greetings without AI calls
// • Automatic model selection
// • Gemini primary provider
// • OpenAI fallback
// • Quota-aware routing
// • Photo/image support
// • SomaHub knowledge/context support
// • Conversation history
// • English / Kiswahili support
// ============================================================


const MODELS = {
  // No API call
  greeting: "soma-greeting",

  // Gemini models
  light:
    process.env.GEMINI_MODEL_LITE ||
    "gemini-3.5-flash-lite",

  flash:
    process.env.GEMINI_MODEL ||
    "gemini-3.8-flash",

  smart:
    process.env.GEMINI_MODEL_SMART ||
    "gemini-3.1-pro-preview",

  // OpenAI fallback
  fallback:
    process.env.OPENAI_MODEL ||
    "gpt-5-mini"
};


// ============================================================
// HELPERS
// ============================================================

function sendJSON(res, status, data) {
  res.status(status);

  res.setHeader(
    "Content-Type",
    "application/json; charset=utf-8"
  );

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  return res.json(data);
}


function cleanText(value, max = 12000) {
  if (value == null) return "";

  return String(value)
    .replace(/\u0000/g, "")
    .slice(0, max);
}


function isQuotaError(error) {
  const message =
    String(error?.message || "").toLowerCase();

  const status =
    Number(error?.status || 0);

  return (
    status === 429 ||
    /quota/.test(message) ||
    /rate.?limit/.test(message) ||
    /resource.?exhausted/.test(message) ||
    /too many requests/.test(message) ||
    /usage limit/.test(message) ||
    /credits remaining/.test(message) ||
    /billing/.test(message)
  );
}


function isModelError(error) {
  const message =
    String(error?.message || "").toLowerCase();

  const status =
    Number(error?.status || 0);

  return (
    status === 400 ||
    status === 404 ||
    /model.*not found/.test(message) ||
    /not supported/.test(message) ||
    /invalid.*model/.test(message)
  );
}


function publicProviderError(error) {

  const message =
    String(error?.message || "Unknown error");

  if (isQuotaError(error)) {
    return "usage limit or quota reached";
  }

  if (isModelError(error)) {
    return "model unavailable";
  }

  return message.slice(0, 500);
}


// ============================================================
// LANGUAGE / INTENT
// ============================================================

const SW_WORDS = [
  "habari",
  "mambo",
  "nisaidie",
  "hesabu",
  "hisabati",
  "sayansi",
  "kiswahili",
  "shule",
  "mwalimu",
  "asante",
  "eleza",
  "soma",
  "darasa",
  "mtihani",
  "swali",
  "masomo",
  "tafadhali",
  "nini",
  "vipi",
  "kwa nini",
  "naomba"
];


function detectLang(text) {

  if (!text) return "EN";

  const value =
    String(text).toLowerCase();

  const matches =
    SW_WORDS.filter(word =>
      value.includes(word)
    ).length;

  return matches > 0 ? "SW" : "EN";
}


function detectIntent(question) {

  const q =
    String(question || "").trim();

  const t =
    q.toLowerCase();

  // Greetings
  if (
    /^(hello|hi|hey|habari|mambo|niaje|sasa|good morning|good afternoon|good evening|hallo)\b/
      .test(t) &&
    t.length < 40
  ) {
    return "greeting";
  }


  // Thanks
  if (
    /^(thanks|thank you|asante|asanteni|shukrani)\b/
      .test(t) &&
    t.length < 40
  ) {
    return "thanks";
  }


  // Goodbye
  if (
    /^(bye|goodbye|kwaheri|later|see you)\b/
      .test(t) &&
    t.length < 30
  ) {
    return "bye";
  }


  // Small talk
  if (
    /^(how are you|how are u|uko aje|hujambo|hu jambo|mambo vipi|who are you|what is your name|unajina gani)/
      .test(t)
  ) {
    return "smalltalk";
  }


  // Help
  if (
    /^(help|nisaidie|what can you do|unaweza kufanya nini)/
      .test(t) &&
    t.length < 50
  ) {
    return "help";
  }


  // Exam / complex educational work
  if (
    /(set exam|create exam|make an exam|mark this|mark my work|total marks|solve.*exam|kcpe|kcse|kbsea|assessment|paper 1|paper 2)/
      .test(t)
  ) {
    return "smart";
  }


  // Long or reasoning-heavy questions
  if (
    q.length > 800 ||
    /(explain deeply|step by step working|proof|derive|detailed explanation|show all working)/
      .test(t)
  ) {
    return "smart";
  }


  // Images
  if (
    /(photo|image|picture|picha|attached|attachment)/
      .test(t)
  ) {
    return "flash";
  }


  return "normal";
}


// ============================================================
// HUMAN-FRIENDLY PROMPT
// ============================================================

function buildPrompt(data) {

  const {
    question = "",
    originalQuestion = "",
    grade = "",
    role = "",
    task = "",
    mode = "",
    subject = "",
    topic = "",
    strand = "",
    knowledge = [],
    history = []
  } = data;


  let prompt = `

You are SomaHub AI Teacher, a friendly Kenyan digital tutor.

You help learners understand school work clearly and confidently.

STUDENT DETAILS
Grade: ${cleanText(grade || "Grade 7", 50)}
Role: ${cleanText(role || "Student", 50)}
Language: ${cleanText(task || "EN", 20)}
Subject: ${cleanText(subject || "General", 100)}
Topic: ${cleanText(topic || "", 150)}
Strand: ${cleanText(strand || "", 150)}

USER QUESTION:
${cleanText(question, 12000)}
`;


  if (originalQuestion) {

    prompt += `

ORIGINAL QUESTION:
${cleanText(originalQuestion, 6000)}
`;
  }


  // SomaHub knowledge
  if (
    Array.isArray(knowledge) &&
    knowledge.length > 0
  ) {

    prompt += `

SOMAHUB LEARNING RESOURCES:
`;

    knowledge
      .slice(0, 12)
      .forEach((item, index) => {

        if (!item) return;

        const path =
          cleanText(
            item.path ||
            item.name ||
            `Resource ${index + 1}`,
            200
          );

        const content =
          cleanText(
            item.content || "",
            7000
          );

        if (!content) return;

        prompt += `

--- ${path} ---

${content}
`;
      });
  }


  // Recent conversation
  if (
    Array.isArray(history) &&
    history.length > 0
  ) {

    prompt += `

RECENT CONVERSATION:
`;

    history
      .slice(-8)
      .forEach(message => {

        if (!message) return;

        const roleName =
          message.role || "user";

        const content =
          cleanText(
            message.content || "",
            3000
          );

        if (!content) return;

        prompt +=
          `${roleName}: ${content}\n`;
      });
  }


  prompt += `

TEACHING RULES:

1. Answer the student's actual question directly.
2. Match the learner's grade level.
3. Use simple, natural language.
4. Be friendly and encouraging.
5. For mathematics, show the working clearly.
6. For science, explain concepts with suitable examples.
7. For English or Kiswahili, give correct examples.
8. For exam questions, answer according to the marks and level.
9. Do not unnecessarily repeat the question.
10. Do not claim to have seen a resource that was not supplied.
11. If the student uses Kiswahili, respond naturally in Kiswahili.
12. If the student uses English, respond in English.
13. If the question mixes English and Kiswahili, you may naturally mix them where helpful.
14. Keep answers readable on a phone.
15. For simple questions, avoid unnecessarily long explanations.

You are a learning assistant, not a search engine.
`;


  return prompt;
}


// ============================================================
// IMAGE DATA CLEANING
// ============================================================

function cleanBase64Photo(photo) {

  if (!photo) return "";

  let value =
    String(photo).trim();

  // Correctly remove data URL prefix
  value =
    value.replace(
      /^data:[^;]+;base64,/i,
      ""
    );

  return value.trim();
}


// ============================================================
// GEMINI
// ============================================================

async function callGemini({
  prompt,
  photo,
  mimeType,
  modelId
}) {

  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {

    const error =
      new Error(
        "GEMINI_API_KEY not configured"
      );

    error.provider = "Gemini";

    throw error;
  }


  const parts = [
    {
      text: String(prompt || "")
    }
  ];


  if (photo) {

    const base64 =
      cleanBase64Photo(photo);

    if (!base64) {

      throw new Error(
        "Image contains no usable data"
      );
    }


    // Prevent excessively large uploads
    if (base64.length > 4500000) {

      throw new Error(
        "Image is too large. Please upload a smaller photo."
      );
    }


    parts.push({
      inlineData: {
        mimeType:
          String(
            mimeType ||
            "image/jpeg"
          ).toLowerCase(),

        data: base64
      }
    });
  }


  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;


  /*
   * Gemini 3.x:
   * Keep generationConfig minimal.
   * Do not send unsupported temperature/topP/topK
   * settings to newer Gemini 3 models.
   */

  const requestBody = {
    contents: [
      {
        role: "user",
        parts
      }
    ],

    generationConfig: {
      maxOutputTokens: 5000
    }
  };


  const response =
    await fetch(
      url,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey
        },

        body:
          JSON.stringify(requestBody)
      }
    );


  const raw =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(raw);

  } catch {

    const error =
      new Error(
        `Gemini ${response.status}: non-JSON response`
      );

    error.status =
      response.status;

    error.provider =
      "Gemini";

    throw error;
  }


  if (!response.ok) {

    const error =
      new Error(
        data?.error?.message ||
        `Gemini request failed (${response.status})`
      );

    error.status =
      response.status;

    error.provider =
      "Gemini";

    throw error;
  }


  const answer =
    data?.candidates?.[0]?.content?.parts
      ?.map(part => part?.text || "")
      .join("")
      .trim();


  if (!answer) {

    const error =
      new Error(
        "Gemini returned an empty answer"
      );

    error.provider =
      "Gemini";

    throw error;
  }


  return {
    answer,
    provider: "Gemini",
    model: modelId
  };
}


// ============================================================
// OPENAI
// ============================================================

async function callOpenAI({
  prompt,
  photo,
  mimeType,
  modelId
}) {

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {

    const error =
      new Error(
        "OPENAI_API_KEY not configured"
      );

    error.provider =
      "OpenAI";

    throw error;
  }


  const content = [
    {
      type: "input_text",
      text: String(prompt || "")
    }
  ];


  if (photo) {

    const base64 =
      cleanBase64Photo(photo);

    if (!base64) {

      throw new Error(
        "Image contains no usable data"
      );
    }


    if (base64.length > 4500000) {

      throw new Error(
        "Image is too large. Please upload a smaller photo."
      );
    }


    content.push({
      type: "input_image",

      image_url:
        `data:${String(
          mimeType ||
          "image/jpeg"
        ).toLowerCase()};base64,${base64}`
    });
  }


  const response =
    await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`
        },

        body:
          JSON.stringify({
            model: modelId,

            input: [
              {
                role: "user",
                content
              }
            ],

            max_output_tokens: 5000
          })
      }
    );


  const raw =
    await response.text();


  let data;

  try {

    data =
      JSON.parse(raw);

  } catch {

    const error =
      new Error(
        `OpenAI ${response.status}: non-JSON response`
      );

    error.status =
      response.status;

    error.provider =
      "OpenAI";

    throw error;
  }


  if (!response.ok) {

    const error =
      new Error(
        data?.error?.message ||
        `OpenAI request failed (${response.status})`
      );

    error.status =
      response.status;

    error.provider =
      "OpenAI";

    throw error;
  }


  let answer =
    data?.output_text;


  // Defensive fallback for Responses API output
  if (
    !answer &&
    Array.isArray(data?.output)
  ) {

    answer =
      data.output
        .flatMap(item =>
          Array.isArray(item?.content)
            ? item.content
            : []
        )
        .map(part =>
          part?.text || ""
        )
        .join("\n")
        .trim();
  }


  if (!answer) {

    const error =
      new Error(
        "OpenAI returned an empty answer"
      );

    error.provider =
      "OpenAI";

    throw error;
  }


  return {
    answer,
    provider: "OpenAI",
    model: modelId
  };
}


// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(req, res) {

  // CORS
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );


  // OPTIONS
  if (req.method === "OPTIONS") {

    return res
      .status(204)
      .end();
  }


  // ==========================================================
  // HEALTH CHECK
  // ==========================================================

  if (req.method === "GET") {

    return sendJSON(
      res,
      200,
      {
        ok: true,

        service:
          "SomaHub AI Teacher",

        endpoint:
          "/api/gemini",

        geminiConfigured:
          Boolean(
            process.env.GEMINI_API_KEY
          ),

        openaiConfigured:
          Boolean(
            process.env.OPENAI_API_KEY
          ),

        geminiModel:
          MODELS.flash,

        openaiModel:
          MODELS.fallback,

        primaryProvider:
          "Gemini",

        fallbackProvider:
          "OpenAI",

        models: MODELS
      }
    );
  }


  // ==========================================================
  // ONLY POST
  // ==========================================================

  if (req.method !== "POST") {

    return sendJSON(
      res,
      405,
      {
        ok: false,
        error:
          "Method not allowed"
      }
    );
  }


  try {

    let body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};


    if (
      !body ||
      typeof body !== "object"
    ) {
      body = {};
    }


    const question =
      cleanText(
        body.question,
        12000
      );


    if (!question) {

      return sendJSON(
        res,
        400,
        {
          ok: false,
          error:
            "Please enter a question."
        }
      );
    }


    // ========================================================
    // INTENT
    // ========================================================

    const intent =
      detectIntent(question);


    const language =
      detectLang(question);


    // ========================================================
    // HUMAN RESPONSES
    // These consume ZERO AI quota.
    // ========================================================

    if (intent === "greeting") {

      const grade =
        cleanText(
          body.grade ||
          "Grade 7",
          50
        );


      const answer =
        language === "SW"

          ? `Habari! 👋 Karibu SomaHub Tutor!

Niko tayari kukusaidia na masomo ya ${grade}.

Uliza chochote kuhusu hesabu, sayansi, Kiingereza, Kiswahili, homework au mtihani.

Nikoje kukusaidia leo?`

          : `Hello! 👋 Welcome to SomaHub Tutor!

I'm ready to help you with ${grade} work.

Ask me about mathematics, science, English, homework, exams or any topic you're learning.

How can I help you today?`;


      return sendJSON(
        res,
        200,
        {
          ok: true,
          answer,
          provider: "SomaHub",
          model: MODELS.greeting,
          intent,
          language,
          hasImage:
            Boolean(body.photo)
        }
      );
    }


    if (intent === "thanks") {

      return sendJSON(
        res,
        200,
        {
          ok: true,

          answer:
            language === "SW"

              ? "Karibu sana! 😊 Uliza tena wakati wowote ukihitaji msaada."

              : "You're most welcome! 😊 Ask me anytime you need help.",

          provider:
            "SomaHub",

          model:
            MODELS.greeting,

          intent,
          language
        }
      );
    }


    if (intent === "bye") {

      return sendJSON(
        res,
        200,
        {
          ok: true,

          answer:
            language === "SW"

              ? "Kwaheri! 👋 Soma kwa bidii na urudi tena wakati wowote."

              : "Goodbye! 👋 Keep learning and come back anytime.",

          provider:
            "SomaHub",

          model:
            MODELS.greeting,

          intent,
          language
        }
      );
    }


    if (intent === "smalltalk") {

      return sendJSON(
        res,
        200,
        {
          ok: true,

          answer:
            language === "SW"

              ? "Mimi ni SomaHub Tutor 🎓. Niko hapa kukusaidia kuelewa masomo, kufanya homework, kutatua maswali na kujifunza kwa urahisi. Unaweza kuniuliza swali lolote."

              : "I'm SomaHub Tutor 🎓, your learning assistant. I can explain topics, solve questions, help with homework, mark work and create revision materials. What would you like to learn?",

          provider:
            "SomaHub",

          model:
            MODELS.greeting,

          intent,
          language
        }
      );
    }


    if (intent === "help") {

      return sendJSON(
        res,
        200,
        {
          ok: true,

          answer:
            `I can help you with:

1. 📚 Explain school topics
2. 🔢 Solve mathematics with working
3. 📝 Mark your work
4. 📖 Create homework and revision questions
5. 📄 Create exams and assessments
6. 📷 Read and explain photos of work
7. 🌍 English and Kiswahili learning

Just type your question or upload a photo.`,

          provider:
            "SomaHub",

          model:
            MODELS.greeting,

          intent,
          language
        }
      );
    }


    // ========================================================
    // AUTOMATIC MODEL SELECTION
    // ========================================================

    let chosenModel =
      MODELS.flash;


    if (intent === "smart") {

      chosenModel =
        MODELS.smart;

    } else if (
      intent === "normal" &&
      question.length < 100
    ) {

      chosenModel =
        MODELS.light;
    }


    // Images should use the vision-capable main model.
    if (body.photo) {

      chosenModel =
        MODELS.flash;
    }


    // ========================================================
    // BUILD PROMPT
    // ========================================================

    const payload = {
      ...body,
      question
    };


    const prompt =
      buildPrompt(payload);


    const errors = [];


    // ========================================================
    // GEMINI ATTEMPT
    // ========================================================

    let geminiQuotaExceeded =
      false;


    try {

      const result =
        await callGemini({
          prompt,
          photo: body.photo,
          mimeType: body.mimeType,
          modelId: chosenModel
        });


      return sendJSON(
        res,
        200,
        {
          ok: true,
          ...result,
          hasImage:
            Boolean(body.photo),
          intent,
          language
        }
      );


    } catch (error) {

      geminiQuotaExceeded =
        isQuotaError(error);


      errors.push({
        provider:
          "Gemini",

        model:
          chosenModel,

        error:
          publicProviderError(error),

        quota:
          geminiQuotaExceeded
      });
    }


    // ========================================================
    // IMPORTANT:
    // If Gemini hit quota/rate limits, DO NOT waste another
    // Gemini request using a second model.
    // Go directly to OpenAI.
    // ========================================================

    if (
      !geminiQuotaExceeded &&
      chosenModel !== MODELS.flash
    ) {

      try {

        const result =
          await callGemini({
            prompt,
            photo: body.photo,
            mimeType: body.mimeType,
            modelId: MODELS.flash
          });


        return sendJSON(
          res,
          200,
          {
            ok: true,

            ...result,

            hasImage:
              Boolean(body.photo),

            intent,
            language,

            fallbackFrom:
              chosenModel
          }
        );


      } catch (error) {

        const quota =
          isQuotaError(error);


        errors.push({
          provider:
            "Gemini",

          model:
            MODELS.flash,

          error:
            publicProviderError(error),

          quota
        });


        if (quota) {
          geminiQuotaExceeded =
            true;
        }
      }
    }


    // ========================================================
    // OPENAI FALLBACK
    // ========================================================

    try {

      const result =
        await callOpenAI({
          prompt,
          photo: body.photo,
          mimeType: body.mimeType,
          modelId: MODELS.fallback
        });


      return sendJSON(
        res,
        200,
        {
          ok: true,

          ...result,

          hasImage:
            Boolean(body.photo),

          intent,
          language,

          fallbackFrom:
            "Gemini"
        }
      );


    } catch (error) {

      errors.push({
        provider:
          "OpenAI",

        model:
          MODELS.fallback,

        error:
          publicProviderError(error),

        quota:
          isQuotaError(error)
      });
    }


    // ========================================================
    // ALL PROVIDERS FAILED
    // ========================================================

    const geminiError =
      errors.find(
        item =>
          item.provider === "Gemini"
      );

    const openaiError =
      errors.find(
        item =>
          item.provider === "OpenAI"
      );


    let userMessage =
      "No AI provider is currently available.";


    if (
      geminiError?.quota &&
      openaiError?.quota
    ) {

      userMessage =
        "SomaHub AI is temporarily unavailable because the available AI usage limits have been reached. Please try again later.";

    } else if (
      geminiError?.quota &&
      !openaiError
    ) {

      userMessage =
        "Gemini usage limit has been reached. SomaHub is trying its fallback provider.";

    } else if (
      openaiError?.quota &&
      !geminiError
    ) {

      userMessage =
        "The OpenAI fallback is currently unavailable because its usage limit has been reached.";

    } else {

      userMessage =
        "No AI provider is currently available. Please try again shortly.";
    }


    return sendJSON(
      res,
      503,
      {
        ok: false,

        error:
          userMessage,

        providers:
          errors,

        intent,
        language
      }
    );


  } catch (error) {

    return sendJSON(
      res,
      500,
      {
        ok: false,

        error:
          String(
            error?.message ||
            "Unexpected server error"
          ).slice(0,800)
      }
    );
  }
}
