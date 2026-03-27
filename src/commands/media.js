const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const sharp = require("sharp");
const { baseEmbed } = require("../constants/embed");

async function fetchAttachmentBuffer(attachment) {
  if (!attachment?.url) throw new Error("Missing image attachment.");
  const contentType = String(attachment.contentType || "").toLowerCase();
  if (contentType && !contentType.startsWith("image/")) {
    throw new Error("Attachment must be an image.");
  }
  const res = await fetch(attachment.url);
  if (!res.ok) throw new Error("Could not download attachment.");
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

function fileBaseName(name, fallback) {
  const raw = String(name || fallback || "image");
  const stripped = raw.replace(/\.[^.]+$/, "");
  return stripped.slice(0, 40);
}

function formatFileSize(bytes) {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function mediaInfoText({ ext, width, height, sizeBytes }) {
  const type = String(ext || "unknown").replace(/^\./, "").toUpperCase();
  const resolution = width && height ? `${width}x${height}` : "Unknown";
  return `Type: ${type} | Resolution: ${resolution} | Size: ${formatFileSize(sizeBytes)}`;
}

function captionSvg(width, text) {
  const safe = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const fontSize = Math.max(22, Math.min(42, Math.floor(width / 18)));
  const height = Math.max(70, Math.floor(fontSize * 2));
  return {
    svg: Buffer.from(
      `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" fill="#101114"/>
<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
  fill="#ffffff" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700">${safe}</text>
</svg>`
    ),
    height
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("media")
    .setDescription("Image editing tools")
    .addSubcommand((sub) =>
      sub
        .setName("overlay")
        .setDescription("Overlay one image on top of another")
        .addAttachmentOption((opt) => opt.setName("image1").setDescription("Base image").setRequired(true))
        .addAttachmentOption((opt) => opt.setName("image2").setDescription("Overlay image").setRequired(true))
        .addNumberOption((opt) =>
          opt
            .setName("opacity")
            .setDescription("Overlay opacity (0-100). Default 50")
            .setRequired(false)
            .setMinValue(0)
            .setMaxValue(100)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("caption")
        .setDescription("Add a caption to an image")
        .addAttachmentOption((opt) => opt.setName("image").setDescription("Image to caption").setRequired(true))
        .addStringOption((opt) => opt.setName("caption").setDescription("Caption text").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("imagetogif")
        .setDescription("Convert image to GIF")
        .addAttachmentOption((opt) => opt.setName("image").setDescription("Image to convert").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("invert")
        .setDescription("Invert colors in an image")
        .addAttachmentOption((opt) => opt.setName("image").setDescription("Image to invert").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("monochrome")
        .setDescription("Turn image to black and white")
        .addAttachmentOption((opt) => opt.setName("image").setDescription("Image to convert").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("resize")
        .setDescription("Resize image by percentage")
        .addAttachmentOption((opt) => opt.setName("image").setDescription("Image to resize").setRequired(true))
        .addIntegerOption((opt) =>
          opt
            .setName("percentage")
            .setDescription("Resize percent (1-500)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(500)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    try {
      if (sub === "overlay") {
        const img1 = interaction.options.getAttachment("image1", true);
        const img2 = interaction.options.getAttachment("image2", true);
        const opacityRaw = interaction.options.getNumber("opacity") ?? 50;
        const opacity = Math.max(0, Math.min(1, Number(opacityRaw) / 100));

        const [buf1, buf2] = await Promise.all([fetchAttachmentBuffer(img1), fetchAttachmentBuffer(img2)]);
        const meta = await sharp(buf1).metadata();
        const width = meta.width || 512;
        const height = meta.height || 512;
        const overlay = await sharp(buf2)
          .resize(width, height, { fit: "cover" })
          .ensureAlpha(opacity)
          .png()
          .toBuffer();
        const out = await sharp(buf1)
          .resize(width, height, { fit: "cover" })
          .composite([{ input: overlay, blend: "over" }])
          .png()
          .toBuffer();
        const outMeta = await sharp(out).metadata();

        const file = new AttachmentBuilder(out, { name: `${fileBaseName(img1.name, "overlay")}-overlay.png` });
        return interaction.editReply({
          content: mediaInfoText({
            ext: "png",
            width: outMeta.width,
            height: outMeta.height,
            sizeBytes: out.length
          }),
          files: [file]
        });
      }

      if (sub === "caption") {
        const img = interaction.options.getAttachment("image", true);
        const caption = interaction.options.getString("caption", true).slice(0, 120);
        const buf = await fetchAttachmentBuffer(img);
        const meta = await sharp(buf).metadata();
        const { svg, height } = captionSvg(meta.width || 512, caption);
        const out = await sharp({
          create: {
            width: meta.width || 512,
            height: (meta.height || 512) + height,
            channels: 4,
            background: "#101114"
          }
        })
          .composite([{ input: svg, left: 0, top: 0 }, { input: buf, left: 0, top: height }])
          .png()
          .toBuffer();
        const outMeta = await sharp(out).metadata();
        const file = new AttachmentBuilder(out, { name: `${fileBaseName(img.name, "caption")}-caption.png` });
        return interaction.editReply({
          content: mediaInfoText({
            ext: "png",
            width: outMeta.width,
            height: outMeta.height,
            sizeBytes: out.length
          }),
          files: [file]
        });
      }

      if (sub === "imagetogif") {
        const img = interaction.options.getAttachment("image", true);
        const buf = await fetchAttachmentBuffer(img);
        const out = await sharp(buf).gif().toBuffer();
        const outMeta = await sharp(out).metadata();
        const file = new AttachmentBuilder(out, { name: `${fileBaseName(img.name, "image")}.gif` });
        return interaction.editReply({
          content: mediaInfoText({
            ext: "gif",
            width: outMeta.width,
            height: outMeta.height,
            sizeBytes: out.length
          }),
          files: [file]
        });
      }

      if (sub === "invert") {
        const img = interaction.options.getAttachment("image", true);
        const buf = await fetchAttachmentBuffer(img);
        const out = await sharp(buf).negate().png().toBuffer();
        const outMeta = await sharp(out).metadata();
        const file = new AttachmentBuilder(out, { name: `${fileBaseName(img.name, "invert")}-invert.png` });
        return interaction.editReply({
          content: mediaInfoText({
            ext: "png",
            width: outMeta.width,
            height: outMeta.height,
            sizeBytes: out.length
          }),
          files: [file]
        });
      }

      if (sub === "monochrome") {
        const img = interaction.options.getAttachment("image", true);
        const buf = await fetchAttachmentBuffer(img);
        const out = await sharp(buf).grayscale().png().toBuffer();
        const outMeta = await sharp(out).metadata();
        const file = new AttachmentBuilder(out, { name: `${fileBaseName(img.name, "mono")}-mono.png` });
        return interaction.editReply({
          content: mediaInfoText({
            ext: "png",
            width: outMeta.width,
            height: outMeta.height,
            sizeBytes: out.length
          }),
          files: [file]
        });
      }

      if (sub === "resize") {
        const img = interaction.options.getAttachment("image", true);
        const percentage = interaction.options.getInteger("percentage", true);
        const buf = await fetchAttachmentBuffer(img);
        const meta = await sharp(buf).metadata();
        const width = Math.max(1, Math.round((meta.width || 1) * (percentage / 100)));
        const height = Math.max(1, Math.round((meta.height || 1) * (percentage / 100)));
        const out = await sharp(buf).resize(width, height).png().toBuffer();
        const outMeta = await sharp(out).metadata();
        const file = new AttachmentBuilder(out, {
          name: `${fileBaseName(img.name, "resize")}-resize-${percentage}pct.png`
        });
        return interaction.editReply({
          content: mediaInfoText({
            ext: "png",
            width: outMeta.width,
            height: outMeta.height,
            sizeBytes: out.length
          }),
          files: [file]
        });
      }

      return interaction.editReply({
        embeds: [baseEmbed().setTitle("Unknown subcommand").setDescription("This media subcommand is not implemented.")]
      });
    } catch (err) {
      return interaction.editReply({
        embeds: [
          baseEmbed()
            .setTitle("Media processing failed")
            .setDescription(err?.message || "Could not process that image.")
        ]
      });
    }
  }
};
