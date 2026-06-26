import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import multer from "multer";
import unzipper from "unzipper";
import { DownloadAsZipBody } from "@workspace/api-zod";

const _require = createRequire(import.meta.url);
// archiver is CJS-only; use createRequire to avoid ESM default-import issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const archiver: (format: string, opts?: any) => any = _require("archiver");

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "files");
const ZIPS_DIR = path.join(process.cwd(), "uploads", "zips");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(ZIPS_DIR, { recursive: true });

const FILES_JSON = path.join(UPLOADS_DIR, "_index.json");

interface StoredFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  url: string;
  isArchive: boolean;
  createdAt: string;
}

function loadFiles(): StoredFile[] {
  if (!fs.existsSync(FILES_JSON)) return [];
  try {
    return JSON.parse(fs.readFileSync(FILES_JSON, "utf-8"));
  } catch {
    return [];
  }
}

function saveFiles(files: StoredFile[]): void {
  fs.writeFileSync(FILES_JSON, JSON.stringify(files, null, 2));
}

const ARCHIVE_MIMES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-gzip",
  "application/x-bzip2",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/octet-stream",
];

const ARCHIVE_EXTS = [".zip", ".tar", ".tar.gz", ".tgz", ".gz", ".bz2", ".7z", ".rar"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Upload file
router.post("/files/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const isArchive =
    ARCHIVE_MIMES.includes(req.file.mimetype) ||
    ARCHIVE_EXTS.some((e) => req.file!.originalname.toLowerCase().endsWith(e));

  const stored: StoredFile = {
    id: randomUUID(),
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimeType: req.file.mimetype,
    url: `/api/files/download/${req.file.filename}`,
    isArchive,
    createdAt: new Date().toISOString(),
  };

  const files = loadFiles();
  files.unshift(stored);
  saveFiles(files);

  res.json(stored);
});

// List files
router.get("/files", (req, res) => {
  res.json(loadFiles());
});

// Download single file
router.get("/files/download/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const filepath = path.join(UPLOADS_DIR, safeFilename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.download(filepath, safeFilename);
});

// Extract archive and return file listing
router.post("/files/extract", async (req, res) => {
  const { fileId } = req.body as { fileId?: string };
  if (!fileId) {
    res.status(400).json({ error: "fileId required" });
    return;
  }

  const files = loadFiles();
  const stored = files.find((f) => f.id === fileId);
  if (!stored) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const filepath = path.join(UPLOADS_DIR, stored.filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "File on disk not found" });
    return;
  }

  const extractDir = path.join(UPLOADS_DIR, `extract_${fileId}`);
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    const extractedFiles: string[] = [];

    const ext = stored.originalName.toLowerCase();

    if (ext.endsWith(".zip")) {
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filepath)
          .pipe(unzipper.Extract({ path: extractDir }))
          .on("close", resolve)
          .on("error", reject);
      });

      // Collect extracted file names
      const walk = (dir: string, base = ""): string[] => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const result: string[] = [];
        for (const entry of entries) {
          const rel = base ? `${base}/${entry.name}` : entry.name;
          if (entry.isDirectory()) result.push(...walk(path.join(dir, entry.name), rel));
          else result.push(rel);
        }
        return result;
      };
      extractedFiles.push(...walk(extractDir));
    } else if (ext.endsWith(".tar") || ext.endsWith(".tar.gz") || ext.endsWith(".tgz")) {
      // Use tar shell command as fallback
      const { execSync } = await import("child_process");
      execSync(`tar -xf "${filepath}" -C "${extractDir}"`, { timeout: 30000 });
      const walk = (dir: string, base = ""): string[] => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const result: string[] = [];
        for (const entry of entries) {
          const rel = base ? `${base}/${entry.name}` : entry.name;
          if (entry.isDirectory()) result.push(...walk(path.join(dir, entry.name), rel));
          else result.push(rel);
        }
        return result;
      };
      extractedFiles.push(...walk(extractDir));
    } else {
      res.status(400).json({ error: "Unsupported archive type. Supported: .zip, .tar, .tar.gz, .tgz" });
      return;
    }

    // Package extracted files back as a downloadable zip
    const zipId = randomUUID();
    const zipName = `extracted_${zipId}.zip`;
    const zipPath = path.join(ZIPS_DIR, zipName);

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 6 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(extractDir, false);
      archive.finalize();
    });

    res.json({
      success: true,
      files: extractedFiles,
      extractedPath: extractDir,
      downloadUrl: `/api/files/zip/${zipName}`,
    });
  } catch (err) {
    req.log.error({ err }, "Extraction failed");
    res.status(500).json({ error: "Extraction failed" });
  }
});

// Package files as ZIP for download
router.post("/files/download-zip", async (req, res) => {
  const parseResult = DownloadAsZipBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { fileIds, zipName: userZipName } = parseResult.data;
  const allFiles = loadFiles();
  const toZip = allFiles.filter((f) => fileIds.includes(f.id));

  if (toZip.length === 0) {
    res.status(400).json({ error: "No valid files found" });
    return;
  }

  const zipId = randomUUID();
  const zipName = userZipName ? `${userZipName}.zip` : `download_${zipId}.zip`;
  const zipPath = path.join(ZIPS_DIR, zipName);

  try {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 6 } });
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);

      for (const file of toZip) {
        const filepath = path.join(UPLOADS_DIR, file.filename);
        if (fs.existsSync(filepath)) {
          archive.file(filepath, { name: file.originalName });
        }
      }
      archive.finalize();
    });

    const stat = fs.statSync(zipPath);

    res.json({
      success: true,
      downloadUrl: `/api/files/zip/${zipName}`,
      filename: zipName,
      size: stat.size,
    });
  } catch (err) {
    req.log.error({ err }, "ZIP creation failed");
    res.status(500).json({ error: "ZIP creation failed" });
  }
});

// Serve generated zip files
router.get("/files/zip/:filename", (req, res) => {
  const safeFilename = path.basename(req.params.filename);
  const zipPath = path.join(ZIPS_DIR, safeFilename);
  if (!fs.existsSync(zipPath)) {
    res.status(404).json({ error: "ZIP not found" });
    return;
  }
  res.download(zipPath, safeFilename);
});

// Delete file
router.delete("/files/:id", (req, res) => {
  const { id } = req.params;
  const files = loadFiles();
  const idx = files.findIndex((f) => f.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const [removed] = files.splice(idx, 1);
  const filepath = path.join(UPLOADS_DIR, removed.filename);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  saveFiles(files);
  res.json({ success: true, message: "File deleted" });
});

export default router;
