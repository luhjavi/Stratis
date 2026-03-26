const { Schema, model } = require("mongoose");

const requestStatSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = model("RequestStat", requestStatSchema);
