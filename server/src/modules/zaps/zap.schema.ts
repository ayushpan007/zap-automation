import { z } from 'zod';
import { fieldsForTrigger } from '../catalog/catalog.data.js';
import { findUnknownTokens } from '../../lib/template.js';

/** Runtime validation for request bodies. TypeScript types alone do nothing for untrusted JSON. */
const repoRef = z.object({
  id: z.number().int().positive(),
  fullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'must look like owner/repo'),
});

const trigger = z.object({
  app: z.literal('github', { error: 'Only GitHub triggers can run right now' }),
  event: z.literal('pull_request.opened', { error: 'Unsupported trigger event' }),
  repo: repoRef,
});

const action = z.object({
  app: z.literal('github', { error: 'Only GitHub actions can run right now' }),
  type: z.literal('pull_request.comment', { error: 'Unsupported action' }),
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
});

export type TriggerInput = z.infer<typeof trigger>;
export type ActionInput = z.infer<typeof action>;

type StepRefs = Readonly<{ trigger: { app: string; event: string }; action: { body: string } }>;

/** Pure field-mapping check: every {{token}} must be a field the trigger provides. Returns a message or null. */
export const templateProblem = ({ trigger, action }: StepRefs): string | null => {
  const allowed = fieldsForTrigger(trigger.app, trigger.event).map((f) => f.path);
  const unknown = findUnknownTokens(action.body, allowed);
  if (unknown.length === 0) return null;
  return `Unknown field${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `{{${u}}}`).join(', ')}`;
};

export const createZapSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    enabled: z.boolean().default(false),
    trigger,
    action,
  })
  .superRefine((zap, ctx) => {
    const problem = templateProblem(zap);
    if (problem) ctx.addIssue({ code: 'custom', path: ['action', 'body'], message: problem });
  });

// Trigger and action are replaced whole (not merged) so the token check always sees a consistent pair.
export const updateZapSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    enabled: z.boolean(),
    trigger,
    action,
  })
  .partial()
  .refine((p) => Object.keys(p).length > 0, 'Provide at least one field to update');

export const objectIdParam = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');

export type CreateZapInput = z.infer<typeof createZapSchema>;
export type UpdateZapInput = z.infer<typeof updateZapSchema>;
