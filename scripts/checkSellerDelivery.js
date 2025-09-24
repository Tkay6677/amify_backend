import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config();

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in kilometers
  return d;
}

async function checkSellerDelivery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the seller
    const seller = await User.findOne({ email: 'ebitokoni96@gmail.com' });
    if (!seller) {
      console.log('Seller not found');
      return;
    }

    console.log('Seller found:');
    console.log('- Name:', seller.name);
    console.log('- Business Name:', seller.businessName);
    console.log('- Coordinates:', seller.address.coordinates.coordinates);

    // Find the seller's store
    const store = await Store.findOne({ seller: seller._id });
    if (!store) {
      console.log('No store found for this seller');
      return;
    }

    console.log('\nStore found:');
    console.log('- Store ID:', store._id);
    console.log('- Store Name:', store.name);
    console.log('- Shipping settings:', store.settings?.shipping);

    const zones = store.settings?.shipping?.zones || [];
    console.log('\nDelivery zones:', zones.length);

    if (zones.length === 0) {
      console.log('No delivery zones configured for this store');
      console.log('\nTo fix this, the seller needs to:');
      console.log('1. Log into their dashboard');
      console.log('2. Go to the Delivery Zones tab');
      console.log('3. Create at least one delivery zone');
      return;
    }

    // Test customer location
    const customerLat = 4.9134;
    const customerLon = 6.2932;
    const customerState = 'Rivers'; // Assuming this is Rivers State based on coordinates

    console.log('\nTesting delivery to customer location:');
    console.log('- Customer coordinates:', [customerLon, customerLat]);
    console.log('- Customer state:', customerState);

    let availableZones = [];

    for (const zone of zones) {
      console.log(`\nChecking zone: ${zone.name}`);
      console.log('- Type:', zone.deliveryType);
      console.log('- Active:', zone.isActive !== false);

      if (zone.isActive === false) {
        console.log('- Skipped (inactive)');
        continue;
      }

      if (zone.deliveryType === 'state-based') {
        console.log('- States covered:', zone.states);
        if (zone.states.includes(customerState)) {
          availableZones.push(zone);
          console.log('- ✅ Customer state is covered');
        } else {
          console.log('- ❌ Customer state not covered');
        }
      } else if (zone.deliveryType === 'radius-based') {
        const distance = calculateDistance(
          customerLat,
          customerLon,
          zone.location.latitude,
          zone.location.longitude
        );
        console.log('- Zone center:', [zone.location.longitude, zone.location.latitude]);
        console.log('- Zone radius:', zone.radius, 'km');
        console.log('- Distance to customer:', Math.round(distance * 100) / 100, 'km');
        
        if (distance <= zone.radius) {
          availableZones.push({
            ...zone,
            distance: Math.round(distance * 100) / 100
          });
          console.log('- ✅ Customer is within delivery radius');
        } else {
          console.log('- ❌ Customer is outside delivery radius');
        }
      }
    }

    console.log('\n=== DELIVERY VALIDATION RESULT ===');
    console.log('Available zones:', availableZones.length);
    if (availableZones.length > 0) {
      console.log('✅ Delivery is available');
      availableZones.sort((a, b) => a.cost - b.cost);
      console.log('Cheapest option:', availableZones[0].name, '- ₦' + availableZones[0].cost);
    } else {
      console.log('❌ Delivery is not available');
    }

    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSellerDelivery();