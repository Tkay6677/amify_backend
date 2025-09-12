import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: ['Electronics', 'Fashion', 'Beauty', 'Home', 'Sports', 'Books', 'Health', 'Automotive', 'Other']
  },
  subcategory: {
    type: String,
    trim: true
  },
  brand: {
    type: String,
    trim: true
  },
  images: [{
    url: {
      type: String,
      required: true
    },
    publicId: String,
    alt: String
  }],
  specifications: [{
    name: String,
    value: String
  }],
  variants: [{
    name: String, // e.g., "Color", "Size"
    options: [String] // e.g., ["Red", "Blue", "Green"]
  }],
  inventory: {
    quantity: {
      type: Number,
      required: [true, 'Inventory quantity is required'],
      min: [0, 'Quantity cannot be negative']
    },
    lowStockThreshold: {
      type: Number,
      default: 10
    },
    sku: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller is required']
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: [500, 'Review comment cannot exceed 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [String],
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['kg', 'g', 'lb'],
      default: 'kg'
    }
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'inch'],
      default: 'cm'
    }
  },
  shipping: {
    freeShipping: {
      type: Boolean,
      default: false
    },
    shippingCost: {
      type: Number,
      default: 0
    },
    processingTime: {
      type: String,
      default: '1-2 business days'
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'out_of_stock', 'discontinued'],
    default: 'active'
  },
  featured: {
    type: Boolean,
    default: false
  },
  totalSales: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for better query performance
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ seller: 1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ price: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ status: 1 });
productSchema.index({ featured: -1 });

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.originalPrice && this.originalPrice > this.price) {
    return Math.round(((this.originalPrice - this.price) / this.originalPrice) * 100);
  }
  return 0;
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.inventory.quantity === 0) return 'out_of_stock';
  if (this.inventory.quantity <= this.inventory.lowStockThreshold) return 'low_stock';
  return 'in_stock';
});

// Method to update rating
productSchema.methods.updateRating = function() {
  if (this.reviews.length === 0) {
    this.rating.average = 0;
    this.rating.count = 0;
  } else {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.rating.average = Number((totalRating / this.reviews.length).toFixed(1));
    this.rating.count = this.reviews.length;
  }
};

// Pre-save middleware to update rating
productSchema.pre('save', function(next) {
  if (this.isModified('reviews')) {
    this.updateRating();
  }
  next();
});

export default mongoose.model('Product', productSchema);
