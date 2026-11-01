import mongoose from 'mongoose';
import { createApp } from './app.js';
import { parseConfig } from './config/env.js';
import { createGithubClient } from './modules/github/github.client.js';
import { webhookUrl } from './modules/webhooks/repo-hook.service.js';

/** Process entry point: the only place that reads process.env, connects to Mongo, and listens. */
const main = async () => {
  const config = parseConfig(process.env);
  await mongoose.connect(config.mongoUrl);
  await mongoose.syncIndexes(); // create the indexes declared on the schemas

  const github = createGithubClient({ clientId: config.github.clientId, clientSecret: config.github.clientSecret });
  const app = createApp({ config, github });

  const server = app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
    console.log(`[server] GitHub webhooks will be registered at ${webhookUrl(config.publicUrl)}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
