const { Schema, model } = require("mongoose");

const botBanSchema = new Schema(
  {
    scope: { type: String, enum: ["user", "server"], required: true },
    targetId: { type: String, required: true },
    createdBy: { type: String, default: null },
    reason: { type: String, default: "" }
  },
  { timestamps: true }
);

botBanSchema.index({ scope: 1, targetId: 1 }, { unique: true });

module.exports = model("BotBan", botBanSchema);
