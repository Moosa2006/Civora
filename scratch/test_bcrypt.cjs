const path = require('path');
const bcrypt = require(path.resolve(__dirname, '../server/node_modules/bcryptjs'));

async function test() {
  try {
    const res = await bcrypt.compare('CivoraDev123!', '$2a$12$INVALID_HASH_ACCOUNT_PERMANENTLY_LOCKED_DEMO_ACCOUNT_DECOMMISSIONED_20261030');
    console.log('Result:', res);
  } catch (err) {
    console.error('Bcrypt threw error:', err);
  }
}

test();
