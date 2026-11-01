import { describe, expect, it } from 'vitest';
import { AppError } from '../errors/app-error.js';
import { GithubApiError } from '../modules/github/github.client.js';
import { toErrorResponse } from './error-handler.js';

describe('toErrorResponse', () => {
  it('passes expected errors through with their message', () => {
    expect(toErrorResponse(new AppError('FORBIDDEN', 'You need admin access'))).toEqual({
      status: 403,
      body: { error: { code: 'FORBIDDEN', message: 'You need admin access', details: undefined } },
    });
  });

  it('hides GitHub request details from the client', () => {
    const res = toErrorResponse(new GithubApiError(401, 'GitHub GET /repos/octo/demo failed (401): {"message":"Bad credentials"}'));
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('/repos/octo/demo');
    expect(res.body.error.message).toBe('GitHub request failed. Try again in a moment.');
  });

  it('never leaks unknown errors', () => {
    expect(toErrorResponse(new Error('db password is hunter2')).body.error.message).toBe('Something went wrong');
  });
});
