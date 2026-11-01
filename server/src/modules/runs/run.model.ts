import { Schema, model, type InferSchemaType } from 'mongoose';

const pullRequestSchema = new Schema(
  {
    number: { type: Number, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false },
);

/** One record per (zap, triggering event). Doubles as the idempotency lock for webhook redeliveries. */
const runSchema = new Schema(
  {
    zapId: { type: Schema.Types.ObjectId, ref: 'Zap', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // e.g. "pull_request:<pr id>:opened" — the same PR opening must only ever produce one comment per Zap.
    eventKey: { type: String, required: true },
    deliveryId: { type: String, required: true },
    status: { type: String, required: true, enum: ['running', 'succeeded', 'failed'] },
    pullRequest: { type: pullRequestSchema, required: true },
    commentUrl: { type: String, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

runSchema.index({ zapId: 1, eventKey: 1 }, { unique: true });
runSchema.index({ zapId: 1, createdAt: -1 });

export type Run = InferSchemaType<typeof runSchema>;
export const RunModel = model('Run', runSchema);
