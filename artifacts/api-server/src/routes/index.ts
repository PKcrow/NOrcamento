import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import teamRouter from "./team";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import productsRouter from "./products";
import serviceTemplatesRouter from "./serviceTemplates";
import quotesRouter from "./quotes";
import tasksRouter from "./tasks";
import notificationsRouter from "./notifications";
import companyRouter from "./company";
import reportsRouter from "./reports";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(teamRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(productsRouter);
router.use(serviceTemplatesRouter);
router.use(quotesRouter);
router.use(tasksRouter);
router.use(notificationsRouter);
router.use(companyRouter);
router.use(reportsRouter);
router.use(storageRouter);

export default router;
