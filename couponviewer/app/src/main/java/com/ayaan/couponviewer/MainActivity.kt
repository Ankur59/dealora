package com.ayaan.couponviewer

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Vibrator
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.ayaan.couponviewer.data.models.CouponData
import com.ayaan.couponviewer.ui.screens.CouponViewerScreen
import com.ayaan.couponviewer.ui.theme.CouponViewerTheme
import com.ayaan.couponviewer.utils.IntentParser

class MainActivity : ComponentActivity() {
    
    private lateinit var couponData: CouponData
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Parse intent
        val data = when {
            intent.data != null -> IntentParser.parseDeepLink(intent)
            else -> IntentParser.parseIntent(intent)
        }
        
        if (data == null) {
            // Check if launched from launcher (no data expected)
            if (intent.action == Intent.ACTION_MAIN && intent.hasCategory(Intent.CATEGORY_LAUNCHER)) {
                // Use sample data for testing/demo
                couponData = CouponData(
                    couponCode = "WELCOME2024",
                    brandName = "Coupon Viewer",
                    title = "Welcome to Coupon Viewer",
                    description = "This is a sample coupon to demonstrate the app interface. Integrate with source app to see real coupons.",
                    category = "Demo",
                    discountType = "percentage",
                    discountValue = "100",
                    minimumOrder = "0",
                    expiryDate = "Valid Forever",
                    terms = "• This is a demo coupon\n• Use it to test the UI\n• Enjoy!",
                    sourcePackage = null,
                    couponLink = "https://example.com"
                )
            } else {
                // Invalid data from deep link or intent
                Toast.makeText(
                    this,
                    "Invalid coupon data",
                    Toast.LENGTH_SHORT
                ).show()
                finish()
                return
            }
        } else {
            couponData = data
        }
        
        // Auto-copy code
        copyToClipboard(couponData.couponCode, showToast = true)
        
        // Set UI
        setContent {
            CouponViewerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    CouponViewerScreen(
                        couponData = couponData,
                        onRedeemClick = { redeemCoupon() },
                        onShareClick = { shareCoupon() },
                        onCopyClick = { copyToClipboard(couponData.couponCode) }
                    )
                }
            }
        }
    }
    
    private fun copyToClipboard(text: String, showToast: Boolean = false) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("Coupon Code", text)
        clipboard.setPrimaryClip(clip)
        
        // Haptic feedback
        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
             vibrator.vibrate(android.os.VibrationEffect.createOneShot(50, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
             vibrator.vibrate(50)
        }
        
        if (showToast) {
            Toast.makeText(
                this,
                "Coupon code copied!",
                Toast.LENGTH_SHORT
            ).show()
        }
    }
    
    private fun redeemCoupon() {
        val sourcePackage = couponData.sourcePackage
        val couponLink = couponData.couponLink
        
        when {
            !sourcePackage.isNullOrBlank() -> openApp(sourcePackage, couponLink)
            !couponLink.isNullOrBlank() -> openLink(couponLink)
            else -> {
                Toast.makeText(
                    this,
                    "No redemption method available",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
    
    private fun openApp(packageName: String, fallbackLink: String?) {
        try {
            val intent = packageManager.getLaunchIntentForPackage(packageName)
            if (intent != null) {
                startActivity(intent)
            } else {
                openLink(fallbackLink)
            }
        } catch (e: Exception) {
            openLink(fallbackLink)
        }
    }
    
    private fun openLink(link: String?) {
        if (!link.isNullOrBlank()) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link))
                startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(
                    this,
                    "Unable to open link",
                    Toast.LENGTH_SHORT
                ).show()
            }
        } else {
            Toast.makeText(
                this,
                "Source app not installed",
                Toast.LENGTH_SHORT
            ).show()
        }
    }
    
    private fun shareCoupon() {
        val shareText = buildString {
            append("🎟️ ${couponData.brandName} Coupon\n\n")
            couponData.title?.let { append("💰 $it\n") }
            append("🔑 Code: ${couponData.couponCode}\n\n")
            couponData.description?.let { append("📝 $it\n\n") }
            couponData.expiryDate?.let { append("⏰ Valid: $it\n\n") }
            append("Use Coupon Viewer app to redeem!")
        }
        
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
            putExtra(Intent.EXTRA_SUBJECT, "${couponData.brandName} Coupon")
        }
        
        startActivity(Intent.createChooser(intent, "Share coupon"))
    }
}