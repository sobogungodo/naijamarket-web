// scripts/generate-icons.js
// Generates PWA icons from SVG source using Sharp

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Icon sizes to generate
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Badge sizes (for notifications)
const BADGE_SIZES = [72, 96, 128];

// Shortcut icon size
const SHORTCUT_SIZE = 96;

// Paths
const SVG_PATH = path.join(__dirname, '../public/icons/icon.svg');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');
  
  const svgBuffer = fs.readFileSync(SVG_PATH);
  
  // Generate standard icons
  console.log('📱 Standard icons:');
  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);
    
    console.log(`  ✅ icon-${size}x${size}.png`);
  }
  
  // Generate maskable icons (with safe zone padding)
  console.log('\n🔲 Maskable icons:');
  for (const size of [192, 512]) {
    const outputPath = path.join(OUTPUT_DIR, `icon-maskable-${size}x${size}.png`);
    
    // Maskable icons need 10% safe zone, so we scale down the content
    const innerSize = Math.round(size * 0.8);
    const padding = Math.round(size * 0.1);
    
    await sharp(svgBuffer)
      .resize(innerSize, innerSize)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 34, g: 197, b: 94, alpha: 1 } // green-500
      })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);
    
    console.log(`  ✅ icon-maskable-${size}x${size}.png`);
  }
  
  // Generate badge icons (notification badges - simpler design)
  console.log('\n🔔 Badge icons:');
  const badgeSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <circle cx="64" cy="64" r="60" fill="#22c55e"/>
      <text x="64" y="82" text-anchor="middle" font-family="system-ui" font-size="56" font-weight="800" fill="white">N</text>
    </svg>
  `;
  const badgeBuffer = Buffer.from(badgeSvg);
  
  for (const size of BADGE_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `badge-${size}x${size}.png`);
    
    await sharp(badgeBuffer)
      .resize(size, size)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);
    
    console.log(`  ✅ badge-${size}x${size}.png`);
  }
  
  // Generate shortcut icons
  console.log('\n⚡ Shortcut icons:');
  const shortcuts = [
    { name: 'prices', icon: '📊', color: '#22c55e' },
    { name: 'alerts', icon: '🔔', color: '#f59e0b' },
    { name: 'markets', icon: '🏪', color: '#3b82f6' },
    { name: 'trends', icon: '📈', color: '#8b5cf6' }
  ];
  
  for (const shortcut of shortcuts) {
    const shortcutSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
        <rect width="96" height="96" rx="20" fill="${shortcut.color}"/>
        <text x="48" y="66" text-anchor="middle" font-size="48">${shortcut.icon}</text>
      </svg>
    `;
    const shortcutBuffer = Buffer.from(shortcutSvg);
    const outputPath = path.join(OUTPUT_DIR, `shortcut-${shortcut.name}.png`);
    
    await sharp(shortcutBuffer)
      .resize(SHORTCUT_SIZE, SHORTCUT_SIZE)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);
    
    console.log(`  ✅ shortcut-${shortcut.name}.png`);
  }
  
  // Generate action icons (for notification actions)
  console.log('\n🎬 Action icons:');
  const actions = [
    { name: 'view', icon: '👁️' },
    { name: 'dismiss', icon: '✖️' }
  ];
  
  for (const action of actions) {
    const actionSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" fill="#374151"/>
        <text x="32" y="42" text-anchor="middle" font-size="28">${action.icon}</text>
      </svg>
    `;
    const actionBuffer = Buffer.from(actionSvg);
    const outputPath = path.join(OUTPUT_DIR, `action-${action.name}.png`);
    
    await sharp(actionBuffer)
      .resize(64, 64)
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(outputPath);
    
    console.log(`  ✅ action-${action.name}.png`);
  }
  
  // Generate Apple Touch Icon
  console.log('\n🍎 Apple Touch Icon:');
  const appleTouchPath = path.join(OUTPUT_DIR, 'apple-touch-icon.png');
  
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(appleTouchPath);
  
  console.log('  ✅ apple-touch-icon.png (180x180)');
  
  // Generate favicon
  console.log('\n🔖 Favicon:');
  const faviconPath = path.join(__dirname, '../public/favicon.ico');
  
  // Create a 32x32 PNG first
  const favicon32 = await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toBuffer();
  
  // Copy as favicon.ico (browsers handle PNG in .ico format)
  fs.writeFileSync(faviconPath, favicon32);
  console.log('  ✅ favicon.ico (32x32)');
  
  console.log('\n✨ All icons generated successfully!');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
}

// Run
generateIcons().catch(console.error);
