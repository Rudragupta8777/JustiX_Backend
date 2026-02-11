const Meeting = require('../models/Meeting');
const aiService = require('../services/aiService'); //

// Helper for 6-digit code
const generateMeetingCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// 1. Create Meeting (UPDATED)
exports.createMeeting = async (req, res) => {
    try {
        const { caseId } = req.body;
        const userId = req.user.uid; // From auth middleware

        // 1. Calculate Meeting Number
        // We count how many meetings already exist for this specific case
        const count = await Meeting.countDocuments({ case_id: caseId });
        const nextNumber = count + 1;

        // 2. Generate Code
        let code = generateMeetingCode();

        // 3. Create Document
        const newMeeting = new Meeting({
            case_id: caseId,
            user_id: userId,
            meeting_number: nextNumber, // Save the number
            meeting_code: code,
            transcript: [],
            status: "active"
        });

        await newMeeting.save();

        // 4. Return the Number in the response so Android can see it immediately
        res.json({ 
            success: true, 
            meetingCode: code, 
            meetingId: newMeeting._id,
            meetingNumber: nextNumber // <--- ADDED THIS
        });

    } catch (err) {
        console.error("Create Meeting Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 2. End Meeting (UPDATED)
exports.endMeeting = async (req, res) => {
    try {
        const { meetingCode } = req.body;

        if (!meetingCode) {
            return res.status(400).json({ error: "Meeting Code is required" });
        }

        const meeting = await Meeting.findOne({ meeting_code: meetingCode });
        
        if (!meeting) return res.status(404).json({ error: "Meeting not found" });

        if (meeting.status === "completed") {
            return res.json({ 
                success: true, 
                message: "Meeting already ended",
                summary: meeting.summary,
                score: meeting.score
            });
        }

        // AI Analysis
        const analysis = await aiService.generatePostSessionAnalysis(meeting.transcript);

        meeting.summary = analysis.summary;
        meeting.feedback = analysis.feedback;
        meeting.score = analysis.score;
        meeting.status = "completed"; 
        meeting.ended_at = new Date();
        
        await meeting.save();

        res.json({ success: true, ...analysis });

    } catch (err) {
        console.error("End Meeting Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 3. Get Meeting
exports.getMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        res.json(meeting);
    } catch (e) {
        res.status(500).json({ error: "Meeting not found" });
    }
};

// 4. Get History (This returns the full object with meeting_number)
exports.getCaseHistory = async (req, res) => {
    try {
        const meetings = await Meeting.find({ 
            case_id: req.params.caseId,
            user_id: req.user.uid
        }).sort({ created_at: -1 }); // Newest first
        res.json(meetings);
    } catch (e) {
        res.status(500).json({ error: "History fetch failed" });
    }
};