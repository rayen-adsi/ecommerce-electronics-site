const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Pour gérer les fichiers système (utile pour la suppression)


const app = express();
const PORT = process.env.PORT || 5000; // Le port sur lequel votre serveur va écouter

// --- Middleware ---
app.use(cors()); // Activez CORS pour permettre les requêtes depuis votre frontend
app.use(express.json()); // Permet d'analyser les requêtes JSON
app.use(express.urlencoded({ extended: true })); // Added to handle URL-encoded data if needed

// Servir les fichiers statiques (images/vidéos uploadées)
// Accès via http://localhost:5000/uploads/nom_du_fichier.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Configuration de Multer pour le téléchargement de fichiers ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Crée le dossier 'uploads' s'il n'existe pas
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true }); // recursive: true pour créer des dossiers imbriqués si nécessaire
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Renomme le fichier pour éviter les doublons et conserver l'extension
        cb(null, Date.now() + '-' + file.originalname);
    }
});

// Multer filter to allow only image and video files for reviews
const reviewMediaFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Seuls les fichiers image et vidéo sont autorisés pour les avis!'), false);
    }
};

// Multer filter for product images/videos (already present, keep it)
const productMediaFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        // You might want to log this or handle it more gracefully
        cb(new Error('Seuls les fichiers image et vidéo sont autorisés pour les produits!'), false);
    }
};

// Multer upload instances for different purposes
const uploadReviewMedia = multer({
    storage: storage,
    fileFilter: reviewMediaFilter,
    limits: { fileSize: 1024 * 1024 * 50 } // 50MB limit per file for reviews
});

const uploadProductMedia = multer({
    storage: storage,
    fileFilter: productMediaFilter,
    limits: { fileSize: 1024 * 1024 * 100 } // 100MB limit per file for products
});


// --- Connexion à MongoDB ---
mongoose.connect('mongodb://localhost:27017/ecom-site-tunisie') // Remplacez 'ecom-site-tunisie' par le nom de votre BDD
    .then(() => console.log('Connecté à MongoDB !'))
    .catch(err => console.error('Erreur de connexion à MongoDB :', err));

// --- Définition du Schéma et Modèle de Produit ---
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    characteristics: [String], // Tableau de chaînes de caractères
    price: { type: Number, required: true },
    oldPrice: Number, // Optionnel
    quantity: { type: Number, required: true },
    images: [String], // Tableau de chemins de fichiers d'images (URLs relatives)
    videos: [String],  // Tableau de chemins de fichiers de vidéos (URLs relatives)
    category: { type: String, default: 'Autre' } // NOUVEAU CHAMP : Ajout de la catégorie
});

const Product = mongoose.model('Product', productSchema);

// --- Définition du Schéma et Modèle de Revue (Review) ---
// **MODIFIED REVIEW SCHEMA** to handle both images and videos in a single 'media' array
const reviewSchema = new mongoose.Schema({
    reviewerName: { type: String, default: 'Anonymous' }, // Nom de l'évaluateur (optionnel)
    reviewText: { type: String, required: true }, // Texte de l'avis
    rating: { type: Number, min: 1, max: 5, default: 0 }, // Note sur 5 étoiles
    media: [ // Changed from 'photos' to 'media' to store both images and videos
        {
            fileName: String,
            filePath: String, // Path on the server, e.g., /uploads/image-123.jpg
            fileType: String, // Mime type, e.g., image/jpeg, video/mp4
            uploadDate: { type: Date, default: Date.now }
        }
    ],
    createdAt: { type: Date, default: Date.now }, // Date de soumission de l'avis
    isApproved: { type: Boolean, default: false } // Pour l'approbation par l'administrateur
});

const Review = mongoose.model('Review', reviewSchema);


// --- API Routes for Products ---

