import { Schema, model, Types } from 'mongoose';

export interface ISession {
  conversationId: Types.ObjectId;
  pattern: 'socketio' | 'worker' | 'live';
  config?: Record<string, unknown>;
}

const sessionSchema = new Schema<ISession>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    pattern: { type: String, enum: ['socketio', 'worker', 'live'], required: true },
    config: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const Session = model<ISession>('Session', sessionSchema);
