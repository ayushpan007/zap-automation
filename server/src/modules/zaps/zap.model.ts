import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const sub = { _id: false } as const;

const repoSchema = new Schema(
  {
    id: { type: Number, required: true },
    fullName: { type: String, required: true },
  },
  sub,
);

const triggerSchema = new Schema(
  {
    app: { type: String, required: true, enum: ['github'] },
    event: { type: String, required: true, enum: ['pull_request.opened'] },
    repo: { type: repoSchema, required: true },
  },
  sub,
);

const actionSchema = new Schema(
  {
    app: { type: String, required: true, enum: ['github'] },
    type: { type: String, required: true, enum: ['pull_request.comment'] },
    body: { type: String, required: true, maxlength: 5000 },
  },
  sub,
);

/**
 * Trigger and action are embedded: they are always read and written with the Zap and have no
 * life of their own. Runs are a separate collection because they grow without bound.
 */
const zapSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    enabled: { type: Boolean, required: true, default: false },
    trigger: { type: triggerSchema, required: true },
    action: { type: actionSchema, required: true },
  },
  { timestamps: true },
);

// List page: "my zaps, newest first".
zapSchema.index({ userId: 1, updatedAt: -1 });
// Webhook delivery: "enabled zaps listening on this repo for this event".
zapSchema.index({ 'trigger.repo.id': 1, 'trigger.event': 1, enabled: 1 });

export type Zap = InferSchemaType<typeof zapSchema>;
export type ZapDoc = HydratedDocument<Zap>;
export const ZapModel = model('Zap', zapSchema);
