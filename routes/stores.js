import express from 'express';
import Store from '../models/Store.js';
import { protect, restrictTo } from '../middleware/auth.js';
const router = express.Router();

// Get all stores for the authenticated seller
router.get('/', protect, restrictTo('seller', 'admin'), async (req, res) => {
  try {

    const stores = await Store.findBySeller(req.user.id);
    
    res.json({
      success: true,
      data: stores,
      count: stores.length
    });
  } catch (error) {
    console.error('Get stores error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stores' 
    });
  }
});

// Get a specific store by ID
router.get('/:id', protect, restrictTo('seller', 'admin'), async (req, res) => {
  try {
    const store = await Store.findById(req.params.id).populate('seller', 'name email businessName');
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    // Check if user owns the store or is admin
    if (store.seller._id.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Get store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch store' 
    });
  }
});

// Create a new store
router.post('/', protect, restrictTo('seller'), async (req, res) => {
  try {

    const { name, slug, description, template, components, styles, settings } = req.body;

    // Check if store name already exists for this seller
    const existingStore = await Store.findOne({ 
      seller: req.user.id, 
      name: name.trim(),
      isActive: true 
    });

    if (existingStore) {
      return res.status(400).json({ 
        success: false, 
        message: 'A store with this name already exists' 
      });
    }

    // Generate slug if not provided
    let finalSlug = slug;
    if (!finalSlug && name) {
      finalSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    const store = new Store({
      name: name.trim(),
      slug: finalSlug,
      description: description?.trim(),
      seller: req.user.id,
      template,
      components: components || [],
      styles: styles || {},
      settings: settings || {}
    });

    await store.save();
    await store.populate('seller', 'name email businessName');

    res.status(201).json({
      success: true,
      data: store,
      message: 'Store created successfully'
    });
  } catch (error) {
    console.error('Create store error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store slug already exists. Please choose a different name.' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Failed to create store' 
    });
  }
});

// Update a store
router.put('/:id', protect, restrictTo('seller'), async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    // Check if user owns the store or is admin
    if (store.seller.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const { name, description, template, components, styles, settings } = req.body;

    // Update fields if provided
    if (name !== undefined) store.name = name.trim();
    if (description !== undefined) store.description = description?.trim();
    if (template !== undefined) store.template = template;
    if (components !== undefined) store.components = components;
    if (styles !== undefined) store.styles = { ...store.styles.toObject(), ...styles };
    if (settings !== undefined) store.settings = { ...store.settings.toObject(), ...settings };

    // Increment version
    store.version += 1;

    await store.save();
    await store.populate('seller', 'name email businessName');

    res.json({
      success: true,
      data: store,
      message: 'Store updated successfully'
    });
  } catch (error) {
    console.error('Update store error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Store slug already exists. Please choose a different name.' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Failed to update store' 
    });
  }
});

// Publish/Unpublish a store
router.patch('/:id/publish', protect, restrictTo('seller'), async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    // Check if user owns the store or is admin
    if (store.seller.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const { isPublished } = req.body;

    if (isPublished) {
      await store.publish();
    } else {
      await store.unpublish();
    }

    await store.populate('seller', 'name email businessName');

    res.json({
      success: true,
      data: store,
      message: `Store ${isPublished ? 'published' : 'unpublished'} successfully`
    });
  } catch (error) {
    console.error('Publish store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update store status' 
    });
  }
});

// Duplicate a store
router.post('/:id/duplicate', protect, restrictTo('seller'), async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    // Check if user owns the store or is admin
    if (store.seller.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const { name } = req.body;
    const duplicatedStore = await store.duplicate(name);
    await duplicatedStore.populate('seller', 'name email businessName');

    res.status(201).json({
      success: true,
      data: duplicatedStore,
      message: 'Store duplicated successfully'
    });
  } catch (error) {
    console.error('Duplicate store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to duplicate store' 
    });
  }
});

// Delete a store (soft delete)
router.delete('/:id', protect, restrictTo('seller'), async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    // Check if user owns the store or is admin
    if (store.seller.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Soft delete
    store.isActive = false;
    store.settings.isPublished = false;
    await store.save();

    res.json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    console.error('Delete store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete store' 
    });
  }
});

// Get public store by slug (for viewing published stores)
router.get('/public/:slug', async (req, res) => {
  try {
    const store = await Store.findOne({ 
      slug: req.params.slug, 
      'settings.isPublished': true,
      isActive: true 
    }).populate('seller', 'name businessName rating');
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found or not published' 
      });
    }

    // Increment views (you might want to implement IP tracking for unique visitors)
    await store.incrementViews();

    res.json({
      success: true,
      data: store
    });
  } catch (error) {
    console.error('Get public store error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch store' 
    });
  }
});

// Get store analytics
router.get('/:id/analytics', protect, restrictTo('seller'), async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    // Check if user owns the store or is admin
    if (store.seller.toString() !== req.user.id && req.user.type !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    const analytics = {
      views: store.performance.views,
      uniqueVisitors: store.performance.uniqueVisitors,
      conversionRate: store.performance.conversionRate,
      lastVisited: store.performance.lastVisited,
      componentCount: store.componentCount,
      isPublished: store.settings.isPublished,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics' 
    });
  }
});

export default router;
