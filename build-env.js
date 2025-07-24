const fs = require('fs');

const envVars = {
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID: process.env.FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID: process.env.FIREBASE_APP_ID,
  GEMINI_API_URL: process.env.GEMINI_API_URL,
  FORMSPREE_URL: process.env.FORMSPREE_URL
};

const envContent = `window.env = ${JSON.stringify(envVars, null, 2)};`;

fs.writeFileSync('env.js', envContent);
console.log('Environment variables written to env.js');
console.log('Generated env.js with:', Object.keys(envVars));