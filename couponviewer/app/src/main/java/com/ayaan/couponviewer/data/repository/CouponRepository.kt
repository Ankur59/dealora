package com.ayaan.couponviewer.data.repository

import com.ayaan.couponviewer.data.models.CouponData

class CouponRepository {

    private val coupons = listOf(
        CouponData(
            couponCode = "SAVE50",
            brandName = "Fashion Store",
            title = "Flat 50% Off on Fashion",
            description = "Get amazing discounts on all fashion items. Limited time offer!",
            category = "Fashion",
            discountType = "percentage",
            discountValue = "50",
            minimumOrder = "999",
            expiryDate = "Valid till 31 Dec 2026",
            terms = "• Valid on orders above ₹999\n• Cannot be combined with other offers\n• Applicable on select items only",
            sourcePackage = null,
            couponLink = "https://example.com"
        ),
        CouponData(
            couponCode = "FOOD200",
            brandName = "Food Delivery",
            title = "₹200 Off on Food Orders",
            description = "Enjoy delicious meals with great savings. Order now!",
            category = "Food",
            discountType = "flat",
            discountValue = "200",
            minimumOrder = "500",
            expiryDate = "Valid till 15 Mar 2026",
            terms = "• Valid on orders above ₹500\n• Valid for all users\n• One time use per user",
            sourcePackage = null,
            couponLink = "https://example.com"
        ),
        CouponData(
            couponCode = "TECH30",
            brandName = "Tech Bazaar",
            title = "30% Off on Electronics",
            description = "Upgrade your gadgets with exclusive tech deals",
            category = "Electronics",
            discountType = "percentage",
            discountValue = "30",
            minimumOrder = "2999",
            expiryDate = "Valid till 30 Jun 2026",
            terms = "• Valid on orders above ₹2999\n• Applicable on all electronics\n• Free shipping included",
            sourcePackage = null,
            couponLink = "https://example.com"
        ),
        CouponData(
            couponCode = "GROCERY100",
            brandName = "Fresh Mart",
            title = "₹100 Off on Groceries",
            description = "Save on your monthly grocery shopping",
            category = "Grocery",
            discountType = "flat",
            discountValue = "100",
            minimumOrder = "1000",
            expiryDate = "Valid till 28 Feb 2026",
            terms = "• Valid on orders above ₹1000\n• Valid on all grocery items\n• Can be used twice per month",
            sourcePackage = null,
            couponLink = "https://example.com"
        ),
        CouponData(
            couponCode = "BOGO2024",
            brandName = "Book Haven",
            title = "Buy 1 Get 1 Free on Books",
            description = "Double your reading pleasure with BOGO offer",
            category = "Books",
            discountType = "bogo",
            discountValue = "BOGO",
            minimumOrder = "299",
            expiryDate = "Valid till 31 Dec 2026",
            terms = "• Buy one book, get another free\n• Free book should be of equal or lesser value\n• Valid on all books",
            sourcePackage = null,
            couponLink = "https://example.com"
        ),
        CouponData(
            couponCode = "BEAUTY25",
            brandName = "Beauty World",
            title = "25% Off on Beauty Products",
            description = "Pamper yourself with premium beauty products",
            category = "Beauty",
            discountType = "percentage",
            discountValue = "25",
            minimumOrder = "799",
            expiryDate = "Valid till 31 May 2026",
            terms = "• Valid on orders above ₹799\n• Applicable on all beauty brands\n• Free samples included",
            sourcePackage = null,
            couponLink = "https://example.com"
        )
    )

    fun getCoupons(): List<CouponData> = coupons

    fun getCouponById(id: Int): CouponData? {
        return coupons.getOrNull(id)
    }
}