// Route pour ajouter un nouveau produit
app.post('/api/products', uploadProductMedia.fields([
    { name: 'productImages', maxCount: 10 }, // Accepte jusqu'à 10 images
    { name: 'productVideos', maxCount: 5 }   // Accepte jusqu'à 5 vidéos
]), async (req, res) => {
    try {
        // Récupération des données du formulaire
        const { name, description, characteristics, price, oldPrice, quantity, category } = req.body;

        // Récupérer les chemins des fichiers téléchargés par Multer
        const imagePaths = req.files['productImages'] ? req.files['productImages'].map(file => `/uploads/${file.filename}`) : [];
        const videoPaths = req.files['productVideos'] ? req.files['productVideos'].map(file => `/uploads/${file.filename}`) : [];

        const newProduct = new Product({
            name,
            description,
            characteristics: characteristics ? JSON.parse(characteristics) : [],
            price: parseFloat(price),
            oldPrice: oldPrice ? parseFloat(oldPrice) : null,
            quantity: parseInt(quantity),
            images: imagePaths,
            videos: videoPaths,
            category: category || 'Autre'
        });

        await newProduct.save();
        res.status(201).json(newProduct);

    } catch (error) {
        console.error('Erreur lors de l\'ajout du produit :', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'ajout du produit', error: error.message });
    }
});

// Route pour récupérer tous les produits
app.get('/api/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.status(200).json(products);
    } catch (error) {
        console.error('Erreur lors de la récupération des produits :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des produits', error: error.message });
    }
});

// Route pour récupérer un seul produit par ID
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        res.status(200).json(product);
    } catch (error) {
        console.error('Erreur lors de la récupération du produit par ID :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération du produit', error: error.message });
    }
});

// Route pour modifier un produit (par ID)
app.put('/api/products/:id', uploadProductMedia.fields([
    { name: 'productImages', maxCount: 10 },
    { name: 'productVideos', maxCount: 5 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, characteristics, price, oldPrice, quantity, category } = req.body;

        let existingImages = req.body.existingImages ? (Array.isArray(req.body.existingImages) ? req.body.existingImages : [req.body.existingImages]) : [];
        let existingVideos = req.body.existingVideos ? (Array.isArray(req.body.existingVideos) ? req.body.existingVideos : [req.body.existingVideos]) : [];

        const newImagePaths = req.files && req.files['productImages'] ? req.files['productImages'].map(file => `/uploads/${file.filename}`) : [];
        const newVideoPaths = req.files && req.files['productVideos'] ? req.files['productVideos'].map(file => `/uploads/${file.filename}`) : [];

        const allImages = [...existingImages, ...newImagePaths];
        const allVideos = [...existingVideos, ...newVideoPaths];

        const updatedProduct = await Product.findByIdAndUpdate(id, {
            name,
            description,
            characteristics: characteristics ? JSON.parse(characteristics) : [],
            price: parseFloat(price),
            oldPrice: oldPrice ? parseFloat(oldPrice) : null,
            quantity: parseInt(quantity),
            images: allImages,
            videos: allVideos,
            category: category || 'Autre'
        }, { new: true });

        if (!updatedProduct) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }

        res.status(200).json(updatedProduct);

    } catch (error) {
        console.error('Erreur lors de la modification du produit :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la modification du produit', error: error.message });
    }
});

