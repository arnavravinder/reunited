import admin from 'firebase-admin';

let db;

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    const isVercelCron = req.headers['x-vercel-signature'];

    if (!isVercelCron && (!authHeader || authHeader !== `Bearer ${process.env.CLEANUP_API_KEY}`)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!admin.apps.length) {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
      }
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }

    if (!db) {
      db = admin.firestore();
    }
    const now = admin.firestore.Timestamp.now();

    const expiredClaimsSnapshot = await db.collection('claims')
      .where('pickupDeadline', '<=', now)
      .get();

    const batch = db.batch();
    let processedCount = 0;

    for (const doc of expiredClaimsSnapshot.docs) {
      const claimData = doc.data();

      if (claimData.status !== 'pending' && claimData.status !== 'approved') {
        continue;
      }

      batch.update(doc.ref, {
        status: 'expired',
        expiredAt: now
      });

      const itemRef = db.collection('items').doc(claimData.itemId);
      batch.update(itemRef, {
        claimed: false,
        claimId: null,
        claimStatus: null,
        status: 'available'
      });

      batch.create(db.collection('notifications').doc(), {
        userId: claimData.userId,
        title: 'Claim Expired',
        message: `Your claim for ${claimData.itemName} has expired. The item has been returned to the lost and found office.`,
        timestamp: now,
        type: 'claim_update',
        read: false,
        actionable: false,
        itemId: claimData.itemId,
        claimId: doc.id
      });

      processedCount++;
    }

    if (processedCount > 0) {
      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      processedCount,
      message: `Successfully processed ${processedCount} expired claims`
    });

  } catch (error) {
    console.error('Error cleaning up expired claims:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}