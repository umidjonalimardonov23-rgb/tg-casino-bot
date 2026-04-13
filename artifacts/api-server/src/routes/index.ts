import { Router, type IRouter } from "express";
import healthRouter from "./health";
import playersRouter from "./players";
import gameRouter from "./game";
import spinRouter from "./spin";
import promoRouter from "./promo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(playersRouter);
router.use(gameRouter);
router.use(spinRouter);
router.use(promoRouter);

export default router;
