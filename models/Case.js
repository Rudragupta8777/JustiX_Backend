const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    title: { type: String, required: true },
    text_content: { type: String }, // The full PDF text
    summary: { type: String },      // <--- ADD THIS (The AI Strategy Guide)
    page_images: [String],
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Case', CaseSchema);