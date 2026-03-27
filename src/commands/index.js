const roblox = require("./roblox");
const utility = require("./utility");
const media = require("./media");
const auth = require("./auth");
const privacy = require("./privacy");
const tos = require("./tos");

const commands = [roblox, utility, media, auth, privacy, tos];

module.exports = {
  commands
};
