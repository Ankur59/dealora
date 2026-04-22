import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import MerchantCredential from './src/models/merchantCredential.model.js';
import Merchant from './src/models/merchant.model.js';

const STANDARD_CREDENTIALS = {
  EMAIL: 'Nobentadeal@gmail.com',
  PASSWORD: 'Mumbai@123',
  PHONE: '7425817074'
};
const merchantId = '69e5f24d2f5321814a4f035c';
const goal = 'Login to the merchant account using the provided credentials. Fill email with EMAIL, password with PASSWORD.';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('connected');

  try {
    const creds = { ...STANDARD_CREDENTIALS };
    const custom = await MerchantCredential.find({ merchantId }).lean();
    for (const c of custom) {
        if (c.credentialType === 'email_password') {
           creds.EMAIL = c.login;
           creds.PASSWORD = c.password;
        } else if (c.credentialType === 'phone_password') {
           creds.PHONE = c.login;
           if (!custom.find(x => x.credentialType === 'email_password')) {
             creds.PASSWORD = c.password;
           }
        }
    }
    
    let finalGoal = goal.replace(STANDARD_CREDENTIALS.EMAIL, creds.EMAIL);
    finalGoal = finalGoal.replace(STANDARD_CREDENTIALS.PHONE, creds.PHONE);
    console.log('finalGoal', finalGoal);

    const merchant = await Merchant.findById(merchantId);
    console.log('merchant.website', merchant?.website);
    if (!merchant.actionMaps) merchant.actionMaps = new Map();
    if (!merchant.automationMacros) merchant.automationMacros = new Map();
    
    console.log('has login macro?', merchant.automationMacros.has('login'));

  } catch (e) {
    console.error('TEST ERROR', e);
  }
  process.exit();
}
test();
