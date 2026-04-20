import { Schema, model } from "mongoose";

const merchantCredentialSchema = new Schema(
  {
    merchantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "merchant",
      index: true,
    },
    merchantName: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    credentialType: {
      type: String,
      enum: ["email_password", "phone_password"],
      required: true,
      index: true,
    },
    login: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    password: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true },
);

merchantCredentialSchema.index({ merchantId: 1, credentialType: 1 }, { unique: true });

const MerchantCredential = model(
  "merchant_credential",
  merchantCredentialSchema,
  "merchant_credentials",
);

export default MerchantCredential;
