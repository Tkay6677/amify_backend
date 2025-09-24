import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Store from '../models/Store.js';

// Load environment variables
dotenv.config();

// Sample data
const sampleUsers = [
  // Sellers
  {
    name: 'Sarah Johnson',
    email: 'sarah@techstore.com',
    password: 'password123',
    type: 'seller',
    businessName: 'TechStore Pro',
    phone: '+15550101',
    isVerified: true,
    address: {
      street: '123 Tech Street',
      city: 'Silicon Valley',
      state: 'CA',
      country: 'Nigeria',
      zipCode: '94000',
      coordinates: {
        type: 'Point',
        coordinates: [7.0219, 4.8156] // Lagos, Nigeria coordinates [longitude, latitude]
      }
    }
  },
  {
    name: 'Mike Chen',
    email: 'mike@fashionhub.com',
    password: 'password123',
    type: 'seller',
    businessName: 'Fashion Hub',
    phone: '+15550102',
    isVerified: true,
    address: {
      street: '456 Fashion Ave',
      city: 'Abuja',
      state: 'FCT',
      country: 'Nigeria',
      zipCode: '10001',
      coordinates: {
        type: 'Point',
        coordinates: [7.4951, 9.0765] // Abuja, Nigeria coordinates [longitude, latitude]
      }
    }
  },
  {
    name: 'Emma Rodriguez',
    email: 'emma@organicfoods.com',
    password: 'password123',
    type: 'seller',
    businessName: 'Organic Foods Co',
    phone: '+15550103',
    isVerified: true,
    address: {
      street: '789 Green Lane',
      city: 'Port Harcourt',
      state: 'Rivers',
      country: 'Nigeria',
      zipCode: '97201',
      coordinates: {
        type: 'Point',
        coordinates: [7.0134, 4.8156] // Port Harcourt, Nigeria coordinates [longitude, latitude]
      }
    }
  },
  {
    name: 'David Kim',
    email: 'david@homegoods.com',
    password: 'password123',
    type: 'seller',
    businessName: 'Home & Garden Plus',
    phone: '+15550104',
    isVerified: true,
    address: {
      street: '321 Home Street',
      city: 'Kano',
      state: 'Kano',
      country: 'Nigeria',
      zipCode: '78701',
      coordinates: {
        type: 'Point',
        coordinates: [8.5264, 12.0022] // Kano, Nigeria coordinates [longitude, latitude]
      }
    }
  },
  // Buyers
  {
    name: 'John Smith',
    email: 'john@example.com',
    password: 'password123',
    type: 'buyer',
    phone: '+15550201',
    address: {
      street: '123 Main St',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      zipCode: '12345',
      coordinates: {
        type: 'Point',
        coordinates: [3.3792, 6.5244] // Lagos, Nigeria coordinates [longitude, latitude]
      }
    }
  },
  {
    name: 'Lisa Wilson',
    email: 'lisa@example.com',
    password: 'password123',
    type: 'buyer',
    phone: '+15550202',
    address: {
      street: '456 Oak Ave',
      city: 'Abuja',
      state: 'FCT',
      country: 'Nigeria',
      zipCode: '67890',
      coordinates: {
        type: 'Point',
        coordinates: [7.4951, 9.0765] // Abuja, Nigeria coordinates [longitude, latitude]
      }
    }
  },
  // Admin
  {
    name: 'Admin User',
    email: 'admin@amify.com',
    password: 'admin123',
    type: 'admin',
    isVerified: true,
    address: {
      street: 'Admin Office',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      zipCode: '00000',
      coordinates: {
        type: 'Point',
        coordinates: [3.3792, 6.5244] // Lagos, Nigeria coordinates [longitude, latitude]
      }
    }
  }
];

