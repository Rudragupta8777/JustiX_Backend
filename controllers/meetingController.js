const Meeting = require('../models/Meeting');
const Case = require('../models/Case'); 
const aiService = require('../services/aiService');

// Helper for 6-digit code
const generateMeetingCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// 1. Create Meeting
exports.createMeeting = async (req, res) => {
    try {
        const { caseId } = req.body;
        const userId = req.user.uid;

        const count = await Meeting.countDocuments({ case_id: caseId });
        const nextNumber = count + 1;
        let code = generateMeetingCode();

        const newMeeting = new Meeting({
            case_id: caseId,
            user_id: userId,
            meeting_number: nextNumber,
            meeting_code: code,
            transcript: [],
            status: "active"
        });

        await newMeeting.save();

        res.json({ 
            success: true, 
            meetingCode: code, 
            meetingId: newMeeting._id,
            meetingNumber: nextNumber 
        });

    } catch (err) {
        console.error("Create Meeting Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 2. VR Join
exports.joinMeetingVR = async (req, res) => {
    try {
        const { meetingCode } = req.body;

        if (!meetingCode) return res.status(400).json({ error: "Meeting Code is required" });

        const meeting = await Meeting.findOne({ meeting_code: meetingCode });
        if (!meeting) return res.status(404).json({ error: "Invalid Session Code" });

        const caseData = await Case.findById(meeting.case_id);
        if (!caseData) return res.status(404).json({ error: "Case file not found" });

        res.json({
            success: true,
            meetingId: meeting._id,
            caseId: caseData._id,
            caseTitle: caseData.title,
            evidencePages: caseData.page_images, 
            caseSummary: caseData.summary
        });

    } catch (err) {
        console.error("VR Join Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 3. End Meeting (UPDATED: Uses meetingId)
exports.endMeeting = async (req, res) => {
    try {
        // CHANGED: Expect meetingId instead of meetingCode
        const { meetingId } = req.body;

        if (!meetingId) {
            return res.status(400).json({ error: "Meeting ID is required" });
        }

        // CHANGED: Find by ID
        const meeting = await Meeting.findById(meetingId);
        
        if (!meeting) return res.status(404).json({ error: "Meeting not found" });

        // Idempotency check
        if (meeting.status === "completed") {
            return res.json({ 
                success: true, 
                message: "Meeting already ended",
                summary: meeting.summary,
                score: meeting.score,
                feedback: meeting.feedback
            });
        }

        // --- Generate AI Analysis ---
        const analysis = await aiService.generatePostSessionAnalysis(meeting.transcript);

        // --- Generate Judge's Closing Audio ---
        const closingText = "The court is adjourned. We will review your arguments in the next session.";
        let closingAudio = null;
        
        try {
            // Generates audio using the "Judge" persona
            closingAudio = await aiService.generateAudio(closingText, "Judge");
        } catch (audioErr) {
            console.error("Failed to generate closing audio:", audioErr);
        }

        // --- Update Database ---
        meeting.summary = analysis.summary;
        meeting.feedback = analysis.feedback;
        meeting.score = analysis.score;
        meeting.status = "completed"; 
        meeting.ended_at = new Date();
        
        await meeting.save();

        res.json({ 
            success: true, 
            ...analysis, 
            closing_audio: closingAudio, 
            closing_text: closingText 
        });

    } catch (err) {
        console.error("End Meeting Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 4. Get Single Meeting
exports.getMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        res.json(meeting);
    } catch (e) {
        res.status(500).json({ error: "Meeting not found" });
    }
};

// 5. Get History
exports.getCaseHistory = async (req, res) => {
    try {
        const meetings = await Meeting.find({ 
            case_id: req.params.caseId,
            user_id: req.user.uid
        }).sort({ created_at: -1 }); 
        res.json(meetings);
    } catch (e) {
        res.status(500).json({ error: "History fetch failed" });
    }
};