import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.routes.js';
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

// Routes
app.use('/api/v1/health', healthRouter);

// 404 + error handler (order matters: notFound before errorHandler)
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] ${env.APP_NAME} listening on http://localhost:${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[api] env=${env.NODE_ENV} frontend=${env.FRONTEND_URL}`);
});
