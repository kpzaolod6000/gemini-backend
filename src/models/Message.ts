import { Schema, model, Types } from 'mongoose';

export interface IMessage {
  conversationId: Types.ObjectId;
  role: 'user' | 'model';
  content: string;
  model: string;
  timestamp: Date;
  metadata?: unknown;
}

const messageSchema = new Schema<IMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  role: { type: String, enum: ['user', 'model'], required: true },
  content: { type: String, required: true },
  model: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed },
});

export const Message = model<IMessage>('Message', messageSchema);
