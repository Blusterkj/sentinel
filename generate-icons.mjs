// generate-icons.mjs
// Resizes the Sentinel icon to all Android mipmap sizes + notification drawable
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SRC = 'C:\\Users\\blust\\.gemini\\antigravity-ide\\brain\\672248c4-32f0-4948-8529-58c9a164bd39\\sentinel_app_icon_1781516952245.png';
const RES = 'android/app/src/main/res';

const mipmaps = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function run() {
  // App icons (full color)
  for (const { dir, size } of mipmaps) {
    const outDir = path.join(RES, dir);
    fs.mkdirSync(outDir, { recursive: true });
    await sharp(SRC).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher.png'));
    await sharp(SRC).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher_round.png'));
    console.log(`✅ ${dir}: ${size}x${size}`);
  }

  // Notification icon: white on transparent, 96x96 (xxhdpi drawable)
  const drawableDir = path.join(RES, 'drawable');
  fs.mkdirSync(drawableDir, { recursive: true });
  
  // Create white silhouette by converting to grayscale and thresholding
  await sharp(SRC)
    .resize(96, 96)
    .greyscale()
    .threshold(50)
    .png()
    .toFile(path.join(drawableDir, 'ic_stat_sentinel.png'));
  
  console.log('✅ drawable/ic_stat_sentinel.png (notification icon)');
  console.log('\n🎉 All icons generated!');
}

run().catch(console.error);
