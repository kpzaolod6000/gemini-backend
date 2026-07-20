import mongoose from 'mongoose';

const raw = process.env.MONGODB_URI;

if (!raw) {
  throw new Error('Falta la variable de entorno MONGODB_URI');
}

const MONGODB_URI: string = raw;

async function dbConnect(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(MONGODB_URI);
}

export { dbConnect };