import admin from 'firebase-admin';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const envCheck = {
      hasFirebaseKey: !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY,
      hasFirebaseUrl: !!process.env.FIREBASE_DATABASE_URL,
      hasCleanupKey: !!process.env.CLEANUP_API_KEY,
      firebaseKeyLength: process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.length || 0,
      appsLength: admin.apps.length
    };

    if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        envCheck.firebaseInitSuccess = true;
      } catch (e) {
        envCheck.firebaseInitError = e.message;
      }
    }

    if (admin.apps.length) {
      const db = admin.firestore();
      const testQuery = await db.collection('claims').limit(1).get();
      envCheck.firestoreWorks = true;
      envCheck.claimsCount = testQuery.size;
    }

    return res.status(200).json({
      success: true,
      environment: envCheck
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Test failed',
      details: error.message,
      stack: error.stack
    });
  }
}