const sampleProducts = [
  // TechStore Pro products
  {
    name: 'MacBook Pro 16"',
    description: 'Powerful laptop for professionals with M2 Pro chip, 16GB RAM, and 512GB SSD.',
    price: 2499.99,
    originalPrice: 2699.99,
    category: 'Electronics',
    images: [
      { url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500', alt: 'MacBook Pro' }
    ],
    inventory: { quantity: 25 },
    isActive: true,
    tags: ['laptop', 'apple', 'professional', 'computing']
  },
  {
    name: 'iPhone 15 Pro',
    description: 'Latest iPhone with titanium design, A17 Pro chip, and advanced camera system.',
    price: 999.99,
    category: 'Electronics',
    images: [
      { url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500', alt: 'iPhone 15 Pro' }
    ],
    inventory: { quantity: 50 },
    isActive: true,
    tags: ['smartphone', 'apple', 'mobile', 'camera']
  },
  {
    name: 'AirPods Pro',
    description: 'Premium wireless earbuds with active noise cancellation and spatial audio.',
    price: 249.99,
    category: 'Electronics',
    images: [
      { url: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=500', alt: 'AirPods Pro' }
    ],
    inventory: { quantity: 100 },
    isActive: true,
    tags: ['headphones', 'wireless', 'apple', 'audio']
  },
  // Fashion Hub products
  {
    name: 'Designer Leather Jacket',
    description: 'Premium genuine leather jacket with modern cut and classic styling.',
    price: 299.99,
    originalPrice: 399.99,
    category: 'Fashion',
    images: [
      { url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500', alt: 'Leather Jacket' }
    ],
    inventory: { quantity: 15 },
    isActive: true,
    tags: ['jacket', 'leather', 'fashion', 'outerwear']
  },
  {
    name: 'Silk Evening Dress',
    description: 'Elegant silk dress perfect for special occasions and formal events.',
    price: 189.99,
    category: 'Fashion',
    images: [
      { url: 'https://images.unsplash.com/photo-1566479179817-c0c5b4b4b4b4?w=500', alt: 'Evening Dress' }
    ],
    inventory: { quantity: 20 },
    isActive: true,
    tags: ['dress', 'silk', 'formal', 'evening']
  },
  {
    name: 'Casual Sneakers',
    description: 'Comfortable and stylish sneakers for everyday wear.',
    price: 89.99,
    category: 'Fashion',
    images: [
      { url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500', alt: 'Sneakers' }
    ],
    inventory: { quantity: 75 },
    isActive: true,
    tags: ['shoes', 'sneakers', 'casual', 'comfort']
  },
  // Organic Foods Co products
  {
    name: 'Organic Honey',
    description: 'Pure, raw organic honey sourced from local beekeepers.',
    price: 24.99,
    category: 'Health',
    images: [
      { url: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=500', alt: 'Organic Honey' }
    ],
    inventory: { quantity: 40 },
    isActive: true,
    tags: ['honey', 'organic', 'natural', 'sweetener']
  },
  {
    name: 'Quinoa Grain Bowl Mix',
    description: 'Nutritious blend of organic quinoa, seeds, and dried fruits.',
    price: 12.99,
    category: 'Health',
    images: [
      { url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500', alt: 'Quinoa Bowl' }
    ],
    inventory: { quantity: 60 },
    isActive: true,
    tags: ['quinoa', 'healthy', 'organic', 'grain']
  },
  // Home & Garden Plus products
  {
    name: 'Ceramic Plant Pot Set',
    description: 'Beautiful set of 3 ceramic pots perfect for indoor plants.',
    price: 34.99,
    category: 'Home',
    images: [
      { url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=500', alt: 'Plant Pots' }
    ],
    inventory: { quantity: 30 },
    isActive: true,
    tags: ['pots', 'ceramic', 'plants', 'home decor']
  },
  {
    name: 'Bamboo Cutting Board',
    description: 'Eco-friendly bamboo cutting board with juice groove.',
    price: 29.99,
    category: 'Home',
    images: [
      { url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500', alt: 'Bamboo Cutting Board' }
    ],
    inventory: { quantity: 45 },
    isActive: true,
    tags: ['cutting board', 'bamboo', 'kitchen', 'eco-friendly']
  }
];

const sampleStores = [
  {
    name: 'TechStore Pro',
    slug: 'techstore-pro',
    description: 'Your one-stop shop for premium technology products',
    template: 'tech',
    components: [
      {
        id: 'header-1',
        type: 'header',
        props: {
          title: 'TechStore Pro',
          subtitle: 'Premium Technology Solutions',
          logo: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=100',
          navigation: [
            { label: 'Home', href: '#home' },
            { label: 'Products', href: '#products' },
            { label: 'About', href: '#about' },
            { label: 'Contact', href: '#contact' }
          ]
        },
        position: { x: 0, y: 0 },
        order: 1
      },
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          title: 'Latest Technology at Your Fingertips',
          subtitle: 'Discover premium laptops, smartphones, and accessories',
          backgroundImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1200',
          ctaText: 'Shop Now',
          ctaLink: '#products'
        },
        position: { x: 0, y: 100 },
        order: 2
      },
      {
        id: 'product-grid-1',
        type: 'product-grid',
        props: {
          title: 'Featured Products',
          columns: 3,
          limit: 6,
          showFilters: true
        },
        position: { x: 0, y: 600 },
        order: 3
      }
    ],
    styles: {
      primaryColor: '#2563eb',
      secondaryColor: '#64748b',
      accentColor: '#0ea5e9',
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
      fontFamily: 'Inter',
      fontSize: 'base',
      spacing: 'normal',
      borderRadius: 'md',
      shadow: 'sm'
    },
    settings: {
      isPublished: true,
      seoTitle: 'TechStore Pro - Premium Technology Products',
      seoDescription: 'Shop the latest laptops, smartphones, and tech accessories at TechStore Pro.'
    },
    performance: {
      views: 1250,
      uniqueVisitors: 890,
      conversionRate: 3.2
    },
    version: 1,
    isActive: true
  },
  {
    name: 'Fashion Hub',
    slug: 'fashion-hub',
    description: 'Trendy fashion for the modern lifestyle',
    template: 'fashion',
    components: [
      {
        id: 'header-1',
        type: 'header',
        props: {
          title: 'Fashion Hub',
          subtitle: 'Style Redefined',
          navigation: [
            { label: 'Home', href: '#home' },
            { label: 'Collections', href: '#collections' },
            { label: 'Sale', href: '#sale' },
            { label: 'Contact', href: '#contact' }
          ]
        },
        position: { x: 0, y: 0 },
        order: 1
      },
      {
        id: 'hero-1',
        type: 'hero',
        props: {
          title: 'Fashion Forward',
          subtitle: 'Discover the latest trends in fashion',
          backgroundImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
          ctaText: 'Explore Collection',
          ctaLink: '#collections'
        },
        position: { x: 0, y: 100 },
        order: 2
      },
      {
        id: 'product-grid-1',
        type: 'product-grid',
        props: {
          title: 'New Arrivals',
          columns: 4,
          limit: 8,
          showFilters: true
        },
        position: { x: 0, y: 600 },
        order: 3
      }
    ],
    styles: {
      primaryColor: '#ec4899',
      secondaryColor: '#6b7280',
      accentColor: '#f59e0b',
      backgroundColor: '#ffffff',
      textColor: '#111827',
      fontFamily: 'Playfair Display',
      fontSize: 'base',
      spacing: 'normal',
      borderRadius: 'sm',
      shadow: 'md'
    },
    settings: {
      isPublished: true,
      seoTitle: 'Fashion Hub - Trendy Fashion & Style',
      seoDescription: 'Discover the latest fashion trends and stylish clothing at Fashion Hub.'
    },
    performance: {
      views: 2100,
      uniqueVisitors: 1450,
      conversionRate: 4.1
    },
    version: 1,
    isActive: true
  }
];

// Seed function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/amify');
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Product.deleteMany({});
    await Store.deleteMany({});

    // Create users
    console.log('👥 Creating users...');
    const hashedUsers = await Promise.all(
      sampleUsers.map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, 12)
      }))
    );
    const createdUsers = await User.insertMany(hashedUsers);
    console.log(`✅ Created ${createdUsers.length} users`);

    // Get seller IDs
    const sellers = createdUsers.filter(user => user.type === 'seller');
    const [techSeller, fashionSeller, foodSeller, homeSeller] = sellers;

    // Create products with seller references
    console.log('📦 Creating products...');
    const productsWithSellers = [
      // TechStore Pro products
      { ...sampleProducts[0], seller: techSeller._id },
      { ...sampleProducts[1], seller: techSeller._id },
      { ...sampleProducts[2], seller: techSeller._id },
      // Fashion Hub products
      { ...sampleProducts[3], seller: fashionSeller._id },
      { ...sampleProducts[4], seller: fashionSeller._id },
      { ...sampleProducts[5], seller: fashionSeller._id },
      // Organic Foods Co products
      { ...sampleProducts[6], seller: foodSeller._id },
      { ...sampleProducts[7], seller: foodSeller._id },
      // Home & Garden Plus products
      { ...sampleProducts[8], seller: homeSeller._id },
      { ...sampleProducts[9], seller: homeSeller._id }
    ];
    const createdProducts = await Product.insertMany(productsWithSellers);
    console.log(`✅ Created ${createdProducts.length} products`);

    // Create stores with seller references
    console.log('🏪 Creating stores...');
    const storesWithSellers = [
      { ...sampleStores[0], seller: techSeller._id },
      { ...sampleStores[1], seller: fashionSeller._id }
    ];
    const createdStores = await Store.insertMany(storesWithSellers);
    console.log(`✅ Created ${createdStores.length} stores`);

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('Note: Mongoose index warnings are normal on first run and can be ignored.');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${createdUsers.length} (${sellers.length} sellers, ${createdUsers.filter(u => u.type === 'buyer').length} buyers, ${createdUsers.filter(u => u.type === 'admin').length} admin)`);
    console.log(`   Products: ${createdProducts.length}`);
    console.log(`   Stores: ${createdStores.length}`);
    
    console.log('\n🔐 Test Accounts:');
    console.log('   Sellers:');
    console.log('     - sarah@techstore.com / password123 (TechStore Pro)');
    console.log('     - mike@fashionhub.com / password123 (Fashion Hub)');
    console.log('     - emma@organicfoods.com / password123 (Organic Foods Co)');
    console.log('     - david@homegoods.com / password123 (Home & Garden Plus)');
    console.log('   Buyers:');
    console.log('     - john@example.com / password123');
    console.log('     - lisa@example.com / password123');
    console.log('   Admin:');
    console.log('     - admin@amify.com / admin123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Always run seeding when this file is executed
seedDatabase();

export default seedDatabase;
