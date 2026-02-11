const fs = require('fs');
const aiService = require('../services/aiService');
const Meeting = require('../models/Meeting');
const Case = require('../models/Case');

module.exports = (io, socket) => {
    let currentMeetingId = null;

    // VR joins the meeting room
    socket.on('join_meeting', (meetingId) => {
        currentMeetingId = meetingId;
        console.log(`User joined meeting: ${meetingId}`);
        socket.join(meetingId);
    });

    // Audio Stream Processing
    socket.on('audio_data', async (audioBuffer) => {
        if (!currentMeetingId) return;

        const tempFilePath = `uploads/audio_${socket.id}_${Date.now()}.wav`;

        try {
            // 1. Write Audio File
            fs.writeFileSync(tempFilePath, audioBuffer);

            // 2. STT (Deepgram)
            const userText = await aiService.transcribeAudio(tempFilePath);
            console.log("User said:", userText);

            if (!userText) return; // Ignore silence

            // 3. Get Context
            const meeting = await Meeting.findById(currentMeetingId);
            const caseData = await Case.findById(meeting.case_id);
            
            const history = meeting.transcript.map(t => ({
                role: t.speaker === "User" ? "user" : "assistant",
                content: t.text
            }));

            // 4. AI Logic (GPT-4o)
            const aiResponseText = await aiService.getAIResponse(userText, meeting.case_id, history);

            // 5. TTS (OpenAI)
            const audioBase64 = await aiService.generateAudio(aiResponseText);

            // 6. Save Turn to DB
            meeting.transcript.push({ speaker: "User", text: userText });
            meeting.transcript.push({ speaker: "Lawyer", text: aiResponseText });
            await meeting.save();

            // 7. Send to VR
            socket.emit('ai_response', {
                text: aiResponseText,
                audio: audioBase64,
                speaker: "Lawyer",
                animation: "Objection" // You can randomize this
            });

        } catch (err) {
            console.error("Socket Error:", err);
        } finally {
            // Cleanup temp file
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
    });
};