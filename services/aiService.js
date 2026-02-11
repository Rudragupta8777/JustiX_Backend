const { createClient } = require("@deepgram/sdk");
const fs = require('fs');
const axios = require('axios'); 

// Initialize Deepgram
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const AI_SERVICE_URL = process.env.AI_MODELS_URI; 

// 1. FAST Speech-to-Text
exports.transcribeAudio = async (filePath) => {
    try {
        const audioBuffer = fs.readFileSync(filePath);
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
            audioBuffer,
            { model: "nova-2", smart_format: true }
        );
        if (error) throw error;
        return result.results.channels[0].alternatives[0].transcript;
    } catch (err) {
        console.error("Deepgram STT Error:", err);
        return ""; 
    }
};

// 2. The Brain (Talk to Python)
exports.getAIResponse = async (userText, caseId, chatHistory) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/turn`, {
            case_id: caseId.toString(),
            user_text: userText,
            history: chatHistory
        });
        
        // Expected from Python: { "speaker": "Judge", "reply_text": "...", "emotion": "stern" }
        return {
            text: response.data.reply_text,
            speaker: response.data.speaker || "Lawyer",
            emotion: response.data.emotion || "neutral"
        };
    } catch (error) {
        console.warn("⚠️ Python Brain offline. Switching to ECHO MODE.");
        return { 
            text: `(Backup) You said: "${userText}"`, 
            speaker: "Judge", 
            emotion: "neutral" 
        };
    }
};

// 3. Text-to-Speech (Dynamic Voices)
exports.generateAudio = async (text, speaker) => {
    try {
        console.log(`Generating Audio for ${speaker}...`);

        // Select Voice based on Persona
        // Judge = "aura-orion-en" (Deep Male)
        // Lawyer = "aura-asteria-en" (Sharp Female) or "aura-arcas-en" (Male)
        const modelName = (speaker === "Judge") ? "aura-orion-en" : "aura-asteria-en";

        const response = await deepgram.speak.request(
            { text },
            {
                model: modelName,
                encoding: "mp3",
            }
        );

        const stream = await response.getStream();
        if (!stream) throw new Error("Deepgram returned no audio stream");

        const buffer = await getBufferFromStream(stream);
        return buffer.toString("base64");

    } catch (err) {
        console.error("Deepgram TTS Error:", err);
        return null;
    }
};

// Helper
async function getBufferFromStream(stream) {
    const chunks = [];
    const reader = stream.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return Buffer.from(result);
}

// 4. Analysis
exports.generatePostSessionAnalysis = async (transcript) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/analyze`, { transcript });
        return response.data;
    } catch (error) {
        return { summary: "Analysis Failed", feedback: "Check Python Server", score: 0 };
    }
};

// 5. Init Case (For Upload)
exports.initCaseWithAI = async (caseId, fullText) => {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/init_case`, {
            case_id: caseId,
            pdf_text: fullText
        });
        return response.data.summary; // Return the strategy guide
    } catch (error) {
        console.error("AI Init Failed:", error.message);
        return "AI Analysis Pending...";
    }
};