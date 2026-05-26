// ──────────────────────────────────────────────────────────────
// SSL Certificate Generator
// Generates a self-signed certificate for development HTTPS.
// Run: node src/scripts/generate-ssl.js
// ──────────────────────────────────────────────────────────────

const fs    = require('fs');
const path  = require('path');
const { execSync } = require('child_process');

const sslDir = path.join(__dirname, '..', '..', 'ssl');

function generateSelfSignedCert() {
  // Ensure the ssl directory exists
  if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
  }

  const keyPath  = path.join(sslDir, 'server.key');
  const certPath = path.join(sslDir, 'server.cert');

  // Check if certs already exist
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('  ✅ SSL certificates already exist at:');
    console.log(`     Key:  ${keyPath}`);
    console.log(`     Cert: ${certPath}`);
    console.log('  To regenerate, delete these files and re-run this script.\n');
    return;
  }

  console.log('  🔐 Generating self-signed SSL certificate...\n');

  // Try OpenSSL first
  if (tryOpenSSL(keyPath, certPath)) {
    return;
  }

  // Fallback: write a placeholder cert so the server can start
  console.log('  ⚠️  OpenSSL not available. Writing placeholder certificate.\n');

  // Generate a key using Node's crypto
  const { generateKeyPairSync } = require('crypto');
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Self-signed PEM certificate (minimal, for dev use only)
  const certPem = [
    '-----BEGIN CERTIFICATE-----',
    'MIIDazCCAlMCFAjXRpzLdbHsFSeYqnHviBqj0BkYMA0GCSqGSIb3DQEBCwUAMHgx',
    'CzAJBgNVBAYTAlVTMQ8wDQYDVQQIDAZPcmVnb24xETAPBgNVBAcMCFBvcnRsYW5k',
    'MRYwFAYDVQQKDA1QbGFuZXggRGV2ZWxvdzEXMBUGA1UEAwwObG9jYWxob3N0Lmxv',
    'Y2FsMRQwEgYDVQQDDAsqLmxvY2FsaG9zdDAeFw0yNTAxMDEwMDAwMDBaFw0yNjAx',
    'MDEwMDAwMDBaMHgxCzAJBgNVBAYTAlVTMQ8wDQYDVQQIDAZPcmVnb24xETAPBgNV',
    'BAcMCFBvcnRsYW5kMRYwFAYDVQQKDA1QbGFuZXggRGV2ZWxvdzEXMBUGA1UEAwwO',
    'bG9jYWxob3N0LmxvY2FsMRQwEgYDVQQDDAsqLmxvY2FsaG9zdDCCASIwDQYJKoZI',
    'hvcNAQEBBQADggEPADCCAQoCggEBAK0A/0gvCZ6JwKkq9Y5FPvYqp+XA1KNJMaY0',
    'kFV0j6oR/xHGVdVNgs5QKJoBxQm2T8MGLGFjNEMjBSlNMXR7JUkhYLfyx+quvA3E',
    'V/8hLX1mOIJ3CQ3XmYjGjA8A0IZGFUflBGTv7y8CfbwVYG+Y46+RtD5K+a+Jh4lG',
    'rlBMFq3B7C2VB5TfjV8QPLVrh1RsahYF7mz8SqNyWK5SWrQYDmB6fBKYumvRP3eD',
    'jFvDfYfQhTKsTD7iKJFZo3b9+NOMV8J4x9lO17N+1SJjLPSxJYDfk+gTKf5M7Jj5',
    'Q3V1oYy6iyqTPjRQxkJKLyFQm26PRB0wJfOQj+CJWHRcBPcCAwEAATANBgkqhkiG',
    '9w0BAQsFAAOCAQEAf9q3sFV6MgAUhvsEuT7xAKFrh/tGVmGAV10XW8FF8TgCkeMn',
    'l2xb2gMOxOBwQ2nbjRTAB8M+iEqRJ1wUcxRtN6wBwNcpUWH5X/PXBNINPA4T7wOB',
    'ZPZRGGtXVs+CJoWFz2oE2mCdG4MiKB98Ola8xp+qM3tUwLO7b1HWEq8djNPBmnBy',
    'w+oT+0RbxXUMoNxTD2t3CvjP2PPBlLFUG/AQBvB+oLFUjKn4IDmHN9Kx0FEX3PxM',
    'KY/NlM5IGAc7Fkprr6l6PxBP5SF2IPjR6KzA1F7Y8mDUBp7wDdR+F0C3vqMZRgK0',
    'XBV3jK8DqkFJv9WKCYkYQYgO3QJjHQH3BmMXjg==',
    '-----END CERTIFICATE-----',
  ].join('\n');

  fs.writeFileSync(keyPath, privateKey, 'utf8');
  fs.writeFileSync(certPath, certPem, 'utf8');

  console.log(`  ✅ Placeholder SSL certificate generated.`);
  console.log(`     Key:  ${keyPath}`);
  console.log(`     Cert: ${certPath}`);
  console.log('');
  console.log('  ⚠️  This is a self-signed certificate for development only.');
  console.log('  ⚠️  Browsers will show a security warning — click "Advanced" → "Proceed".\n');
  console.log('  💡 Install OpenSSL for proper certificate generation:');
  console.log('     https://slproweb.com/products/Win32OpenSSL.html\n');
}

/**
 * Try to generate certs using OpenSSL.
 * Accepts an optional IP address via CLI argument (node generate-ssl.js 192.168.1.100).
 * Returns true if successful, false otherwise.
 */
function tryOpenSSL(keyPath, certPath) {
  try {
    console.log('  Using OpenSSL to generate certificate...\n');

    // Collect ALL non-internal IPv4 addresses for the SAN
    const allIPs = getAllLocalIPs();
    // Optional CLI override: node generate-ssl.js 192.168.1.100
    const extraIP = process.argv[2];
    if (extraIP && !allIPs.includes(extraIP)) {
      allIPs.push(extraIP);
    }

    const ipEntries = allIPs.map(ip => `IP:${ip}`).join(',');
    const san = `DNS:localhost,${ipEntries}`;

    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/CN=localhost/O=Planex Development/C=US" -addext "subjectAltName=${san}"`,
      { stdio: 'inherit' }
    );

    console.log('\n  ✅ Certificate generated with OpenSSL!');
    console.log(`     Key:  ${keyPath}`);
    console.log(`     Cert: ${certPath}`);
    console.log(`     SAN:  ${san}`);
    console.log('');
    console.log('  ⚠️  This is a self-signed certificate for development only.');
    console.log('  ⚠️  Browsers will show a security warning — click "Advanced" → "Proceed".\n');
    return true;
  } catch {
    return false;
  }
}

/** Returns all non-internal IPv4 addresses on this machine. */
function getAllLocalIPs() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = ['127.0.0.1'];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

generateSelfSignedCert();
