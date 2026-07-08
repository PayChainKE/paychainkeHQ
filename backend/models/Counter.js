import mongoose from 'mongoose';

// Generic atomic-increment counter — backs globally sequential, human-readable
// identifiers (e.g. invoice numbers) where per-document random IDs won't do.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.model('Counter', counterSchema);
