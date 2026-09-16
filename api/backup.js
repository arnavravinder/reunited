import admin from 'firebase-admin';

let db;

const EMAIL_API_BASE = process.env.EMAIL_API_BASE || 'https://api.reunited.co.in';
const COLLECTIONS = ['items', 'claims', 'lostItems', 'users'];
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const serialise = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value === 'object') {
    if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
      return { latitude: value.latitude, longitude: value.longitude };
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialise(entry)]));
  }
  return value;
};

const csvCell = (value) => `"${String(value === null || value === undefined ? '' : value).replace(/"/g, '""')}"`;

const buildClaimsCsv = (claims, items) => {
  const itemsById = new Map(items.map(item => [item.id, item]));
  const header = ['Item', 'Claim Code', 'Claimed By', 'Claimant Email', 'Student Name', 'Grade', 'Claim Date', 'Pickup Deadline', 'Status', 'Storage Location'];
  const rows = claims.map(claim => {
    const item = itemsById.get(claim.itemId) || {};
    const grade = claim.studentGrade ? `${claim.studentGrade}${claim.studentSection || ''}` : '';
    return [
      claim.itemName || item.name || '',
      claim.claimCode || item.claimCode || '',
      claim.userName || '',
      claim.userEmail || '',
      claim.studentName || '',
      grade,
      (claim.claimDate || '').toString().slice(0, 10),
      (claim.pickupDeadline || '').toString().slice(0, 10),
      claim.status || '',
      item.storageLocation || ''
    ];
  });
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
};

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    const isVercelCron = req.headers['x-vercel-signature'];

    if (!isVercelCron && (!authHeader || authHeader !== `Bearer ${process.env.BACKUP_API_KEY}`)) {
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

    const generatedAt = new Date();
    const stamp = generatedAt.toISOString().slice(0, 10);
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'reunited-web.appspot.com';
    const bucket = admin.storage().bucket(bucketName);

    const counts = {};
    const skipped = [];
    const exported = {};

    for (const name of COLLECTIONS) {
      try {
        const snapshot = await db.collection(name).get();
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...serialise(doc.data()) }));
        exported[name] = docs;
        counts[name] = docs.length;

        await bucket.file(`backups/${stamp}/${name}.json`).save(JSON.stringify(docs, null, 2), {
          contentType: 'application/json',
          resumable: false
        });
      } catch (error) {
        console.error(`Backup failed for ${name}:`, error.message);
        skipped.push(name);
      }
    }

    const storagePath = `gs://${bucketName}/backups/${stamp}/`;
    const istNow = new Date(generatedAt.getTime() + IST_OFFSET_MS);
    const isMonday = istNow.getUTCDay() === 1;
    const force = req.query && (req.query.email === '1' || req.query.email === 'true');

    let emailed = false;
    if ((isMonday || force) && process.env.BACKUP_REPORT_EMAIL) {
      try {
        const csv = buildClaimsCsv(exported.claims || [], exported.items || []);
        const response = await fetch(`${EMAIL_API_BASE}/api/send-backup-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.BACKUP_API_KEY}`
          },
          body: JSON.stringify({
            to: process.env.BACKUP_REPORT_EMAIL,
            counts,
            storagePath,
            csv,
            generatedAt: generatedAt.toISOString(),
            skipped
          })
        });
        if (!response.ok) throw new Error(`send-backup-report responded ${response.status}`);
        emailed = true;
      } catch (error) {
        console.error('Backup report email failed:', error.message);
      }
    }

    return res.status(200).json({
      success: skipped.length === 0,
      generatedAt: generatedAt.toISOString(),
      storagePath,
      counts,
      skipped,
      emailed
    });
  } catch (error) {
    console.error('Backup job failed:', error.message);
    return res.status(500).json({ error: 'Backup job failed', message: error.message });
  }
}
