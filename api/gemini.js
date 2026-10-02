export default async function handler(req, res) {

  /* =========================================================
     CORS
  ========================================================= */

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS, GET"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  /* =========================================================
     OPTIONS
  ========================================================= */

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  /* =========================================================
     GET
  ========================================================= */

  if (req.method === "GET") {

    return res.status(200).json({
      answer: "SomaHub AI Teacher is ready.",
      providers: {
        gemini: Boolean(process.env.GEMINI_API_KEY),
        openai: Boolean(process.env.OPENAI_API_KEY)
      },
      models: {
        gemini: [
          "gemini-3.8-flash",
          "gemini-3.7-flash",
          "gemini-3.6-flash",
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
          "gemini-3.1-flash-lite",
          "gemini-3.1-pro-preview"
        ]
      }
    });

  }

  /* =========================================================
     METHOD
  ========================================================= */

  if (req.method !== "POST") {

    return res.status(405).json({
      answer: "POST request required."
    });

  }

  try {

    /* =======================================================
       REQUEST BODY
    ======================================================= */

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});


    const question =
      String(
        body.question ||
        "Explain the concept in this question."
      ).slice(0, 30000);


    const grade =
      String(
        body.grade ||
        "Grade 7"
      ).slice(0, 100);


    const shke =
      String(
        body.shke ||
        "SomaHub Kenya"
      ).slice(0, 1000);


    const role =
      String(
        body.role ||
        "Student"
      ).slice(0, 50);


    const task =
      String(
        body.task ||
        "Explain / Solve"
      ).slice(0, 100);


    const subject =
      String(
        body.subject ||
        ""
      ).slice(0, 200);


    const strand =
      String(
        body.strand ||
        ""
      ).slice(0, 300);


    const spread =
      String(
        body.spread ||
        "Balanced"
      ).slice(0, 50);


    const questionCount =
      String(
        body.questionCount ||
        ""
      ).slice(0, 20);


    const totalMarks =
      String(
        body.totalMarks ||
        ""
      ).slice(0, 20);


    const provider =
      String(
        body.provider ||
        "auto"
      ).toLowerCase();


    let photo =
      String(
        body.photo ||
        ""
      );


    let mimeType =
      String(
        body.mimeType ||
        "image/jpeg"
      );


    /* =======================================================
       SOMAHUB KNOWLEDGE
    ======================================================= */

    let knowledge = "";

    if (Array.isArray(body.knowledge)) {

      knowledge =
        body.knowledge
          .slice(0, 20)
          .map((item, index) => {

            const path =
              String(
                item?.path ||
                `SomaHub source ${index + 1}`
              ).slice(0, 300);

            const content =
              String(
                item?.content ||
                ""
              ).slice(0, 8000);

            return `
SOURCE ${index + 1}: ${path}

${content}
`;

          })
          .join("\n");

    }


    if (
      !knowledge &&
      typeof body.knowledge === "string"
    ) {

      knowledge =
        body.knowledge.slice(0, 45000);

    }


    /* =======================================================
       SOURCE LIST
    ======================================================= */

    let sources = [];

    if (Array.isArray(body.sources)) {

      sources =
        body.sources
          .map(
            item =>
              String(item).slice(0, 300)
          )
          .slice(0, 30);

    }


    /* =======================================================
       CONVERSATION HISTORY
    ======================================================= */

    let history = "";

    if (Array.isArray(body.history)) {

      history =
        body.history
          .slice(-8)
          .map(item => {

            const speaker =
              String(
                item?.role ||
                "user"
              );

            const content =
              String(
                item?.content ||
                ""
              ).slice(0, 1500);

            return `${speaker}: ${content}`;

          })
          .join("\n");

    }


    /* =======================================================
       API KEYS
    ======================================================= */

    const GEMINI_KEY =
      process.env.GEMINI_API_KEY || "";


    const OPENAI_KEY =
      process.env.OPENAI_API_KEY || "";


    /* =======================================================
       GEMINI MODELS
       
       Ordered from newest/general purpose to
       lighter backup models.
    ======================================================= */

    const GEMINI_MODELS = [

      "gemini-3.8-flash",

      "gemini-3.7-flash",

      "gemini-3.6-flash",

      "gemini-3.5-flash",

      "gemini-3.5-flash-lite",

      "gemini-3.1-flash-lite",

      "gemini-3.1-pro-preview"

    ];


    /*
     * Optional custom model:
     *
     * Add GEMINI_MODEL in Vercel if you want to
     * change the first model without editing code.
     */

    const customGeminiModel =
      String(
        process.env.GEMINI_MODEL ||
        ""
      ).trim();


    if (
      customGeminiModel &&
      !GEMINI_MODELS.includes(
        customGeminiModel
      )
    ) {

      GEMINI_MODELS.unshift(
        customGeminiModel
      );

    }


    /* =======================================================
       OPENAI MODEL
    ======================================================= */

    const OPENAI_MODEL =
      process.env.OPENAI_MODEL ||
      "gpt-5";


    /* =======================================================
       IMAGE PROCESSING
    ======================================================= */

    if (photo) {

      /*
       * Accept a complete data URL.
       */

      if (
        photo.startsWith("data:")
      ) {

        const match =
          photo.match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
          );


        if (!match) {

          return res.status(400).json({

            answer:
              "The uploaded image format could not be read."

          });

        }


        mimeType =
          match[1];

        photo =
          match[2];

      }


      const allowedTypes = [

        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif"

      ];


      if (
        !allowedTypes.includes(
          mimeType
        )
      ) {

        return res.status(400).json({

          answer:
            "Unsupported image format. Please use JPEG, PNG or WebP."

        });

      }


      if (
        photo.length >
        5000000
      ) {

        return res.status(413).json({

          answer:
            "The photo is too large. Please take a clearer photo of the question."

        });

      }

    }


    /* =======================================================
       AI TEACHER PROMPT
    ======================================================= */

    const prompt = `

You are SomaHub AI Teacher for Kenyan learners and teachers.

You are an educational assistant designed to support
learning, revision, homework, examinations and marking.

============================================================
LEARNER INFORMATION
============================================================

Role:
${role}

Grade:
${grade}

Subject:
${subject || "Determine from the question"}

Strand / Topic:
${strand || "Determine from the question"}

Task:
${task}

Question Spread:
${spread}

Number of Questions:
${questionCount || "Not specified"}

Total Marks:
${totalMarks || "Not specified"}

Platform:
${shke}


============================================================
SOMAHUB KNOWLEDGE
============================================================

The following information may come from SomaHub files.

Use relevant SomaHub information as the primary context.

Do not invent information that is not present.

If the SomaHub files do not contain the required answer,
use your general educational knowledge.

If general knowledge is used, you may state:

"General knowledge used."

Do not refuse to answer simply because SomaHub has no
matching information.

${knowledge || "No relevant SomaHub file content was supplied."}


============================================================
RECENT CONVERSATION
============================================================

${history || "No previous conversation."}


============================================================
GENERAL TEACHING RULES
============================================================

1. Identify the subject.

2. Identify the topic or strand.

3. Explain the concept clearly.

4. Keep the explanation appropriate for ${grade}.

5. Do not simply provide an unexplained answer.

6. Show important working in Mathematics.

7. Explain causes, effects and processes in Science.

8. Explain grammar rules in English.

9. Explain historical, geographical, social and civic
   concepts in SST.

10. Explain agricultural practices and reasons in
    Agriculture.

11. Explain ICT concepts with practical examples.

12. If an image is unclear, say so instead of guessing.

13. If several questions are supplied, number them.

14. Keep paragraphs reasonably short.

15. Be accurate and educational.


============================================================
MULTIPLE CHOICE
============================================================

If the learner provides choices A, B, C and D:

Explain EVERY choice.

Use:

**Option A:** Explain what A means and why it is correct
or incorrect.

**Option B:** Explain what B means and why it is correct
or incorrect.

**Option C:** Explain what C means and why it is correct
or incorrect.

**Option D:** Explain what D means and why it is correct
or incorrect.

Do not simply say "wrong".

Give the reason.


============================================================
NORMAL ANSWER FORMAT
============================================================

### Topic (Strand)

### Explanation

### Brief Question

### Working / Reasoning

### Choices and Reasons

### Correct Choice

### Why

### Marking (KNEC-style)

Total marks:
Award:
Reason:

### KEY POINT

### FINAL ANSWER

Use **bold** for important terms.

Use ==highlighted text== for the most important
answer or conclusion.


============================================================
HOMEWORK
============================================================

If the task is to set homework:

Create ORIGINAL questions based on the relevant
SomaHub curriculum information.

Include:

### Homework

Grade:
Subject:
Topic:
Difficulty:
Total Questions:
Total Marks:

### Instructions

### Questions

### Marking Guide

Use the requested question spread.

Focused = mainly one skill.

Balanced = selected skill plus closely related skills.

Wide = wider coverage of related subtopics and skills.

Do not copy long passages from source material.


============================================================
EXAM
============================================================

If the task is to set an examination:

Create an ORIGINAL examination appropriate for
the selected grade.

Include:

### Examination

Grade:
Subject:
Topic / Strand:
Total Questions:
Total Marks:

### Instructions

### Section A

### Section B

### Section C

when appropriate.

Then provide:

### Marking Scheme

### Answer Key

Do not claim that a generated paper is an official
KNEC examination.


============================================================
MARKING
============================================================

If marking learner work:

Read the question.

Read the learner's answer.

Compare it with the supplied marking guide or
SomaHub material.

Award marks fairly.

Accept valid equivalent answers.

Use:

### Marking

Question 1 — X/Y marks

Awarded:
Reason:
Correction:

Continue for all questions.

Then:

### Total

Awarded: X/Y


============================================================
WIDER SPREAD
============================================================

If spread is Wide, cover more related skills.

Where appropriate, vary question types:

- recall
- understanding
- application
- analysis
- practical examples

Do not make questions unnecessarily difficult
for the selected grade.


============================================================
CURRENT REQUEST
============================================================

${question}

`;


    /* =======================================================
       PROVIDER ORDER
    ======================================================= */

    let providers = [];


    if (
      provider === "openai"
    ) {

      if (OPENAI_KEY) {
        providers.push("openai");
      }

      if (GEMINI_KEY) {
        providers.push("gemini");
      }

    } else {

      if (GEMINI_KEY) {
        providers.push("gemini");
      }

      if (OPENAI_KEY) {
        providers.push("openai");
      }

    }


    if (
      providers.length === 0
    ) {

      return res.status(500).json({

        answer:
          "No AI provider is configured. Add GEMINI_API_KEY in Vercel Environment Variables."

      });

    }


    /* =======================================================
       TRY AI PROVIDERS
    ======================================================= */

    let finalAnswer = "";

    let usedProvider = "";

    let usedModel = "";

    let lastError = "";


    for (
      const currentProvider
      of providers
    ) {

      /* =====================================================
         GEMINI
      ===================================================== */

      if (
        currentProvider === "gemini"
      ) {

        const result =
          await tryGeminiModels({

            apiKey:
              GEMINI_KEY,

            models:
              GEMINI_MODELS,

            prompt,
            photo,
            mimeType

          });


        if (
          result.ok
        ) {

          finalAnswer =
            result.answer;

          usedProvider =
            "Gemini";

          usedModel =
            result.model;

          break;

        }


        lastError =
          result.error || "";


        /*
         * Try the next provider if Gemini is unavailable.
         */

        continue;

      }


      /* =====================================================
         OPENAI
      ===================================================== */

      if (
        currentProvider === "openai"
      ) {

        const result =
          await callOpenAI({

            apiKey:
              OPENAI_KEY,

            model:
              OPENAI_MODEL,

            prompt,
            photo,
            mimeType

          });


        if (
          result.ok
        ) {

          finalAnswer =
            result.answer;

          usedProvider =
            "OpenAI";

          usedModel =
            OPENAI_MODEL;

          break;

        }


        lastError =
          result.error || "";

      }

    }


    /* =======================================================
       ALL PROVIDERS FAILED
    ======================================================= */

    if (
      !finalAnswer.trim()
    ) {

      console.error(
        "All AI providers failed:",
        lastError
      );


      return res.status(503).json({

        answer:
          "SomaHub AI is temporarily unavailable. Please try again later."

      });

    }


    /* =======================================================
       SUCCESS
    ======================================================= */

    return res.status(200).json({

      answer:
        finalAnswer.trim(),

      provider:
        usedProvider,

      model:
        usedModel,

      hasImage:
        Boolean(photo),

      somaHubSources:
        sources,

      somaHubKnowledgeUsed:
        Boolean(knowledge),

      task:
        task,

      grade:
        grade

    });


  } catch (error) {

    console.error(
      "SomaHub server error:",
      error
    );


    return res.status(500).json({

      answer:
        "SomaHub AI server error. Please try again."

    });

  }

}


