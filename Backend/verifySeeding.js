require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./src/config/database');
const PrivateCoupon = require('./src/models/PrivateCoupon');

const verify = async () => {
    await connectDB();
    const count = await PrivateCoupon.countDocuments();
    console.log(`Total Private Coupons: ${count}`);

    const swiggyCoupons = await PrivateCoupon.find({ brandName: /^swiggy$/i });
    console.log(`Swiggy Coupons: ${swiggyCoupons.length}`);
    swiggyCoupons.forEach(c => console.log(` - ${c.couponTitle}`));

    mongoose.connection.close();
};

verify();
