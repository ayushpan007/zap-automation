import type { AppDeps } from '../../app-deps.js';
import { AppError } from '../../errors/app-error.js';
import { decryptSecret, encryptSecret } from '../../lib/crypto.js';
import { UserModel } from '../users/user.model.js';

// `repo` is the narrowest classic OAuth scope that allows creating repo webhooks and commenting on PRs.
export const OAUTH_SCOPES = ['repo', 'read:user'] as const;

export const callbackUrl = (clientUrl: string): string => `${clientUrl}/auth/github/callback`;

/** Pure: the GitHub page we send the browser to. `state` ties the callback to this browser (CSRF). */
export const buildAuthorizeUrl = (clientId: string, clientUrl: string, state: string): string => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(clientUrl),
    scope: OAUTH_SCOPES.join(' '),
    state,
    allow_signup: 'true',
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

/** Exchange the OAuth code, then create or update the user in one atomic upsert. Returns our user id. */
export const completeLogin = async ({ config, github }: AppDeps, code: string): Promise<string> => {
  const { accessToken, scopes } = await github.exchangeCode(code, callbackUrl(config.clientUrl));
  const profile = await github.getUser(accessToken);
  const user = await UserModel.findOneAndUpdate(
    { githubId: profile.id },
    {
      $set: {
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        accessTokenEnc: encryptSecret(accessToken, config.tokenEncryptionKey),
        scopes,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  return user.id as string;
};

export const getUserToken = async (config: AppDeps['config'], userId: string): Promise<string> => {
  const user = await UserModel.findById(userId).select('+accessTokenEnc');
  if (!user) throw new AppError('UNAUTHENTICATED', 'Session user no longer exists');
  return decryptSecret(user.accessTokenEnc, config.tokenEncryptionKey);
};
