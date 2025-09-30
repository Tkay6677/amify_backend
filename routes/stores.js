import express from 'express';
import Store from '../models/Store.js';
import { protect, restrictTo } from '../middleware/auth.js';
const router = express.Router();

// Get all public stores with locations (for marketplace map)
router.get('/public', async (req, res) => {
  try {
    const stores = await Store.find({ 
      $or: [
        { isPublished: true },
        { 'settings.isPublished': true }
      ]
    })
    .populate('seller', 'name businessName address')
    .select('name slug description seller settings.contact isPublished')
    .lean();

    console.log(`Found ${stores.length} published stores`);

    // Filter stores that have seller location data
    const storesWithLocations = stores
      .filter(store => 
        store.seller?.address?.coordinates?.coordinates && 
        Array.isArray(store.seller.address.coordinates.coordinates) &&
        store.seller.address.coordinates.coordinates.length === 2
      )
      .map(store => ({
        _id: store._id,
        name: store.name,
        slug: store.slug,
        description: store.description,
        businessName: store.seller.businessName || store.seller.name,
        location: {
          coordinates: store.seller.address.coordinates.coordinates,
          address: `${store.seller.address.city || ''}, ${store.seller.address.state || ''}`.trim().replace(/^,\s*/, '')
        },
        contact: store.settings?.contact || {}
      }));

    res.json({
      success: true,
      data: storesWithLocations,
      count: storesWithLocations.length
    });
  } catch (error) {
    console.error('Get public stores error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch stores' 
    });
  }
});

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

    const { name, slug, description, template, components, styles, settings, pages } = req.body;

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
      settings: settings || {},
      pages: Array.isArray(pages) && pages.length > 0 ? pages : [{ slug: 'home', name: 'Home' }]
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

    const { name, description, template, components, styles, settings, pages } = req.body;

    // Update fields if provided
    if (name !== undefined) store.name = name.trim();
    if (description !== undefined) store.description = description?.trim();
    if (template !== undefined) store.template = template;
    if (components !== undefined) store.components = components;
    if (styles !== undefined) store.styles = { ...store.styles.toObject(), ...styles };
    if (settings !== undefined) store.settings = { ...store.settings.toObject(), ...settings };
    if (pages !== undefined && Array.isArray(pages)) store.pages = pages;

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

// Update delivery zones for a store
router.patch('/:id/delivery-zones', protect, restrictTo('seller'), async (req, res) => {
  try {
    const { zones } = req.body;
    
    const store = await Store.findById(req.params.id);
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    // Check if user owns the store
    if (store.seller.toString() !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    // Validate zones data
    if (!Array.isArray(zones)) {
      return res.status(400).json({
        success: false,
        message: 'Zones must be an array'
      });
    }

    // Validate each zone
    for (const zone of zones) {
      if (!zone.name || !zone.cost || !zone.estimatedDays) {
        return res.status(400).json({
          success: false,
          message: 'Each zone must have name, cost, and estimatedDays'
        });
      }

      if (zone.deliveryType === 'radius-based') {
        if (!zone.location || !zone.radius) {
          return res.status(400).json({
            success: false,
            message: 'Radius-based zones must have location and radius'
          });
        }
      } else if (zone.deliveryType === 'state-based') {
        if (!zone.states || !Array.isArray(zone.states) || zone.states.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'State-based zones must have at least one state'
          });
        }
      }
    }

    // Update shipping zones
    if (!store.settings.shipping) {
      store.settings.shipping = { enabled: true, zones: [] };
    }
    
    store.settings.shipping.zones = zones;
    store.version += 1;

    await store.save();

    res.json({
      success: true,
      data: store.settings.shipping.zones,
      message: 'Delivery zones updated successfully'
    });
  } catch (error) {
    console.error('Update delivery zones error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update delivery zones' 
    });
  }
});

// Get delivery zones for a store
router.get('/:id/delivery-zones', async (req, res) => {
  try {
    const store = await Store.findById(req.params.id).select('settings.shipping');
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    const zones = store.settings?.shipping?.zones || [];

    res.json({
      success: true,
      data: zones
    });
  } catch (error) {
    console.error('Get delivery zones error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch delivery zones' 
    });
  }
});

// Validate delivery for a location
router.post('/:id/validate-delivery', async (req, res) => {
  try {
    const { location, state } = req.body;
    
    const store = await Store.findById(req.params.id).select('settings.shipping');
    
    if (!store) {
      return res.status(404).json({ 
        success: false, 
        message: 'Store not found' 
      });
    }

    const zones = store.settings?.shipping?.zones || [];
    const activeZones = zones.filter(zone => zone.isActive !== false);

    let availableZones = [];

    for (const zone of activeZones) {
      if (zone.deliveryType === 'state-based' && state) {
        // Case-insensitive state matching
        const stateMatches = zone.states.some(zoneState => 
          zoneState.toLowerCase() === state.toLowerCase()
        );
        if (stateMatches) {
          availableZones.push(zone);
        }
      } else if (zone.deliveryType === 'radius-based' && location) {
        // Calculate distance using Haversine formula
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          zone.location.latitude,
          zone.location.longitude
        );
        
        if (distance <= zone.radius) {
          availableZones.push({
            ...zone,
            distance: Math.round(distance * 100) / 100 // Round to 2 decimal places
          });
        }
      }
    }

    // Sort by cost (cheapest first)
    availableZones.sort((a, b) => a.cost - b.cost);

    res.json({
      success: true,
      data: {
        available: availableZones.length > 0,
        zones: availableZones,
        cheapestOption: availableZones[0] || null
      }
    });
  } catch (error) {
    console.error('Validate delivery error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to validate delivery' 
    });
  }
});

// Helper function to calculate distance between two coordinates
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
