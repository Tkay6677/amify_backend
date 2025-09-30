import express from 'express';
import { body, validationResult } from 'express-validator';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = express.Router();

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', protect, [
  body('shippingAddress.fullName').trim().notEmpty().withMessage('Full name is required'),
  body('shippingAddress.phone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Valid phone number is required'),
  body('shippingAddress.street').trim().notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
  body('paymentInfo.method').isIn(['paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery']).withMessage('Valid payment method is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate inventory and calculate totals
    let subtotal = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;
      
      // Check product availability
      if (product.status !== 'active') {
        return res.status(400).json({ 
          message: `Product "${product.name}" is no longer available` 
        });
      }

      // Check inventory
      if (product.inventory.quantity < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for "${product.name}". Only ${product.inventory.quantity} available` 
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        product: product._id,
        seller: product.seller,
        quantity: item.quantity,
        price: product.price,
        variant: item.variant
      });
    }

    // Calculate shipping and total
    const shippingCost = req.body.shippingCost || 0;
    const tax = 0; // No tax for now
    const discount = req.body.discount || 0;
    const total = subtotal + shippingCost + tax - discount;

    // Create order
    const order = await Order.create({
      buyer: req.user.id,
      items: orderItems,
      shippingAddress: req.body.shippingAddress,
      paymentInfo: {
        method: req.body.paymentInfo.method,
        reference: req.body.paymentInfo.reference,
        transactionId: req.body.paymentInfo.transactionId
      },
      pricing: {
        subtotal,
        shippingCost,
        tax,
        discount,
        total
      }
    });

    // Update product inventory
    for (const item of cart.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { 
          $inc: { 
            'inventory.quantity': -item.quantity,
            totalSales: item.quantity
          }
        }
      );
    }

    // Clear cart
    cart.clearCart();
    await cart.save();

    // Add initial timeline entry
    order.addTimelineEntry('pending', 'Order placed successfully', req.user.id);
    await order.save();

    // Populate order for response
    await order.populate([
      { path: 'items.product', select: 'name images price' },
      { path: 'items.seller', select: 'name businessName' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Server error creating order' });
  }
});

// @desc    Get user's orders
// @route   GET /api/orders
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { buyer: req.user.id };
    
    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const orders = await Order.find(filter)
      .populate('items.product', 'name images price')
      .populate('items.seller', 'name businessName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ message: 'Server error fetching orders' });
  }
});

// @desc    Get seller's orders
// @route   GET /api/orders/seller/dashboard
// @access  Private (Sellers only)
router.get('/seller/dashboard', protect, restrictTo('seller', 'admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { 'items.seller': req.user.id };
    
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const orders = await Order.find(filter)
      .populate('buyer', 'name email phone')
      .populate('items.product', 'name images price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get seller orders error:', error);
    res.status(500).json({ message: 'Server error fetching seller orders' });
  }
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('buyer', 'name email phone')
      .populate('items.product', 'name images price')
      .populate('items.seller', 'name businessName phone')
      .populate('timeline.updatedBy', 'name');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user can access this order
    if (order.buyer._id.toString() !== req.user.id && 
        !order.items.some(item => item.seller._id.toString() === req.user.id) &&
        req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view this order' });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ message: 'Server error fetching order' });
  }
});

// @desc    Update order status (sellers and admin)
// @route   PUT /api/orders/:id/status
// @access  Private
router.put('/:id/status', protect, [
  body('status').isIn(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid status'),
  body('message').optional().trim().isLength({ max: 200 }).withMessage('Message too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { status, message, trackingNumber, carrier } = req.body;
    
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check authorization
    const canUpdate = req.user.type === 'admin' || 
                     order.items.some(item => item.seller.toString() === req.user.id);
    
    if (!canUpdate) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    // Update tracking info if provided
    if (trackingNumber) order.tracking.trackingNumber = trackingNumber;
    if (carrier) order.tracking.carrier = carrier;

    // Set timestamps based on status
    if (status === 'shipped' && !order.tracking.shippedAt) {
      order.tracking.shippedAt = new Date();
    }
    if (status === 'delivered' && !order.tracking.deliveredAt) {
      order.tracking.deliveredAt = new Date();
    }

    // Add timeline entry
    order.addTimelineEntry(status, message || `Order ${status}`, req.user.id);
    
    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ message: 'Server error updating order status' });
  }
});

// @desc    Cancel order
// @route   PUT /api/orders/:id/cancel
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('items.product');
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user can cancel this order
    if (order.buyer.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to cancel this order' });
    }

    // Check if order can be cancelled
    if (['shipped', 'delivered', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ message: 'Order cannot be cancelled at this stage' });
    }

    // Restore inventory
    for (const item of order.items) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { 
          $inc: { 
            'inventory.quantity': item.quantity,
            totalSales: -item.quantity
          }
        }
      );
    }

    // Update order status
    order.addTimelineEntry('cancelled', req.body.reason || 'Order cancelled by customer', req.user.id);
    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ message: 'Server error cancelling order' });
  }
});

export default router;
