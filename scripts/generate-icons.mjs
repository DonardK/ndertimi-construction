import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#1d4ed8");
  gradient.addColorStop(1, "#1e40af");
  ctx.fillStyle = gradient;
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  // Hard hat icon (simple construction symbol)
  const cx = size / 2;
  const cy = size / 2;
  const s = size * 0.5;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size * 0.04;

  // Helmet body
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.05, s * 0.4, Math.PI, 0, false);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.15);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.15);
  ctx.closePath();
  ctx.fill();

  // Brim
  ctx.beginPath();
  ctx.roundRect(cx - s * 0.55, cy + s * 0.1, s * 1.1, s * 0.12, s * 0.06);
  ctx.fill();

  return canvas.toBuffer("image/png");
}

try {
  const sizes = [192, 512];
  for (const size of sizes) {
    const buf = generateIcon(size);
    const outPath = join(__dirname, "..", "public", "icons", `icon-${size}x${size}.png`);
    writeFileSync(outPath, buf);
    console.log(`Generated ${size}x${size} icon`);
  }
} catch (e) {
  console.log("canvas module not available, using placeholder icons");
}