/* ===========================================================
   TRY MULTIPLE GEMINI MODELS
=========================================================== */

async function tryGeminiModels({
  apiKey,
  models,
  prompt,
  photo,
  mimeType
}) {

  let lastError =
    "Gemini models unavailable.";


  for (
    const model
    of models
  ) {

    try {

      const result =
        await callGemini({

          apiKey,
          model,
          prompt,
          photo,
          mimeType

        });


      if (
        result.ok
      ) {

        return {

          ok:
            true,

          answer:
            result.answer,

          model:
            model

        };

      }


      lastError =
        result.error ||
        lastError;


      /*
       * Move immediately to another Gemini model.
       *
       * This is especially useful if a particular
       * model is unavailable or rate-limited.
       */

      console.warn(
        `Gemini model ${model} failed:`,
        result.error
      );


    } catch (error) {

      lastError =
        error?.message ||
        String(error);

    }

  }


  return {

    ok:
      false,

    error:
      lastError

  };

}


/* ===========================================================
   GEMINI API
=========================================================== */

async function callGemini({
  apiKey,
  model,
  prompt,
  photo,
  mimeType
}) {

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;


  const parts = [

    {
      text:
        prompt
    }

  ];


  /* ---------------------------------------------------------
     IMAGE
  --------------------------------------------------------- */

  if (
    photo
  ) {

    parts.push({

      inlineData: {

        mimeType:
          mimeType,

        data:
          photo

      }

    });

  }


  const response =
    await fetch(
      endpoint,
      {

        method:
          "POST",

        headers: {

          "Content-Type":
            "application/json",

          "x-goog-api-key":
            apiKey

        },

        body:
          JSON.stringify({

            contents: [

              {

                role:
                  "user",

                parts:
                  parts

              }

            ],

            generationConfig: {

              maxOutputTokens:
                5000

            }

          })

      }
    );


  const data =
    await safeJson(
      response
    );


  /* ---------------------------------------------------------
     ERROR
  --------------------------------------------------------- */

  if (
    !response.ok
  ) {

    const message =
      data?.error?.message ||
      `Gemini HTTP ${response.status}`;


    console.error(
      `Gemini ${model} error:`,
      JSON.stringify(
        data,
        null,
        2
      )
    );


    return {

      ok:
        false,

      error:
        message

    };

  }


  /* ---------------------------------------------------------
     EXTRACT ANSWER
  --------------------------------------------------------- */

  let answer = "";


  const candidates =
    data?.candidates ||
    [];


  for (
    const candidate
    of candidates
  ) {

    const candidateParts =
      candidate?.content?.parts ||
      [];


    for (
      const part
      of candidateParts
    ) {

      if (
        typeof part?.text ===
        "string"
      ) {

        answer +=
          part.text;

      }

    }

  }


  if (
    !answer.trim()
  ) {

    return {

      ok:
        false,

      error:
        "Gemini returned no readable answer."

    };

  }


  return {

    ok:
      true,

    answer:
      answer.trim()

  };

}


