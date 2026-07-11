import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import teamRouter from "./team";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import productsRouter from "./products";
import quotesRouter from "./quotes";
import tasksRouter from "./tasks";
import notificationsRouter from "./notifications";
import companyRouter from "./company";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(teamRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(productsRouter);
router.use(quotesRouter);
router.use(tasksRouter);
router.use(notificationsRouter);
router.use(companyRouter);
router.use(storageRouter);

export default router;
