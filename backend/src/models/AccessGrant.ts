import mongoose, { Schema, Document } from 'mongoose';

export interface IAccessGrant extends Document {
  username: string;
  usernameLower: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccessGrantSchema = new Schema<IAccessGrant>(
  {
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IAccessGrant>('AccessGrant', AccessGrantSchema);
