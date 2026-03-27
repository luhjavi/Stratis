const { Schema, model } = require("mongoose");

const cachedPayloadSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

cachedPayloadSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = model("CachedPayload", cachedPayloadSchema);
