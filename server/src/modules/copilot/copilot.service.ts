import type { AppDeps } from '../../app-deps.js';
import { AppError } from '../../errors/app-error.js';
import { getUserToken } from '../auth/auth.service.js';
import type { GithubRepo } from '../github/github.client.js';
import { templateProblem } from '../zaps/zap.schema.js';
import type { CopilotOutput } from './copilot.prompt.js';

/** What the editor receives. Never saved here: the user reviews it, picks a repo, and saves it (off). */
export type ZapDraftDto = Readonly<{
  name: string;
  body: string;
  repo: { id: number; fullName: string } | null;
  explanation: string;
}>;

const MAX_NAME = 100;

/**
 * Pure: turns model output into a draft the rest of the app can trust. The model's output is
 * untrusted like any input: unsupported requests become a clear error, unknown {{tokens}} are
 * rejected with the same rule the Zap API uses, and the repo must be one the user administers.
 */
export const toZapDraft = (out: CopilotOutput, adminRepos: readonly GithubRepo[]): ZapDraftDto => {
  if (!out.supported) throw new AppError('BAD_REQUEST', out.explanation || 'That Zap needs a trigger or action that is not available yet.');

  const body = out.commentBody.trim();
  const problem = templateProblem({ trigger: { app: 'github', event: 'pull_request.opened' }, action: { body } });
  if (!body || problem) {
    throw new AppError('UPSTREAM_FAILED', 'Copilot drafted an invalid comment. Try rephrasing your description.');
  }

  const match = adminRepos.find((r) => r.fullName.toLowerCase() === out.repoFullName?.toLowerCase());
  return {
    name: out.name.trim().slice(0, MAX_NAME) || 'Copilot draft',
    body,
    repo: match ? { id: match.id, fullName: match.fullName } : null,
    explanation: out.explanation,
  };
};

export const draftZap = async (deps: AppDeps, userId: string, request: string): Promise<ZapDraftDto> => {
  if (!deps.copilot) throw new AppError('NOT_CONFIGURED', 'Copilot is not set up on this server (ANTHROPIC_API_KEY is missing).');

  const token = await getUserToken(deps.config, userId);
  const repos = await deps.github.listAdminRepos(token);
  const out = await deps.copilot.draft({ request, repos: repos.map((r) => r.fullName) });
  return toZapDraft(out, repos);
};
