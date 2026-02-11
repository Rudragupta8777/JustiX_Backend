const admin = require('../config/firebase'); // You need to setup firebase-admin sdk

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken; // Use this 'req.user.uid' in your controllers
    next();
  } catch (error) {
    return res.status(403).json({ message: "Unauthorized" });
  }
};

module.exports = verifyToken;