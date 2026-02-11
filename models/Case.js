const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
    user_id: { 
        type: String, 
        required: true 
    },
    title: { 
        type: String, 
        default: "Untitled" 
    },
    text_content: { 
        type: String 
    }, // Raw text for AI Context
    page_images: [{ 
        type: String 
    }], // Cloudinary URLs for VR
    created_at: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Case', CaseSchema);