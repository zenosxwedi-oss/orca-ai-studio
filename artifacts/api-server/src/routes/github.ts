import { Router, type IRouter } from "express";
import path from "path";
import fs from "fs";
import { SaveToGithubBody } from "@workspace/api-zod";

const router: IRouter = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "files");

router.post("/github/save", async (req, res) => {
  const parseResult = SaveToGithubBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { token, repo, branch = "main", message = "Upload via Orca AI Studio", fileIds } = parseResult.data;

  // Load stored files
  const FILES_JSON = path.join(UPLOADS_DIR, "_index.json");
  let allFiles: Array<{ id: string; filename: string; originalName: string }> = [];
  if (fs.existsSync(FILES_JSON)) {
    try {
      allFiles = JSON.parse(fs.readFileSync(FILES_JSON, "utf-8"));
    } catch {
      allFiles = [];
    }
  }

  const toUpload = allFiles.filter((f) => fileIds.includes(f.id));
  if (toUpload.length === 0) {
    res.status(400).json({ error: "No valid files found" });
    return;
  }

  // Parse owner/repo
  const parts = repo.split("/");
  if (parts.length !== 2) {
    res.status(400).json({ error: "repo must be in format owner/repo" });
    return;
  }
  const [owner, repoName] = parts;

  const results: Array<{ file: string; success: boolean; error?: string }> = [];

  for (const file of toUpload) {
    const filepath = path.join(UPLOADS_DIR, file.filename);
    if (!fs.existsSync(filepath)) {
      results.push({ file: file.originalName, success: false, error: "File not found on disk" });
      continue;
    }

    const content = fs.readFileSync(filepath);
    const base64Content = content.toString("base64");

    // Check if file already exists to get its SHA (required for update)
    let sha: string | undefined;
    try {
      const checkRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(file.originalName)}?ref=${branch ?? "main"}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      if (checkRes.ok) {
        const existing = (await checkRes.json()) as { sha?: string };
        sha = existing.sha;
      }
    } catch {
      // file doesn't exist yet
    }

    // Create or update file
    try {
      const body: Record<string, unknown> = {
        message: message ?? "Upload via Orca AI Studio",
        content: base64Content,
        branch: branch ?? "main",
      };
      if (sha) body.sha = sha;

      const uploadRes = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/${encodeURIComponent(file.originalName)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (uploadRes.ok) {
        results.push({ file: file.originalName, success: true });
      } else {
        const errText = await uploadRes.text();
        results.push({ file: file.originalName, success: false, error: errText });
      }
    } catch (err) {
      results.push({ file: file.originalName, success: false, error: String(err) });
    }
  }

  const allSuccess = results.every((r) => r.success);
  const successCount = results.filter((r) => r.success).length;

  res.json({
    success: allSuccess,
    url: `https://github.com/${owner}/${repoName}/tree/${branch ?? "main"}`,
    message: `Uploaded ${successCount}/${toUpload.length} files to ${repo}`,
  });
});

export default router;
