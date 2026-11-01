import mongoose from 'mongoose';
import { vi } from 'vitest';
import type { AppDeps } from '../app-deps.js';
import { createApp } from '../app.js';
import type { AppConfig } from '../config/env.js';
import { encryptSecret } from '../lib/crypto.js';
import { SESSION_COOKIE, signSession } from '../modules/auth/session.js';
import type { CopilotModel } from '../modules/copilot/copilot.model.js';
import type { GithubClient } from '../modules/github/github.client.js';
import { UserModel } from '../modules/users/user.model.js';

export const testConfig: AppConfig = {
  env: 'test',
  port: 0,
  mongoUrl: process.env.MONGO_URL_TEST ?? 'mongodb://127.0.0.1:27017/zaps_test',
  clientUrl: 'http://localhost:4200',
  publicUrl: 'https://hooks.example.test',
  github: { clientId: 'cid', clientSecret: 'csecret', webhookSecret: 'test-webhook-secret-123456' },
  jwtSecret: 'test-jwt-secret-that-is-at-least-32-chars',
  tokenEncryptionKey: Buffer.alloc(32, 7),
  anthropicApiKey: undefined,
};

export const TEST_REPO = { id: 101, fullName: 'octo/demo' } as const;

/** A GitHub fake: every method is a vi.fn so tests can assert calls and override behaviour. */
export const fakeGithub = () => {
  let commentId = 1;
  return {
    exchangeCode: vi.fn(async () => ({ accessToken: 'gho_test', scopes: ['repo'] })),
    getUser: vi.fn(async () => ({ id: 1, login: 'octo', name: 'Octo', avatarUrl: 'https://avatars.test/1' })),
    listAdminRepos: vi.fn(async () => [{ ...TEST_REPO, private: false }]),
    getRepo: vi.fn(async (_t: string, fullName: string) => ({ id: TEST_REPO.id, fullName, private: false, isAdmin: true })),
    createWebhook: vi.fn(async () => ({ id: 555 })),
    findWebhookByUrl: vi.fn(async () => undefined),
    deleteWebhook: vi.fn(async () => undefined),
    createIssueComment: vi.fn(async (_t: string, repo: string, n: number) => {
      const id = commentId++;
      return { id, htmlUrl: `https://github.com/${repo}/pull/${n}#issuecomment-${id}` };
    }),
  } satisfies GithubClient;
};

export const buildTestApp = (github: GithubClient = fakeGithub(), copilot?: CopilotModel) => {
  const deps: AppDeps = { config: testConfig, github, copilot };
  return { app: createApp(deps), deps, github };
};

export const connectTestDb = async () => {
  await mongoose.connect(testConfig.mongoUrl);
  await mongoose.connection.dropDatabase(); // isolated test database only
  await mongoose.syncIndexes();
};

export const clearTestDb = async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
};

export const disconnectTestDb = async () => {
  await mongoose.disconnect();
};

/** Creates a user and returns a Cookie header value for an authenticated request. */
export const signedInUser = async (githubId = 1, login = 'octo') => {
  const user = await UserModel.create({
    githubId,
    login,
    avatarUrl: 'https://avatars.test/1',
    accessTokenEnc: encryptSecret(`token-${login}`, testConfig.tokenEncryptionKey),
  });
  const cookie = `${SESSION_COOKIE}=${signSession(user.id as string, testConfig.jwtSecret)}`;
  return { userId: user.id as string, cookie };
};

export const validZapBody = (overrides: Record<string, unknown> = {}) => ({
  name: 'Thank PR authors',
  enabled: false,
  trigger: { app: 'github', event: 'pull_request.opened', repo: TEST_REPO },
  action: { app: 'github', type: 'pull_request.comment', body: 'Thanks @{{pr.author}} for "{{pr.title}}"!' },
  ...overrides,
});
