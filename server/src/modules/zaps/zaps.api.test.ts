import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GithubApiError } from '../github/github.client.js';
import { RepoHookModel } from '../webhooks/repo-hook.model.js';
import {
  TEST_REPO,
  buildTestApp,
  clearTestDb,
  connectTestDb,
  disconnectTestDb,
  fakeGithub,
  signedInUser,
  validZapBody,
} from '../../test/helpers.js';

describe('/api/zaps', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it('rejects requests without a session', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/api/zaps');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('creates a disabled Zap without touching GitHub', async () => {
    const { app, github } = buildTestApp();
    const { cookie } = await signedInUser();
    const res = await request(app).post('/api/zaps').set('Cookie', cookie).send(validZapBody());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Thank PR authors', enabled: false, trigger: { repo: TEST_REPO } });
    expect(github.createWebhook).not.toHaveBeenCalled();
  });

  it('validates the body, including unknown template fields', async () => {
    const { app } = buildTestApp();
    const { cookie } = await signedInUser();
    const bad = validZapBody({ action: { app: 'github', type: 'pull_request.comment', body: 'Hi {{pr.secret}}' } });
    const res = await request(app).post('/api/zaps').set('Cookie', cookie).send(bad);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('{{pr.secret}}');

    const unsupported = await request(app).post('/api/zaps').set('Cookie', cookie).send(validZapBody({ trigger: { app: 'slack', event: 'x', repo: TEST_REPO } }));
    expect(unsupported.status).toBe(400);
  });

  it('only lists and returns the signed-in user’s Zaps', async () => {
    const { app } = buildTestApp();
    const alice = await signedInUser(1, 'alice');
    const bob = await signedInUser(2, 'bob');
    const created = await request(app).post('/api/zaps').set('Cookie', alice.cookie).send(validZapBody());

    const bobList = await request(app).get('/api/zaps').set('Cookie', bob.cookie);
    expect(bobList.body.zaps).toEqual([]);
    const bobGet = await request(app).get(`/api/zaps/${created.body.id}`).set('Cookie', bob.cookie);
    expect(bobGet.status).toBe(404);
    const bobPatch = await request(app).patch(`/api/zaps/${created.body.id}`).set('Cookie', bob.cookie).send({ name: 'mine now' });
    expect(bobPatch.status).toBe(404);

    const aliceList = await request(app).get('/api/zaps').set('Cookie', alice.cookie);
    expect(aliceList.body.zaps).toHaveLength(1);
  });

  it('enabling registers one webhook per repo; disabling the last Zap removes it', async () => {
    const { app, github } = buildTestApp();
    const { cookie } = await signedInUser();
    const a = await request(app).post('/api/zaps').set('Cookie', cookie).send(validZapBody({ enabled: true }));
    const b = await request(app).post('/api/zaps').set('Cookie', cookie).send(validZapBody({ name: 'Second', enabled: true }));
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(github.createWebhook).toHaveBeenCalledTimes(1);
    expect(github.createWebhook).toHaveBeenCalledWith('token-octo', TEST_REPO.fullName, 'https://hooks.example.test/webhooks/github', expect.any(String));

    await request(app).patch(`/api/zaps/${a.body.id}`).set('Cookie', cookie).send({ enabled: false });
    expect(github.deleteWebhook).not.toHaveBeenCalled(); // b still listens
    await request(app).patch(`/api/zaps/${b.body.id}`).set('Cookie', cookie).send({ enabled: false });
    expect(github.deleteWebhook).toHaveBeenCalledWith('token-octo', TEST_REPO.fullName, 555);
    expect(await RepoHookModel.countDocuments()).toBe(0);
  });

  it('refuses to enable a Zap on a repo the user does not administer', async () => {
    const github = fakeGithub();
    github.getRepo.mockResolvedValueOnce({ ...TEST_REPO, private: false, isAdmin: false });
    const { app } = buildTestApp(github);
    const { cookie } = await signedInUser();
    const res = await request(app).post('/api/zaps').set('Cookie', cookie).send(validZapBody({ enabled: true }));
    expect(res.status).toBe(403);
    expect(github.createWebhook).not.toHaveBeenCalled();
  });

  it('adopts an existing hook when GitHub says it already exists', async () => {
    const github = fakeGithub();
    github.createWebhook.mockRejectedValueOnce(new GithubApiError(422, 'Hook already exists'));
    github.findWebhookByUrl.mockResolvedValueOnce({ id: 777 });
    const { app } = buildTestApp(github);
    const { cookie } = await signedInUser();
    const res = await request(app).post('/api/zaps').set('Cookie', cookie).send(validZapBody({ enabled: true }));
    expect(res.status).toBe(201);
    expect((await RepoHookModel.findOne())?.hookId).toBe(777);
  });

  it('rejects a patch whose new body references unknown fields', async () => {
    const { app } = buildTestApp();
    const { cookie } = await signedInUser();
    const created = await request(app).post('/api/zaps').set('Cookie', cookie).send(validZapBody());
    const res = await request(app)
      .patch(`/api/zaps/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ action: { app: 'github', type: 'pull_request.comment', body: '{{nope}}' } });
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed id', async () => {
    const { app } = buildTestApp();
    const { cookie } = await signedInUser();
    expect((await request(app).get('/api/zaps/not-an-id').set('Cookie', cookie)).status).toBe(400);
  });
});
