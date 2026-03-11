const mongoose = require('mongoose');

// Описание структуры данных пользователя
const UserSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true, // Гарантирует, что ID не дублируются
        index: true   // Ускоряет поиск в миллионы раз
    },
    username: String,
    balance: { type: Number, default: 0 },
    energy: { type: Number, default: 1000 },
    referredBy: { type: String, default: null }, // ID того, кто пригласил
    friendsCount: { type: Number, default: 0 },
    lastSync: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
