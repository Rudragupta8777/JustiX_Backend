const Case = require('../models/Case');
const pdfParse = require('pdf-parse'); // This will now work correctly
const cloudinary = require('../config/cloudinary');
const fs = require('fs-extra');
const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_MODELS_URI; 

exports.uploadCase = async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");

        // 1. Text Extraction
        const dataBuffer = await fs.readFile(req.file.path);
        
        // This simple call works with pdf-parse@1.1.1
        const pdfData = await pdfParse(dataBuffer);
        
        const fullText = pdfData.text;
        const totalPages = pdfData.numpages;

        // 2. Cloudinary Upload (PDF -> Images)
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "verdictech_cases",
            resource_type: "auto"
        });

        // 3. Generate Image URLs
        const imageUrls = [];
        for (let i = 1; i <= totalPages; i++) {
            const url = result.secure_url
                .replace('/upload/', `/upload/pg_${i}/`)
                .replace('.pdf', '.png');
            imageUrls.push(url);
        }

        // 4. Save to MongoDB
        const newCase = new Case({
            user_id: req.user.uid, 
            title: req.body.title || "Untitled Case",
            text_content: fullText,
            page_images: imageUrls
        });
        await newCase.save();

        // ---------------------------------------------------------
        // CRITICAL STEP: Send Text to Python AI for "Training"
        // ---------------------------------------------------------
        if (AI_SERVICE_URL) {
            try {
                await axios.post(`${AI_SERVICE_URL}/init_case`, {
                    case_id: newCase._id.toString(),
                    pdf_text: fullText
                });
                console.log("✅ AI Successfully trained on this case.");
            } catch (aiError) {
                console.error("⚠️ AI Training Failed (Is Python running?):", aiError.message);
            }
        } else {
            console.warn("⚠️ AI_MODELS_URI is missing in .env. Skipping AI training.");
        }
        // ---------------------------------------------------------

        await fs.unlink(req.file.path); 

        res.status(201).json({ success: true, caseId: newCase._id, pages: imageUrls });

    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Processing failed" });
    }
};