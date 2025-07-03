const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Pour gérer les fichiers système (utile pour la suppression)
const userRoutes = require('./routes/users'); // Chemin vers le fichier users.js



const app = express();
const PORT = process.env.PORT || 5000; // Le port sur lequel votre serveur va écouter
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

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
    promotion_price: { type: Number, required: false },
    oldPrice: Number, // Optionnel
    quantity: { type: Number, required: true, default: 0 },
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

// In your server.js, add this after your Review model definition

// --- Définition du Schéma et Modèle de Commande (Order) ---
const orderSchema = new mongoose.Schema({
   userId: { type: String, required: true },
    orderId: { type: String, required: true, unique: true }, // Client-generated unique ID for the order
    customerInfo: { // Details of the customer at the time of order
        fullName: { type: String, required: true },
        email: { type: String, required: true },
        phone: { type: String },
        shippingAddress: { type: String, required: true }
    },
    items: [ // Array of items in this order
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Reference to the Product
            name: { type: String, required: true },
            price: { type: Number, required: true }, // Price at time of purchase (includes promo if applicable)
            quantity: { type: Number, required: true }, // Quantity ordered for this product (not stock)
            imageUrl: { type: String } // Store image for easier display in admin/user order history
        }
    ],
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    orderDate: { type: Date, default: Date.now },
    status: { type: String, default: 'Pending' } // e.g., Pending, Processing, Shipped, Delivered, Cancelled
});
const Order = mongoose.model('Order', orderSchema);
app.use('/api/users', userRoutes);
// ... (rest of your server.js code) ...

// --- API Routes for Products ---

// Route pour ajouter un nouveau produit
app.post('/api/orders', async (req, res) => {
    try {
        const { userId, orderId, customerInfo, items, totalAmount, paymentMethod, orderDate, status } = req.body;

        const validatedItems = [];

        for (const item of items) {
            const product = await Product.findById(item._id);
            if (!product) {
                return res.status(404).json({ message: `Produit introuvable: ${item.name}` });
            }

            // Secure fallback logic
            const promo = product.promotion_price;
            const base = product.price;
            const price = (typeof promo === 'number' && promo > 0 && promo < base) ? promo : base;

            if (typeof price !== 'number' || price <= 0) {
                return res.status(400).json({ message: `Prix invalide pour ${product.name}` });
            }

            validatedItems.push({
                productId: product._id,
                name: product.name,
                price: price, // must be a valid number
                quantity: item.quantity,
                imageUrl: item.imageUrl || (product.images?.[0] ?? '')
            });
        }

        const newOrder = new Order({
            userId,
            orderId,
            customerInfo,
            items: validatedItems,
            totalAmount,
            paymentMethod,
            orderDate,
            status
        });

        await newOrder.save();

        res.status(201).json({ message: "Commande enregistrée avec succès", order: newOrder });

    } catch (error) {
        console.error("Erreur lors de la création de la commande:", error);
        res.status(500).json({ message: "Erreur serveur lors de la création de la commande", error: error.message });
    }
});

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
    // Route pour décrémenter la quantité d’un produit (après une commande)
app.patch('/api/products/:id/decrement', async (req, res) => {
    const { id } = req.params;
    const { quantity } = req.body;

    try {
        const product = await Product.findById(id);
        if (!product) return res.status(404).json({ message: 'Produit non trouvé.' });

        if (product.quantity < quantity) {
            return res.status(400).json({ message: 'Stock insuffisant.' });
        }

        product.quantity -= quantity;
        await product.save();

        res.status(200).json({ message: 'Stock mis à jour avec succès.', updatedQuantity: product.quantity });
    } catch (error) {
        console.error('Erreur lors de la mise à jour du stock :', error);
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour du stock', error: error.message });
    }
});

    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Produit non trouvé' });
        }
        res.set('Cache-Control', 'no-store');
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
        const { name, description, characteristics, price, promotion_price, oldPrice, quantity, category } = req.body;

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
            promotion_price: promotion_price,
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
// ... (Your existing GET /api/products and GET /api/products/:id routes) ...

// NEW: GET products by search query
// Example: GET /api/products/search?q=monitor&category=pc
app.get('/api/products/search', async (req, res) => {
    try {
        const query = req.query.q; // The search term
        const category = req.query.category; // Optional category filter
        let filters = {};

        if (query) {
            // Case-insensitive search across name, description, category, and characteristics
            const searchRegex = new RegExp(query, 'i'); // 'i' for case-insensitive
            filters.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { category: searchRegex },
                { characteristics: searchRegex } // Search within characteristics array
            ];
        }

        if (category) {
            filters.category = new RegExp(category, 'i'); // Filter by exact category, case-insensitive
        }

        const products = await Product.find(filters);
        res.json(products);
    } catch (err) {
        console.error('Error searching products:', err);
        res.status(500).json({ message: err.message });
    }
});

