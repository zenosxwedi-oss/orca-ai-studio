import { Router, type IRouter } from "express";
import { SendMessageBody } from "@workspace/api-zod";

const router: IRouter = Router();

const ORCA_API_URL = "https://api.orcarouter.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are an expert AI coding assistant. Give COMPLETE, working code only — no partial examples, no unnecessary disclaimers.
- Support all languages: JS/TS, Python, Go, Rust, C++, Java, PHP, Lua, Bash, etc.
- For games, websites, animations: output a single self-contained HTML file (all CSS in <style>, all JS in <script>)
- Always use proper markdown code blocks with the correct language tag
- Be concise and direct`;

// SSE Streaming endpoint
router.post("/chat/stream", async (req, res) => {
  const parseResult = SendMessageBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { messages, model = "deepseek/deepseek-chat" } = parseResult.data;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const upstream = await fetch(ORCA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errorText = await upstream.text();
      req.log.error({ status: upstream.status, body: errorText }, "OrcaRouter stream error");
      res.write(`data: ${JSON.stringify({ error: errorText })}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to stream from OrcaRouter");
    res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
    res.end();
  }
});

// Non-streaming endpoint
router.post("/chat", async (req, res) => {
  const parseResult = SendMessageBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { messages, model = "deepseek/deepseek-chat" } = parseResult.data;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
    return;
  }

  try {
    const response = await fetch(ORCA_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      req.log.error({ status: response.status, body: errorText }, "OrcaRouter API error");
      res.status(500).json({ error: `AI provider returned ${response.status}: ${errorText}` });
      return;
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { role: string; content: string } }>;
      model: string;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    const assistantMessage = data.choices?.[0]?.message;
    if (!assistantMessage) {
      res.status(500).json({ error: "No response from AI provider" });
      return;
    }

    res.json({
      message: assistantMessage,
      model: data.model,
      usage: data.usage,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to call OrcaRouter API");
    res.status(500).json({ error: "Failed to reach AI provider" });
  }
});

export default router;
