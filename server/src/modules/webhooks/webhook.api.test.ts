import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RunModel } from '../runs/run.model.js';
import { ZapModel } from '../zaps/zap.model.js';
import { signPayload } from './webhook.signature.js';
import {
  TEST_REPO,
  buildTestApp,
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
  fakeGithub,
  signedInUser,
  testConfig,
  validZapBody,
} from '../../test/helpers.js';

const prOpened = (overrides: { action?: string; prId?: number } = {}) => ({
  action: overrides.action ?? 'opened',
  pull_request: {
    id: overrides.prId ?? 9001,
    number: 7,
    title: 'Add dark mode',
    html_url: `https://github.com/${TEST_REPO.fullName}/pull/7`,
    user: { login: 'contributor' },
    base: { ref: 'main' },
    head: { ref: 'feat/dark' },
  },
  repository: { id: TEST_REPO.id, full_name: TEST_REPO.fullName },
});

const deliver = (app: Parameters<typeof request>[0], payload: unknown, opts: { event?: string; delivery?: string; secret?: string } = {}) => {
  const json = JSON.stringify(payload);
  const body = Buffer.from(json);
  return request(app)
    .post('/webhooks/github')
    .set('Content-Type', 'application/json')
    .set('X-GitHub-Event', opts.event ?? 'pull_request')
    .set('X-GitHub-Delivery', opts.delivery ?? 'delivery-1')
    .set('X-Hub-Signature-256', signPayload(body, opts.secret ?? testConfig.github.webhookSecret))
    .send(json); // a string, not a Buffer: superagent would JSON-encode a Buffer with a JSON content type
};

const createZap = async (userId: string, enabled = true, body?: string) =>
  ZapModel.create({ ...validZapBody({ enabled }), userId, ...(body ? { action: { app: 'github', type: 'pull_request.comment', body } } : {}) });

describe('POST /webhooks/github', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it('rejects deliveries with a bad signature', async () => {
    const { app, github } = buildTestApp();
    const res = await deliver(app, prOpened(), { secret: 'wrong-secret-wrong-secret' });
    expect(res.status).toBe(401);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it('comments on the PR with mapped fields and records a run', async () => {
    const { app, github } = buildTestApp();
    const { userId } = await signedInUser();
    const zap = await createZap(userId, true, 'Thanks @{{pr.author}} for "{{pr.title}}" into {{pr.base}}');

    const res = await deliver(app, prOpened());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ matched: 1, succeeded: 1, failed: 0, duplicate: 0 });
    expect(github.createIssueComment).toHaveBeenCalledWith('token-octo', TEST_REPO.fullName, 7, 'Thanks @contributor for "Add dark mode" into main');

    const run = await RunModel.findOne({ zapId: zap._id });
    expect(run?.status).toBe('succeeded');
    expect(run?.commentUrl).toContain('#issuecomment-');
  });

  it('does not comment twice when GitHub redelivers the same event', async () => {
    const { app, github } = buildTestApp();
    const { userId } = await signedInUser();
    await createZap(userId);
    await deliver(app, prOpened(), { delivery: 'a' });
    const again = await deliver(app, prOpened(), { delivery: 'b' });
    expect(again.body).toMatchObject({ matched: 1, succeeded: 0, duplicate: 1 });
    expect(github.createIssueComment).toHaveBeenCalledTimes(1);
  });

  it('ignores disabled Zaps and non-"opened" actions', async () => {
    const { app, github } = buildTestApp();
    const { userId } = await signedInUser();
    await createZap(userId, false);
    expect((await deliver(app, prOpened())).body.matched).toBe(0);

    await createZap(userId, true);
    const closed = await deliver(app, prOpened({ action: 'closed' }));
    expect(closed.status).toBe(202);
    expect(github.createIssueComment).not.toHaveBeenCalled();
  });

  it('answers GitHub’s ping', async () => {
    const { app } = buildTestApp();
    expect((await deliver(app, { zen: 'hi' }, { event: 'ping' })).body).toEqual({ ok: true });
  });

  it('records a failed run when GitHub rejects the comment, without failing other Zaps', async () => {
    const github = fakeGithub();
    github.createIssueComment.mockRejectedValueOnce(new Error('Bad credentials'));
    const { app } = buildTestApp(github);
    const alice = await signedInUser(1, 'alice');
    const bob = await signedInUser(2, 'bob');
    await createZap(alice.userId);
    await createZap(bob.userId);

    const res = await deliver(app, prOpened());
    expect(res.body).toMatchObject({ matched: 2, succeeded: 1, failed: 1 });
    expect(await RunModel.countDocuments({ status: 'failed', error: 'Bad credentials' })).toBe(1);
  });
});
