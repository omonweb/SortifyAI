const admin = require("firebase-admin");

function getServiceAccount() {
  if (process.env.FIREBASE_CREDENTIALS) {
    const parsed = JSON.parse(process.env.FIREBASE_CREDENTIALS);

    // Render-style env vars often escape newlines inside private keys.
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    }

    return parsed;
  }

  return require("../firebase-service-account.json");
}

function getStorageBucket(serviceAccount) {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    serviceAccount.storageBucket ||
    "sortifyai-2026.firebasestorage.app"
  );
}

const serviceAccount = getServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: getStorageBucket(serviceAccount),
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { admin, db, bucket };
