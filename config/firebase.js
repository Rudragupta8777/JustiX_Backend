const admin = require("firebase-admin");

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // If on Render, parse the string back into an object
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // If local, require the file (make sure this file is in .gitignore!)
  serviceAccount = require("../serviceAccount.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;