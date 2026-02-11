const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
    case_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    user_id: { type: String, required: true },
    meeting_number: { type: Number, default: 1 },

    // NEW FIELD: The 6-digit code for VR
    meeting_code: { type: String, required: true, unique: true },

    transcript: [{
        speaker: { type: String }, 
        text: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],

    summary: { type: String },
    feedback: { type: String },
    score: { type: Number },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    created_at: { type: Date, default: Date.now },
    ended_at: { type: Date }
});

module.exports = mongoose.model('Meeting', MeetingSchema);