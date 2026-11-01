/**
 * Response/request shapes of the Express API. They mirror the server's DTOs (zap.mapper.ts,
 * catalog.data.ts). These are compile-time only; the server still validates every request at runtime.
 */
export interface User {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string;
}

export interface TriggerField {
  path: string;
  label: string;
  example: string;
}

export interface AppDef {
  key: string;
  name: string;
  category: string;
  available: boolean;
  triggers: { key: string; name: string; description: string; fields: TriggerField[] }[];
  actions: { key: string; name: string; description: string }[];
}

export interface RepoRef {
  id: number;
  fullName: string;
}

export interface Repo extends RepoRef {
  private: boolean;
}

export interface Zap {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { app: string; event: string; repo: RepoRef };
  action: { app: string; type: string; body: string };
  createdAt: string;
  updatedAt: string;
}

export interface ZapInput {
  name: string;
  enabled: boolean;
  trigger: { app: 'github'; event: 'pull_request.opened'; repo: RepoRef };
  action: { app: 'github'; type: 'pull_request.comment'; body: string };
}

export interface Run {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  pullRequest: { number: number; title: string; url: string };
  commentUrl: string | null;
  error: string | null;
  createdAt: string;
}

/** POST /api/copilot/draft. Never saved by the server: the editor shows it for review. */
export interface ZapDraft {
  name: string;
  body: string;
  repo: RepoRef | null;
  explanation: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: { path: string[]; message: string }[] };
}
