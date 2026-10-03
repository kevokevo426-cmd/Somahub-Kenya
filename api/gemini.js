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
// • AI homework generation
// • AI exam generation
// • Structured question JSON
// • Original "twisted" questions
// ============================================================


// ============================================================
// MODELS
// ============================================================

const MODELS = {

  // No AI call
  greeting: "soma-greeting",

  // Gemini
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
// LANGUAGE
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
  "naomba",
  "nomino",
  "sentensi",
  "methali",
  "kiwakilishi",
  "kitenzi"
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


// ============================================================
// INTENT
// ============================================================

function detectIntent(question) {

  const q =
    String(question || "").trim();

  const t =
    q.toLowerCase();


  // Greeting
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


  // Homework generation
  if (
    /(create homework|make homework|generate homework|give me homework|set homework|my homework|homework questions|generate questions)/i
      .test(t)
  ) {
    return "homework";
  }


  // Exam generation
  if (
    /(set exam|create exam|make an exam|generate exam|create paper|make paper|assessment paper|weekly exam|revision paper)/i
      .test(t)
  ) {
    return "exam";
  }


  // Marking / assessment
  if (
    /(mark this|mark my work|marking scheme|marking guide|total marks|grade my work)/i
      .test(t)
  ) {
    return "smart";
  }


  // Complex educational work
  if (
    /(solve.*exam|kcpe|kcse|kbsea|assessment|paper 1|paper 2)/i
      .test(t)
  ) {
    return "smart";
  }


  // Long / reasoning-heavy
  if (
    q.length > 800 ||
    /(explain deeply|step by step working|proof|derive|detailed explanation|show all working)/i
      .test(t)
  ) {
    return "smart";
  }


  // Images
  if (
    /(photo|image|picture|picha|attached|attachment)/i
      .test(t)
  ) {
    return "flash";
  }


  return "normal";
}


// ============================================================
// SOMAHUB QUESTION GENERATION PROMPT
// ============================================================

function buildQuestionPrompt(data, type = "homework") {

  const {
    grade = "Grade 7",
    role = "Student",
    subject = "General",
    topic = "",
    strand = "",
    questionCount = type === "exam" ? 20 : 5,
    marks = type === "exam" ? 40 : 10,
    language = "EN",
    knowledge = [],
    history = []
  } = data;


  const safeGrade =
    cleanText(grade, 50);

  const safeSubject =
    cleanText(subject, 100);

  const safeStrand =
    cleanText(strand, 150);

  const safeTopic =
    cleanText(topic, 150);


  let prompt = `

You are SomaHub AI Teacher.

Create ORIGINAL Kenyan curriculum learning questions.

This is NOT a request to copy questions from a source.

You must understand the supplied SomaHub learning material and then
"twist and own" the knowledge by creating NEW questions using your
own wording and different examples.

LEARNER DETAILS
Grade: ${safeGrade}
Role: ${cleanText(role, 50)}
Subject: ${safeSubject}
Topic: ${safeTopic}
Strand: ${safeStrand}
Language: ${cleanText(language, 20)}

NUMBER OF QUESTIONS:
${Number(questionCount) || 5}

TOTAL MARKS:
${Number(marks) || 10}


IMPORTANT:

1. Questions must match the learner's grade.
2. Questions must match the subject.
3. Questions must match the strand/topic where supplied.
4. Use Kenyan school context where appropriate.
5. Do not copy sentences from supplied resources.
6. Create fresh examples.
7. Mix question styles where suitable.
8. Make questions clear enough for a learner to understand.
9. Do not make Grade 4 questions unnecessarily difficult.
10. Do not make Grade 9 questions too simple.
11. For Mathematics, provide the correct answer and acceptable equivalent answers.
12. For English/Kiswahili, provide acceptable answers where appropriate.
13. For open-ended questions, provide a concise marking answer.
14. Include marks for every question.
15. Do not include explanations outside the JSON.
16. Return ONLY valid JSON.
`;


  if (type === "exam") {

    prompt += `

THIS IS A WEEKLY EXAM / ASSESSMENT.

Create a balanced assessment.

Use a mixture of:
- Multiple choice
- Short answer
- Structured questions

Ensure the total marks are appropriate.

`;
  } else {

    prompt += `

THIS IS DAILY HOMEWORK.

Keep it learner-friendly and practical.

`;
  }


  if (
    Array.isArray(knowledge) &&
    knowledge.length > 0
  ) {

    prompt += `

SOMAHUB MASTER LEARNING RESOURCES:

`;

    knowledge
      .slice(0, 15)
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
            item.content ||
            item.somahubContent ||
            "",
            7000
          );

        if (!content) return;

        prompt += `

--- ${path} ---

${content}
`;
      });
  }


  if (
    Array.isArray(history) &&
    history.length > 0
  ) {

    prompt += `

RECENT LEARNING CONTEXT:

`;

    history
      .slice(-6)
      .forEach(item => {

        if (!item) return;

        prompt +=
          `${cleanText(item.role || "user", 30)}: ` +
          `${cleanText(item.content || "", 2000)}\n`;
      });
  }


  prompt += `

RETURN EXACTLY THIS JSON STRUCTURE:

{
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Correct answer",
      "acceptedAnswers": ["Correct answer"],
      "marks": 2,
      "type": "mcq",
      "strand": "${safeStrand || "General"}",
      "explanation": "Short explanation"
    }
  ]
}

RULES FOR OPTIONS:

- MCQ questions must have exactly 4 options.
- The correct answer must appear in options.
- Non-MCQ questions may use an empty options array.
- Never put the answer outside the JSON.
- Do not use markdown.
- Do not wrap the JSON in backticks.
- Do not add commentary before or after the JSON.

`;


  return prompt;
}


