const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');


const app = express();
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  // Remove deprecated options
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define schemas
const orderSchema = new mongoose.Schema({
  seller: String,
  buyer: String,
  credits: Number,
  timestamp: String,
  certificate_hash: String
});

const landSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  LandName: String,
  UserID: String,
  geoTag: {
    type: { type: String },
    coordinates: [Number]
  },
  landDocument: String,
  landVideo: String,
  creditsInitial: Number,
  remainingCredits: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

landSchema.index({ geoTag: '2dsphere' });

const registeredLandsSchema = new mongoose.Schema({
  name: String,
  price: Number,
  location: String,
  area: String,
  greencover: String,
  status: String,
  date: String,
  userID: String
});
const buyCreditsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  priceCredits: {
    type: Number,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  validity: {
    type: Date,
    required: true
  },
  dateOfRegistration: {
    type: Date,
    required: true
  }
}, { timestamps: true });
const Order = mongoose.model('Order', orderSchema);
const Land = mongoose.model('Land', landSchema);
const RegisteredLands = mongoose.model('registered_lands', registeredLandsSchema);
const BuyCredits = mongoose.model('buy_credits', buyCreditsSchema);


app.get('/', (req, res) => {
  res.send('Welcome to the Green Credit Trading Platform API');
});
app.post('/create-order', async (req, res) => {
  try {
    const { seller, buyer, credits } = req.body;

    if (!seller || !buyer || !credits) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const certificate_hash = crypto.randomBytes(16).toString('hex');

    const order = new Order({
      seller,
      buyer,
      credits,
      timestamp,
      certificate_hash,
    });

    await order.save();

    await Land.findOneAndUpdate(
      { land_hash: seller },
      { $inc: { credits_sold: credits } },
      { new: true, upsert: true },
    );

    // Generate sender and receiver hashes
    const senderHash = crypto.createHash('sha256').update(seller).digest('hex');
    const receiverHash = crypto.createHash('sha256').update(buyer).digest('hex');

    // Call external API to log the transaction
    await axios.post('http://127.0.0.1:8080/add_transaction', {
      sender: senderHash,
      receiver: receiverHash,
      amount: credits,
    });

    // Delete the order after successful logging
    await Order.findByIdAndDelete(order._id);

    res.status(200).json({ message: 'Order created, transaction logged, and order deleted', certificate_hash });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.post('/create-order', async (req, res) => {
  try {
    const { seller, buyer, credits } = req.body;

    if (!seller || !buyer || !credits) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
    const certificate_hash = crypto.randomBytes(16).toString('hex');

    const order = new Order({
      seller,
      buyer,
      credits,
      timestamp,
      certificate_hash
    });

    await order.save();

    await Land.findOneAndUpdate(
      { land_hash: seller },
      { $inc: { credits_sold: credits } },
      { new: true, upsert: true }
    );

    res.status(200).json({ certificate_hash });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/registered_land', async (req, res) => {
  try {
    const registeredLands = await RegisteredLands.find();
    console.log('Retrieved documents:', registeredLands);

    if (registeredLands.length === 0) {
      console.log('No documents found in the collection');
    }

    res.status(200).json(registeredLands);
  } catch (error) {
    console.error('Error in /registered_land route:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/buy-credits', async (req, res) => {
  try {
    const buyCredits = await BuyCredits.find();
    
    if (buyCredits.length === 0) {
      return res.status(404).json({ message: 'No buy credits found' });
    }

    res.status(200).json(buyCredits);
  } catch (error) {
    console.error('Error fetching buy credits:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});