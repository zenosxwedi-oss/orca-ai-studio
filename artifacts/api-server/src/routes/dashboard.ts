import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const IMAGES_DIR = path.join(process.cwd(), "uploads", "images");
const VIDEOS_DIR = path.join(process.cwd(), "uploads", "videos");
const FILES_DIR = path.join(process.cwd(), "uploads", "files");

function loadJson<T>(dir: string): T[] {
  const jsonPath = path.join(dir, "_index.json");
  if (!fs.existsSync(jsonPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as T[];
  } catch {
    return [];
  }
}

router.get("/dashboard/stats", (req, res) => {
  const images = loadJson<{ id: string; url: string; prompt: string; filename: string; createdAt: string }>(IMAGES_DIR);
  const videos = loadJson<{ id: string; htmlCode: string; prompt: string; duration: number; filename: string; createdAt: string }>(VIDEOS_DIR);
  const files = loadJson<{ id: string }>(FILES_DIR);

  res.json({
    totalImages: images.length,
    totalVideos: videos.length,
    totalFiles: files.length,
    recentImages: images.slice(0, 4),
    recentVideos: videos.slice(0, 3),
  });
});

export default router;
