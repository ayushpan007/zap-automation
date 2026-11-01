/**
 * The app picker's source of truth. Only GitHub is runnable; other developer tools are listed
 * with `available: false` so the builder can show the product's shape without pretending to work.
 */
export type TriggerField = Readonly<{ path: string; label: string; example: string }>;

export type TriggerDef = Readonly<{ key: string; name: string; description: string; fields: readonly TriggerField[] }>;
export type ActionDef = Readonly<{ key: string; name: string; description: string }>;

export type AppDef = Readonly<{
  key: string;
  name: string;
  category: 'Source control' | 'Issue tracking' | 'Chat' | 'Monitoring' | 'Deploys';
  available: boolean;
  triggers: readonly TriggerDef[];
  actions: readonly ActionDef[];
}>;

export const PULL_REQUEST_FIELDS: readonly TriggerField[] = [
  { path: 'pr.title', label: 'PR title', example: 'Fix login redirect' },
  { path: 'pr.number', label: 'PR number', example: '42' },
  { path: 'pr.url', label: 'PR link', example: 'https://github.com/acme/web/pull/42' },
  { path: 'pr.author', label: 'Author username', example: 'octocat' },
  { path: 'pr.base', label: 'Target branch', example: 'main' },
  { path: 'pr.head', label: 'Source branch', example: 'fix/login' },
  { path: 'repo.fullName', label: 'Repository', example: 'acme/web' },
];

export const CATALOG: readonly AppDef[] = [
  {
    key: 'github',
    name: 'GitHub',
    category: 'Source control',
    available: true,
    triggers: [
      {
        key: 'pull_request.opened',
        name: 'Pull request opened',
        description: 'Runs when a new pull request is opened in the selected repository.',
        fields: PULL_REQUEST_FIELDS,
      },
    ],
    actions: [
      {
        key: 'pull_request.comment',
        name: 'Comment on pull request',
        description: 'Posts a comment on the pull request that triggered the Zap.',
      },
    ],
  },
  {
    key: 'gitlab',
    name: 'GitLab',
    category: 'Source control',
    available: false,
    triggers: [{ key: 'merge_request.opened', name: 'Merge request opened', description: '', fields: [] }],
    actions: [{ key: 'merge_request.note', name: 'Comment on merge request', description: '' }],
  },
  {
    key: 'jira',
    name: 'Jira',
    category: 'Issue tracking',
    available: false,
    triggers: [{ key: 'issue.created', name: 'Issue created', description: '', fields: [] }],
    actions: [{ key: 'issue.create', name: 'Create issue', description: '' }],
  },
  {
    key: 'linear',
    name: 'Linear',
    category: 'Issue tracking',
    available: false,
    triggers: [{ key: 'issue.created', name: 'Issue created', description: '', fields: [] }],
    actions: [{ key: 'issue.create', name: 'Create issue', description: '' }],
  },
  {
    key: 'slack',
    name: 'Slack',
    category: 'Chat',
    available: false,
    triggers: [],
    actions: [{ key: 'message.post', name: 'Post message to channel', description: '' }],
  },
  {
    key: 'sentry',
    name: 'Sentry',
    category: 'Monitoring',
    available: false,
    triggers: [{ key: 'issue.created', name: 'New error issue', description: '', fields: [] }],
    actions: [],
  },
  {
    key: 'vercel',
    name: 'Vercel',
    category: 'Deploys',
    available: false,
    triggers: [{ key: 'deployment.failed', name: 'Deployment failed', description: '', fields: [] }],
    actions: [],
  },
];

/** Pure lookup used by validation: the fields a template may reference for a given trigger. */
export const fieldsForTrigger = (appKey: string, triggerKey: string): readonly TriggerField[] =>
  CATALOG.find((a) => a.key === appKey && a.available)?.triggers.find((t) => t.key === triggerKey)?.fields ?? [];
