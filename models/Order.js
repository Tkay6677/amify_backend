import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Buyer is required']
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    variant: {
      color: String,
      size: String,
      other: mongoose.Schema.Types.Mixed
    }
  }],
  shippingAddress: {
    fullName: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    street: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: 'Nigeria'
    },
    zipCode: String
  },
  paymentInfo: {
    method: {
      type: String,
      enum: ['paystack', 'flutterwave', 'bank_transfer', 'cash_on_delivery'],
      required: true
    },
    transactionId: String,
    reference: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: Date
  },
  pricing: {
    subtotal: {
      type: Number,
      required: true
    },
    shippingCost: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'],
    default: 'pending'
  },
  tracking: {
    trackingNumber: String,
    carrier: String,
    estimatedDelivery: Date,
    shippedAt: Date,
    deliveredAt: Date
  },
  notes: {
    buyer: String,
    seller: String,
    admin: String
  },
  timeline: [{
    status: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
});

// Indexes
orderSchema.index({ orderNumber: 1 });
orderSchema.index({ buyer: 1 });
orderSchema.index({ 'items.seller': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ 'paymentInfo.status': 1 });

// Generate order number before validation
orderSchema.pre('validate', async function(next) {
  try {
    if (this.isNew && !this.orderNumber) {
      const count = await this.constructor.countDocuments();
      this.orderNumber = `AMF${Date.now().toString().slice(-6)}${(count + 1).toString().padStart(4, '0')}`;
    }
    next();
  } catch (e) {
    next(e);
  }
});

// Method to add timeline entry
orderSchema.methods.addTimelineEntry = function(status, message, updatedBy) {
  this.timeline.push({
    status,
    message,
    updatedBy
  });
  this.status = status;
};

export default mongoose.model('Order', orderSchema);
