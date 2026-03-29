import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" }));

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";
const BASE = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

console.log("API Key loaded:", GEMINI_KEY ? GEMINI_KEY.slice(0, 8) + "..." : "MISSING!");

app.post("/api/gemini/stream", async (req, res) => {
  console.log("→ /api/gemini/stream hit");
  const { systemPrompt, userMessage } = req.body;
  try {
    const url = `${BASE}:streamGenerateContent?alt=sse&key=${GEMINI_KEY}`;
    console.log("→ Calling Gemini at:", url.replace(GEMINI_KEY, "KEY_HIDDEN"));
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 1000 },
      }),
    });
    console.log("→ Gemini status:", response.status);
    if (!response.ok) {
      const err = await response.text();
      console.error("→ Gemini error body:", err);
      return res.status(500).json({ error: err });
    }
    res.setHeader("Content-Type", "text/event-stream");
    response.body.pipe(res);
  } catch (err) {
    console.error("→ Stream error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/gemini/vision", async (req, res) => {
  console.log("→ /api/gemini/vision hit");
  const { system, base64, mimeType } = req.body;
  try {
    const response = await fetch(`${BASE}:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: "Extract all financial data from this document." }] }],
        generationConfig: { maxOutputTokens: 1000 },
      }),
    });
    console.log("→ Gemini vision status:", response.status);
    const d = await response.json();
    if (d.error) { console.error("→ Gemini vision error:", d.error); return res.status(500).json({ error: d.error }); }
    let text = d.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    text = text.replace(/```json|```/g, "").trim();
    res.json({ text });
  } catch (err) {
    console.error("→ Vision error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/gemini/text", async (req, res) => {
  console.log("→ /api/gemini/text hit");
  const { system, text } = req.body;
  try {
    const response = await fetch(`${BASE}:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: `Parse this financial document:\n${text}` }] }],
        generationConfig: { maxOutputTokens: 1000 },
      }),
    });
    console.log("→ Gemini text status:", response.status);
    const d = await response.json();
    if (d.error) { console.error("→ Gemini text error:", d.error); return res.status(500).json({ error: d.error }); }
    let out = d.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    out = out.replace(/```json|```/g, "").trim();
    res.json({ text: out });
  } catch (err) {
    console.error("→ Text error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Gemini proxy running on http://localhost:${PORT}`));
