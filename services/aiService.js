const { createClient } = require("@deepgram/sdk");
const OpenAI = require('openai');
const fs = require('fs');
const axios = require('axios'); // Required to talk to Python

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Python AI URL (from .env)
const AI_SERVICE_URL = process.env.AI_MODELS_URI; 

// 1. FAST Speech-to-Text (Deepgram)
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
        console.error("Deepgram Error:", err);
        return ""; 
    }
};

// 2. The Brain (CALLS PYTHON MICROSERVICE)
exports.getAIResponse = async (userText, caseId, chatHistory) => {
    try {
        // We send the data to the Python Brain
        const response = await axios.post(`${AI_SERVICE_URL}/turn`, {
            case_id: caseId.toString(), // Ensure string format
            user_text: userText,
            history: chatHistory
        });

        // Python returns: { "reply_text": "Objection...", "speaker": "Lawyer" }
        return response.data.reply_text;

    } catch (error) {
        console.error("⚠️ AI Brain Error (Python):", error.message);
        // Fallback if Python is down, so the app doesn't crash
        return "I object! (The AI service is momentarily unavailable).";
    }
};

// 3. Text-to-Speech (OpenAI)
exports.generateAudio = async (text) => {
    try {
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "onyx",
            input: text,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        return buffer.toString('base64');
    } catch (err) {
        console.error("TTS Error:", err);
        return null;
    }
};

// 4. End-of-Meeting Analysis (CALLS PYTHON MICROSERVICE)
// It is better to let Python do this since it has the RAG context, 
// but doing it in Node (as you had it) is also fine. 
// Ideally, use Python for consistency:
exports.generatePostSessionAnalysis = async (transcript) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/analyze`, {
            transcript: transcript
        });
        return response.data;
    } catch (error) {
        console.error("Analysis Error:", error.message);
        return { 
            summary: "Error generating summary", 
            feedback: "Please try again.", 
            score: 0 
        };
    }
};