// generate-icons.mjs — renders the exact Sentinel SVG logo to all Android icon sizes
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const RES = 'android/app/src/main/res';

// Exact SVG from src/components/Logo.tsx — rendered at 512x512 with dark background
const svgIcon = (size) => Buffer.from(`
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100" height="100" fill="#111111"/>
  <defs>
    <linearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <!-- 4-pointed Zenith Star (exact from Logo.tsx) -->
  <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z"
        fill="url(#starGrad)" filter="url(#glow)"/>
  <!-- Center circle cutout -->
  <circle cx="50" cy="50" r="10" fill="#111111"/>
  <!-- Inner arc detail -->
  <path d="M47 45 C47 45, 53 45, 53 50 C53 55, 47 55, 47 55"
        fill="none" stroke="#eab308" stroke-width="2"/>
</svg>`);

// Notification icon: white star on transparent (Android status bar requirement)
const svgNotification = (size) => Buffer.from(`
<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <path d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z" fill="white"/>
  <circle cx="50" cy="50" r="10" fill="black" fill-opacity="0"/>
</svg>`);

const mipmaps = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function run() {
  for (const { dir, size } of mipmaps) {
    const outDir = path.join(RES, dir);
    fs.mkdirSync(outDir, { recursive: true });
    await sharp(svgIcon(size)).png().toFile(path.join(outDir, 'ic_launcher.png'));
    await sharp(svgIcon(size)).png().toFile(path.join(outDir, 'ic_launcher_round.png'));
    console.log(`✅ ${dir}: ${size}x${size}`);
  }

  // Notification icon: 96x96 white silhouette on transparent
  const drawableDir = path.join(RES, 'drawable');
  fs.mkdirSync(drawableDir, { recursive: true });
  await sharp(svgNotification(96)).png().toFile(path.join(drawableDir, 'ic_stat_sentinel.png'));
  console.log('✅ drawable/ic_stat_sentinel.png');

  console.log('\n🎉 All icons generated from exact Sentinel SVG!');
}

run().catch(console.error);
