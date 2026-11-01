import type { AppConfig } from './config/env.js';
import type { CopilotModel } from './modules/copilot/copilot.model.js';
import type { GithubClient } from './modules/github/github.client.js';

/** Everything with side effects that the app needs, passed in explicitly (real in server.ts, fakes in tests). */
export type AppDeps = Readonly<{
  config: AppConfig;
  github: GithubClient;
  /** Undefined when ANTHROPIC_API_KEY isn't set: the app runs, Copilot answers 503. */
  copilot?: CopilotModel;
}>;