/* ===========================================================
   OPENAI FALLBACK
=========================================================== */

async function callOpenAI({
  apiKey,
  model,
  prompt,
  photo,
  mimeType
}) {

  const content = [

    {

      type:
        "input_text",

      text:
        prompt

    }

  ];


  if (
    photo
  ) {

    content.push({

      type:
        "input_image",

      image_url:
        `data:${mimeType};base64,${photo}`,

      detail:
        "auto"

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

          "Authorization":
            `Bearer ${apiKey}`

        },

        body:
          JSON.stringify({

            model:
              model,

            input: [

              {

                role:
                  "user",

                content:
                  content

              }

            ],

            max_output_tokens:
              5000

          })

      }
    );


  const data =
    await safeJson(
      response
    );


  if (
    !response.ok
  ) {

    const message =
      data?.error?.message ||
      `OpenAI HTTP ${response.status}`;


    console.error(
      "OpenAI error:",
      JSON.stringify(
        data,
        null,
        2
      )
    );


    return {

      ok:
        false,

      error:
        message

    };

  }


  let answer = "";


  if (
    typeof data?.output_text ===
    "string"
  ) {

    answer =
      data.output_text;

  }


  if (
    !answer.trim() &&
    Array.isArray(data?.output)
  ) {

    for (
      const item
      of data.output
    ) {

      if (
        Array.isArray(
          item?.content
        )
      ) {

        for (
          const part
          of item.content
        ) {

          if (
            typeof part?.text ===
            "string"
          ) {

            answer +=
              part.text;

          }

        }

      }

    }

  }


  if (
    !answer.trim()
  ) {

    return {

      ok:
        false,

      error:
        "OpenAI returned no readable answer."

    };

  }


  return {

    ok:
      true,

    answer:
      answer.trim()

  };

}


