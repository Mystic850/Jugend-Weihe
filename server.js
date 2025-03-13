const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS für externe Anfragen erlauben (z. B. von GitHub Pages)
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());  // JSON-Unterstützung
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB-Verbindung (nutze MongoDB Atlas, falls lokal nicht verfügbar)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bilderDB';
mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ Verbunden mit MongoDB"))
.catch(err => console.error("❌ MongoDB-Verbindungsfehler:", err));

// MongoDB Schema
const ImageSchema = new mongoose.Schema({
    filename: String,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
});
const Image = mongoose.model('Image', ImageSchema);

// Prüfe, ob `uploads/` Ordner existiert, erstelle ihn falls nicht
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("📂 'uploads/' Ordner erstellt!");
}

// Multer-Konfiguration für Datei-Uploads
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB Limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const isValid = allowedTypes.test(file.mimetype) && allowedTypes.test(path.extname(file.originalname).toLowerCase());
        isValid ? cb(null, true) : cb(new Error('❌ Nur JPG, PNG, GIF erlaubt!'));
    }
}).array('images', 10);

// Upload-Route
app.post('/upload', (req, res) => {
    console.log("📥 Upload-Anfrage erhalten...");
    upload(req, res, async (err) => {
        if (err) return res.status(400).json({ message: err.message });

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: '❌ Keine Datei ausgewählt!' });
        }

        try {
            const savedImages = await Image.insertMany(
                req.files.map(file => ({ filename: file.filename, path: `/uploads/${file.filename}` }))
            );

            res.status(200).json({ filePaths: savedImages.map(img => img.path) });
        } catch (dbError) {
            console.error("❌ Datenbankfehler:", dbError);
            res.status(500).json({ message: "Fehler beim Speichern in der Datenbank" });
        }
    });
});

// Bilder abrufen
app.get('/images', async (req, res) => {
    try {
        const images = await Image.find().sort({ uploadedAt: -1 });
        res.status(200).json({ filePaths: images.map(img => img.path) });
    } catch (err) {
        console.error("❌ Fehler beim Abrufen der Bilder:", err);
        res.status(500).json({ message: "Fehler beim Abrufen der Bilder" });
    }
});

// 404 Fehlerbehandlung
app.use((req, res) => {
    res.status(404).send("❌ Fehler 404: Route nicht gefunden");
});

// Server starten
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
});
