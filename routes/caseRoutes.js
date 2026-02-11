const express = require('express');
const router = express.Router();
const multer = require('multer');
const caseController = require('../controllers/caseController');
const meetingController = require('../controllers/meetingController');
const verifyToken = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

// --- CASE MANAGEMENT ---
router.post('/upload', verifyToken, upload.single('pdf'), caseController.uploadCase);
router.get('/my-cases', verifyToken, caseController.getMyCases);

// --- MEETING MANAGEMENT ---

// 1. Mobile starts a meeting
router.post('/meeting/start', verifyToken, meetingController.createMeeting);

// 2. VR calls this to validate code & download evidence images
// (No token verification needed here as VR uses the 6-digit code for access)
router.post('/meeting/vr/join', meetingController.joinMeetingVR);

// 3. End a meeting
router.post('/meeting/end', meetingController.endMeeting);

// 4. Get data for Android UI
router.get('/meeting/:id', verifyToken, meetingController.getMeeting);
router.get('/:caseId/history', verifyToken, meetingController.getCaseHistory);

module.exports = router;