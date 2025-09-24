import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config();

async function setupTestStore() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the seller
    const seller = await User.findOne({ email: 'ebitokoni96@gmail.com' });
    if (!seller) {
      console.log('Seller not found');
      return;
    }

    console.log('Setting up store for seller:', seller.name);

    // Check if store already exists
    let store = await Store.findOne({ seller: seller._id });
    
    if (store) {
      console.log('Store already exists:', store.name);
    } else {
      // Create a basic store
      store = new Store({
        name: seller.businessName || 'Helix Store',
        slug: 'helix-store',
        seller: seller._id,
        description: seller.businessDescription || 'Na we dey run am',
        settings: {
          general: {
            storeName: seller.businessName || 'Helix Store',
            storeDescription: seller.businessDescription || 'Na we dey run am',
            logo: seller.avatar,
            favicon: seller.avatar
          },
          contact: {
            email: seller.email,
            phone: seller.phone || '+234',
            address: 'Port Harcourt, Rivers State, Nigeria'
          },
          shipping: {
            enabled: true,
            zones: []
          }
        },
        isPublished: true,
        version: 1
      });

      await store.save();
      console.log('✅ Store created successfully');
    }

    // Set up delivery zones
    const deliveryZones = [
      {
        id: 'zone-rivers-state',
        name: 'Rivers State Delivery',
        deliveryType: 'state-based',
        states: ['Rivers'],
        cost: 1500,
        estimatedDays: '1-2 days',
        isActive: true
      },
      {
        id: 'zone-nearby-radius',
        name: 'Local Delivery (50km)',
        deliveryType: 'radius-based',
        location: {
          latitude: seller.address.coordinates.coordinates[1], // latitude
          longitude: seller.address.coordinates.coordinates[0], // longitude
          address: 'Port Harcourt, Rivers State'
        },
        radius: 50,
        cost: 1000,
        estimatedDays: '1 day',
        isActive: true
      },
      {
        id: 'zone-extended-radius',
        name: 'Extended Delivery (100km)',
        deliveryType: 'radius-based',
        location: {
          latitude: seller.address.coordinates.coordinates[1], // latitude
          longitude: seller.address.coordinates.coordinates[0], // longitude
          address: 'Port Harcourt, Rivers State'
        },
        radius: 100,
        cost: 2000,
        estimatedDays: '2-3 days',
        isActive: true
      }
    ];

    // Update store with delivery zones
    store.settings.shipping.zones = deliveryZones;
    store.version += 1;
    await store.save();

    console.log('✅ Delivery zones configured:');
    deliveryZones.forEach(zone => {
      console.log(`  - ${zone.name} (${zone.deliveryType}): ₦${zone.cost}`);
    });

    console.log('\n=== Store Setup Complete ===');
    console.log('Store ID:', store._id);
    console.log('Store Name:', store.name);
    console.log('Seller Location:', seller.address.coordinates.coordinates);
    console.log('Delivery Zones:', deliveryZones.length);

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error setting up store:', error);
    process.exit(1);
  }
}

setupTestStore();