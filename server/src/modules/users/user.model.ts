import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    // GitHub's numeric id is stable; logins can be renamed. Unique index makes login an idempotent upsert.
    githubId: { type: Number, required: true, unique: true },
    login: { type: String, required: true },
    name: { type: String, default: null },
    avatarUrl: { type: String, required: true },
    // Encrypted (AES-256-GCM). `select: false` keeps it out of every query unless explicitly requested.
    accessTokenEnc: { type: String, required: true, select: false },
    scopes: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type User = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
