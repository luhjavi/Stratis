function info(message, extra) {
  console.log(`[INFO] ${message}`, extra || "");
}

function warn(message, extra) {
  console.warn(`[WARN] ${message}`, extra || "");
}

function error(message, extra) {
  console.error(`[ERROR] ${message}`, extra || "");
}

module.exports = {
  info,
  warn,
  error
};
