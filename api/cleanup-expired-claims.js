import admin from 'firebase-admin';

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-signature'];

  if (!isVercelCron && (!authHeader || authHeader !== `Bearer ${process.env.CLEANUP_API_KEY}`)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
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

    res.status(200).json({
      success: true,
      processedCount,
      message: `Successfully processed ${processedCount} expired claims`
    });

  } catch (error) {
    console.error('Error cleaning up expired claims:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}