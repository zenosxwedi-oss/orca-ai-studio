import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/config/status", (_req, res) => {
  res.json({
    apiKeyConfigured: !!process.env.OPENAI_API_KEY,
  });
});

export default router;
