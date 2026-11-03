const https = require('https');

function testEndpoint(method, path, body) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = https.request('https://civora-l06w.onrender.com' + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[${method}] ${path} -> STATUS ${res.statusCode}:`, data);
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (err) => {
      console.error(`[${method}] ${path} ERROR:`, err.message);
      resolve({ error: err.message });
    });
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  await testEndpoint('GET', '/api/health');
  await testEndpoint('GET', '/api/meta/categories');
  await testEndpoint('GET', '/api/complaints/categories');
  await testEndpoint('GET', '/api/transparency/metrics');
  await testEndpoint('GET', '/api/auth/me');
  await testEndpoint('POST', '/api/auth/login', { email: 'moosa2006eng@gmail.com', password: 'test' });
}

run();

