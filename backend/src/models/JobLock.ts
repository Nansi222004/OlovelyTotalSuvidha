import mongoose, { Document, Schema } from "mongoose";

/**
 * R-03: lease lock so a scheduled financial job runs on one instance at a time
 * (multiple API replicas each start the scheduler). The lease expires on its own,
 * so a crashed holder never blocks the job permanently.
 */
export interface IJobLock extends Document {
  name: string;
  holder: string;
  lockedUntil: Date;
  lastRunAt?: Date;
  lastResult?: any;
}

const JobLockSchema = new Schema<IJobLock>(
  {
    name: { type: String, required: true, unique: true },
    holder: { type: String, required: true },
    lockedUntil: { type: Date, required: true },
    lastRunAt: { type: Date },
    lastResult: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

const JobLock =
  (mongoose.models.JobLock as mongoose.Model<IJobLock>) || mongoose.model<IJobLock>("JobLock", JobLockSchema);

export default JobLock;
