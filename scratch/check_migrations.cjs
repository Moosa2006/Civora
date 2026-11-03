const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve('server', 'prisma', 'migrations');
const dirs = fs.readdirSync(migrationsDir).filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory());

console.log(`Scanning ${dirs.length} migration directories...`);

for (const dir of dirs) {
  const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
  if (fs.existsSync(sqlPath)) {
    const content = fs.readFileSync(sqlPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Check for empty string quotes or empty identifiers
      if (/''/.test(line)) {
        console.log(`[EMPTY_QUOTE][${dir}:${idx + 1}] ${line.trim()}`);
      }
      if (/\"\"/.test(line)) {
        console.log(`[EMPTY_IDENTIFIER][${dir}:${idx + 1}] ${line.trim()}`);
      }
      if (/ALTER\s+TYPE.*ADD\s+VALUE/i.test(line)) {
        console.log(`[ALTER_TYPE_ADD_VALUE][${dir}:${idx + 1}] ${line.trim()}`);
      }
    });
  }
}

