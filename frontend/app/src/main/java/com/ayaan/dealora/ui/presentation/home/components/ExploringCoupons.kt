package com.ayaan.dealora.ui.presentation.home.components

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.home.HomeViewModel
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun ExploringCoupons(
    navController: NavController,
    coupons: List<PrivateCoupon>,
    isLoading: Boolean,
    savedCouponIds: Set<String>,
    viewModel: HomeViewModel
) {
    Log.d("ExploringCoupons", "Redrawing with ${coupons.size} coupons")
    
    // Filter out redeemed coupons and ensure we only show active ones
    val activeCoupons = coupons.filter { coupon ->
        coupon.redeemed != true && (coupon.status == "active" || coupon.status == null)
    }
    
    Log.d("ExploringCoupons", "Active coupons after filter: ${activeCoupons.size}")

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
                    modifier = Modifier.size(32.dp), color = DealoraPrimary
                )
            }
        }

        activeCoupons.isEmpty() -> {
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
                            couponTitle = coupon.couponTitle ?: coupon.brandName.uppercase() + " coupon",
                            description = coupon.description ?: "",
                            category = coupon.category,
                            expiryDays = coupon.daysUntilExpiry,
                            couponCode = coupon.couponCode ?: "",
                            couponId = coupon.id,
                            isRedeemed = coupon.status == "redeemed",
                            couponLink = coupon.couponLink,
                            minimumOrderValue = coupon.minimumOrderValue,
                            isSaved = savedCouponIds.contains(coupon.id),
                            source = coupon.source,
                            showActionButtons = true,
                            onSave = { couponId ->
                                viewModel.saveCoupon(coupon)
                            },
                            onRemoveSave = { couponId ->
                                viewModel.removeSavedCoupon(couponId)
                            },
                            onDetailsClick = {
                                val couponJson = viewModel.moshi.adapter(PrivateCoupon::class.java).toJson(coupon)
                                navController.navigate(
                                    Route.CouponDetails.createRoute(
                                        couponId = coupon.id,
                                        isPrivate = true,
                                        couponCode = coupon.couponCode ?: "WELCOME100",
                                        couponData = Uri.encode(couponJson)
                                    )
                                )
                            },

                            onDiscoverClick = {
                                val websiteUrl = coupon.couponLink?.trim()?.takeIf { it.isNotEmpty() }
                                if (websiteUrl != null) {
                                    try {
                                        val uri = Uri.parse(
                                            if (websiteUrl.startsWith("http://") || websiteUrl.startsWith("https://"))
                                                websiteUrl
                                            else
                                                "https://$websiteUrl"
                                        )
                                        val linkIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                        }
                                        context.startActivity(linkIntent)
                                    } catch (e: Exception) {
                                        Log.e("ExploringCoupons", "Could not open brand link: ${e.message}", e)
                                    }
                                } else {
                                    Log.w("ExploringCoupons", "No website link available for this coupon")
                                }
                            },
                            onRedeem = { couponId ->
                                viewModel.redeemCoupon(couponId = couponId, onSuccess = {
                                    showSuccessDialog = true
                                }, onError = { error ->
                                    errorMessage = error
                                    showErrorDialog = true
                                })
                            })
                    }

                    // Success Dialog
                    if (showSuccessDialog) {
                        AlertDialog(onDismissRequest = { showSuccessDialog = false }, title = {
                            Text(
                                text = "Success!",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp
                            )
                        }, text = {
                            Text(
                                text = "Coupon redeemed successfully!", fontSize = 14.sp
                            )
                        }, confirmButton = {
                            Button(
                                onClick = { showSuccessDialog = false },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color(0xFF4CAF50)
                                )
                            ) {
                                Text("OK")
                            }
                        })
                    }

                    // Error Dialog
                    if (showErrorDialog) {
                        AlertDialog(onDismissRequest = { showErrorDialog = false }, title = {
                            Text(
                                text = "Error",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = Color.Red
                            )
                        }, text = {
                            Text(
                                text = errorMessage, fontSize = 14.sp
                            )
                        }, confirmButton = {
                            Button(
                                onClick = { showErrorDialog = false },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = Color.Red
                                )
                            ) {
                                Text("OK")
                            }
                        })
                    }
                }
            }
        }
    }
}