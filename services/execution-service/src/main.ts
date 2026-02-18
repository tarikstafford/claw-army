import 'dotenv/config';
import { buildApp } from './app';

const app = buildApp();
const port = Number(process.env['PORT'] ?? 3001);

try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
