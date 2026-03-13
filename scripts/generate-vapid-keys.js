// scripts/generate-vapid-keys.js
// Generates VAPID keys for Web Push notifications

const webPush = require('web-push');
const fs = require('fs');
const path = require('path');

// Generate VAPID keys
const vapidKeys = webPush.generateVAPIDKeys();

console.log('🔐 VAPID Keys Generated\n');
console.log('='.repeat(60));
console.log('\n📋 Add these to your environment variables:\n');

console.log('# .env.local (for Next.js)');
console.log('# Public key - safe to expose to client');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"\n`);
console.log('# Private key - KEEP SECRET, server-side only');
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"\n`);
console.log('# Your email for push service contact');
console.log('VAPID_EMAIL="mailto:admin@naijamarketintel.ng"\n');

console.log('='.repeat(60));
console.log('\n📝 Also add to Vercel Environment Variables:\n');
console.log('1. Go to: https://vercel.com/dashboard → your project → Settings → Environment Variables');
console.log('2. Add these three variables:');
console.log('   - NEXT_PUBLIC_VAPID_PUBLIC_KEY (can be exposed to browser)');
console.log('   - VAPID_PRIVATE_KEY (secret - server only)');
console.log('   - VAPID_EMAIL\n');

// Also save to a local file (for backup, add to .gitignore!)
const envContent = `# VAPID Keys for Web Push Notifications
# Generated: ${new Date().toISOString()}
# WARNING: Add this file to .gitignore!

NEXT_PUBLIC_VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"
VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"
VAPID_EMAIL="mailto:admin@naijamarketintel.ng"
`;

const outputPath = path.join(__dirname, '../.env.vapid');
fs.writeFileSync(outputPath, envContent);

console.log(`✅ Keys also saved to: ${outputPath}`);
console.log('\n⚠️  IMPORTANT: Add .env.vapid to your .gitignore file!\n');

// Verify the keys work
try {
  webPush.setVapidDetails(
    'mailto:admin@naijamarketintel.ng',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log('✅ VAPID keys verified successfully!\n');
} catch (error) {
  console.error('❌ VAPID key verification failed:', error.message);
}
