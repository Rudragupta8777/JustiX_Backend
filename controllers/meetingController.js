const Meeting = require('../models/Meeting');
const Case = require('../models/Case'); // Required for VR Join to fetch images
const aiService = require('../services/aiService');

// Helper for 6-digit code
const generateMeetingCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// 1. Create Meeting (Starts a new session from Mobile)
exports.createMeeting = async (req, res) => {
    try {
        const { caseId } = req.body;
        const userId = req.user.uid; // From auth middleware

        // A. Calculate Meeting Number
        // We count how many meetings already exist for this specific case
        const count = await Meeting.countDocuments({ case_id: caseId });
        const nextNumber = count + 1;

        // B. Generate Unique Code
        let code = generateMeetingCode();

        // C. Create Document
        const newMeeting = new Meeting({
            case_id: caseId,
            user_id: userId,
            meeting_number: nextNumber, // Save the sequential number
            meeting_code: code,
            transcript: [],
            status: "active"
        });

        await newMeeting.save();

        // D. Return the Number so Android displays "Session #X" immediately
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

// 2. VR Join (Headset calls this to validate code & get images)
exports.joinMeetingVR = async (req, res) => {
    try {
        const { meetingCode } = req.body;

        if (!meetingCode) {
            return res.status(400).json({ error: "Meeting Code is required" });
        }

        // A. Find the Meeting
        const meeting = await Meeting.findOne({ meeting_code: meetingCode });
        if (!meeting) {
            return res.status(404).json({ error: "Invalid Session Code" });
        }

        // B. Find the Case Details (Specifically Images)
        const caseData = await Case.findById(meeting.case_id);
        if (!caseData) {
            return res.status(404).json({ error: "Case file not found" });
        }

        // C. Return Everything the VR Needs
        res.json({
            success: true,
            meetingId: meeting._id,
            caseId: caseData._id,
            caseTitle: caseData.title,
            
            // The VR headset will spawn these pages on the virtual desk
            evidencePages: caseData.page_images, 
            
            // Optional context for local processing
            caseSummary: caseData.summary
        });

    } catch (err) {
        console.error("VR Join Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 3. End Meeting (Called by VR or Mobile to finish session)
exports.endMeeting = async (req, res) => {
    try {
        const { meetingCode } = req.body;

        if (!meetingCode) {
            return res.status(400).json({ error: "Meeting Code is required" });
        }

        const meeting = await Meeting.findOne({ meeting_code: meetingCode });
        
        if (!meeting) return res.status(404).json({ error: "Meeting not found" });

        // Idempotency check: If already completed, just return results
        if (meeting.status === "completed") {
            return res.json({ 
                success: true, 
                message: "Meeting already ended",
                summary: meeting.summary,
                score: meeting.score
            });
        }

        // Generate AI Analysis
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

// 4. Get Single Meeting (For Details Screen)
exports.getMeeting = async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        res.json(meeting);
    } catch (e) {
        res.status(500).json({ error: "Meeting not found" });
    }
};

// 5. Get History (For Case Details List)
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