import type { AppConfig } from './config/env.js';
import type { GithubClient } from './modules/github/github.client.js';

/** Everything with side effects that the app needs, passed in explicitly (real in server.ts, fakes in tests). */
export type AppDeps = Readonly<{
  config: AppConfig;
  github: GithubClient;
}>;
