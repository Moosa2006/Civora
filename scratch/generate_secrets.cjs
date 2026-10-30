const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const deploymentDir = path.resolve(__dirname, '..', 'deployment');
if (!fs.existsSync(deploymentDir)) {
  fs.mkdirSync(deploymentDir, { recursive: true });
}

const secretsPath = path.join(deploymentDir, '.env.production.secrets');

// Generate 32 bytes (64 hex characters) cryptographically secure random strings
const jwtSecret = crypto.randomBytes(32).toString('hex');
const cookieSecret = crypto.randomBytes(32).toString('hex');

// Generate a high-entropy password for initial administrator bootstrap (24 chars)
const adminPassword = crypto.randomBytes(18).toString('base64url');

const fileContent = `# ==============================================================================
# CIVORA PRODUCTION DEPLOYMENT SECRETS (CONFIDENTIAL)
# Generated locally via crypto.randomBytes(32)
# STRICTLY CONFIDENTIAL - DO NOT COMMIT TO VERSION CONTROL OR EXPOSE PUBLICLY
# ==============================================================================

# ------------------------------------------------------------------------------
# RENDER BACKEND ENVIRONMENT VARIABLES (Copy to Render Environment Settings)
# ------------------------------------------------------------------------------

# Cryptographically strong 64-character hex secret for signing JSON Web Tokens
JWT_SECRET=${jwtSecret}

# Optional cookie/session signature secret
COOKIE_SECRET=${cookieSecret}

# ------------------------------------------------------------------------------
# INITIAL PRODUCTION ADMINISTRATOR BOOTSTRAP (One-time setup)
# Run once via: npx tsx src/scripts/bootstrapAdmin.ts
# ------------------------------------------------------------------------------
BOOTSTRAP_ADMIN_EMAIL=admin@civora.gov
BOOTSTRAP_ADMIN_PASSWORD=${adminPassword}
BOOTSTRAP_ADMIN_NAME=Civora Platform Administrator
BOOTSTRAP_ADMIN_PHONE=+10000000000
`;

fs.writeFileSync(secretsPath, fileContent, { mode: 0o600 });
console.log(`[SUCCESS] Production deployment secrets safely generated at: ${secretsPath}`);
console.log(`[STATUS] Secrets file size: ${Buffer.byteLength(fileContent)} bytes. Secrets not logged to stdout.`);

