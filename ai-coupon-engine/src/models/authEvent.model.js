import mongoose from "mongoose";

const authEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "DashboardUser" },
    email: { type: String, lowercase: true, trim: true, maxlength: 254 },
    type: {
      type: String,
      enum: ["login_success", "login_failure", "logout"],
      required: true,
    },
    ip: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 512 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

authEventSchema.index({ createdAt: -1 });
authEventSchema.index({ email: 1, createdAt: -1 });

export default mongoose.models.AuthEvent ||
  mongoose.model("AuthEvent", authEventSchema);
