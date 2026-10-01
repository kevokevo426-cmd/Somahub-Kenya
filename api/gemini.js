export default async function handler(req, res) {

  /* =====================================
     CORS
  ====================================== */

  res.setHeader(
    "Access-Control-Allow-Origin",
    "*"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS, GET"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );


  /* =====================================
     OPTIONS
  ====================================== */

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }


  /* =====================================
     GET
  ====================================== */

  if (req.method === "GET") {

    return res.status(200).json({
      answer:
        "SomaHub AI Teacher is ready."
    });

  }


  /* =====================================
     METHOD
  ====================================== */

  if (req.method !== "POST") {

    return res.status(405).json({
      answer:
        "POST request required."
    });

  }


  try {

    /* =====================================
       REQUEST BODY
    ====================================== */

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});


    const question =
      String(
        body.question ||
        "Explain the concept in this question."
      ).slice(0, 8000);


    const grade =
      String(
        body.grade ||
        "Grade 7"
      );


    const shke =
      String(
        body.shke ||
        "SHKE"
      );


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


    /* =====================================
       API KEY
    ====================================== */

    const KEY =
      process.env.GEMINI_API_KEY;


    if (!KEY) {

      return res.status(500).json({

        answer:
          "GEMINI_API_KEY is missing in Vercel Environment Variables."

      });

    }


    /* =====================================
       AI TEACHER PROMPT
    ====================================== */

    const prompt = `You are SomaHub AI Teacher for Kenyan learners.

Curriculum/context:
${shke}

Learner level:
${grade}

Your job is to act like a patient, clear and professional teacher.

IMPORTANT:
Do not simply give the final answer.
Teach the learner how to understand the question and solve similar questions.

When a photograph is provided:

1. Carefully read the photograph.
2. Identify the subject.
3. Identify the topic.
4. Rewrite the question briefly if necessary.
5. Explain the concept in simple language suitable for ${grade}.
6. Solve the question step by step.
7. Explain WHY the answer is correct.
8. Highlight the most important facts.
9. Give a simple example when useful.
10. End with a clearly marked final answer.

MULTIPLE CHOICE QUESTIONS:

If the question contains options such as A, B, C and D:

You MUST discuss the choices.

Use this structure:

**Question:** Briefly state what is being asked.

**Concept:** Explain the relevant concept.

**Option A:** Explain what A means and whether it is correct or incorrect.

**Option B:** Explain what B means and whether it is correct or incorrect.

**Option C:** Explain what C means and whether it is correct or incorrect.

**Option D:** Explain what D means and whether it is correct or incorrect.

**Correct Choice:** State the correct letter and answer.

**Why:** Explain clearly why the correct choice is right.

Do not just say:
"A is wrong."
Explain the reason.

If an option is obviously unrelated, briefly explain why.

FORMATTING:

Use **bold text** for important words and key facts.

Use ==highlighted text== for the most important answer, rule, definition or conclusion.

Use:
**KEY POINT:** for important things the learner must remember.

Use:
**CORRECT CHOICE:** for multiple-choice answers.

Use:
**FINAL ANSWER:** for the final answer.

For example:

**KEY POINT:** A noun is a naming word.

**CORRECT CHOICE:** B) Nairobi

==FINAL ANSWER: B) Nairobi==

MATHEMATICS:

Show all important working.

Explain each step.

Do not skip calculations.

SCIENCE:

Explain the process, principle, cause and effect.

ENGLISH:

Explain the grammar rule and why the selected answer follows the rule.

SST:

Explain historical, geographical, social or civic concepts clearly.

AGRICULTURE:

Explain processes, practices, reasons and examples.

COMPUTER / ICT:

Explain the concept and give a practical example.

OTHER SUBJECTS:

Give a clear age-appropriate explanation.

If the image is unclear:

Say which part cannot be read.

Do not invent information.

If there are several questions:

Answer them one at a time and number them.

Always be accurate, encouraging and educational.

Learner's request:
${question}`;


    /* =====================================
       GEMINI PARTS
    ====================================== */

    const parts = [
      {
        text: prompt
      }
    ];


    /* =====================================
       IMAGE
    ====================================== */

    if (photo) {

      /*
       * Accept a complete data URL too.
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
        3000000
      ) {

        return res.status(413).json({

          answer:
            "The photo is too large. Please take a clearer photo of the question."

        });

      }


      parts.push({

        inlineData: {

          mimeType:
            mimeType,

          data:
            photo

        }

      });

    }


    /* =====================================
       GEMINI API
    ====================================== */

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";


    let response;
    let data;


    /*
     * Retry temporary Google errors.
     */

    for (
      let attempt = 1;
      attempt <= 3;
      attempt++
    ) {

      response =
        await fetch(
          endpoint,
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              "x-goog-api-key":
                KEY

            },

            body:
              JSON.stringify({

                contents: [

                  {

                    role: "user",

                    parts:
                      parts

                  }

                ],

                generationConfig: {

                  temperature:
                    0.25,

                  maxOutputTokens:
                    5000

                }

              })

          }
        );


      data =
        await response.json();


      /*
       * Retry 503 or 429.
       */

      if (
        response.status !== 503 &&
        response.status !== 429
      ) {

        break;

      }


      if (
        attempt < 3
      ) {

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              attempt * 2000
            )
        );

      }

    }


    /* =====================================
       ERROR
    ====================================== */

    if (!response.ok) {

      console.error(
        "Gemini API error:",
        JSON.stringify(
          data,
          null,
          2
        )
      );


      const googleMessage =
        data?.error?.message ||
        "Unknown Gemini API error.";


      return res.status(
        response.status
      ).json({

        answer:
          `Gemini API error: ${googleMessage}`

      });

    }


    /* =====================================
       GET RESPONSE
    ====================================== */

    let answer = "";


    const candidates =
      data?.candidates || [];


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


    /* =====================================
       EMPTY RESPONSE
    ====================================== */

    if (
      !answer.trim()
    ) {

      console.error(
        "Unexpected Gemini response:",
        JSON.stringify(
          data,
          null,
          2
        )
      );


      return res.status(502).json({

        answer:
          "Gemini returned no readable answer. Please try again."

      });

    }


    /* =====================================
       SUCCESS
    ====================================== */

    return res.status(200).json({

      answer:
        answer.trim(),

      model:
        "gemini-3.8-flash",

      hasImage:
        Boolean(photo)

    });


  } catch (error) {

    console.error(
      "SomaHub server error:",
      error
    );


    return res.status(500).json({

      answer:
        "SomaHub AI server error: " +
        error.message

    });

  }

}
