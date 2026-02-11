const express = require('express');
const router = express.Router();
const multer = require('multer');
const caseController = require('../controllers/caseController');
const meetingController = require('../controllers/meetingController');
const verifyToken = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

// CASE MANAGEMENT
router.post('/upload', verifyToken, upload.single('pdf'), caseController.uploadCase);
router.get('/my-cases', verifyToken, caseController.getMyCases);

// MEETING MANAGEMENT
router.post('/meeting/start', verifyToken, meetingController.createMeeting);

router.post('/meeting/end', meetingController.endMeeting);


router.get('/meeting/:id', verifyToken, meetingController.getMeeting);
router.get('/:caseId/history', verifyToken, meetingController.getCaseHistory);

module.exports = router;