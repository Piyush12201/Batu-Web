#!/usr/bin/env node

require('dotenv').config();
const initializeDatabase = require('./database/init');

console.log('🚀 Starting database initialization...\n');

initializeDatabase().then(() => {
  console.log('\n✨ Setup complete! You can now start the server.\n');
  process.exit(0);
}).catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
