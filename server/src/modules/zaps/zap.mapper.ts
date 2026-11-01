import type { Types } from 'mongoose';

/** The API shape of a Zap. Never expose raw Mongoose documents (internal fields, __v, ObjectIds). */
export type ZapDto = Readonly<{
  id: string;
  name: string;
  enabled: boolean;
  trigger: { app: string; event: string; repo: { id: number; fullName: string } };
  action: { app: string; type: string; body: string };
  createdAt: string;
  updatedAt: string;
}>;

type ZapLike = {
  _id: Types.ObjectId;
  name: string;
  enabled: boolean;
  trigger: { app: string; event: string; repo: { id: number; fullName: string } };
  action: { app: string; type: string; body: string };
  createdAt: Date;
  updatedAt: Date;
};

export const toZapDto = (z: ZapLike): ZapDto => ({
  id: z._id.toString(),
  name: z.name,
  enabled: z.enabled,
  trigger: { app: z.trigger.app, event: z.trigger.event, repo: { id: z.trigger.repo.id, fullName: z.trigger.repo.fullName } },
  action: { app: z.action.app, type: z.action.type, body: z.action.body },
  createdAt: z.createdAt.toISOString(),
  updatedAt: z.updatedAt.toISOString(),
});

export type RunDto = Readonly<{
  id: string;
  status: string;
  pullRequest: { number: number; title: string; url: string };
  commentUrl: string | null;
  error: string | null;
  createdAt: string;
}>;

type RunLike = {
  _id: Types.ObjectId;
  status: string;
  pullRequest: { number: number; title: string; url: string };
  commentUrl?: string | null;
  error?: string | null;
  createdAt: Date;
};

export const toRunDto = (r: RunLike): RunDto => ({
  id: r._id.toString(),
  status: r.status,
  pullRequest: { number: r.pullRequest.number, title: r.pullRequest.title, url: r.pullRequest.url },
  commentUrl: r.commentUrl ?? null,
  error: r.error ?? null,
  createdAt: r.createdAt.toISOString(),
});
