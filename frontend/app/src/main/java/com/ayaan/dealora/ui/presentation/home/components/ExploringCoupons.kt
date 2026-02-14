package com.ayaan.dealora.ui.presentation.home.components

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.presentation.home.HomeViewModel

@Composable
fun ExploringCoupons(
    navController: NavController,
    coupons: List<PrivateCoupon>,
    isLoading: Boolean,
    savedCouponIds: Set<String>,
    viewModel: HomeViewModel
) {
    Log.d("ExploringCoupons", coupons.toString())
    // Filter out redeemed coupons
    val activeCoupons = coupons.filter { coupon ->
        coupon.redeemed != true
    }

    when {
        isLoading -> {
            // Show loading state
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(32.dp),
                    color = DealoraPrimary
                )
            }
        }
        activeCoupons.isEmpty() -> {
            // Show empty state with placeholder images
//            LazyRow(
//                contentPadding = PaddingValues(horizontal = 0.dp)
//            ) {
//                items(5) { index ->
//                    Image(
//                        painter = painterResource(R.drawable.coupon_filled),
//                        contentDescription = "Coupon Banner",
//                        modifier = Modifier
//                            .width(300.dp)
//                            .height(200.dp)
//                    )
//                    if (index < 4) {
//                        Box(modifier = Modifier.width(17.dp))
//                    }
//                }
//            }
        }
        else -> {
            // Show actual coupons with proper width
            LazyRow(
                contentPadding = PaddingValues(horizontal = 0.dp)
            ) {
                items(activeCoupons.size) { index ->
                    val coupon = activeCoupons[index]
                    val context = LocalContext.current

                    // State for redeem dialog for this specific card
                    var showSuccessDialog by remember { mutableStateOf(false) }
                    var showErrorDialog by remember { mutableStateOf(false) }
                    var errorMessage by remember { mutableStateOf("") }

                    Box(
                        modifier = Modifier.width(350.dp)
                    ) {
                        CouponCard(
                            brandName = coupon.brandName.uppercase().replace(" ", "\n"),
                            couponTitle = coupon.couponTitle,
                            description = coupon.description ?: "",
                            category = coupon.category,
                            expiryDays = coupon.daysUntilExpiry,
                            couponCode = coupon.couponCode ?: "",
                            couponId = coupon.id,
                            isRedeemed = coupon.redeemed ?: false,
                            couponLink = coupon.couponLink,
                            minimumOrderValue = coupon.minimumOrderValue,
                            isSaved = savedCouponIds.contains(coupon.id),
                            showActionButtons = true,
                            onSave = { couponId ->
                                viewModel.saveCoupon(coupon)
                            },
                            onRemoveSave = { couponId ->
                                viewModel.removeSavedCoupon(couponId)
                            },
                            onDetailsClick = {
                                navController.navigate(
                                    Route.CouponDetails.createRoute(
                                        couponId = coupon.id,
                                        isPrivate = true
                                    )
                                )
                            },
                            onDiscoverClick = {
                                try {
                                    // Create implicit intent with custom action
                                    val intent = Intent().apply {
                                        action = "com.ayaan.couponviewer.SHOW_COUPON"
                                        
                                        // Add coupon data as extras with defaults for null/empty values
                                        putExtra(
                                            "EXTRA_COUPON_CODE",
                                            coupon.couponCode?.takeIf { it.isNotEmpty() } ?: "NO CODE"
                                        )
                                        putExtra(
                                            "EXTRA_COUPON_TITLE",
                                            coupon.couponTitle?.takeIf { it.isNotEmpty() } ?: "Special Offer"
                                        )
                                        putExtra(
                                            "EXTRA_DESCRIPTION",
                                            coupon.description?.takeIf { it.isNotEmpty() } ?: "Check app for details"
                                        )
                                        putExtra(
                                            "EXTRA_BRAND_NAME",
                                            coupon.brandName?.takeIf { it.isNotEmpty() } ?: "Dealora"
                                        )
                                        putExtra(
                                            "EXTRA_CATEGORY",
                                            coupon.category?.takeIf { it.isNotEmpty() } ?: "General"
                                        )
                                        coupon.daysUntilExpiry?.let {
                                            putExtra("EXTRA_EXPIRY_DATE", "$it days")
                                        }
                                        putExtra(
                                            "EXTRA_MINIMUM_ORDER",
                                            coupon.minimumOrderValue?.takeIf { it.isNotEmpty() } ?: "No minimum"
                                        )
                                        putExtra(
                                            "EXTRA_COUPON_LINK",
                                            coupon.couponLink?.takeIf { it.isNotEmpty() } ?: ""
                                        )
                                        putExtra("EXTRA_SOURCE_PACKAGE", context.packageName)
                                        
                                        // Set package to ensure it opens the right app
                                        setPackage("com.ayaan.couponviewer")
                                        
                                        // Add category to help Android find the intent handler
                                        addCategory(Intent.CATEGORY_DEFAULT)
                                    }
                                    
                                    Log.d("ExploringCoupons", "Attempting to launch CouponViewer with intent: $intent")
                                    Log.d("ExploringCoupons", "Coupon Title: ${coupon.couponTitle}")
                                    
                                    context.startActivity(intent)
                                } catch (e: Exception) {
                                    Log.e("ExploringCoupons", "Failed to open CouponViewer app: ${e.message}", e)
                                    
                                    // Fallback to Play Store
                                    try {
                                        val playStoreIntent = Intent(Intent.ACTION_VIEW).apply {
                                            data = Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                            setPackage("com.android.vending")
                                        }
                                        context.startActivity(playStoreIntent)
                                    } catch (e2: Exception) {
                                        // Last resort - open in browser
                                        val browserIntent = Intent(Intent.ACTION_VIEW).apply {
                                            data = Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                        }
                                        context.startActivity(browserIntent)
                                    }
                                }
                            },
                            onRedeem = { couponId ->
                                viewModel.redeemCoupon(
                                    couponId = couponId,
                                    onSuccess = {
                                        showSuccessDialog = true
                                    },
                                    onError = { error ->
                                        errorMessage = error
                                        showErrorDialog = true
                                    }
                                )
                            }
                        )
                    }

                    // Success Dialog
                    if (showSuccessDialog) {
                        AlertDialog(
                            onDismissRequest = { showSuccessDialog = false },
                            title = {
                                Text(
                                    text = "Success!",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp
                                )
                            },
                            text = {
                                Text(
                                    text = "Coupon redeemed successfully!",
                                    fontSize = 14.sp
                                )
                            },
                            confirmButton = {
                                Button(
                                    onClick = { showSuccessDialog = false },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color(0xFF4CAF50)
                                    )
                                ) {
                                    Text("OK")
                                }
                            }
                        )
                    }

                    // Error Dialog
                    if (showErrorDialog) {
                        AlertDialog(
                            onDismissRequest = { showErrorDialog = false },
                            title = {
                                Text(
                                    text = "Error",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 18.sp,
                                    color = Color.Red
                                )
                            },
                            text = {
                                Text(
                                    text = errorMessage,
                                    fontSize = 14.sp
                                )
                            },
                            confirmButton = {
                                Button(
                                    onClick = { showErrorDialog = false },
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Color.Red
                                    )
                                ) {
                                    Text("OK")
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}