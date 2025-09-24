import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';
import User from './models/User.js';

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
  const distance = R * c; // Distance in kilometers
  return distance;
}

async function debugDistances() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test coordinates from the error (latitude=5.5199&longitude=7.07)
    const searchLat = 5.5199;
    const searchLon = 7.07;

    console.log('Search coordinates:', searchLat, searchLon);

    // Get all sellers and their coordinates
    const sellers = await User.find({ type: 'seller' }).select('_id name businessName address');
    
    console.log('Total sellers:', sellers.length);
    
    sellers.forEach((seller, index) => {
      if (seller.address && seller.address.coordinates && seller.address.coordinates.coordinates) {
        const [sellerLon, sellerLat] = seller.address.coordinates.coordinates;
        const distance = calculateDistance(searchLat, searchLon, sellerLat, sellerLon);
        
        console.log(`Seller ${index + 1}:`, {
          name: seller.name || seller.businessName,
          coordinates: [sellerLon, sellerLat],
          distanceKm: Math.round(distance * 100) / 100
        });
      } else {
        console.log(`Seller ${index + 1}: No coordinates`);
      }
    });

    // Test with a larger radius
    console.log('\nTesting with 1000km radius...');
    const nearbySellers = await User.find({
      type: 'seller',
      'address.coordinates.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [searchLon, searchLat]
          },
          $maxDistance: 1000000 // 1000km in meters
        }
      }
    }).select('_id name businessName address');

    console.log('Sellers within 1000km:', nearbySellers.length);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
  }
}

debugDistances();