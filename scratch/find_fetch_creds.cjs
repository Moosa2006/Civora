const fs = require('fs');
const path = require('path');

function inspectFetches(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      inspectFetches(full);
    } else if (/\.(tsx?|jsx?)$/.test(f)) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, i) => {
        if (/fetch\s*\(/.test(l)) {
          // Check surrounding 10 lines for credentials
          const chunk = lines.slice(i, i + 8).join('\n');
          const hasCredentials = chunk.includes('credentials');
          const isApi = chunk.includes('/api');
          if (isApi && !hasCredentials) {
            console.log(`[NO_CREDENTIALS] ${path.relative(process.cwd(), full)}:${i+1}: ${l.trim()}`);
          }
        }
      });
    }
  }
}

inspectFetches(path.resolve('client', 'src'));