// ============================================================
// NORMAL AI PROMPT
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
            item.content ||
            item.somahubContent ||
            "",
            7000
          );

        if (!content) return;

        prompt += `

--- ${path} ---

${content}
`;
      });
  }


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
16. Never invent information from a resource that was not supplied.

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

    error.provider =
      "Gemini";

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

      const error =
        new Error(
          "Image contains no usable data"
        );

      error.provider =
        "Gemini";

      throw error;
    }


    if (base64.length > 4500000) {

      const error =
        new Error(
          "Image is too large. Please upload a smaller photo."
        );

      error.provider =
        "Gemini";

      throw error;
    }


    parts.push({

      inlineData: {

        mimeType:
          String(
            mimeType ||
            "image/jpeg"
          ).toLowerCase(),

        data:
          base64
      }
    });
  }


  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;


  const requestBody = {

    contents: [

      {
        role: "user",
        parts
      }

    ],

    generationConfig: {

      maxOutputTokens:
        5000
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
          JSON.stringify(
            requestBody
          )
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
      ?.map(part =>
        part?.text || ""
      )
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

    provider:
      "Gemini",

    model:
      modelId
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
      type:
        "input_text",

      text:
        String(prompt || "")
    }

  ];


  if (photo) {

    const base64 =
      cleanBase64Photo(photo);


    if (!base64) {

      const error =
        new Error(
          "Image contains no usable data"
        );

      error.provider =
        "OpenAI";

      throw error;
    }


    if (base64.length > 4500000) {

      const error =
        new Error(
          "Image is too large. Please upload a smaller photo."
        );

      error.provider =
        "OpenAI";

      throw error;
    }


    content.push({

      type:
        "input_image",

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

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${apiKey}`
        },

        body:
          JSON.stringify({

            model:
              modelId,

            input: [

              {
                role:
                  "user",

                content
              }

            ],

            max_output_tokens:
              5000
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

    provider:
      "OpenAI",

    model:
      modelId
  };
}


// ============================================================
// JSON EXTRACTION
// ============================================================

function extractJSON(text) {

  if (!text) return null;


  let value =
    String(text).trim();


  // Remove markdown code fences
  value =
    value
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();


  try {

    return JSON.parse(value);

  } catch {}


  // Find JSON object
  const first =
    value.indexOf("{");

  const last =
    value.lastIndexOf("}");


  if (
    first >= 0 &&
    last > first
  ) {

    try {

      return JSON.parse(
        value.slice(
          first,
          last + 1
        )
      );

    } catch {}
  }


  // Find JSON array
  const arrayFirst =
    value.indexOf("[");

  const arrayLast =
    value.lastIndexOf("]");


  if (
    arrayFirst >= 0 &&
    arrayLast > arrayFirst
  ) {

    try {

      return JSON.parse(
        value.slice(
          arrayFirst,
          arrayLast + 1
        )
      );

    } catch {}
  }


  return null;
}


// ============================================================
// NORMALIZE GENERATED QUESTIONS
// ============================================================

function normalizeQuestions(data) {

  let list = [];


  if (
    Array.isArray(data)
  ) {

    list =
      data;

  } else if (
    Array.isArray(data?.questions)
  ) {

    list =
      data.questions;

  } else if (
    Array.isArray(data?.items)
  ) {

    list =
      data.items;
  }


  return list

    .map((item, index) => {

      if (!item) return null;


      const q =
        cleanText(
          item.question ||
          item.q ||
          item.text ||
          "",
          2000
        );


      if (!q) return null;


      let options =
        item.options ||
        item.choices ||
        [];


      if (!Array.isArray(options)) {
        options = [];
      }


      options =
        options
          .map(x =>
            cleanText(x, 500)
          )
          .filter(Boolean)
          .slice(0, 4);


      const answer =
        cleanText(
          item.answer ||
          item.correctAnswer ||
          item.correct ||
          "",
          1000
        );


      let acceptedAnswers =
        item.acceptedAnswers ||
        item.acceptableAnswers ||
        [];


      if (
        !Array.isArray(
          acceptedAnswers
        )
      ) {

        acceptedAnswers =
          [];
      }


      acceptedAnswers =
        acceptedAnswers
          .map(x =>
            cleanText(x, 500)
          )
          .filter(Boolean);


      if (
        answer &&
        !acceptedAnswers.some(
          x =>
            x.toLowerCase() ===
            answer.toLowerCase()
        )
      ) {

        acceptedAnswers.unshift(
          answer
        );
      }


      const marks =
        Number(item.marks) > 0
          ? Number(item.marks)
          : options.length
            ? 1
            : 2;


      return {

        id:
          item.id ||
          `q-${Date.now()}-${index}`,

        q,

        question:
          q,

        options,

        answer,

        acceptedAnswers,

        marks,

        type:
          item.type ||
          (
            options.length
              ? "mcq"
              : "short_answer"
          ),

        strand:
          cleanText(
            item.strand ||
            item.topic ||
            "",
            200
          ),

        explanation:
          cleanText(
            item.explanation ||
            "",
            1500
          )
      };

    })

    .filter(Boolean);
}


// ============================================================
// HUMAN RESPONSES
// ============================================================

function humanResponse(
  intent,
  language,
  grade
) {

  if (intent === "greeting") {

    return language === "SW"

      ? `Habari! 👋 Karibu SomaHub Tutor!

Niko tayari kukusaidia na masomo ya ${grade}.

Uliza chochote kuhusu hesabu, sayansi, Kiingereza, Kiswahili, homework au mtihani.

Tuanze! 🎓`

      : `Hello! 👋 Welcome to SomaHub Tutor!

I'm ready to help you with ${grade} work.

Ask me about mathematics, science, English, homework, exams or any topic you're learning.

Let's learn! 🎓`;
  }


  if (intent === "thanks") {

    return language === "SW"

      ? "Karibu sana! 😊 Uliza tena wakati wowote ukihitaji msaada."

      : "You're most welcome! 😊 Ask me anytime you need help.";
  }


  if (intent === "bye") {

    return language === "SW"

      ? "Kwaheri! 👋 Soma kwa bidii na urudi tena wakati wowote."

      : "Goodbye! 👋 Keep learning and come back anytime.";
  }


  if (intent === "smalltalk") {

    return language === "SW"

      ? "Mimi ni SomaHub Tutor 🎓. Niko hapa kukusaidia kuelewa masomo, kufanya homework, kutatua maswali na kujifunza kwa urahisi."

      : "I'm SomaHub Tutor 🎓, your learning assistant. I can explain topics, solve questions, help with homework, mark work and create revision materials.";
  }


  if (intent === "help") {

    return `I can help you with:

1. 📚 Explain school topics
2. 🔢 Solve mathematics with working
3. 📝 Mark your work
4. 📖 Create homework
5. 📄 Create exams and assessments
6. 📷 Read and explain photos
7. 🌍 English and Kiswahili learning

Just type your question or upload a photo.`;
  }


  return null;
}


// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  // ==========================================================
  // CORS
  // ==========================================================

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


  // ==========================================================
  // OPTIONS
  // ==========================================================

  if (
    req.method === "OPTIONS"
  ) {

    return res
      .status(204)
      .end();
  }


  // ==========================================================
  // HEALTH CHECK
  // ==========================================================

  if (
    req.method === "GET"
  ) {

    return sendJSON(
      res,
      200,
      {

        ok:
          true,

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

        features: [

          "chat",

          "homework_generation",

          "exam_generation",

          "image_support",

          "conversation_history",

          "somahub_knowledge",

          "english",

          "kiswahili",

          "quota_aware_routing"

        ],

        models:
          MODELS
      }
    );
  }


  // ==========================================================
  // POST ONLY
  // ==========================================================

  if (
    req.method !== "POST"
  ) {

    return sendJSON(
      res,
      405,
      {

        ok:
          false,

        error:
          "Method not allowed"
      }
    );
  }


  try {

    // ========================================================
    // BODY
    // ========================================================

    let body =
      typeof req.body === "string"

        ? JSON.parse(
            req.body || "{}"
          )

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


    // ========================================================
    // ALLOW STRUCTURED TASKS WITHOUT A NORMAL QUESTION
    // ========================================================

    const requestedTask =
      String(
        body.task ||
        body.mode ||
        ""
      ).toLowerCase();


    const isHomeworkRequest =
      requestedTask.includes(
        "homework"
      );


    const isExamRequest =
      requestedTask.includes(
        "exam"
      );


    if (
      !question &&
      !isHomeworkRequest &&
      !isExamRequest
    ) {

      return sendJSON(
        res,
        400,
        {

          ok:
            false,

          error:
            "Please enter a question."
        }
      );
    }


    const actualQuestion =
      question ||
      (
        isHomeworkRequest

          ? "Generate homework."

          : "Generate an exam."
      );


    // ========================================================
    // INTENT
    // ========================================================

    let intent =
      detectIntent(
        actualQuestion
      );


    if (isHomeworkRequest) {
      intent = "homework";
    }


    if (isExamRequest) {
      intent = "exam";
    }


    const language =
      detectLang(
        actualQuestion
      );


    const grade =
      cleanText(
        body.grade ||
        "Grade 7",
        50
      );


    // ========================================================
    // HUMAN RESPONSES
    // ZERO AI QUOTA
    // ========================================================

    if (
      [
        "greeting",
        "thanks",
        "bye",
        "smalltalk",
        "help"
      ].includes(intent)
    ) {

      const answer =
        humanResponse(
          intent,
          language,
          grade
        );


      return sendJSON(
        res,
        200,
        {

          ok:
            true,

          answer,

          provider:
            "SomaHub",

          model:
            MODELS.greeting,

          intent,

          language,

          hasImage:
            Boolean(body.photo)
        }
      );
    }


    // ========================================================
    // MODEL SELECTION
    // ========================================================

    let chosenModel =
      MODELS.flash;


    if (
      intent === "smart" ||
      intent === "exam"
    ) {

      chosenModel =
        MODELS.smart;

    } else if (
      intent === "homework"
    ) {

      chosenModel =
        MODELS.flash;

    } else if (
      intent === "normal" &&
      actualQuestion.length < 100
    ) {

      chosenModel =
        MODELS.light;
    }


    // Images use the main model
    if (body.photo) {

      chosenModel =
        MODELS.flash;
    }


    // ========================================================
    // QUESTION / EXAM GENERATION
    // ========================================================

    let prompt;


    if (
      intent === "homework" ||
      intent === "exam"
    ) {

      prompt =
        buildQuestionPrompt(
          {
            ...body,

            grade,

            language:
              language,

            questionCount:
              Number(
                body.questionCount ||
                (
                  intent === "exam"
                    ? 20
                    : 5
                )
              ),

            marks:
              Number(
                body.marks ||
                (
                  intent === "exam"
                    ? 40
                    : 10
                )
              )
          },

          intent === "exam"
            ? "exam"
            : "homework"
        );

    } else {

      // ======================================================
      // NORMAL CHAT
      // ======================================================

      prompt =
        buildPrompt(
          {
            ...body,

            question:
              actualQuestion,

            task:
              language
          }
        );
    }


    // ========================================================
    // COMMON PAYLOAD
    // ========================================================

    const payload = {

      ...body,

      question:
        actualQuestion,

      grade,

      language,

      intent
    };


    // ========================================================
    // PROVIDER ROUTING
    //
    // Gemini first.
    //
    // If Gemini reaches quota, do NOT waste another Gemini
    // request on another model.
    //
    // Go directly to OpenAI.
    // ========================================================

    const errors = [];


    // ========================================================
    // GEMINI
    // ========================================================

    if (
      process.env.GEMINI_API_KEY
    ) {

      try {

        const result =
          await callGemini({

            prompt,

            photo:
              body.photo,

            mimeType:
              body.mimeType,

            modelId:
              chosenModel
          });


        // ====================================================
        // STRUCTURED HOMEWORK / EXAM
        // ====================================================

        if (
          intent === "homework" ||
          intent === "exam"
        ) {

          const parsed =
            extractJSON(
              result.answer
            );


          const questions =
            normalizeQuestions(
              parsed
            );


          if (
            questions.length > 0
          ) {

            return sendJSON(
              res,
              200,
              {

                ok:
                  true,

                answer:
                  result.answer,

                questions,

                provider:
                  result.provider,

                model:
                  result.model,

                intent,

                language,

                grade,

                type:
                  intent === "exam"
                    ? "exam"
                    : "homework",

                source:
                  "AI + SomaHub knowledge",

                original:
                  true
              }
            );
          }


          // If AI returned invalid JSON,
          // continue to fallback instead of
          // giving broken homework to frontend.

          errors.push({

            provider:
              "Gemini",

            error:
              "AI returned invalid question JSON"
          });


        } else {

          return sendJSON(
            res,
            200,
            {

              ok:
                true,

              answer:
                result.answer,

              provider:
                result.provider,

              model:
                result.model,

              intent,

              language,

              grade,

              hasImage:
                Boolean(body.photo)
            }
          );
        }


      } catch (error) {

        errors.push({

          provider:
            "Gemini",

          error:
            publicProviderError(
              error
            ),

          quota:
            isQuotaError(
              error
            ),

          modelError:
            isModelError(
              error
            )
        });


        // ====================================================
        // IMPORTANT:
        //
        // If Gemini quota is exhausted, we DO NOT try another
        // Gemini model. We immediately move to OpenAI.
        // ====================================================
      }

    } else {

      errors.push({

        provider:
          "Gemini",

        error:
          "GEMINI_API_KEY not configured"
      });
    }


    // ========================================================
    // OPENAI FALLBACK
    // ========================================================

    if (
      process.env.OPENAI_API_KEY
    ) {

      try {

        const result =
          await callOpenAI({

            prompt,

            photo:
              body.photo,

            mimeType:
              body.mimeType,

            modelId:
              MODELS.fallback
          });


        // ====================================================
        // STRUCTURED HOMEWORK / EXAM
        // ====================================================

        if (
          intent === "homework" ||
          intent === "exam"
        ) {

          const parsed =
            extractJSON(
              result.answer
            );


          const questions =
            normalizeQuestions(
              parsed
            );


          if (
            questions.length > 0
          ) {

            return sendJSON(
              res,
              200,
              {

                ok:
                  true,

                answer:
                  result.answer,

                questions,

                provider:
                  result.provider,

                model:
                  result.model,

                intent,

                language,

                grade,

                type:
                  intent === "exam"
                    ? "exam"
                    : "homework",

                source:
                  "OpenAI fallback + SomaHub knowledge",

                original:
                  true
              }
            );
          }


          errors.push({

            provider:
              "OpenAI",

            error:
              "AI returned invalid question JSON"
          });


        } else {

          return sendJSON(
            res,
            200,
            {

              ok:
                true,

              answer:
                result.answer,

              provider:
                result.provider,

              model:
                result.model,

              intent,

              language,

              grade,

              hasImage:
                Boolean(body.photo)
            }
          );
        }


      } catch (error) {

        errors.push({

          provider:
            "OpenAI",

          error:
            publicProviderError(
              error
            ),

          quota:
            isQuotaError(
              error
            ),

          modelError:
            isModelError(
              error
            )
        });

      }

    } else {

      errors.push({

        provider:
          "OpenAI",

        error:
          "OPENAI_API_KEY not configured"
      });
    }


    // ========================================================
    // BOTH PROVIDERS FAILED
    // ========================================================

    const quotaOnly =
      errors.length > 0 &&
      errors.every(
        item =>
          item.quota === true
      );


    return sendJSON(
      res,
      503,
      {

        ok:
          false,

        error:
          quotaOnly

            ? "All configured AI providers are currently at their usage limit."

            : "No AI provider is currently available.",

        intent,

        grade,

        details:
          errors
      }
    );


  } catch (error) {

    console.error(
      "SomaHub AI API error:",
      error
    );


    return sendJSON(
      res,
      500,
      {

        ok:
          false,

        error:
          "SomaHub AI could not process this request.",

        details:
          process.env.NODE_ENV ===
          "development"

            ? String(
                error?.message ||
                error
              )

            : undefined
      }
    );
  }
}
