import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { decryptSecret } from '../../lib/crypto.js';
import { UserModel } from '../users/user.model.js';
import { OAUTH_STATE_COOKIE, SESSION_COOKIE } from './session.js';
import { buildTestApp, clearTestDb, connectTestDb, disconnectTestDb, testConfig } from '../../test/helpers.js';

describe('GitHub OAuth', () => {
  beforeAll(connectTestDb);
  afterAll(disconnectTestDb);
  beforeEach(clearTestDb);

  it('redirects to GitHub with a state cookie', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/auth/github');
    expect(res.status).toBe(302);
    const location = new URL(res.headers.location as string);
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(location.searchParams.get('redirect_uri')).toBe('http://localhost:4200/auth/github/callback');
    expect(String(res.headers['set-cookie'])).toContain(`${OAUTH_STATE_COOKIE}=${location.searchParams.get('state')}`);
  });

  it('rejects a callback whose state does not match (CSRF)', async () => {
    const { app, github } = buildTestApp();
    const res = await request(app).get('/auth/github/callback?code=abc&state=evil').set('Cookie', `${OAUTH_STATE_COOKIE}=good`);
    expect(res.headers.location).toBe('http://localhost:4200/login?error=invalid_state');
    expect(github.exchangeCode).not.toHaveBeenCalled();
  });

  // Same character count, different byte count: used to throw inside timingSafeEqual and return a 500.
  it('rejects a non-ASCII state as a mismatch instead of crashing', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get(`/auth/github/callback?code=abc&state=${encodeURIComponent('é')}`).set('Cookie', `${OAUTH_STATE_COOKIE}=e`);
    expect(res.headers.location).toBe('http://localhost:4200/login?error=invalid_state');
  });

  it('creates the user with an encrypted token, sets a session, and the session works', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/auth/github/callback?code=abc&state=s1').set('Cookie', `${OAUTH_STATE_COOKIE}=s1`);
    expect(res.headers.location).toBe('http://localhost:4200/zaps');

    const user = await UserModel.findOne({ githubId: 1 }).select('+accessTokenEnc');
    expect(user?.accessTokenEnc).not.toContain('gho_test');
    expect(decryptSecret(user!.accessTokenEnc, testConfig.tokenEncryptionKey)).toBe('gho_test');

    const session = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(session).toMatch(/HttpOnly/i);
    const me = await request(app).get('/api/me').set('Cookie', session.split(';')[0]!);
    expect(me.body).toMatchObject({ login: 'octo' });
    expect(me.body).not.toHaveProperty('accessTokenEnc');
  });

  it('logging in twice updates the same user (idempotent upsert)', async () => {
    const { app } = buildTestApp();
    for (const s of ['a', 'b']) {
      await request(app).get(`/auth/github/callback?code=c&state=${s}`).set('Cookie', `${OAUTH_STATE_COOKIE}=${s}`);
    }
    expect(await UserModel.countDocuments()).toBe(1);
  });
});
