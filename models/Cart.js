import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 50
    },
    variant: {
      color: String,
      size: String,
      other: mongoose.Schema.Types.Mixed
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  totalItems: {
    type: Number,
    default: 0
  },
  totalPrice: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for better performance
cartSchema.index({ user: 1 });

// Calculate totals before saving
cartSchema.pre('save', async function(next) {
  if (this.isModified('items')) {
    await this.populate('items.product');
    
    this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
    this.totalPrice = this.items.reduce((total, item) => {
      return total + (item.product.price * item.quantity);
    }, 0);
  }
  next();
});

// Method to add item to cart
cartSchema.methods.addItem = function(productId, quantity = 1, variant = {}) {
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString() && 
    JSON.stringify(item.variant) === JSON.stringify(variant)
  );

  if (existingItemIndex > -1) {
    this.items[existingItemIndex].quantity += quantity;
  } else {
    this.items.push({
      product: productId,
      quantity,
      variant
    });
  }
};

// Method to remove item from cart
cartSchema.methods.removeItem = function(productId, variant = {}) {
  this.items = this.items.filter(
    item => !(item.product.toString() === productId.toString() && 
    JSON.stringify(item.variant) === JSON.stringify(variant))
  );
};

// Method to update item quantity
cartSchema.methods.updateQuantity = function(productId, quantity, variant = {}) {
  const itemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString() && 
    JSON.stringify(item.variant) === JSON.stringify(variant)
  );

  if (itemIndex > -1) {
    if (quantity <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = quantity;
    }
  }
};

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.totalItems = 0;
  this.totalPrice = 0;
};

export default mongoose.model('Cart', cartSchema);