// Route pour supprimer un produit (par ID)
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedProduct = await Product.findByIdAndDelete(id);

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }

        // Supprimer les fichiers physiques du disque
        deletedProduct.images.forEach(imagePath => {
            const filePath = path.join(__dirname, imagePath);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Erreur lors de la suppression de l'image ${filePath}:`, err);
            });
        });
        deletedProduct.videos.forEach(videoPath => {
            const filePath = path.join(__dirname, videoPath);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Erreur lors de la suppression de la vidéo ${filePath}:`, err);
            });
        });

        res.status(200).json({ message: 'Produit supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression du produit :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression du produit', error: error.message });
    }
});


// --- Routes API pour les Revues (Reviews) ---

// POST: Soumettre un nouvel avis avec photos/vidéos
// **MODIFIED**: Using uploadReviewMedia and handling 'media' field
app.post('/api/reviews', uploadReviewMedia.array('reviewMedia', 5), async (req, res) => { // 'reviewMedia' matches frontend input name
    try {
        const { reviewerName, reviewText, rating } = req.body;

        // Process uploaded files for reviews
        const mediaFiles = req.files ? req.files.map(file => ({
            fileName: file.filename,
            filePath: `/uploads/${file.filename}`, // Store the public path
            fileType: file.mimetype // Store the MIME type for distinguishing image/video
        })) : [];

        // Validation simple côté serveur
        if (!reviewText || reviewText.trim() === '') {
            // Supprimer les fichiers uploadés s'il y a une erreur de validation
            mediaFiles.forEach(mediaItem => {
                const filePath = path.join(__dirname, mediaItem.filePath);
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Erreur lors de la suppression du fichier temporaire ${filePath}:`, err);
                });
            });
            return res.status(400).json({ message: 'Le texte de l\'avis est requis.' });
        }

        const newReview = new Review({
            reviewerName: reviewerName || 'Anonymous',
            reviewText,
            rating: parseInt(rating),
            media: mediaFiles, // Store media objects with file paths and types
            isApproved: true // Reviews are unapproved by default, waiting for admin
        });

        await newReview.save();
        res.status(201).json({ message: 'Avis soumis avec succès, en attente d\'approbation.', review: newReview });

    } catch (error) {
        console.error('Erreur lors de la soumission de l\'avis :', error);
        // En cas d'erreur, assurez-vous de nettoyer les fichiers potentiellement uploadés
        if (req.files) {
            req.files.forEach(file => {
                const filePath = path.join(__dirname, 'uploads', file.filename);
                fs.unlink(filePath, (err) => {
                    if (err) console.error(`Erreur lors de la suppression du fichier ${filePath} suite à une erreur serveur:`, err);
                });
            });
        }
        res.status(500).json({ message: 'Erreur serveur lors de la soumission de l\'avis', error: error.message });
    }
});

// GET: Récupérer tous les avis (pour l'admin)
app.get('/api/reviews', async (req, res) => {
    try {
        const reviews = await Review.find().sort({ createdAt: -1 }); // Trie du plus récent au plus ancien
        res.status(200).json(reviews);
    } catch (error) {
        console.error('Erreur lors de la récupération des avis :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des avis', error: error.message });
    }
});

// GET: Récupérer les avis approuvés (pour le frontend public)
// **MODIFIED**: Now returns 'media' array instead of 'photos'
app.get('/api/reviews/approved', async (req, res) => {
    try {
        const approvedReviews = await Review.find({ isApproved: true }).sort({ createdAt: -1 });
        res.status(200).json(approvedReviews);
    } catch (error) {
        console.error('Erreur lors de la récupération des avis approuvés :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des avis approuvés', error: error.message });
    }
});

// PUT: Approuver un avis (action admin)
app.put('/api/reviews/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const updatedReview = await Review.findByIdAndUpdate(id, { isApproved: true }, { new: true });

        if (!updatedReview) {
            return res.status(404).json({ message: 'Avis non trouvé' });
        }
        res.status(200).json({ message: 'Avis approuvé avec succès', review: updatedReview });
    } catch (error) {
        console.error('Erreur lors de l\'approbation de l\'avis :', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'approbation de l\'avis', error: error.message });
    }
});

// DELETE: Supprimer un avis (action admin)
// **MODIFIED**: Now deletes all media files in the 'media' array
app.delete('/api/reviews/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedReview = await Review.findByIdAndDelete(id);

        if (!deletedReview) {
            return res.status(404).json({ message: 'Avis non trouvé' });
        }

        // Supprimer les fichiers médias associés (photos et vidéos) du dossier 'uploads'
        deletedReview.media.forEach(mediaItem => { // Iterate through the 'media' array
            const filePath = path.join(__dirname, mediaItem.filePath); // Use mediaItem.filePath
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Erreur lors de la suppression du fichier média ${filePath}:`, err);
            });
        });

        res.status(200).json({ message: 'Avis supprimé avec succès' });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'avis :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'avis', error: error.message });
    }
});


// --- Démarrer le serveur ---
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accédez à votre frontend admin via http://localhost:8080/index.html`); // Rappel pour le frontend admin
    console.log(`Accédez à votre page produits via http://localhost:8080/categories-pc.html`); // Rappel pour la page produits
});