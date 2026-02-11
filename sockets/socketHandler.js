const fs = require('fs');
const aiService = require('../services/aiService');
const Meeting = require('../models/Meeting');
const Case = require('../models/Case');

module.exports = (io, socket) => {
    let currentMeetingId = null; 

    // 1. Join Meeting
    socket.on('join_meeting', async (meetingCode) => {
        try {
            const meeting = await Meeting.findOne({ meeting_code: meetingCode });

            if (!meeting) {
                socket.emit('error', 'Invalid Meeting Code');
                return;
            }

            // --- CHECK 1: IS MEETING CLOSED? ---
            if (meeting.status === 'completed') {
                console.log(`❌ User tried to join ended meeting: ${meetingCode}`);
                socket.emit('error', 'This meeting has ended. Please start a new one.');
                return;
            }
            // -----------------------------------

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
            // Fetch Meeting to check status
            const meeting = await Meeting.findById(currentMeetingId);

            // --- CHECK 2: STOP PROCESSING IF CLOSED ---
            if (!meeting || meeting.status === 'completed') {
                console.warn("⚠️ Audio received for closed meeting. Ignoring.");
                socket.emit('error', 'Meeting Ended');
                return; 
            }
            // ------------------------------------------

            fs.writeFileSync(tempFilePath, audioBuffer);
            
            // Transcribe
            const userText = await aiService.transcribeAudio(tempFilePath);
            console.log("User said:", userText);

            if (!userText) return;

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
                animation: aiResult.emotion
            });

        } catch (err) {
            console.error("Socket Error:", err);
        } finally {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        }
    });
};