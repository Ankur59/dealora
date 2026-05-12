package com.ayaan.dealora.utils

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast

/**
 * Helper object for launching Coupon Viewer app
 */
object CouponViewerIntentHelper {
    
    private const val COUPON_VIEWER_PACKAGE = "com.ayaan.couponviewer"
    private const val COUPON_VIEWER_ACTION = "com.ayaan.couponviewer.SHOW_COUPON"
    
    /**
     * Launch Coupon Viewer app with coupon data
     */
    fun openCouponViewerApp(
        context: Context,
        couponCode: String,
        brandName: String,
        title: String? = null,
        description: String? = null,
        category: String? = null,
        discountType: String? = null,
        discountValue: String? = null,
        minimumOrder: String? = null,
        expiryDate: String? = null,
        terms: String? = null,
        sourcePackage: String? = null,
        couponLink: String? = null
    ) {
        try {
            // Create explicit intent
            val intent = Intent().apply {
                action = COUPON_VIEWER_ACTION
                setPackage(COUPON_VIEWER_PACKAGE)
                
                // Required fields
                putExtra("EXTRA_COUPON_CODE", couponCode)
                putExtra("EXTRA_BRAND_NAME", brandName)
                
                // Optional fields
                title?.let { putExtra("EXTRA_COUPON_TITLE", it) }
                description?.let { putExtra("EXTRA_DESCRIPTION", it) }
                category?.let { putExtra("EXTRA_CATEGORY", it) }
                discountType?.let { putExtra("EXTRA_DISCOUNT_TYPE", it) }
                discountValue?.let { putExtra("EXTRA_DISCOUNT_VALUE", it) }
                minimumOrder?.let { putExtra("EXTRA_MINIMUM_ORDER", it) }
                expiryDate?.let { putExtra("EXTRA_EXPIRY_DATE", it) }
                terms?.let { putExtra("EXTRA_TERMS", it) }
                sourcePackage?.let { putExtra("EXTRA_SOURCE_PACKAGE", it) }
                couponLink?.let { putExtra("EXTRA_COUPON_LINK", it) }
                
                // Add flags
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            context.startActivity(intent)
            
        } catch (e: ActivityNotFoundException) {
            // App not installed - prompt user to install
            openPlayStore(context, COUPON_VIEWER_PACKAGE)
        } catch (e: Exception) {
            Toast.makeText(
                context, 
                "Unable to open Coupon Viewer: ${e.message}", 
                Toast.LENGTH_SHORT
            ).show()
        }
    }
    
    /**
     * Open Google Play Store to install Coupon Viewer
     */
    private fun openPlayStore(context: Context, packageName: String) {
        try {
            val playStoreIntent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("market://details?id=$packageName")
                setPackage("com.android.vending")
            }
            context.startActivity(playStoreIntent)
        } catch (e: Exception) {
            // Fallback to browser
            try {
                val browserIntent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse("https://play.google.com/store/apps/details?id=$packageName")
                }
                context.startActivity(browserIntent)
            } catch (e: Exception) {
                Toast.makeText(
                    context,
                    "Coupon Viewer app not found. Please install it from Play Store.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
}
