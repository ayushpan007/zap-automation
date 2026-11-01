import { AppError } from '../../errors/app-error.js';

/**
 * Thin wrapper over the GitHub REST API using Node's built-in fetch.
 * This is the side-effect boundary for GitHub: everything else receives a `GithubClient`
 * as a parameter, which is how tests swap in a fake without mocking modules.
 */
export type GithubUser = Readonly<{ id: number; login: string; name: string | null; avatarUrl: string }>;
export type GithubRepo = Readonly<{ id: number; fullName: string; private: boolean }>;
export type GithubComment = Readonly<{ id: number; htmlUrl: string }>;

export type GithubClient = Readonly<{
  exchangeCode: (code: string, redirectUri: string) => Promise<{ accessToken: string; scopes: string[] }>;
  getUser: (token: string) => Promise<GithubUser>;
  listAdminRepos: (token: string) => Promise<GithubRepo[]>;
  /** The repo as the token's owner sees it, including whether they are an admin. */
  getRepo: (token: string, repoFullName: string) => Promise<GithubRepo & { isAdmin: boolean }>;
  createWebhook: (token: string, repoFullName: string, url: string, secret: string) => Promise<{ id: number }>;
  findWebhookByUrl: (token: string, repoFullName: string, url: string) => Promise<{ id: number } | undefined>;
  deleteWebhook: (token: string, repoFullName: string, hookId: number) => Promise<void>;
  createIssueComment: (token: string, repoFullName: string, issueNumber: number, body: string) => Promise<GithubComment>;
}>;

export class GithubApiError extends AppError {
  constructor(
    readonly upstreamStatus: number,
    message: string,
  ) {
    super('UPSTREAM_FAILED', message);
    this.name = 'GithubApiError';
  }
}

type RawRepo = { id: number; full_name: string; private: boolean; permissions?: { admin?: boolean } };

// Pure mappers from GitHub's snake_case payloads to our API types.
export const toGithubRepo = (r: RawRepo): GithubRepo => ({ id: r.id, fullName: r.full_name, private: r.private });
export const isAdminRepo = (r: RawRepo): boolean => r.permissions?.admin === true;

export const createGithubClient = (opts: { clientId: string; clientSecret: string; timeoutMs?: number }): GithubClient => {
  const timeoutMs = opts.timeoutMs ?? 8000;

  const request = async <T>(token: string | null, path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`https://api.github.com${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'zap-automation',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new GithubApiError(res.status, `GitHub ${init.method ?? 'GET'} ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  };

  return {
    exchangeCode: async (code, redirectUri) => {
      const res = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: opts.clientId, client_secret: opts.clientSecret, code, redirect_uri: redirectUri }),
      });
      // GitHub returns 200 with an `error` field for bad codes, so check both.
      const data = (await res.json()) as { access_token?: string; scope?: string; error?: string };
      if (!res.ok || !data.access_token) {
        throw new GithubApiError(res.status, `OAuth code exchange failed: ${data.error ?? res.status}`);
      }
      return { accessToken: data.access_token, scopes: (data.scope ?? '').split(',').filter(Boolean) };
    },

    getUser: async (token) => {
      const u = await request<{ id: number; login: string; name: string | null; avatar_url: string }>(token, '/user');
      return { id: u.id, login: u.login, name: u.name, avatarUrl: u.avatar_url };
    },

    // Webhooks need admin rights on the repo, so only offer repos where the user has them.
    listAdminRepos: async (token) => {
      const repos = await request<RawRepo[]>(token, '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member');
      return repos.filter(isAdminRepo).map(toGithubRepo);
    },

    getRepo: async (token, repoFullName) => {
      const r = await request<RawRepo>(token, `/repos/${repoFullName}`);
      return { ...toGithubRepo(r), isAdmin: isAdminRepo(r) };
    },

    createWebhook: async (token, repoFullName, url, secret) =>
      request<{ id: number }>(token, `/repos/${repoFullName}/hooks`, {
        method: 'POST',
        body: JSON.stringify({ name: 'web', active: true, events: ['pull_request'], config: { url, secret, content_type: 'json', insecure_ssl: '0' } }),
      }).then((h) => ({ id: h.id })),

    findWebhookByUrl: async (token, repoFullName, url) => {
      const hooks = await request<{ id: number; config: { url?: string } }[]>(token, `/repos/${repoFullName}/hooks?per_page=100`);
      const match = hooks.find((h) => h.config.url === url);
      return match ? { id: match.id } : undefined;
    },

    deleteWebhook: async (token, repoFullName, hookId) => {
      await request<void>(token, `/repos/${repoFullName}/hooks/${hookId}`, { method: 'DELETE' });
    },

    // A PR is an issue in GitHub's API, so PR conversation comments use the issues endpoint.
    createIssueComment: async (token, repoFullName, issueNumber, body) => {
      const c = await request<{ id: number; html_url: string }>(token, `/repos/${repoFullName}/issues/${issueNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      return { id: c.id, htmlUrl: c.html_url };
    },
  };
};
