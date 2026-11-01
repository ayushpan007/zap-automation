import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZapModel } from '../zaps/zap.model.js';
import { TEST_REPO, buildTestApp, clearTestDb, connectTestDb, disconnectTestDb, fakeGithub, signedInUser } from '../../test/helpers.js';
import type { CopilotModel } from './copilot.model.js';
import { COPILOT_SYSTEM_PROMPT, copilotOutputSchema, copilotUserMessage, type CopilotOutput } from './copilot.prompt.js';
import { toZapDraft } from './copilot.service.js';

const output = (overrides: Partial<CopilotOutput> = {}): CopilotOutput => ({
  supported: true,
  explanation: 'Thanks the author on every new PR.',
  name: 'Thank PR authors',
  commentBody: 'Thanks @{{pr.author}} for "{{pr.title}}"!',
  repoFullName: null,
  ...overrides,
});

const fakeCopilot = (out: CopilotOutput = output()) => ({ draft: vi.fn(async () => out) }) satisfies CopilotModel;

describe('copilot prompt', () => {
  it('lists every trigger field and keeps the user text inside a delimited block', () => {
    expect(COPILOT_SYSTEM_PROMPT).toContain('{{pr.title}}');
    expect(COPILOT_SYSTEM_PROMPT).toContain('{{repo.fullName}}');
    const msg = copilotUserMessage('comment thanks', ['octo/demo']);
    expect(msg).toContain('octo/demo');
    expect(msg).toMatch(/<description>\ncomment thanks\n<\/description>/);
  });

  it('builds a structured-output JSON schema the API accepts (all fields required, no extras)', () => {
    const format = betaZodOutputFormat(copilotOutputSchema) as unknown as { schema: { required: string[]; additionalProperties: boolean } };
    expect(format.schema.required).toEqual(['supported', 'explanation', 'name', 'commentBody', 'repoFullName']);
    expect(format.schema.additionalProperties).toBe(false);
  });
});

describe('toZapDraft (model output is untrusted)', () => {
  const repos = [{ ...TEST_REPO, private: false }];

  it('keeps a valid draft and resolves the repo only from the admin list', () => {
    const draft = toZapDraft(output({ repoFullName: 'OCTO/demo' }), repos);
    expect(draft).toEqual({
      name: 'Thank PR authors',
      body: 'Thanks @{{pr.author}} for "{{pr.title}}"!',
      repo: { id: TEST_REPO.id, fullName: TEST_REPO.fullName },
      explanation: 'Thanks the author on every new PR.',
    });
    expect(toZapDraft(output({ repoFullName: 'someone/else' }), repos).repo).toBeNull();
  });

  it('turns an unsupported request into a 400 with the model explanation', () => {
    expect(() => toZapDraft(output({ supported: false, explanation: 'Slack is not available yet.' }), repos)).toThrow('Slack is not available yet.');
  });

  it('rejects invented tokens and empty comments', () => {
    expect(() => toZapDraft(output({ commentBody: 'Hi {{pr.secret}}' }), repos)).toThrow('invalid comment');
    expect(() => toZapDraft(output({ commentBody: '   ' }), repos)).toThrow('invalid comment');
  });

  it('caps the name and falls back when it is blank', () => {
    expect(toZapDraft(output({ name: 'x'.repeat(150) }), repos).name).toHaveLength(100);
    expect(toZapDraft(output({ name: '  ' }), repos).name).toBe('Copilot draft');
  });
});

describe('POST /api/copilot/draft', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it('requires a session', async () => {
    const { app } = buildTestApp(fakeGithub(), fakeCopilot());
    const res = await request(app).post('/api/copilot/draft').send({ text: 'comment thanks' });
    expect(res.status).toBe(401);
  });

  it('answers 503 when Copilot is not configured', async () => {
    const { app } = buildTestApp();
    const { cookie } = await signedInUser();
    const res = await request(app).post('/api/copilot/draft').set('Cookie', cookie).send({ text: 'comment thanks' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('NOT_CONFIGURED');
  });

  it('validates the description', async () => {
    const copilot = fakeCopilot();
    const { app } = buildTestApp(fakeGithub(), copilot);
    const { cookie } = await signedInUser();
    const res = await request(app).post('/api/copilot/draft').set('Cookie', cookie).send({ text: 'x'.repeat(501) });
    expect(res.status).toBe(400);
    expect(copilot.draft).not.toHaveBeenCalled();
  });

  it('returns a draft built from the user text and their admin repos, and saves nothing', async () => {
    const copilot = fakeCopilot(output({ repoFullName: TEST_REPO.fullName }));
    const { app } = buildTestApp(fakeGithub(), copilot);
    const { cookie } = await signedInUser();

    const res = await request(app)
      .post('/api/copilot/draft')
      .set('Cookie', cookie)
      .send({ text: '  When a PR is opened on octo/demo, comment thanks  ' });

    expect(res.status).toBe(200);
    expect(res.body.repo).toEqual({ id: TEST_REPO.id, fullName: TEST_REPO.fullName });
    expect(res.body.body).toBe('Thanks @{{pr.author}} for "{{pr.title}}"!');
    expect(copilot.draft).toHaveBeenCalledWith({ request: 'When a PR is opened on octo/demo, comment thanks', repos: [TEST_REPO.fullName] });
    expect(await ZapModel.countDocuments()).toBe(0);
  });

  it('explains unsupported requests', async () => {
    const { app } = buildTestApp(fakeGithub(), fakeCopilot(output({ supported: false, explanation: 'Posting to Slack is not available yet.' })));
    const { cookie } = await signedInUser();
    const res = await request(app).post('/api/copilot/draft').set('Cookie', cookie).send({ text: 'post to slack when a PR opens' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Posting to Slack is not available yet.');
  });
});
