export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      answer: "SomaHub Gemini API is ready."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      answer: "POST required."
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});

    const question = String(
      body.question || "Explain photosynthesis simply to a Grade 7 learner."
    );

    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        answer: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
You are SomaHub AI Teacher.

Explain concepts like a good teacher.

Give:
1. Simple explanation
2. Key points
3. One example
4. A short summary

Learner's question:
${question}
`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("GEMINI ERROR:", data);

      return res.status(500).json({
        answer:
          "Gemini error: " +
          (data?.error?.message || "Unknown Gemini error")
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      return res.status(500).json({
        answer: "Gemini returned no answer."
      });
    }

    return res.status(200).json({
      answer
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      answer: "SomaHub server error: " + error.message
    });
  }
}
