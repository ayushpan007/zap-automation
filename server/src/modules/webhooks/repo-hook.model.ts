import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * At most one GitHub webhook per repository, shared by every Zap on that repo.
 * Without this, two Zaps on one repo would register two hooks and receive every event twice.
 */
const repoHookSchema = new Schema(
  {
    repoId: { type: Number, required: true, unique: true },
    repoFullName: { type: String, required: true },
    hookId: { type: Number, required: true },
    // Whose token created the hook; needed to delete it later.
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export type RepoHook = InferSchemaType<typeof repoHookSchema>;
export const RepoHookModel = model('RepoHook', repoHookSchema);
