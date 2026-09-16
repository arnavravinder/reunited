import admin from 'firebase-admin';

let db;

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization || '';
    const accepted = [process.env.CLEANUP_API_KEY].filter(Boolean).map(secret => `Bearer ${secret}`);
    if (!accepted.length || !accepted.includes(authHeader)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!admin.apps.length) {
      if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set');
      }
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)),
        databaseURL: process.env.FIREBASE_DATABASE_URL
      });
    }

    if (!db) {
      db = admin.firestore();
    }

    const apply = req.query && (req.query.apply === '1' || req.query.apply === 'true');

    const [claimsSnapshot, itemsSnapshot] = await Promise.all([
      db.collection('claims').where('status', 'in', ['pending', 'approved']).get(),
      db.collection('items').where('status', '==', 'collected').get()
    ]);

    const collectedItemIds = new Set(itemsSnapshot.docs.map(doc => doc.id));
    const stranded = claimsSnapshot.docs.filter(doc => collectedItemIds.has(doc.data().itemId));
    const affectedUsers = new Set(stranded.map(doc => doc.data().userId).filter(Boolean));

    if (!apply) {
      return res.status(200).json({
        dryRun: true,
        strandedClaims: stranded.length,
        affectedParents: affectedUsers.size,
        message: 'No changes written. Re-run with ?apply=1 to release these claim slots.'
      });
    }

    const now = admin.firestore.Timestamp.now();
    let updated = 0;

    for (let i = 0; i < stranded.length; i += 400) {
      const batch = db.batch();
      stranded.slice(i, i + 400).forEach(doc => {
        batch.update(doc.ref, {
          status: 'collected',
          collectedAt: doc.data().collectedAt || now,
          backfilledAt: now
        });
        updated++;
      });
      await batch.commit();
    }

    return res.status(200).json({
      dryRun: false,
      strandedClaims: stranded.length,
      affectedParents: affectedUsers.size,
      updated
    });
  } catch (error) {
    console.error('Backfill failed:', error.message);
    return res.status(500).json({ error: 'Backfill failed', message: error.message });
  }
}
