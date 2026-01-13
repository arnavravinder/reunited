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

    // Optimized query: only fetch active claims that have passed the deadline
    // Note: This requires a composite index on [status, pickupDeadline]
    const expiredClaimsSnapshot = await db.collection('claims')
      .where('status', 'in', ['pending', 'approved'])
      .where('pickupDeadline', '<=', now)
      .get();

    if (expiredClaimsSnapshot.empty) {
      return res.status(200).json({
        success: true,
        processedCount: 0,
        message: 'No expired claims found'
      });
    }

    let processedCount = 0;
    const batchSize = 150; // Keep well under 500 limit (3 operations per claim = 450 ops)
    const chunks = [];

    // Create chunks of documents
    for (let i = 0; i < expiredClaimsSnapshot.docs.length; i += batchSize) {
      chunks.push(expiredClaimsSnapshot.docs.slice(i, i + batchSize));
    }

    // Process each chunk
    for (const chunk of chunks) {
      const batch = db.batch();

      for (const doc of chunk) {
        const claimData = doc.data();

        // Double check status just in case
        if (claimData.status !== 'pending' && claimData.status !== 'approved') {
          continue;
        }

        // 1. Update claim status
        batch.update(doc.ref, {
          status: 'expired',
          expiredAt: now
        });

        // 2. Update item status
        const itemRef = db.collection('items').doc(claimData.itemId);
        batch.update(itemRef, {
          claimed: false,
          claimId: null,
          claimStatus: null,
          status: 'available',
          claimCode: admin.firestore.FieldValue.delete() // Optional: remove claim code when returned to pool
        });

        // 3. Notify user
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
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

      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      processedCount,
      message: `Successfully processed ${processedCount} expired claims in ${chunks.length} batches`
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}