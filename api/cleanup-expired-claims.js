import admin from 'firebase-admin';

let db;

const EMAIL_API_BASE = process.env.EMAIL_API_BASE || 'https://api.reunited.co.in';
const REMINDER_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

const sendEmail = (path, payload) =>
  fetch(`${EMAIL_API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(response => {
    if (!response.ok) throw new Error(`${path} responded ${response.status}`);
  });

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
      .where('status', 'in', ['pending', 'approved'])
      .where('pickupDeadline', '<=', now)
      .get();

    let processedCount = 0;
    const emailQueue = [];
    const batchSize = 150;
    const chunks = [];

    for (let i = 0; i < expiredClaimsSnapshot.docs.length; i += batchSize) {
      chunks.push(expiredClaimsSnapshot.docs.slice(i, i + batchSize));
    }

    for (const chunk of chunks) {
      const batch = db.batch();

      for (const doc of chunk) {
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
          status: 'available',
          claimCode: admin.firestore.FieldValue.delete()
        });

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

        if (claimData.userEmail) {
          emailQueue.push({
            userId: claimData.userId,
            path: '/api/send-claim-expired',
            payload: {
              email: claimData.userEmail,
              userName: claimData.userName,
              itemName: claimData.itemName
            }
          });
        }

        processedCount++;
      }

      await batch.commit();
    }

    const reminderWindowEnd = admin.firestore.Timestamp.fromMillis(now.toMillis() + REMINDER_WINDOW_MS);
    const upcomingSnapshot = await db.collection('claims')
      .where('status', '==', 'approved')
      .where('pickupDeadline', '>', now)
      .where('pickupDeadline', '<=', reminderWindowEnd)
      .get();

    let remindedCount = 0;
    const reminderBatch = db.batch();
    for (const doc of upcomingSnapshot.docs) {
      const claimData = doc.data();
      if (claimData.reminderSentAt || !claimData.userEmail) continue;

      reminderBatch.update(doc.ref, { reminderSentAt: now });
      emailQueue.push({
        userId: claimData.userId,
        path: '/api/send-pickup-reminder',
        payload: {
          email: claimData.userEmail,
          userName: claimData.userName,
          itemName: claimData.itemName,
          deadline: claimData.pickupDeadline.toDate().toISOString()
        }
      });
      remindedCount++;
    }
    if (remindedCount > 0) {
      await reminderBatch.commit();
    }

    const userIds = [...new Set(emailQueue.map(job => job.userId).filter(Boolean))];
    const optedOut = new Set();
    if (userIds.length > 0) {
      const userDocs = await db.getAll(...userIds.map(id => db.collection('users').doc(id)));
      for (const userDoc of userDocs) {
        if (userDoc.exists && userDoc.data().preferences?.emailNotifications === false) {
          optedOut.add(userDoc.id);
        }
      }
    }

    const emailJobs = emailQueue
      .filter(job => !optedOut.has(job.userId))
      .map(job => sendEmail(job.path, job.payload));
    const emailResults = await Promise.allSettled(emailJobs);
    const emailFailures = emailResults.filter(result => result.status === 'rejected').length;

    return res.status(200).json({
      success: true,
      processedCount,
      remindedCount,
      emailsSent: emailJobs.length - emailFailures,
      emailFailures,
      message: `Expired ${processedCount} claims, sent ${remindedCount} pickup reminders`
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}