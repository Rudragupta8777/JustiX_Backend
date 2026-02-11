const Case = require('../models/Case');
const pdfParse = require('pdf-parse'); 
const cloudinary = require('../config/cloudinary');
const fs = require('fs-extra');
const aiService = require('../services/aiService'); // Import Service

exports.uploadCase = async (req, res) => {
    try {
        if (!req.file) return res.status(400).send("No file uploaded");

        // 1. Parse PDF
        const dataBuffer = await fs.readFile(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        const fullText = pdfData.text;
        const totalPages = pdfData.numpages;

        // 2. Upload Images
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "verdictech_cases",
            resource_type: "auto"
        });

        const imageUrls = [];
        for (let i = 1; i <= totalPages; i++) {
            imageUrls.push(result.secure_url.replace('/upload/', `/upload/pg_${i}/`).replace('.pdf', '.png'));
        }

        // 3. Create Case (Initially without summary)
        const newCase = new Case({
            user_id: req.user.uid, 
            title: req.body.title || "Untitled Case",
            text_content: fullText,
            page_images: imageUrls,
            summary: "Processing..." // Placeholder
        });
        await newCase.save();

        // 4. Send to AI & Get Strategy Summary
        if (process.env.AI_MODELS_URI) {
            const aiSummary = await aiService.initCaseWithAI(newCase._id.toString(), fullText);
            
            // Update Case with the AI Summary
            newCase.summary = aiSummary || "No summary generated.";
            await newCase.save();
            
            console.log("✅ Case Initialized & Summary Saved");
        }

        await fs.unlink(req.file.path); 
        res.status(201).json({ success: true, caseId: newCase._id, pages: imageUrls });

    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: "Processing failed" });
    }
};

exports.getMyCases = async (req, res) => {
    try {
        const cases = await Case.find({ user_id: req.user.uid })
            .select('title created_at text_content summary') // Select 'summary' too
            .sort({ created_at: -1 });
        res.json(cases);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch cases" });
    }
};