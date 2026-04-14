import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './domains/health/health.routes.js';
import { eventBus } from './domains/core/events/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Domain subscribers ------------------------------------------------------
// Each domain registers event subscribers at bootstrap. Branch 1 has no
// subscribers yet; this block is the landing spot for Branch 2+ so wiring
// stays in one obvious place instead of scattering across domain imports.
// e.g.:
//   registerOnboardingSubscribers(eventBus);
//   registerNotificationSubscribers(eventBus);
//   registerAnalyticsSubscribers(eventBus);
void eventBus;

// ---- Routes -----------------------------------------------------------------
app.use('/api/v1/health', healthRouter);

// 404 + error handler (order matters)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] ${env.APP_NAME} listening on http://localhost:${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[api] env=${env.NODE_ENV} frontend=${env.FRONTEND_URL}`);
});
