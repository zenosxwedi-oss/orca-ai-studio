import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { GenerateImageBody } from "@workspace/api-zod";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "images");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const IMAGES_JSON = path.join(UPLOADS_DIR, "_index.json");

interface StoredImage {
  id: string;
  filename: string;
  prompt: string;
  url: string;
  createdAt: string;
}

function loadImages(): StoredImage[] {
  if (!fs.existsSync(IMAGES_JSON)) return [];
  try {
    return JSON.parse(fs.readFileSync(IMAGES_JSON, "utf-8"));
  } catch {
    return [];
  }
}

function saveImages(images: StoredImage[]): void {
  fs.writeFileSync(IMAGES_JSON, JSON.stringify(images, null, 2));
}

// Parse size string to width/height
function parseSize(size: string): { width: number; height: number } {
  const parts = size.split("x");
  if (parts.length === 2) {
    const w = parseInt(parts[0], 10);
    const h = parseInt(parts[1], 10);
    if (!isNaN(w) && !isNaN(h)) return { width: w, height: h };
  }
  return { width: 1024, height: 1024 };
}

// Generate image using Pollinations.ai (free, no API key required)
router.post("/images/generate", async (req, res) => {
  const parseResult = GenerateImageBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { prompt, size = "1024x1024", style } = parseResult.data;
  const { width, height } = parseSize(size);

  // Build a richer prompt if style is provided
  const fullPrompt = style ? `${prompt}, ${style} style` : prompt;

  try {
    const encodedPrompt = encodeURIComponent(fullPrompt);
    const seed = Math.floor(Math.random() * 999999);
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&enhance=true&seed=${seed}`;

    req.log.info({ prompt: fullPrompt, size }, "Generating image via Pollinations.ai");

    const imgRes = await fetch(pollinationsUrl, {
      headers: { "User-Agent": "OrcaAIStudio/1.0" },
    });

    if (!imgRes.ok) {
      req.log.error({ status: imgRes.status }, "Pollinations.ai error");
      res.status(500).json({ error: `Image generation failed: status ${imgRes.status}` });
      return;
    }

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : "jpg";
    const id = randomUUID();
    const filename = `${id}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    const buffer = await imgRes.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buffer));

    const imageUrl = `/api/images/file/${filename}`;

    const stored: StoredImage = {
      id,
      filename,
      prompt: fullPrompt,
      url: imageUrl,
      createdAt: new Date().toISOString(),
    };

    const images = loadImages();
    images.unshift(stored);
    saveImages(images);

    res.json({ id, url: imageUrl, prompt: fullPrompt, createdAt: stored.createdAt });
  } catch (err) {
    req.log.error({ err }, "Image generation failed");
    res.status(500).json({ error: "Image generation failed" });
  }
});

// Serve image files (inline view)
router.get("/images/file/:filename", (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filepath = path.join(UPLOADS_DIR, safeFilename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.sendFile(filepath);
});

// Force-download image
router.get("/images/download/:filename", (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filepath = path.join(UPLOADS_DIR, safeFilename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
  res.sendFile(filepath);
});

// List images
router.get("/images", (_req, res) => {
  const images = loadImages();
  res.json(images);
});

// Delete image
router.delete("/images/:id", (req, res) => {
  const { id } = req.params;
  const images = loadImages();
  const idx = images.findIndex((img) => img.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const [removed] = images.splice(idx, 1);
  const filepath = path.join(UPLOADS_DIR, removed.filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  saveImages(images);
  res.json({ success: true, message: "Image deleted" });
});

export default router;
