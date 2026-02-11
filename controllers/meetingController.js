const Meeting = require('../models/Meeting');
const aiService = require('../services/aiService');

// Start/Resume Meeting
exports.createMeeting = async (req, res) => {
    try {
        const { caseId } = req.body;
        const userId = req.user.uid;

        // Auto-increment meeting number
        const count = await Meeting.countDocuments({ case_id: caseId, user_id: userId });
        
        const newMeeting = new Meeting({
            case_id: caseId,
            user_id: userId,
            meeting_number: count + 1,
            transcript: [],
            status: "active"
        });

        await newMeeting.save();
        res.json({ success: true, meetingId: newMeeting._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Pause/End Meeting
exports.endMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) return res.status(404).json({ error: "Meeting not found" });

        // Generate Analysis
        const analysis = await aiService.generatePostSessionAnalysis(meeting.transcript);

        // Update DB
        meeting.summary = analysis.summary;
        meeting.feedback = analysis.feedback;
        meeting.score = analysis.score;
        meeting.status = "completed";
        meeting.ended_at = new Date();
        
        await meeting.save();

        res.json({ success: true, ...analysis });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get Single Meeting
exports.getMeeting = async (req, res) => {
    const meeting = await Meeting.findById(req.params.id);
    res.json(meeting);
};

// Get All Meetings for a Case (History)
exports.getCaseHistory = async (req, res) => {
    const meetings = await Meeting.find({ 
        case_id: req.params.caseId,
        user_id: req.user.uid
    }).sort({ created_at: -1 });
    res.json(meetings);
};