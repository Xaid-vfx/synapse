import mongoose, { Schema, Document } from 'mongoose';

export interface IEarlyAccessLead extends Document {
  email: string;
  emailLower: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

const EarlyAccessLeadSchema = new Schema<IEarlyAccessLead>(
  {
    email: { type: String, required: true, trim: true },
    emailLower: { type: String, required: true, unique: true, index: true },
    source: { type: String, default: 'landing' },
  },
  { timestamps: true }
);

export default mongoose.model<IEarlyAccessLead>('EarlyAccessLead', EarlyAccessLeadSchema);
