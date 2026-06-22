import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const merchantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email',
    ],
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number'],
  },
  businessName: {
    type: String,
    required: [true, 'Please add a business name'],
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 8,
    select: false,
  },
  certificateUrl: {
    type: String,
    required: [false, 'Certificate URL is not mandatory yet'],
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  paybillAccount: {
    type: String,
    unique: true,
    minlength: 5,
    maxlength: 5,
  },
  kesBalance: {
    type: Number,
    default: 0,
  },
  otp: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true
});

// Encrypt password using bcrypt
merchantSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
merchantSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Merchant = mongoose.model('Merchant', merchantSchema);

export default Merchant;
