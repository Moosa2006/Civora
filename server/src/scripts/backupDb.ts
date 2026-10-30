import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.error('Cannot find .env');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/DATABASE_URL=["']?(postgresql:\/\/[^"'\r\n]+)["']?/);
if (!match) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const dbUrl = new URL(match[1]);
const user = dbUrl.username || 'postgres';
const password = dbUrl.password;
const host = dbUrl.hostname || 'localhost';
const port = dbUrl.port || '5432';
const dbName = dbUrl.pathname.replace(/^\//, '');

const backupDir = path.resolve('backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `civora_backup_${timestamp}.sql`);

console.log(`Starting database backup for ${dbName} at ${host}:${port}...`);

try {
  const pgDumpPath = 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
  execSync(`"${pgDumpPath}" -h ${host} -p ${port} -U ${user} -d ${dbName} -F p -f "${backupFile}"`, {
    env: { ...process.env, PGPASSWORD: password },
    stdio: 'inherit',
  });

  const stats = fs.statSync(backupFile);
  console.log(`✅ Backup successfully created: ${backupFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
} catch (err: any) {
  console.error('❌ Backup failed:', err.message);
  process.exit(1);
}

