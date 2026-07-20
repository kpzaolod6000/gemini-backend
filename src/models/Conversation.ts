import { Schema, model } from 'mongoose';

export interface IConversation {
  userId: string;
  title: string;
  model: string;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    model: { type: String, required: true },
  },
  { timestamps: true },
);

export const Conversation = model<IConversation>('Conversation', conversationSchema);
