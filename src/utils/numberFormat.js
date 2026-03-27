function formatCompactNumber(value) {
  const num = Number(value || 0);
  const abs = Math.abs(num);
  if (abs < 1000) return `${num}`;

  const units = [
    { v: 1e9, s: "B" },
    { v: 1e6, s: "M" },
    { v: 1e3, s: "K" }
  ];

  for (const unit of units) {
    if (abs >= unit.v) {
      const short = num / unit.v;
      const decimals = Math.abs(short) >= 100 ? 0 : Math.abs(short) >= 10 ? 1 : 2;
      return `${Number(short.toFixed(decimals))}${unit.s}`;
    }
  }
  return `${num}`;
}

module.exports = { formatCompactNumber };
