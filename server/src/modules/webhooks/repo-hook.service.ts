import type { AppDeps } from '../../app-deps.js';
import { AppError } from '../../errors/app-error.js';
import { isDuplicateKeyError } from '../../lib/mongo-errors.js';
import { getUserToken } from '../auth/auth.service.js';
import { GithubApiError } from '../github/github.client.js';
import { ZapModel } from '../zaps/zap.model.js';
import { RepoHookModel } from './repo-hook.model.js';

export const webhookUrl = (publicUrl: string): string => `${publicUrl}/webhooks/github`;

type RepoRef = Readonly<{ id: number; fullName: string }>;

/**
 * Before a Zap may listen on a repo, prove the user administers it. Without this, a user could
 * submit someone else's repo id, piggy-back on an existing hook, and read that repo's PR titles in run logs.
 */
export const assertRepoAdmin = async ({ github }: AppDeps, token: string, repo: RepoRef): Promise<void> => {
  const actual = await github.getRepo(token, repo.fullName).catch((err: unknown) => {
    if (err instanceof GithubApiError && (err.upstreamStatus === 404 || err.upstreamStatus === 403)) {
      throw new AppError('FORBIDDEN', `You don't have access to ${repo.fullName}`);
    }
    throw err;
  });
  if (actual.id !== repo.id) throw new AppError('VALIDATION_FAILED', 'Repository id does not match its name');
  if (!actual.isAdmin) throw new AppError('FORBIDDEN', `You need admin access to ${repo.fullName} to add a webhook`);
};

/** Idempotent: ensures exactly one GitHub webhook exists for the repo and is recorded. */
export const ensureRepoHook = async (deps: AppDeps, userId: string, token: string, repo: RepoRef): Promise<void> => {
  if (await RepoHookModel.exists({ repoId: repo.id })) return;

  const url = webhookUrl(deps.config.publicUrl);
  const hook = await deps.github
    .createWebhook(token, repo.fullName, url, deps.config.github.webhookSecret)
    .catch(async (err: unknown) => {
      // 422 = a hook with this URL already exists (e.g. left over from an earlier run). Adopt it.
      if (err instanceof GithubApiError && err.upstreamStatus === 422) {
        const existing = await deps.github.findWebhookByUrl(token, repo.fullName, url);
        if (existing) return existing;
      }
      throw err;
    });

  try {
    await RepoHookModel.create({ repoId: repo.id, repoFullName: repo.fullName, hookId: hook.id, createdBy: userId });
  } catch (err) {
    // Another request registered the same repo concurrently; the unique index kept one record. That's fine.
    if (!isDuplicateKeyError(err)) throw err;
  }
};

/**
 * Removes the repo's webhook once no enabled Zap listens on it. Best effort on GitHub's side:
 * a leftover hook only causes ignored deliveries, and ensureRepoHook will adopt it later.
 */
export const releaseRepoHookIfUnused = async (deps: AppDeps, repoId: number): Promise<void> => {
  if (await ZapModel.exists({ 'trigger.repo.id': repoId, enabled: true })) return;
  const record = await RepoHookModel.findOneAndDelete({ repoId });
  if (!record) return;
  try {
    const token = await getUserToken(deps.config, record.createdBy.toString());
    await deps.github.deleteWebhook(token, record.repoFullName, record.hookId);
  } catch (err) {
    console.warn(`[hooks] could not delete webhook ${record.hookId} on ${record.repoFullName}`, err);
  }
};
