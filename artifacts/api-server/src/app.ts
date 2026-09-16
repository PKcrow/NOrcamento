import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.replit.app` : null,
  process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}--auth.repl.co` : null,
  process.env.REPLIT_EXPO_DEV_DOMAIN
    ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`
    : null,
].filter((origin): origin is string => Boolean(origin));

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin || allowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "::1")
    ) || (
      url.protocol === "https:" &&
      /\.expo\..*\.replit\.dev$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS não permitido'));
    }
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

// Global error handler — catches unhandled errors from async route handlers
// and prevents HTTP requests from hanging indefinitely.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error({ err }, "unhandled error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  },
);

export default app;
