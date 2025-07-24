const getEnvVar = (key) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  console.error(`Environment variable ${key} is not defined`);
  return null;
};

window.env = {
  FIREBASE_API_KEY: getEnvVar('FIREBASE_API_KEY'),
  FIREBASE_AUTH_DOMAIN: getEnvVar('FIREBASE_AUTH_DOMAIN'),
  FIREBASE_DATABASE_URL: getEnvVar('FIREBASE_DATABASE_URL'),
  FIREBASE_PROJECT_ID: getEnvVar('FIREBASE_PROJECT_ID'),
  FIREBASE_STORAGE_BUCKET: getEnvVar('FIREBASE_STORAGE_BUCKET'),
  FIREBASE_MESSAGING_SENDER_ID: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  FIREBASE_APP_ID: getEnvVar('FIREBASE_APP_ID'),
  GEMINI_API_URL: getEnvVar('GEMINI_API_URL'),
  FORMSPREE_URL: getEnvVar('FORMSPREE_URL')
};