// ... (Your existing POST, PUT, DELETE /api/products routes and other API routes) ...

// In your server.js, add these routes after your existing /api/reviews routes

// --- API Routes for Orders ---

// POST /api/orders - Create a new order and decrement product stock (CRITICAL FOR STOCK)
app.post('/api/orders', async (req, res) => {
    const { userId, customerInfo, items, totalAmount, paymentMethod, orderId } = req.body;

    // 🔍 Step 1: Validate required data
    if (!userId || !items || items.length === 0 || !totalAmount || !customerInfo || !paymentMethod || !orderId) {
        return res.status(400).json({ message: 'Missing required order details.' });
    }

    try {
        let orderItemsToSave = [];

        // 🛒 Step 2: Process each item in the cart
        for (const item of items) {
            const product = await Product.findById(item._id);

            if (!product) {
                throw new Error(`Product with ID ${item._id} ("${item.name}") not found.`);
            }

            if (product.quantity < item.quantity) {
                throw new Error(`Stock insuffisant pour "${product.name}". Disponible: ${product.quantity}, Commandé: ${item.quantity}.`);
            }

            // 📉 Deduct the purchased quantity from stock
            product.quantity -= item.quantity;
            await product.save();

            const effectivePrice = (product.promotion_price !== undefined && product.promotion_price < product.price)
                ? product.promotion_price
                : product.price;

            orderItemsToSave.push({
                productId: product._id,
                name: product.name,
                price: effectivePrice,
                quantity: item.quantity,
                imageUrl: item.imageUrl
            });
        }

        // 📦 Step 3: Create and save the order
        const order = new Order({
            userId,
            orderId,
            customerInfo,
            items: orderItemsToSave,
            totalAmount,
            paymentMethod,
            orderDate: new Date().toISOString(),
            status: 'Pending'
        });

        await order.save();

        // ✅ Step 4: Respond success
        res.status(201).json({ message: 'Commande passée avec succès.', order });

    } catch (error) {
        console.error("Erreur lors du traitement de la commande:", error);
        res.status(500).json({ message: 'Erreur lors du traitement de la commande.', error: error.message });
    }
});



// GET /api/orders - Get all orders (for admin panel)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ orderDate: -1 }); // Fetch all orders, newest first
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Failed to fetch orders.' });
    }
});

// PUT /api/orders/:id - Update order status (for admin panel)
app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params; // This will be the MongoDB _id of the order
    const { status } = req.body;
    console.log("Updating order:", id, "to status:", status);

    if (!status) {
        return res.status(400).json({ message: 'Status is required for update.' });
    }
    try {
        const updatedOrder = await Order.findByIdAndUpdate(id, { status }, { new: true }); // Update only the status
        if (!updatedOrder) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.status(200).json(updatedOrder);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Failed to update order status.' });
    }
});
// ... (Your existing app.listen at the very end of the file) ...


app.use('/api/users', userRoutes);

app.listen(5000, () => console.log('🚀 Serveur sur http://localhost:5000'));

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('./models/User'); // Adjust the path if your User.js is located elsewhere


app.post('/api/users/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé." });

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1h
    await user.save();

    const resetUrl =`http://127.0.0.1:5500/FRONTEND/reset-password.html?token=${token}`;


    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'techaven03@gmail.com',     // use env variables ideally
        pass: 'nsjx tzkt olnp qade'
      }
    });

    const mailOptions = {
      to: user.email,
      subject: 'Réinitialisation de mot de passe',
      text: `Cliquez ici pour réinitialiser votre mot de passe : ${resetUrl}`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Un email de réinitialisation a été envoyé.' });

  } catch (error) {
    console.error("Erreur mot de passe oublié :", error);
    res.status(500).json({ message: "Erreur lors de la demande de réinitialisation." });
  }
});

app.post('/api/users/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() } // Valid token
    });

    if (!user) return res.status(400).json({ message: "Token invalide ou expiré." });
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({ message: "Mot de passe réinitialisé avec succès." });
  } catch (error) {
    console.error("Erreur reset password :", error);
    res.status(500).json({ message: "Erreur serveur lors du reset." });
  }
});





// --- Démarrer le serveur ---
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accédez à votre frontend admin via http://localhost:8080/index.html`); // Rappel pour le frontend admin
    console.log(`Accédez à votre page produits via http://localhost:8080/categories-pc.html`); // Rappel pour la page produits
});
