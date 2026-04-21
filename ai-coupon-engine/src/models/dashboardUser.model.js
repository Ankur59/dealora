import mongoose from "mongoose";

const dashboardUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
    },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

dashboardUserSchema.index({ email: 1 }, { unique: true });

export default mongoose.models.DashboardUser ||
  mongoose.model("DashboardUser", dashboardUserSchema);
