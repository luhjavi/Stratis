const mongoose = require("mongoose");
const config = require("../config");

async function connectMongo() {
  await mongoose.connect(config.mongo.uri);
}

module.exports = { connectMongo };
