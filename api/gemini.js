export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      answer: "SomaHub AI Teacher Ready"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ answer: "POST required" });
  }

  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : (req.body || {});

    const question = String(
      body.question || "Explain the concept in this image."
    ).slice(0, 8000);

    const grade = String(body.grade || "Grade 7");
    let photo = String(body.photo || "");
    const mimeType = String(body.mimeType || "image/jpeg");
    const KEY = process.env.GEMINI_API_KEY;

    if (!KEY) {
      return res.status(500).json({
        answer: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    const parts = [{
      text: `You are SomaHub AI Teacher for Kenyan learners.

Grade: ${grade}

Your role is to teach concepts, not just mark answers.

When given a question or photograph:
1. Read the question carefully.
2. Identify the subject and topic.
3. Explain the concept in simple language suitable for ${grade}.
4. Answer the question step by step.
5. Explain why the answer is correct.
6. Give a relevant example.
7. Highlight important points to remember.
8. If the image is unclear, state what you cannot read.
9. Never invent information that is not visible.

For Mathematics, show calculations.
For Science, explain processes and principles.
For English, explain language rules.
For SST, explain historical and geographical concepts.
For other subjects, give clear, relevant explanations.

Be patient, encouraging and accurate.
Teach the learner to understand and solve similar questions independently.

Learner's request:
${question}`
    }];

    if (photo) {
      // Accept either Base64 or a data URL.
      if (photo.startsWith("data:")) {
        const match = photo.match(
          /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/
        );

        if (!match) {
          return res.status(400).json({
            answer: "Unsupported image format. Use JPEG, PNG or WebP."
          });
        }

        photo = match[2];
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        return res.status(400).json({
          answer: "Unsupported image format."
        });
      }

      if (photo.length > 3000000) {
        return res.status(413).json({
          answer: "Image is too large. Please resize or compress it."
        });
      }

      parts.push({
        inlineData: {
          mimeType,
          data: photo
        }
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": KEY
        },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 6000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);
      return res.status(500).json({
        answer: "Gemini error: " +
          (data?.error?.message || "Request failed")
      });
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(500).json({
        answer: "No explanation returned. Please try again."
      });
    }

    return res.status(200).json({ answer });

  } catch (error) {
    console.error("SomaHub error:", error);
    return res.status(500).json({
      answer: "Server error: " + error.message
    });
  }
}
