const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({

    case_id: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Case', 
        required: true 
    },
    
    user_id: { type: String, required: true },

    meeting_number: { type: Number, default: 1 },

    transcript: [{
        speaker: { type: String }, // "User", "Judge", "Lawyer"
        text: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],

    // THE AI ANALYSIS (Generated when user hits "Pause/End")
    summary: { type: String }, 
    feedback: { type: String },
    score: { type: Number }, // e.g., 75/100

    // META DATA
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    created_at: { type: Date, default: Date.now },
    ended_at: { type: Date }
});

module.exports = mongoose.model('Meeting', MeetingSchema);