/* ===========================================================
   SAFE JSON
=========================================================== */

async function safeJson(response) {

  try {

    return await response.json();

  } catch {

    return {};

  }

}

Vercel variables

For the Gemini multi-model system, you only need:

GEMINI_API_KEY=your_key_here

The code automatically tries:

1. gemini-3.8-flash
2. gemini-3.7-flash
3. gemini-3.6-flash
4. gemini-3.5-flash
5. gemini-3.5-flash-lite
6. gemini-3.1-flash-lite
7. gemini-3.1-pro-preview

These model IDs are based on Google's current API model list.

If you also add:

OPENAI_API_KEY=your_key_here

then the final fallback becomes OpenAI after the Gemini models fail.

One important limitation: multiple model names do not mean one Gemini quota becomes seven separate quotas. If your project/account has exhausted its applicable quota, switching models may still produce quota errors depending on the model and quota involved. The value of this setup is resilience when a particular model is unavailable, rate-limited, or otherwise fails—not magically multiplying your billing quota.

Also, I deliberately removed the old "temperature" setting from the Gemini request because Google's current Gemini 3.8 migration guidance says to remove deprecated sampling parameters such as "temperature", "top_p", and "top_k" for that model.

After replacing the file, redeploy on Vercel. Then your existing "ai.assistant.html" can continue calling "/api/gemini"; you don't have to rename the endpoint yet.
