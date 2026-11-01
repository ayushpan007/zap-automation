import type { Request, Response } from 'express';
import type { AppDeps } from '../../app-deps.js';
import { AppError } from '../../errors/app-error.js';
import { pullRequestEventSchema } from './pull-request.event.js';
import { handlePullRequestOpened } from './webhook.service.js';
import { isValidSignature } from './webhook.signature.js';

const header = (req: Request, name: string): string | undefined => {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
};

/** POST /webhooks/github — public endpoint; the HMAC signature is what authenticates GitHub. */
export const webhookController = (deps: AppDeps) => ({
  receive: async (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!isValidSignature(rawBody, header(req, 'x-hub-signature-256'), deps.config.github.webhookSecret)) {
      throw new AppError('UNAUTHENTICATED', 'Invalid webhook signature');
    }

    const event = header(req, 'x-github-event');
    const deliveryId = header(req, 'x-github-delivery') ?? 'unknown';
    if (event === 'ping') return res.json({ ok: true });

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new AppError('BAD_REQUEST', 'Webhook body is not JSON');
    }

    if (event !== 'pull_request' || (payload as { action?: unknown }).action !== 'opened') {
      return res.status(202).json({ ignored: true });
    }

    const summary = await handlePullRequestOpened(deps, pullRequestEventSchema.parse(payload), deliveryId);
    res.json(summary);
  },
});
