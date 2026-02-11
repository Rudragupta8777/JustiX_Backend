const express = require('express');
const router = express.Router();
const multer = require('multer');
const caseController = require('../controllers/caseController');
const meetingController = require('../controllers/meetingController');
const verifyToken = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

// CASE UPLOAD
router.post('/upload', verifyToken, upload.single('pdf'), caseController.uploadCase);

// MEETING MANAGEMENT
router.post('/meeting/start', verifyToken, meetingController.createMeeting);
router.post('/meeting/:id/end', verifyToken, meetingController.endMeeting);
router.get('/meeting/:id', verifyToken, meetingController.getMeeting);
router.get('/:caseId/history', verifyToken, meetingController.getCaseHistory);

module.exports = router;