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
import androidx.navigation.compose.rememberNavController
import com.ayaan.couponviewer.data.models.CouponData
import com.ayaan.couponviewer.data.repository.CouponRepository
import com.ayaan.couponviewer.navigation.NavGraph
import com.ayaan.couponviewer.ui.screens.CouponViewerScreen
import com.ayaan.couponviewer.ui.theme.CouponViewerTheme
import com.ayaan.couponviewer.utils.IntentParser

class MainActivity : ComponentActivity() {
    
    private var couponData: CouponData? = null
    private val couponRepository = CouponRepository()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Parse intent
        val data = when {
            intent.data != null -> IntentParser.parseDeepLink(intent)
            else -> IntentParser.parseIntent(intent)
        }
        
        // Check if launched from another app with coupon data
        val isExternalLaunch = data != null

        if (isExternalLaunch) {
            couponData = data
            // Auto-copy code for external launches
            copyToClipboard(couponData!!.couponCode, showToast = true)
        }

        // Set UI
        setContent {
            CouponViewerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (isExternalLaunch && couponData != null) {
                        // Show coupon directly if launched from external app
                        CouponViewerScreen(
                            couponData = couponData!!,
                            onRedeemClick = { redeemCoupon(couponData!!) },
                            onShareClick = { shareCoupon(couponData!!) },
                            onCopyClick = { copyToClipboard(couponData!!.couponCode) }
                        )
                    } else {
                        // Show navigation with home screen
                        val navController = rememberNavController()
                        NavGraph(
                            navController = navController,
                            couponRepository = couponRepository,
                            onRedeemClick = { couponId ->
                                couponRepository.getCouponById(couponId)?.let { redeemCoupon(it) }
                            },
                            onShareClick = { couponId ->
                                couponRepository.getCouponById(couponId)?.let { shareCoupon(it) }
                            },
                            onCopyClick = { couponId ->
                                couponRepository.getCouponById(couponId)?.let {
                                    copyToClipboard(it.couponCode)
                                }
                            }
                        )
                    }
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
    
    private fun redeemCoupon(coupon: CouponData) {
        val sourcePackage = coupon.sourcePackage
        val couponLink = coupon.couponLink

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
    
    private fun shareCoupon(coupon: CouponData) {
        val shareText = buildString {
            append("🎟️ ${coupon.brandName} Coupon\n\n")
            coupon.title?.let { append("💰 $it\n") }
            append("🔑 Code: ${coupon.couponCode}\n\n")
            coupon.description?.let { append("📝 $it\n\n") }
            coupon.expiryDate?.let { append("⏰ Valid: $it\n\n") }
            append("Use Coupon Viewer app to redeem!")
        }
        
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
            putExtra(Intent.EXTRA_SUBJECT, "${coupon.brandName} Coupon")
        }
        
        startActivity(Intent.createChooser(intent, "Share coupon"))
    }
}