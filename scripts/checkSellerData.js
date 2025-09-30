import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config();

async function checkSellerData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the seller
    const seller = await User.findOne({ email: 'ebitokoni96@gmail.com' });
    if (!seller) {
      console.log('Seller not found');
      return;
    }

    console.log('Seller found:', seller.name);
    console.log('Seller address:', JSON.stringify(seller.address, null, 2));
    
    // Check store
    const store = await Store.findOne({ seller: seller._id }).populate('seller');
    if (store) {
      console.log('Store found:', store.name);
      console.log('Store isPublished:', store.isPublished);
      console.log('Store isActive:', store.isActive);
      console.log('Store settings.isPublished:', store.settings?.isPublished);
      console.log('Seller coordinates from store:', store.seller?.address?.coordinates?.coordinates);
    } else {
      console.log('No store found for seller');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkSellerData();