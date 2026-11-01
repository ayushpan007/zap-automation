import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { AppError } from '../../errors/app-error.js';
import { COPILOT_SYSTEM_PROMPT, copilotOutputSchema, copilotUserMessage, type CopilotOutput } from './copilot.prompt.js';

/** The LLM boundary. The real one calls Claude; tests pass a fake, like the GitHub client. */
export type CopilotModel = Readonly<{
  draft: (input: { request: string; repos: readonly string[] }) => Promise<CopilotOutput>;
}>;

const MODEL = 'claude-opus-5-5';
const UNAVAILABLE = 'Copilot could not draft a Zap right now. Try again, or build it by hand.';

export const createClaudeCopilot = (apiKey: string): CopilotModel => {
  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });

  return {
    draft: async ({ request, repos }) => {
      const response = await client.beta.messages
        .parse({
          model: MODEL,
          max_tokens: 16000,
          // A short extraction task: low effort keeps it fast and cheap.
          output_config: { effort: 'low', format: betaZodOutputFormat(copilotOutputSchema) },
          // If a safety classifier declines, the API retries on a recommended model instead of failing.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: COPILOT_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: copilotUserMessage(request, repos) }],
        })
        .catch((err: unknown) => {
          // Log the real cause server-side; the client only gets a safe message.
          console.error('[copilot] Claude request failed', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err);
          throw new AppError('UPSTREAM_FAILED', UNAVAILABLE);
        });

      if (response.stop_reason === 'refusal') {
        throw new AppError('BAD_REQUEST', "Copilot can't help with that request. Try describing the Zap differently.");
      }
      if (!response.parsed_output) {
        console.error(`[copilot] no parsed output (stop_reason=${response.stop_reason})`);
        throw new AppError('UPSTREAM_FAILED', UNAVAILABLE);
      }
      return response.parsed_output;
    },
  };
};
