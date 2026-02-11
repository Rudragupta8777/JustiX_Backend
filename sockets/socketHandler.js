const fs = require('fs');
const aiService = require('../services/aiService');
const Meeting = require('../models/Meeting');
const Case = require('../models/Case');

// CRITICAL: This must be a direct function export
module.exports = (io, socket) => {
    let currentMeetingId = null; 

    // 1. VR sends the 6-Digit Code
    socket.on('join_meeting', async (meetingCode) => {
        try {
            console.log(`VR trying to join with code: ${meetingCode}`);

            // FIND THE MEETING BY CODE
            const meeting = await Meeting.findOne({ meeting_code: meetingCode });

            if (!meeting) {
                console.log("❌ Meeting Code Not Found");
                socket.emit('error', 'Invalid Meeting Code');
                return;
            }

            // Store REAL ID internally
            currentMeetingId = meeting._id.toString();
            socket.join(currentMeetingId); 
            
            console.log(`✅ User joined meeting room: ${currentMeetingId}`);
            socket.emit('joined', { success: true }); 

        } catch (err) {
            console.error("Join Error:", err);
            socket.emit('error', 'Server Error');
        }
    });

    // 2. Audio Processing
    socket.on('audio_data', async (audioBuffer) => {
        if (!currentMeetingId) return; 

        const tempFilePath = `uploads/audio_${socket.id}_${Date.now()}.wav`;

        try {
            fs.writeFileSync(tempFilePath, audioBuffer);

            // STT
            const userText = await aiService.transcribeAudio(tempFilePath);
            console.log("User said:", userText);

            if (!userText) return;

            // Fetch Context
            const meeting = await Meeting.findById(currentMeetingId);
            const caseData = await Case.findById(meeting.case_id);
            
            const history = meeting.transcript.map(t => ({
                role: t.speaker === "User" ? "user" : "assistant",
                content: t.text
            }));

            // AI Logic
            const aiResponseText = await aiService.getAIResponse(userText, meeting.case_id, history);

            // TTS
            const audioBase64 = await aiService.generateAudio(aiResponseText);

            // Save to DB
            meeting.transcript.push({ speaker: "User", text: userText });
            meeting.transcript.push({ speaker: "Lawyer", text: aiResponseText });
            await meeting.save();

            // Send to VR
            socket.emit('ai_response', {
                text: aiResponseText,
                audio: audioBase64,
                speaker: "Lawyer",
                animation: "Objection"
            });

        } catch (err) {
            console.error("Socket Error:", err);
        } finally {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
    });
};