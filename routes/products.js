import express from 'express';
import { body, query, validationResult } from 'express-validator';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { protect, restrictTo, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get all products with filtering, sorting, and pagination
// @route   GET /api/products
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be non-negative'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be non-negative'),
  query('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be between 0 and 5')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { status: 'active' };

    // Category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Seller filter
    if (req.query.seller) {
      filter.seller = req.query.seller;
    }

    // Store filter
    if (req.query.store) {
      filter.store = req.query.store;
    }

    // Price range filter
    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }

    // Rating filter
    if (req.query.rating) {
      filter['rating.average'] = { $gte: parseFloat(req.query.rating) };
    }

    // Search filter
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    // Build sort object
    let sort = {};
    switch (req.query.sort) {
      case 'price_asc':
        sort = { price: 1 };
        break;
      case 'price_desc':
        sort = { price: -1 };
        break;
      case 'rating':
        sort = { 'rating.average': -1 };
        break;
      case 'newest':
        sort = { createdAt: -1 };
        break;
      case 'popular':
        sort = { totalSales: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // Execute query
    const products = await Product.find(filter)
      .populate('seller', 'name businessName rating')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Server error fetching products' });
  }
});

// @desc    Create product
// @route   POST /api/products
// @access  Private (seller or admin)
router.post('/', protect, restrictTo('seller', 'admin'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be non-negative'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('inventory.quantity').isInt({ min: 0 }).withMessage('Quantity must be non-negative'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    }

    const {
      name,
      description,
      price,
      originalPrice,
      category,
      subcategory,
      brand,
      images,
      specifications,
      variants,
      inventory,
      store,
      tags
    } = req.body;

    const product = new Product({
      name: name.trim(),
      description: description.trim(),
      price,
      originalPrice,
      category,
      subcategory,
      brand,
      images: Array.isArray(images) ? images : [],
      specifications: Array.isArray(specifications) ? specifications : [],
      variants: Array.isArray(variants) ? variants : [],
      inventory,
      store: store || null,
      tags: Array.isArray(tags) ? tags : [],
      seller: req.user.id,
    });

    await product.save();
    await product.populate('seller', 'name businessName');

    res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Server error creating product' });
  }
});

// @desc    Link/unlink product to a store
// @route   PATCH /api/products/:id/store
// @access  Private (seller or admin)
router.patch('/:id/store', protect, async (req, res) => {
  try {
    const { storeId } = req.body; // can be null to unlink
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Authorization: must be product owner or admin
    if (product.seller.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (storeId) {
      const { default: Store } = await import('../models/Store.js');
      const store = await Store.findById(storeId);
      if (!store) return res.status(404).json({ message: 'Store not found' });
      if (store.seller.toString() !== req.user.id && req.user.type !== 'admin') {
        return res.status(403).json({ message: 'Cannot link to a store you do not own' });
      }
      product.store = storeId;
    } else {
      product.store = null;
    }

    await product.save();
    await product.populate('seller', 'name businessName');

    res.json({ success: true, data: product, message: storeId ? 'Product linked to store' : 'Product unlinked from store' });
  } catch (error) {
    console.error('Link product to store error:', error);
    res.status(500).json({ message: 'Server error updating product store' });
  }
});

// @desc    Get products near a location
// @route   GET /api/products/nearby
// @access  Public
router.get('/nearby', [
  query('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  query('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  query('radius').optional().isFloat({ min: 0 }).withMessage('Radius must be non-negative'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { latitude, longitude, radius = 10000 } = req.query; // Default radius: 10km
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    // Find sellers within the specified radius
    const nearbySellers = await User.find({
      type: 'seller',
      'address.coordinates.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseFloat(radius) // radius in meters
        }
      }
    }).select('_id name businessName address rating');

    if (nearbySellers.length === 0) {
      return res.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        },
        message: 'No sellers found in the specified area'
      });
    }

    const sellerIds = nearbySellers.map(seller => seller._id);

    // Build filter for products
    const filter = { 
      seller: { $in: sellerIds },
      status: 'active'
    };

    // Apply additional filters if provided
    if (req.query.category) {
      filter.category = { $regex: new RegExp(req.query.category, 'i') };
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }

    if (req.query.rating) {
      filter['rating.average'] = { $gte: parseFloat(req.query.rating) };
    }

    // Search by name if provided
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: new RegExp(req.query.search, 'i') } },
        { description: { $regex: new RegExp(req.query.search, 'i') } }
      ];
    }

    const products = await Product.find(filter)
      .populate('seller', 'name businessName rating address')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    // Add distance information to products
    const productsWithDistance = products.map(product => {
      const seller = nearbySellers.find(s => s._id.toString() === product.seller._id.toString());
      const distance = seller && seller.address && seller.address.coordinates && seller.address.coordinates.coordinates ? calculateDistance(
        parseFloat(latitude), 
        parseFloat(longitude),
        seller.address.coordinates.coordinates[1], // latitude is at index 1
        seller.address.coordinates.coordinates[0]  // longitude is at index 0
      ) : null;

      return {
        ...product.toObject(),
        distance: distance ? Math.round(distance * 100) / 100 : null // Round to 2 decimal places
      };
    });

    res.json({
      success: true,
      data: productsWithDistance,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      searchLocation: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseFloat(radius)
      }
    });
  } catch (error) {
    console.error('Error fetching nearby products:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name businessName rating totalSales')
      .populate('reviews.user', 'name avatar');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Increment view count
    product.views += 1;
    await product.save();

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Server error fetching product' });
  }
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Product owner or admin)
router.put('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check ownership
    if (product.seller.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('seller', 'name businessName');

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Server error updating product' });
  }
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Product owner or admin)
router.delete('/:id', protect, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check ownership
    if (product.seller.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    await Product.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ message: 'Server error deleting product' });
  }
});

// @desc    Add product review
// @route   POST /api/products/:id/reviews
// @access  Private
router.post('/:id/reviews', protect, [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { rating, comment } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if user already reviewed this product
    const existingReview = product.reviews.find(
      review => review.user.toString() === req.user.id
    );

    if (existingReview) {
      return res.status(400).json({ message: 'You have already reviewed this product' });
    }

    // Add review
    product.reviews.push({
      user: req.user.id,
      rating,
      comment
    });

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Review added successfully'
    });
  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ message: 'Server error adding review' });
  }
});

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
router.get('/featured/list', async (req, res) => {
  try {
    const products = await Product.find({ 
      status: 'active', 
      featured: true 
    })
    .populate('seller', 'name businessName')
    .sort({ 'rating.average': -1 })
    .limit(8)
    .lean();

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({ message: 'Server error fetching featured products' });
  }
});

// @desc    Get products by category
// @route   GET /api/products/category/:category
// @access  Public
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const filter = { 
      category: { $regex: new RegExp(category, 'i') },
      status: 'active'
    };

    const products = await Product.find(filter)
      .populate('seller', 'name businessName rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Product.countDocuments(filter);

    res.json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});



// Helper function to calculate distance between two points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

export default router;
