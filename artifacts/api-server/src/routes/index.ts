import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import imagesRouter from "./images";
import videosRouter from "./videos";
import filesRouter from "./files";
import githubRouter from "./github";
import dashboardRouter from "./dashboard";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(imagesRouter);
router.use(videosRouter);
router.use(filesRouter);
router.use(githubRouter);
router.use(dashboardRouter);
router.use(configRouter);

export default router;
