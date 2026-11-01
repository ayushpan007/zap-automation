import type { AppDeps } from '../../app-deps.js';
import { isDuplicateKeyError } from '../../lib/mongo-errors.js';
import { renderTemplate } from '../../lib/template.js';
import { getUserToken } from '../auth/auth.service.js';
import { RunModel } from '../runs/run.model.js';
import { ZapModel, type ZapDoc } from '../zaps/zap.model.js';
import { eventKeyFor, toTemplateContext, type PullRequestEvent } from './pull-request.event.js';

type RunOutcome = 'succeeded' | 'failed' | 'duplicate';
export type DeliverySummary = Readonly<{ matched: number; succeeded: number; failed: number; duplicate: number }>;

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err)).slice(0, 500);

/**
 * Run one Zap for one event. Inserting the run first is the idempotency lock: the unique
 * (zapId, eventKey) index means a redelivered webhook cannot produce a second comment.
 */
const runZap = async (deps: AppDeps, zap: ZapDoc, event: PullRequestEvent, deliveryId: string): Promise<RunOutcome> => {
  const pr = event.pull_request;
  let runId;
  try {
    const run = await RunModel.create({
      zapId: zap._id,
      userId: zap.userId,
      eventKey: eventKeyFor(event),
      deliveryId,
      status: 'running',
      pullRequest: { number: pr.number, title: pr.title, url: pr.html_url },
    });
    runId = run._id;
  } catch (err) {
    if (isDuplicateKeyError(err)) return 'duplicate';
    throw err;
  }

  try {
    const token = await getUserToken(deps.config, zap.userId.toString());
    const body = renderTemplate(zap.action.body, toTemplateContext(event));
    const comment = await deps.github.createIssueComment(token, event.repository.full_name, pr.number, body);
    await RunModel.updateOne({ _id: runId }, { status: 'succeeded', commentUrl: comment.htmlUrl });
    return 'succeeded';
  } catch (err) {
    // Recorded, not swallowed: the failure is visible in the Zap's run history.
    console.error(`[webhook] zap ${zap.id} failed on ${event.repository.full_name}#${pr.number}`, err);
    await RunModel.updateOne({ _id: runId }, { status: 'failed', error: errorMessage(err) });
    return 'failed';
  }
};

const countOutcomes = (outcomes: readonly RunOutcome[]): DeliverySummary => ({
  matched: outcomes.length,
  succeeded: outcomes.filter((o) => o === 'succeeded').length,
  failed: outcomes.filter((o) => o === 'failed').length,
  duplicate: outcomes.filter((o) => o === 'duplicate').length,
});

export const handlePullRequestOpened = async (
  deps: AppDeps,
  event: PullRequestEvent,
  deliveryId: string,
): Promise<DeliverySummary> => {
  const zaps = await ZapModel.find({
    'trigger.repo.id': event.repository.id,
    'trigger.event': 'pull_request.opened',
    enabled: true,
  });
  // Zaps are independent: one user's revoked token must not stop another user's Zap.
  const outcomes = await Promise.all(zaps.map((zap) => runZap(deps, zap, event, deliveryId)));
  return countOutcomes(outcomes);
};
