import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
router.get('/', protect, restrictTo('admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.type) {
      filter.type = req.query.type;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

// @desc    Get user profile
// @route   GET /api/users/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Users can only view their own profile unless they're admin
    if (req.user.id !== req.params.id && req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this profile' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error fetching user' });
  }
});

// @desc    Update user (Admin only)
// @route   PUT /api/users/:id
// @access  Private/Admin
router.put('/:id', protect, restrictTo('admin'), [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('type').optional().isIn(['buyer', 'seller', 'admin']),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error updating user' });
  }
});

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
router.delete('/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow deleting admin users
    if (user.type === 'admin') {
      return res.status(400).json({ message: 'Cannot delete admin users' });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error deleting user' });
  }
});

// @desc    Get seller dashboard stats
// @route   GET /api/users/seller/stats
// @access  Private/Seller
router.get('/seller/stats', protect, restrictTo('seller', 'admin'), async (req, res) => {
  try {
    const sellerId = req.user.id;

    // Get seller location
    const seller = await User.findById(sellerId).select('address');
    const sellerLocation = seller?.address?.coordinates?.coordinates;

    // Get product stats
    const productStats = await Product.aggregate([
      { $match: { seller: sellerId } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalViews: { $sum: '$views' },
          totalSales: { $sum: '$totalSales' }
        }
      }
    ]);

    // Get order stats
    const orderStats = await Order.aggregate([
      { $match: { 'items.seller': sellerId } },
      { $unwind: '$items' },
      { $match: { 'items.seller': sellerId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
        }
      }
    ]);

    // Get recent orders
    const recentOrders = await Order.find({ 'items.seller': sellerId })
      .populate('buyer', 'name email')
      .populate('items.product', 'name images')
      .sort({ createdAt: -1 })
      .limit(5);

    // Location-based analytics
    let locationAnalytics = {
      nearbyCustomers: 0,
      nearbyCompetitors: 0,
      deliveryRadius: '10 km',
      topCustomerAreas: []
    };

    if (sellerLocation && sellerLocation.length === 2) {
      const [longitude, latitude] = sellerLocation;

      // Find nearby customers (buyers who have ordered from any seller within 25km)
      const nearbyCustomers = await User.find({
        type: 'buyer',
        'address.coordinates.coordinates': {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], 25 / 6378.1] // 25km radius in radians
          }
        }
      }).countDocuments();

      // Find nearby competitors (other sellers within 10km)
      const nearbyCompetitors = await User.find({
        type: 'seller',
        _id: { $ne: sellerId },
        'address.coordinates.coordinates': {
          $geoWithin: {
            $centerSphere: [[longitude, latitude], 10 / 6378.1] // 10km radius in radians
          }
        }
      }).countDocuments();

      // Get top customer areas based on order delivery addresses
      const customerAreas = await Order.aggregate([
        { $match: { 'items.seller': sellerId } },
        { $unwind: '$items' },
        { $match: { 'items.seller': sellerId } },
        {
          $group: {
            _id: '$shippingAddress.city',
            orderCount: { $sum: 1 },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
          }
        },
        { $sort: { orderCount: -1 } },
        { $limit: 5 }
      ]);

      locationAnalytics = {
        nearbyCustomers,
        nearbyCompetitors,
        deliveryRadius: '10 km',
        topCustomerAreas: customerAreas.map(area => ({
          city: area._id || 'Unknown',
          orders: area.orderCount,
          revenue: area.revenue
        }))
      };
    }

    const stats = {
      products: productStats[0] || { totalProducts: 0, activeProducts: 0, totalViews: 0, totalSales: 0 },
      orders: orderStats[0] || { totalOrders: 0, totalRevenue: 0, pendingOrders: 0, completedOrders: 0 },
      recentOrders,
      locationAnalytics
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get seller stats error:', error);
    res.status(500).json({ message: 'Server error fetching seller stats' });
  }
});

// @desc    Get top sellers
// @route   GET /api/users/sellers/top
// @access  Public
router.get('/sellers/top', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const topSellers = await User.find({ type: 'seller', isActive: true })
      .select('name businessName profilePicture rating location')
      .sort({ 'rating.average': -1, 'rating.count': -1 })
      .limit(limit);

    res.json({
      success: true,
      data: topSellers
    });
  } catch (error) {
    console.error('Get top sellers error:', error);
    res.status(500).json({ message: 'Server error fetching top sellers' });
  }
});

// @desc    Get public seller profile
// @route   GET /api/users/sellers/:id/profile
// @access  Public
router.get('/sellers/:id/profile', async (req, res) => {
  try {
    const seller = await User.findById(req.params.id).select('-password -email');
    
    if (!seller) {
      return res.status(404).json({ message: 'Seller not found' });
    }

    // Only allow viewing seller profiles
    if (seller.type !== 'seller') {
      return res.status(404).json({ message: 'Seller not found' });
    }

    // Get seller's product count and stats
    const productCount = await Product.countDocuments({ seller: seller._id, status: 'active' });
    const totalOrders = await Order.countDocuments({ 'items.seller': seller._id });
    
    // Calculate total sales
    const salesData = await Order.aggregate([
      { $match: { 'items.seller': seller._id, status: 'delivered' } },
      { $unwind: '$items' },
      { $match: { 'items.seller': seller._id } },
      { $group: { _id: null, totalSales: { $sum: '$items.price' } } }
    ]);

    const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;

    // Add computed fields
    const sellerProfile = {
      ...seller.toObject(),
      stats: {
        productCount,
        totalOrders,
        totalSales,
        responseRate: seller.stats?.responseRate || 95 // Default response rate
      }
    };

    res.json({
      success: true,
      data: sellerProfile
    });
  } catch (error) {
    console.error('Get seller profile error:', error);
    res.status(500).json({ message: 'Server error fetching seller profile' });
  }
});

export default router;
