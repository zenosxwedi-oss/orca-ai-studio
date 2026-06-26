import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { GenerateVideoBody } from "@workspace/api-zod";

const router: IRouter = Router();

const VIDEOS_DIR = path.join(process.cwd(), "uploads", "videos");
fs.mkdirSync(VIDEOS_DIR, { recursive: true });

const VIDEOS_JSON = path.join(VIDEOS_DIR, "_index.json");

interface StoredVideo {
  id: string;
  filename: string;
  prompt: string;
  duration: number;
  htmlCode: string;
  createdAt: string;
}

function loadVideos(): StoredVideo[] {
  if (!fs.existsSync(VIDEOS_JSON)) return [];
  try {
    return JSON.parse(fs.readFileSync(VIDEOS_JSON, "utf-8"));
  } catch {
    return [];
  }
}

function saveVideos(videos: StoredVideo[]): void {
  fs.writeFileSync(VIDEOS_JSON, JSON.stringify(videos, null, 2));
}

const VIDEO_SYSTEM_PROMPT = `You are an expert creative coder who creates stunning animated HTML5 canvas videos.
Generate a single self-contained HTML file with ALL CSS and JavaScript inline.
The animation should:
- Use requestAnimationFrame for smooth 60fps animation
- Fill the viewport (use 100vw / 100vh or a fixed canvas)
- Auto-stop after the specified duration using setTimeout
- Be visually stunning with smooth particle effects, gradients, shapes, or scenes
- Match the user's prompt/theme exactly
- Include a progress bar at the bottom showing remaining time
- Have a title overlay matching the prompt
IMPORTANT: Output ONLY the raw HTML code, no markdown, no code blocks, just the HTML.`;

router.post("/videos/generate", async (req, res) => {
  const parseResult = GenerateVideoBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { prompt, duration = 30, style } = parseResult.data;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
    return;
  }

  try {
    const userPrompt = `Create a ${duration}-second animated HTML5 canvas video for: "${prompt}"${style ? `. Style: ${style}` : ""}.
The animation should loop beautifully and auto-stop after ${duration} seconds (${duration * 1000} milliseconds).
Make it visually spectacular.`;

    const response = await fetch("https://api.orcarouter.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: VIDEO_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(500).json({ error: `AI generation failed: ${errText}` });
      return;
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    let htmlCode = data.choices?.[0]?.message?.content ?? "";

    // Strip markdown code blocks if present
    htmlCode = htmlCode.replace(/^```html?\n?/i, "").replace(/```$/, "").trim();
    if (!htmlCode.toLowerCase().startsWith("<!doctype") && !htmlCode.toLowerCase().startsWith("<html")) {
      // Wrap if bare JS/CSS was returned
      htmlCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;overflow:hidden;background:#000}</style></head><body>${htmlCode}</body></html>`;
    }

    const id = randomUUID();
    const filename = `${id}.json`;

    const stored: StoredVideo = {
      id,
      filename,
      prompt,
      duration,
      htmlCode,
      createdAt: new Date().toISOString(),
    };

    const videos = loadVideos();
    videos.unshift(stored);
    saveVideos(videos);

    res.json({ id, htmlCode, prompt, duration, createdAt: stored.createdAt });
  } catch (err) {
    req.log.error({ err }, "Video generation failed");
    res.status(500).json({ error: "Video generation failed" });
  }
});

// List videos
router.get("/videos", (req, res) => {
  const videos = loadVideos();
  res.json(videos);
});

export default router;
