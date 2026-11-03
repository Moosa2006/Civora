const fs = require('fs');
const path = require('path');

const migrationsDir = path.resolve('server', 'prisma', 'migrations');
const dirs = fs.readdirSync(migrationsDir).filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory());

for (const dir of dirs) {
  const sqlPath = path.join(migrationsDir, dir, 'migration.sql');
  if (fs.existsSync(sqlPath)) {
    const content = fs.readFileSync(sqlPath, 'utf8');
    const matches = content.match(/.*''.*/g);
    if (matches) {
      console.log(`Found ${matches.length} matches in ${dir}:`);
      matches.forEach(m => console.log('  ', m.trim()));
    }
  }
}

