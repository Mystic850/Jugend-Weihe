const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

// CORS aktivieren, falls das Frontend von einer anderen Adresse kommt
app.use(cors());

// Verbindung zur MongoDB-Datenbank herstellen
mongoose.connect('mongodb://localhost:27017/bilderDB', { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log("✅ Verbunden mit MongoDB"))
.catch(err => console.error("❌ MongoDB-Verbindungsfehler:", err));

// Mongoose Schema für Bilder
const ImageSchema = new mongoose.Schema({
    filename: String,
    path: String,
    uploadedAt: { type: Date, default: Date.now }
});

const Image = mongoose.model('Image', ImageSchema);

// Prüfen, ob der Upload-Ordner existiert, falls nicht, erstelle ihn
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log("📂 'uploads/' Ordner erstellt!");
}

// Set up Multer (Datei-Upload)
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(path.basename(file.originalname))); 
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB Limit
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif/;
        const isValidExt = filetypes.test(path.extname(file.originalname).toLowerCase());
        const isValidMime = filetypes.test(file.mimetype);

        if (isValidExt && isValidMime) {
            cb(null, true);
        } else {
            cb(new Error('Nur JPG, PNG, GIF erlaubt!'));
        }
    }
}).array('images', 10);

// Middleware für statische Dateien
app.use(express.static(__dirname));
app.use('/uploads', express.static(uploadDir));

// Upload-Route mit Speicherung in MongoDB
app.post('/upload', (req, res) => {
    console.log("📥 Upload-Anfrage erhalten...");

    upload(req, res, async (err) => {
        if (err) {
            console.error("❌ Upload-Fehler:", err.message);
            return res.status(400).json({ message: err.message });
        }
        if (!req.files || req.files.length === 0) {
            console.warn("⚠️ Keine Datei erhalten!");
            return res.status(400).json({ message: 'Keine Datei ausgewählt!' });
        }

        const filePaths = req.files.map(file => `/uploads/${file.filename}`);

        try {
            // Speichere die Bilddaten in MongoDB
            const savedImages = await Image.insertMany(
                req.files.map(file => ({
                    filename: file.filename,
                    path: `/uploads/${file.filename}`
                }))
            );
            console.log("✅ Bilder in der Datenbank gespeichert:", savedImages);
        } catch (dbError) {
            console.error("❌ Fehler beim Speichern in der DB:", dbError);
            return res.status(500).json({ message: "Fehler beim Speichern der Bilder" });
        }

        console.log("✅ Upload erfolgreich:", filePaths);
        res.status(200).json({ filePaths });
    });
});

// Route, um alle gespeicherten Bilder aus der DB zurückzugeben
app.get('/images', async (req, res) => {
    try {
        const images = await Image.find().sort({ uploadedAt: -1 }); // Neueste zuerst
        res.status(200).json({ filePaths: images.map(img => img.path) });
    } catch (err) {
        console.error("❌ Fehler beim Abrufen der Bilder:", err);
        res.status(500).json({ message: "Fehler beim Abrufen der Bilder" });
    }
});

// Fehler-Handling für nicht gefundene Routen
app.use((req, res, next) => {
    res.status(404).send("❌ Fehler 404: Route nicht gefunden");
});

// Server starten
app.listen(PORT, () => {
    console.log(`🚀 Server läuft auf http://localhost:${PORT}`);
    console.log("📸 Lade vorhandene Bilder...");
});