import express from 'express';
import { body, validationResult } from 'express-validator';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate({
        path: 'items.product',
        select: 'name price images inventory status',
        populate: {
          path: 'seller',
          select: 'name businessName'
        }
      });

    if (!cart) {
      cart = await Cart.create({ user: req.user.id, items: [] });
    }

    res.json({
      success: true,
      data: cart
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Server error fetching cart' });
  }
});

// @desc    Add item to cart
// @route   POST /api/cart/add
// @access  Private
router.post('/add', protect, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1, max: 50 }).withMessage('Quantity must be between 1 and 50'),
  body('variant').optional().isObject().withMessage('Variant must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { productId, quantity, variant = {} } = req.body;

    // Check if product exists and is available
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.status !== 'active') {
      return res.status(400).json({ message: 'Product is not available' });
    }

    if (product.inventory.quantity < quantity) {
      return res.status(400).json({ 
        message: `Only ${product.inventory.quantity} items available in stock` 
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    // Add item to cart
    cart.addItem(productId, quantity, variant);
    await cart.save();

    // Populate and return updated cart
    await cart.populate({
      path: 'items.product',
      select: 'name price images inventory status',
      populate: {
        path: 'seller',
        select: 'name businessName'
      }
    });

    res.json({
      success: true,
      message: 'Item added to cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: 'Server error adding item to cart' });
  }
});

// @desc    Update cart item quantity
// @route   PUT /api/cart/update
// @access  Private
router.put('/update', protect, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 0, max: 50 }).withMessage('Quantity must be between 0 and 50'),
  body('variant').optional().isObject().withMessage('Variant must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { productId, quantity, variant = {} } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Check product availability if quantity > 0
    if (quantity > 0) {
      const product = await Product.findById(productId);
      if (!product || product.status !== 'active') {
        return res.status(400).json({ message: 'Product is not available' });
      }

      if (product.inventory.quantity < quantity) {
        return res.status(400).json({ 
          message: `Only ${product.inventory.quantity} items available in stock` 
        });
      }
    }

    // Update quantity
    cart.updateQuantity(productId, quantity, variant);
    await cart.save();

    // Populate and return updated cart
    await cart.populate({
      path: 'items.product',
      select: 'name price images inventory status',
      populate: {
        path: 'seller',
        select: 'name businessName'
      }
    });

    res.json({
      success: true,
      message: 'Cart updated successfully',
      data: cart
    });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: 'Server error updating cart' });
  }
});

// @desc    Remove item from cart
// @route   DELETE /api/cart/remove
// @access  Private
router.delete('/remove', protect, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('variant').optional().isObject().withMessage('Variant must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { productId, variant = {} } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Remove item
    cart.removeItem(productId, variant);
    await cart.save();

    // Populate and return updated cart
    await cart.populate({
      path: 'items.product',
      select: 'name price images inventory status',
      populate: {
        path: 'seller',
        select: 'name businessName'
      }
    });

    res.json({
      success: true,
      message: 'Item removed from cart successfully',
      data: cart
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: 'Server error removing item from cart' });
  }
});

// @desc    Clear entire cart
// @route   DELETE /api/cart/clear
// @access  Private
router.delete('/clear', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    cart.clearCart();
    await cart.save();

    res.json({
      success: true,
      message: 'Cart cleared successfully',
      data: cart
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: 'Server error clearing cart' });
  }
});

export default router;
