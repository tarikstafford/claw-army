import 'dotenv/config';
import { buildApp } from './app';

const app = await buildApp();
const port = Number(process.env['PORT'] ?? 3002);

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[tool-gateway] Listening on port ${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
