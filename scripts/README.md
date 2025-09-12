# Seed Data Script

This directory contains scripts for populating the Amify database with sample data for development and testing purposes.

## Usage

### Running the Seed Script

From the backend directory, run:

```bash
# Run seed script once
npm run seed

# Run seed script with auto-reload (for development)
npm run seed:dev
```

### What Gets Created

The seed script creates:

#### Users (7 total)
- **4 Sellers** with complete business profiles
- **2 Buyers** with basic user profiles  
- **1 Admin** with administrative privileges

#### Products (10 total)
- **TechStore Pro**: MacBook Pro, iPhone 15 Pro, AirPods Pro
- **Fashion Hub**: Leather Jacket, Silk Dress, Sneakers
- **Organic Foods Co**: Organic Honey, Quinoa Bowl Mix
- **Home & Garden Plus**: Plant Pot Set, Bamboo Cutting Board

#### Stores (2 total)
- **TechStore Pro**: Complete tech store with hero section and product grid
- **Fashion Hub**: Fashion store with modern styling and components

### Test Accounts

#### Sellers
- `sarah@techstore.com` / `password123` (TechStore Pro)
- `mike@fashionhub.com` / `password123` (Fashion Hub)
- `emma@organicfoods.com` / `password123` (Organic Foods Co)
- `david@homegoods.com` / `password123` (Home & Garden Plus)

#### Buyers
- `john@example.com` / `password123`
- `lisa@example.com` / `password123`

#### Admin
- `admin@amify.com` / `admin123`

## Features

- **Realistic Data**: Products include proper images, descriptions, and pricing
- **Store Components**: Sample stores include headers, hero sections, and product grids
- **Performance Metrics**: Stores include sample analytics data
- **Relationships**: All data is properly linked (products to sellers, stores to sellers)
- **Clean Slate**: Script clears existing data before seeding

## Environment Requirements

Make sure your `.env` file includes:
```
MONGODB_URI=mongodb://localhost:27017/amify
JWT_SECRET=your_jwt_secret_here
```

## Development Notes

- The script uses ES modules (import/export)
- All passwords are hashed using bcrypt
- Images use Unsplash URLs for realistic product photos
- Store components follow the Amify store builder schema
- Products include proper stock levels and categories

## Customization

To add more sample data:

1. Edit the arrays in `seedData.js`:
   - `sampleUsers` - Add more user accounts
   - `sampleProducts` - Add more products
   - `sampleStores` - Add more store configurations

2. Run the seed script to apply changes

## Troubleshooting

- Ensure MongoDB is running before executing the script
- Check that all required environment variables are set
- The script will show detailed progress and error messages
- All existing data is cleared before seeding (be careful in production!)
