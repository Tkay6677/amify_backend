import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

// Function to get Supabase client (lazy initialization)
const getSupabaseClient = () => {
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
    console.warn('Supabase environment variables not found, image uploads will use base64 fallback');
    return null;
  }
  return createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );
};

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('type').isIn(['buyer', 'seller']).withMessage('Type must be buyer or seller')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, email, password, type, phone, businessName, businessDescription } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Create user object
    const userData = {
      name,
      email,
      password,
      type,
      phone
    };

    // Handle location coordinates for both buyers and sellers
    const { latitude, longitude, address } = req.body;
    if (latitude && longitude) {
      // Use provided coordinates
      userData.address = {
        country: 'Nigeria',
        coordinates: {
          type: 'Point',
          coordinates: [longitude, latitude] // GeoJSON format: [lng, lat]
        }
      };
      if (address) {
        userData.addressText = address;
      }
    } else {
      // For users without coordinates, set a minimal address structure
      // without the coordinates field to avoid GeoJSON validation errors
      userData.address = {
        country: 'Nigeria'
      };
    }

    // Add seller-specific fields
    if (type === 'seller') {
      if (!businessName) {
        return res.status(400).json({ message: 'Business name is required for sellers' });
      }
      userData.businessName = businessName;
      userData.businessDescription = businessDescription;
      
      // Sellers must have coordinates, so if not provided, use default Nigeria coordinates
      if (!latitude || !longitude) {
        userData.address.coordinates = {
          type: 'Point',
          coordinates: [7.0, 9.0] // Default coordinates for Nigeria (longitude, latitude)
        };
      }
    }

    // Create user
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Check for user and include password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account has been deactivated' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error getting user data' });
  }
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error getting profile data' });
  }
});

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('phone').optional().custom((value) => {
    if (!value || value.trim() === '') return true; // Allow empty phone
    return /^\+?[0-9\s\-\(\)]{7,20}$/.test(value);
  }).withMessage('Please enter a valid phone number'),
  body('businessName').optional().custom((value) => {
    if (!value || value.trim() === '') return true; // Allow empty business name
    return value.trim().length >= 2 && value.trim().length <= 100;
  }).withMessage('Business name must be between 2 and 100 characters'),
  body('businessDescription').optional().custom((value) => {
    if (!value || value.trim() === '') return true; // Allow empty description
    return value.trim().length <= 500;
  }).withMessage('Business description must not exceed 500 characters'),
  body('address').optional().isLength({ max: 1000 }).withMessage('Address must not exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const allowedFields = ['name', 'phone', 'businessName', 'businessDescription', 'address'];
    const updates = {};

    // Only include allowed fields that are present in request
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error updating profile' });
  }
});

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error changing password' });
  }
});

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

// @desc    Upload avatar
// @route   POST /api/auth/upload-avatar
// @access  Private
router.post('/upload-avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let avatarUrl;

    try {
      // Generate unique filename
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${req.user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Get Supabase client
      const supabase = getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('amify-storage')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: true
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('amify-storage')
        .getPublicUrl(filePath);

      avatarUrl = urlData.publicUrl;

    } catch (supabaseError) {
      console.warn('Supabase upload failed, falling back to base64:', supabaseError.message);
      // Fallback to base64 if Supabase upload fails
      avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    // Update user's avatar in database
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      avatarUrl: avatarUrl,
      user: user
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload avatar',
      error: error.message 
    });
  }
});

export default router;
