import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

// Load environment variables
dotenv.config();

async function fixCoordinates() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all users with coordinates
    const users = await User.find({
      'address.coordinates.coordinates': { $exists: true }
    });

    console.log(`Found ${users.length} users with coordinates`);

    let fixedCount = 0;

    for (const user of users) {
      const coords = user.address.coordinates.coordinates;
      
      // Check if coordinates are in the wrong format (objects with $numberDouble)
      if (coords && coords.length === 2) {
        let needsFix = false;
        let newCoords = [];

        for (let i = 0; i < coords.length; i++) {
          if (typeof coords[i] === 'object' && coords[i].$numberDouble !== undefined) {
            newCoords[i] = parseFloat(coords[i].$numberDouble);
            needsFix = true;
          } else if (typeof coords[i] === 'number') {
            newCoords[i] = coords[i];
          } else {
            console.log(`Skipping user ${user._id}: Invalid coordinate format`);
            break;
          }
        }

        if (needsFix && newCoords.length === 2) {
          console.log(`Fixing coordinates for user ${user.name} (${user.email})`);
          console.log(`  Old: [${coords[0]}, ${coords[1]}]`);
          console.log(`  New: [${newCoords[0]}, ${newCoords[1]}]`);

          // Update the coordinates
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                'address.coordinates.coordinates': newCoords
              }
            }
          );

          fixedCount++;
        }
      }
    }

    console.log(`\nFixed coordinates for ${fixedCount} users`);

    // Verify the fix by checking the specific seller you mentioned
    const testSeller = await User.findOne({ email: 'ebitokoni96@gmail.com' });
    if (testSeller) {
      console.log('\nVerifying fix for test seller:');
      console.log('Email:', testSeller.email);
      console.log('Coordinates:', testSeller.address.coordinates.coordinates);
      console.log('Type of coordinates:', typeof testSeller.address.coordinates.coordinates[0]);
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error fixing coordinates:', error);
    process.exit(1);
  }
}

fixCoordinates();