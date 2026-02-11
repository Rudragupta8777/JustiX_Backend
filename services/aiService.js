const { createClient } = require("@deepgram/sdk");
const fs = require('fs');
const axios = require('axios'); 

// Initialize Deepgram
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Python AI URL
const AI_SERVICE_URL = process.env.AI_MODELS_URI; 

// 1. FAST Speech-to-Text (Deepgram Nova-2)
exports.transcribeAudio = async (filePath) => {
    try {
        const audioBuffer = fs.readFileSync(filePath);
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioBuffer,
            {
                model: "nova-2",
                smart_format: true,
            }
        );
        if (error) throw error;
        return result.results.channels[0].alternatives[0].transcript;
    } catch (err) {
        console.error("Deepgram STT Error:", err);
        return ""; 
    }
};

// 2. The Brain (ECHO FALLBACK MODE)
exports.getAIResponse = async (userText, caseId, chatHistory) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/turn`, {
            case_id: caseId.toString(),
            user_text: userText,
            history: chatHistory
        });
        return response.data.reply_text;
    } catch (error) {
        console.warn("⚠️ Python Brain offline. Switching to ECHO MODE.");
        return `You said: "${userText}". I am listening.`;
    }
};

// 3. Text-to-Speech (UPDATED TO DEEPGRAM AURA - FASTEST ⚡)
exports.generateAudio = async (text) => {
    try {
        console.log("Generating Audio via Deepgram Aura...");

        const response = await deepgram.speak.request(
            { text },
            {
                model: "aura-orion-en", // "Orion" is a strong Male Lawyer voice. Use "aura-asteria-en" for Female.
                encoding: "mp3",
            }
        );

        // Deepgram returns a Stream, we must convert it to Base64
        const stream = await response.getStream();
        if (!stream) throw new Error("Deepgram returned no audio stream");

        const buffer = await getBufferFromStream(stream);
        return buffer.toString("base64");

    } catch (err) {
        console.error("Deepgram TTS Error:", err);
        return null;
    }
};

// Helper to convert Stream to Buffer
async function getBufferFromStream(stream) {
    const chunks = [];
    const reader = stream.getReader();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    
    // Merge chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return Buffer.from(result);
}

// 4. End Analysis
exports.generatePostSessionAnalysis = async (transcript) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/analyze`, {
            transcript: transcript
        });
        return response.data;
    } catch (error) {
        return { 
            summary: "Analysis unavailable (Python Offline).", 
            feedback: "Great connectivity test!", 
            score: 100 
        };
    }
};