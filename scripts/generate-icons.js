/**
 * PWA Icon Generator for Sigma HQ
 * 
 * Run: node scripts/generate-icons.js
 * 
 * This creates PNG icons from SVG for PWA manifest.
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Run: npm install sharp');
  console.log('\nAlternatively, manually create icons in public/icons/ folder.');
  console.log('Required sizes: 72, 96, 128, 144, 152, 192, 384, 512');
  process.exit(1);
}

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

// Sigma HQ logo SVG - construction/building themed
const SVG_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <!-- Building icon -->
  <g transform="translate(96, 80)">
    <!-- Main building -->
    <rect x="80" y="120" width="160" height="220" fill="#3b82f6" rx="8"/>
    <!-- Windows -->
    <rect x="100" y="150" width="40" height="40" fill="#0f172a" rx="4"/>
    <rect x="180" y="150" width="40" height="40" fill="#0f172a" rx="4"/>
    <rect x="100" y="210" width="40" height="40" fill="#0f172a" rx="4"/>
    <rect x="180" y="210" width="40" height="40" fill="#0f172a" rx="4"/>
    <rect x="100" y="270" width="40" height="40" fill="#0f172a" rx="4"/>
    <rect x="180" y="270" width="40" height="40" fill="#0f172a" rx="4"/>
    <!-- Side building -->
    <rect x="240" y="180" width="80" height="160" fill="#60a5fa" rx="6"/>
    <rect x="260" y="210" width="25" height="25" fill="#0f172a" rx="3"/>
    <rect x="260" y="260" width="25" height="25" fill="#0f172a" rx="3"/>
    <!-- Crane -->
    <rect x="20" y="60" width="8" height="280" fill="#fbbf24"/>
    <rect x="20" y="60" width="120" height="8" fill="#fbbf24"/>
    <rect x="130" y="60" width="4" height="60" fill="#94a3b8"/>
    <!-- Sigma text -->
    <text x="160" y="50" font-family="system-ui, sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">SIGMA</text>
  </g>
</svg>
`;

async function generateIcons() {
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Generating PWA icons...');

  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    
    await sharp(Buffer.from(SVG_ICON))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`✓ Created ${outputPath}`);
  }

  console.log('\n✅ All icons generated!');
  console.log(`   Location: ${OUTPUT_DIR}`);
}

generateIcons().catch(console.error);
