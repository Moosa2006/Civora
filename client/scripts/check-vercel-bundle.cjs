const fs = require('fs');

(async () => {
  const res = await fetch('https://civora-tau.vercel.app/');
  const html = await res.text();
  const scripts = html.match(/\/assets\/[^"']+\.js/g);
  console.log('Script bundles found:', scripts);

  if (scripts && scripts.length > 0) {
    for (const s of scripts) {
      const codeRes = await fetch('https://civora-tau.vercel.app' + s);
      const code = await codeRes.text();
      console.log(`Bundle ${s}: length = ${code.length}`);
      console.log('  Includes "Civic Portal":', code.includes('Civic Portal'));
      console.log('  Includes "Civora Mobile Navigation":', code.includes('Civora Mobile Navigation'));
      console.log('  Includes "Triage Dashboard":', code.includes('Triage Dashboard'));
      console.log('  Includes "admin-complaints":', code.includes('admin-complaints'));
    }
  }
})();

