import mongoose from 'mongoose';
import Merchant from '../src/models/merchant.model.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkMerchant() {
  await mongoose.connect(process.env.MONGODB_URI);
  const m = await Merchant.findById('69e24930ef24721063648b69');
  console.log('Merchant:', JSON.stringify(m, null, 2));
  process.exit(0);
}

checkMerchant();
