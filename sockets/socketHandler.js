const fs = require('fs');
const aiService = require('../services/aiService');
const Meeting = require('../models/Meeting');

module.exports = (io, socket) => {
    let currentMeetingId = null; 

    // 1. Join Meeting
    socket.on('join_meeting', async (meetingId) => {
        // ... (Keep existing logic, just ensure variable name matches) ...
        console.log(`User joining room: ${meetingId}`);
        currentMeetingId = meetingId;
        socket.join(meetingId);
        socket.emit('joined_status', { success: true, meetingId: meetingId });
    });

    // 2. Audio Processing (UPDATED TO MATCH HTML)
    socket.on('audio_stream', async (data) => {
        // data = { meetingId, audio: "BASE64STRING...", speaker: "User" }
        
        const { meetingId, audio } = data; // Extract fields
        if (!meetingId) return;

        const tempFilePath = `uploads/audio_${socket.id}_${Date.now()}.wav`;

        try {
            // CONVERT BASE64 TO BUFFER
            const audioBuffer = Buffer.from(audio, 'base64');
            fs.writeFileSync(tempFilePath, audioBuffer);
            
            // --- REST OF YOUR LOGIC IS SAME ---
            // Transcribe
            const userText = await aiService.transcribeAudio(tempFilePath);
            console.log("User said:", userText);

            if (!userText) return;

            const meeting = await Meeting.findById(meetingId);
            if (!meeting) return;

            // Prepare Context
            const history = meeting.transcript.map(t => ({
                role: t.speaker === "User" ? "user" : "assistant",
                content: t.text
            }));

            // AI Decision
            const aiResult = await aiService.getAIResponse(userText, meeting.case_id, history);
            
            // Generate Audio
            const audioBase64 = await aiService.generateAudio(aiResult.text, aiResult.speaker);

            // Save to DB
            meeting.transcript.push({ speaker: "User", text: userText });
            meeting.transcript.push({ speaker: aiResult.speaker, text: aiResult.text });
            await meeting.save();

            // Send to VR
            socket.emit('ai_response', {
                text: aiResult.text,
                audio: audioBase64,
                speaker: aiResult.speaker,
                emotion: aiResult.emotion
            });

        } catch (err) {
            console.error("Socket Error:", err);
        } finally {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
    });
};