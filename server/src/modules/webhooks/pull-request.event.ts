import { z } from 'zod';
import type { TemplateContext } from '../../lib/template.js';

/** Only the parts of GitHub's pull_request payload we use. Unknown fields are ignored. */
export const pullRequestEventSchema = z.object({
  action: z.string(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    html_url: z.string(),
    user: z.object({ login: z.string() }),
    base: z.object({ ref: z.string() }),
    head: z.object({ ref: z.string() }),
  }),
  repository: z.object({ id: z.number(), full_name: z.string() }),
});

export type PullRequestEvent = z.infer<typeof pullRequestEventSchema>;

/** Pure: the values available to {{tokens}}. Keys match PULL_REQUEST_FIELDS in the catalog. */
export const toTemplateContext = (e: PullRequestEvent): TemplateContext => ({
  pr: {
    title: e.pull_request.title,
    number: e.pull_request.number,
    url: e.pull_request.html_url,
    author: e.pull_request.user.login,
    base: e.pull_request.base.ref,
    head: e.pull_request.head.ref,
  },
  repo: { fullName: e.repository.full_name },
});

/** Pure: identifies "this PR was opened" across redeliveries and duplicate hooks. */
export const eventKeyFor = (e: PullRequestEvent): string => `pull_request:${e.pull_request.id}:opened`;
