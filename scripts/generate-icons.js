/**
 * PWA Icon Generator for Ascentor
 * 
 * OPTION 1 — Quick (use an online tool):
 *   Go to https://www.pwabuilder.com/imageGenerator
 *   Upload your 512x512 logo → it generates all sizes
 *   Download and place in public/icons/
 * 
 * OPTION 2 — If you have Node + sharp installed:
 *   npm install sharp
 *   node scripts/generate-icons.js
 * 
 * OPTION 3 — Manual with any image editor:
 *   Create these sizes from your logo and place in public/icons/:
 *   - icon-72.png   (72x72)
 *   - icon-96.png   (96x96)
 *   - icon-128.png  (128x128)
 *   - icon-144.png  (144x144)
 *   - icon-152.png  (152x152)
 *   - icon-192.png  (192x192)
 *   - icon-384.png  (384x384)
 *   - icon-512.png  (512x512)
 *   - icon-maskable-192.png (192x192, with 20% padding for safe zone)
 *   - icon-maskable-512.png (512x512, with 20% padding for safe zone)
 * 
 * For maskable icons, your logo should be centered in the middle 60%
 * of the image with padding around it. Use https://maskable.app/ to test.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'public', 'icons', 'icon-source.png');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  if (!fs.existsSync(SOURCE)) {
    console.log('⚠️  Place your 512x512+ logo at public/icons/icon-source.png');
    console.log('   Then run: node scripts/generate-icons.js');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Standard icons
  for (const size of sizes) {
    await sharp(SOURCE)
      .resize(size, size)
      .png()
      .toFile(path.join(OUTPUT_DIR, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }

  // Maskable icons (add 20% padding)
  for (const size of [192, 512]) {
    const innerSize = Math.round(size * 0.6);
    const padding = Math.round(size * 0.2);
    
    const inner = await sharp(SOURCE).resize(innerSize, innerSize).png().toBuffer();
    
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 10, g: 14, b: 23, alpha: 1 }, // #0A0E17
      },
    })
      .composite([{ input: inner, top: padding, left: padding }])
      .png()
      .toFile(path.join(OUTPUT_DIR, `icon-maskable-${size}.png`));
    console.log(`✓ icon-maskable-${size}.png`);
  }

  console.log('\n✅ All icons generated in public/icons/');
}

generate().catch(console.error);
