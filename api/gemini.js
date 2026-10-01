export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      answer: "SomaHub AI Teacher API Ready"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      answer: "Method not allowed"
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body || {};

    const question = String(
      body.question || "Explain this question and help me understand the concept."
    ).slice(0, 12000);

    const grade = String(body.grade || "Grade 7");
    const photo = String(body.photo || "");
    const mimeType = String(body.mimeType || "image/jpeg");

    const KEY = process.env.GEMINI_API_KEY;

    if (!KEY) {
      return res.status(500).json({
        answer: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const parts = [];

    /*
     * TEXT INSTRUCTION
     */
    parts.push({
      text: `
You are SomaHub AI Teacher.

You are helping a Kenyan learner in ${grade}.

Your job is NOT only to mark answers.

When the learner provides a question, worksheet, textbook page,
exam question or photograph:

1. Carefully read the image.
2. Identify the subject and topic.
3. Identify what concept the learner needs to understand.
4. Explain the concept in simple language suitable for ${grade}.
5. If there is a question, solve it step by step.
6. Explain WHY the answer is correct.
7. If the learner's answer is wrong, explain the mistake politely.
8. Give a simple example where useful.
9. If the image is unclear, say exactly which part cannot be read.
10. Never invent text that you cannot clearly see.

Use Kenyan school terminology and examples where appropriate.

IMPORTANT:
- Teach first, mark second.
- Do not simply give a final answer.
- Make the explanation clear enough that the learner can learn
  the concept and solve a similar question independently.
- For mathematics, show the working.
- For science, explain the concept and process.
- For English, explain the grammar/language rule.
- For SST, explain the historical/geographical/civic concept.
- For agriculture, explain the process and give practical examples.

Learner's request:
${question}
`
    });

    /*
     * IMAGE
     */
    if (photo) {
      // Remove accidental data URL prefix if the frontend sends one.
      const cleanPhoto = photo.replace(
        /^data:image\\/[^;]+;base64,/,
        ""
      );

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanPhoto
        }
      });
    }

    const model = "gemini-3.8-flash";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts
          }
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 6000
        }
      })
    });

    const raw = await response.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        answer: "Gemini returned an invalid response."
      });
    }

    if (!response.ok) {
      console.error("Gemini API error:", data);

      const message =
        data?.error?.message ||
        `Gemini API error (${response.status})`;

      return res.status(500).json({
        answer: `AI error: ${message}`
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(p => p.text || "")
        .join("")
        .trim();

    if (!answer) {
      return res.status(500).json({
        answer: "I could not understand the image or question. Please take a clearer photo."
      });
    }

    return res.status(200).json({
      answer
    });

  } catch (error) {
    console.error("SomaHub AI error:", error);

    return res.status(500).json({
      answer: "SomaHub AI encountered an error. Please try again."
    });
  }
}
