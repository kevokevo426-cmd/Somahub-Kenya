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

    return res
      .status(200)
      .end();

  }


  /* =====================================
     GET TEST
  ====================================== */

  if (req.method === "GET") {

    return res
      .status(200)
      .json({
        answer:
          "SomaHub AI Teacher is ready."
      });

  }


  /* =====================================
     METHOD CHECK
  ====================================== */

  if (req.method !== "POST") {

    return res
      .status(405)
      .json({
        answer:
          "POST request required."
      });

  }


  try {

    /* =====================================
       READ REQUEST
    ====================================== */

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});


    const question =
      String(
        body.question ||
        "Explain the concept in this question."
      )
      .slice(0, 8000);


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

      console.error(
        "GEMINI_API_KEY is missing."
      );

      return res
        .status(500)
        .json({
          answer:
            "GEMINI_API_KEY is missing in Vercel Environment Variables."
        });

    }


    /* =====================================
       BUILD PROMPT
    ====================================== */

    const prompt = `You are SomaHub AI Teacher, an educational AI assistant for Kenyan learners.

Curriculum/context:
${shke}

Learner level:
${grade}

Your main purpose is to TEACH and EXPLAIN concepts, not merely give a final answer.

When the learner sends a question or photograph:

1. Carefully read the question.
2. Identify the subject.
3. Identify the topic or concept being tested.
4. Explain the concept in simple language suitable for ${grade}.
5. Solve the question step by step.
6. Explain why the answer is correct.
7. Show calculations where necessary.
8. Give a simple example where useful.
9. Mention important points the learner should remember.
10. If there are several questions in the photograph, handle them clearly one by one.
11. If part of the photograph is unclear, say exactly which part is unclear.
12. Never invent text that cannot be read from the photograph.
13. Encourage understanding so the learner can solve similar questions independently.

Subject guidance:

MATHEMATICS:
Show the working and explain each calculation.

SCIENCE:
Explain the scientific concept, process, reason and application.

ENGLISH:
Explain grammar, vocabulary, comprehension or literature rules clearly.

SOCIAL STUDIES / SST:
Explain historical, geographical, civic and social concepts clearly.

AGRICULTURE:
Explain processes, practices, reasons and examples.

COMPUTER / ICT:
Explain the concept and give practical examples.

OTHER SUBJECTS:
Give a clear age-appropriate explanation.

Be accurate, patient, concise but sufficiently detailed.

Learner's request:
${question}`;


    /* =====================================
       GEMINI CONTENT PARTS
    ====================================== */

    const parts = [
      {
        text: prompt
      }
    ];


    /* =====================================
       IMAGE HANDLING
    ====================================== */

    if (photo) {

      /*
       * In case frontend accidentally sends
       * the complete data URL.
       */
      if (
        photo.startsWith("data:")
      ) {

        const match =
          photo.match(
            /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
          );


        if (!match) {

          return res
            .status(400)
            .json({
              answer:
                "The uploaded image format could not be read."
            });

        }


        mimeType =
          match[1];

        photo =
          match[2];

      }


      /* =====================================
         SUPPORTED IMAGE TYPES
      ====================================== */

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

        return res
          .status(400)
          .json({
            answer:
              "Unsupported image format. Please use JPEG, PNG or WebP."
          });

      }


      /* =====================================
         IMAGE SIZE CHECK
      ====================================== */

      /*
       * Frontend normally sends a compressed
       * 1200px JPEG.
       */
      if (
        photo.length >
        3000000
      ) {

        return res
          .status(413)
          .json({
            answer:
              "The photo is too large. Please take a clearer, closer photo of the question."
          });

      }


      /* =====================================
         ADD IMAGE TO GEMINI REQUEST
      ====================================== */

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
       GEMINI REQUEST
    ====================================== */

    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";


    let response;

    let data;


    /*
     * Retry temporary Google availability
     * errors instead of immediately failing.
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

                  maxOutputTokens:
                    5000

                }

              })

          }
        );


      data =
        await response.json();


      /*
       * Retry temporary overload.
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
       GEMINI ERROR
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


      return res
        .status(response.status)
        .json({

          answer:
            `Gemini API error: ${googleMessage}`

        });

    }


    /* =====================================
       EXTRACT ANSWER
    ====================================== */

    let answer = "";


    try {

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

    } catch (extractError) {

      console.error(
        "Gemini response extraction error:",
        extractError
      );

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


      return res
        .status(502)
        .json({

          answer:
            "Gemini returned no readable answer. Please try the question again."

        });

    }


    /* =====================================
       SUCCESS
    ====================================== */

    return res
      .status(200)
      .json({

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


    return res
      .status(500)
      .json({

        answer:
          "SomaHub AI encountered a server error: " +
          error.message

      });

  }

}
