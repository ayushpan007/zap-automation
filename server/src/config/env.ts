import { z } from 'zod';

const base64Key32 = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes encoded as base64');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URL: z.string().min(1),
  CLIENT_URL: z.url(),
  PUBLIC_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(16),
  JWT_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: base64Key32,
});

export type AppConfig = Readonly<{
  env: 'development' | 'test' | 'production';
  port: number;
  mongoUrl: string;
  clientUrl: string;
  publicUrl: string;
  github: Readonly<{ clientId: string; clientSecret: string; webhookSecret: string }>;
  jwtSecret: string;
  tokenEncryptionKey: Buffer;
}>;

/** Pure: turns a raw env object into typed config, or throws listing every invalid variable. */
export const parseConfig = (raw: NodeJS.ProcessEnv): AppConfig => {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const e = result.data;
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    mongoUrl: e.MONGO_URL,
    clientUrl: e.CLIENT_URL.replace(/\/$/, ''),
    publicUrl: e.PUBLIC_URL.replace(/\/$/, ''),
    github: {
      clientId: e.GITHUB_CLIENT_ID,
      clientSecret: e.GITHUB_CLIENT_SECRET,
      webhookSecret: e.GITHUB_WEBHOOK_SECRET,
    },
    jwtSecret: e.JWT_SECRET,
    tokenEncryptionKey: Buffer.from(e.TOKEN_ENCRYPTION_KEY, 'base64'),
  };
};
