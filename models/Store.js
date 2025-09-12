import mongoose from 'mongoose';

const componentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['header', 'hero', 'product-grid', 'testimonials', 'footer', 'spacer', 'text', 'image', 'video', 'contact-form']
  },
  props: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  order: {
    type: Number,
    default: 0
  }
});

const storeStyleSchema = new mongoose.Schema({
  colors: {
    primary: { type: String, default: '#673ab7' },
    secondary: { type: String, default: '#d1c4e9' },
    accent: { type: String, default: '#512da8' },
    background: { type: String, default: '#ffffff' },
    text: { type: String, default: '#212121' },
    muted: { type: String, default: '#757575' }
  },
  fonts: {
    heading: { type: String, default: 'Inter, sans-serif' },
    body: { type: String, default: 'Inter, sans-serif' }
  },
  spacing: {
    small: { type: String, default: '8px' },
    medium: { type: String, default: '16px' },
    large: { type: String, default: '32px' }
  },
  borderRadius: { type: String, default: '8px' },
  shadows: { type: Boolean, default: true }
});

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  description: {
    type: String,
    maxlength: 500
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  template: {
    type: String,
    required: true,
    enum: ['fashion', 'tech', 'food', 'minimal', 'services']
  },
  components: [componentSchema],
  styles: {
    type: storeStyleSchema,
    default: () => ({})
  },
  settings: {
    isPublished: {
      type: Boolean,
      default: false
    },
    customDomain: {
      type: String,
      trim: true,
      lowercase: true
    },
    seoTitle: {
      type: String,
      maxlength: 60
    },
    seoDescription: {
      type: String,
      maxlength: 160
    },
    favicon: {
      type: String
    },
    analytics: {
      googleAnalyticsId: String,
      facebookPixelId: String
    },
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
      linkedin: String
    }
  },
  performance: {
    views: {
      type: Number,
      default: 0
    },
    uniqueVisitors: {
      type: Number,
      default: 0
    },
    conversionRate: {
      type: Number,
      default: 0
    },
    lastVisited: Date
  },
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
storeSchema.index({ seller: 1, isActive: 1 });
storeSchema.index({ slug: 1 });
storeSchema.index({ 'settings.isPublished': 1 });
storeSchema.index({ createdAt: -1 });

// Virtual for store URL
storeSchema.virtual('storeUrl').get(function() {
  if (this.settings.customDomain) {
    return `https://${this.settings.customDomain}`;
  }
  return `${process.env.FRONTEND_URL}/store/${this.slug}`;
});

// Virtual for component count
storeSchema.virtual('componentCount').get(function() {
  return this.components.length;
});

// Pre-save middleware to generate slug if not provided
storeSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

// Static method to find stores by seller
storeSchema.statics.findBySeller = function(sellerId, options = {}) {
  const query = { seller: sellerId, isActive: true };
  
  if (options.published !== undefined) {
    query['settings.isPublished'] = options.published;
  }
  
  return this.find(query)
    .sort({ updatedAt: -1 })
    .populate('seller', 'name email businessName');
};

// Instance method to publish store
storeSchema.methods.publish = function() {
  this.settings.isPublished = true;
  return this.save();
};

// Instance method to unpublish store
storeSchema.methods.unpublish = function() {
  this.settings.isPublished = false;
  return this.save();
};

// Instance method to increment views
storeSchema.methods.incrementViews = function(isUniqueVisitor = false) {
  this.performance.views += 1;
  if (isUniqueVisitor) {
    this.performance.uniqueVisitors += 1;
  }
  this.performance.lastVisited = new Date();
  return this.save();
};

// Instance method to duplicate store
storeSchema.methods.duplicate = function(newName) {
  const duplicatedStore = new this.constructor({
    name: newName || `${this.name} (Copy)`,
    description: this.description,
    seller: this.seller,
    template: this.template,
    components: this.components.map(comp => ({
      id: comp.id,
      type: comp.type,
      props: { ...comp.props },
      position: { ...comp.position },
      order: comp.order
    })),
    styles: { ...this.styles.toObject() },
    settings: {
      ...this.settings.toObject(),
      isPublished: false,
      customDomain: undefined
    }
  });
  
  return duplicatedStore.save();
};

export default mongoose.model('Store', storeSchema);
