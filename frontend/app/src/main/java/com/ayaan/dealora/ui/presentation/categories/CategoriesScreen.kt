package com.ayaan.dealora.ui.presentation.categories

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsListTopBar
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun CategoriesScreen(
    navController: NavController, viewModel: CategoriesViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

    Scaffold(
        topBar = {
            CouponsListTopBar(
                searchQuery = searchQuery,
                onSearchQueryChanged = { viewModel.onSearchQueryChanged(it) },
                onBackClick = { navController.popBackStack() },
                isPublicMode = uiState.isPublicMode,
                onPublicModeChanged = { viewModel.onPublicModeChanged(it) },
                showModeSwitch = false
            )
        }, containerColor = Color.White
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center), color = DealoraPrimary
                )
            } else if (uiState.errorMessage != null) {
                Text(
                    text = uiState.errorMessage!!,
                    color = Color.Red,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(16.dp)
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 16.dp)
                ) {
                    uiState.categoryGroups.forEach { group ->
                        item {
                            CategoryHeader(group.name, group.totalCount)
                        }

                        items(group.coupons) { coupon ->
                            val isSaved = uiState.savedCouponIds.contains(coupon.id)

                            // Get the full private coupon if in private mode
                            val privateCoupon = viewModel.getPrivateCoupon(coupon.id)

                            // State for this specific card
                            var showSuccessDialog by remember { mutableStateOf(false) }
                            var showErrorDialog by remember { mutableStateOf(false) }
                            var errorMessage by remember { mutableStateOf("") }

                            CouponCard(
                                brandName = coupon.brandName?.uppercase()?.replace(" ", "\n")
                                    ?: "DEALORA",
                                couponTitle = coupon.couponTitle ?: "Special Offer",
                                description = coupon.description ?: "",
                                category = coupon.category,
                                expiryDays = coupon.daysUntilExpiry,
                                couponCode = privateCoupon?.couponCode ?: "",
                                couponId = coupon.id,
                                isRedeemed = privateCoupon?.redeemed ?: false,
                                couponLink = privateCoupon?.couponLink,
                                minimumOrderValue = privateCoupon?.minimumOrderValue,
                                isSaved = isSaved,
                                showActionButtons = !uiState.isPublicMode,
                                onDetailsClick = {
                                    navController.navigate(
                                        Route.CouponDetails.createRoute(
                                            couponId = coupon.id,
                                            isPrivate = !uiState.isPublicMode,
                                            couponCode = privateCoupon?.couponCode ?: "WELCOME100"
                                        )
                                    )
                                },
                                onSave = { viewModel.saveCoupon(coupon.id, coupon) },
                                onRemoveSave = { viewModel.removeSavedCoupon(coupon.id) },
                                onRedeem = { couponId ->
                                    Log.d("CategoriesScreen", "Redeem clicked for coupon: $couponId")
                                    viewModel.redeemCoupon(
                                        couponId = couponId,
                                        onSuccess = {
                                            Log.d("CategoriesScreen", "Redeem success for coupon: $couponId")
                                            showSuccessDialog = true
                                        },
                                        onError = { error ->
                                            Log.e("CategoriesScreen", "Redeem error for coupon: $couponId - $error")
                                            errorMessage = error
                                            showErrorDialog = true
                                        }
                                    )
                                },
                                onDiscoverClick = {
                                    try {
                                        // Create implicit intent with custom action
                                        val intent = Intent().apply {
                                            action = "com.ayaan.couponviewer.SHOW_COUPON"

                                            if (privateCoupon != null) {
                                                // For private coupons with full data
                                                putExtra(
                                                    "EXTRA_COUPON_CODE",
                                                    privateCoupon.couponCode?.takeIf { it.isNotEmpty() }
                                                        ?: "NO CODE"
                                                )
                                                putExtra(
                                                    "EXTRA_COUPON_TITLE",
                                                    privateCoupon.couponTitle?.takeIf { it.isNotEmpty() }
                                                        ?: "Special Offer"
                                                )
                                                putExtra(
                                                    "EXTRA_DESCRIPTION",
                                                    privateCoupon.description?.takeIf { it.isNotEmpty() }
                                                        ?: "Check app for details"
                                                )
                                                putExtra(
                                                    "EXTRA_BRAND_NAME",
                                                    privateCoupon.brandName?.takeIf { it.isNotEmpty() }
                                                        ?: "Dealora"
                                                )
                                                putExtra(
                                                    "EXTRA_CATEGORY",
                                                    privateCoupon.category?.takeIf { it.isNotEmpty() }
                                                        ?: "General"
                                                )
                                                privateCoupon.daysUntilExpiry?.let {
                                                    putExtra("EXTRA_EXPIRY_DATE", "$it days")
                                                } ?: putExtra("EXTRA_EXPIRY_DATE", "Check app for expiry")
                                                putExtra(
                                                    "EXTRA_MINIMUM_ORDER",
                                                    privateCoupon.minimumOrderValue?.takeIf { it.isNotEmpty() }
                                                        ?: "No minimum"
                                                )
                                                putExtra(
                                                    "EXTRA_COUPON_LINK",
                                                    privateCoupon.couponLink?.takeIf { it.isNotEmpty() }
                                                        ?: ""
                                                )
                                            } else {
                                                // For public coupons with limited data
                                                putExtra(
                                                    "EXTRA_COUPON_CODE",
                                                    coupon.couponTitle ?: "DISCOVER"
                                                )
                                                putExtra(
                                                    "EXTRA_COUPON_TITLE",
                                                    coupon.couponTitle ?: "Special Offer"
                                                )
                                                putExtra(
                                                    "EXTRA_DESCRIPTION",
                                                    "View details in the app for more information"
                                                )
                                                putExtra(
                                                    "EXTRA_BRAND_NAME",
                                                    coupon.brandName ?: "Dealora"
                                                )
                                                putExtra("EXTRA_CATEGORY", "General")
                                                putExtra("EXTRA_MINIMUM_ORDER", "No minimum")
                                                putExtra("EXTRA_COUPON_LINK", "")
                                            }

                                            putExtra("EXTRA_SOURCE_PACKAGE", context.packageName)
                                            setPackage("com.ayaan.couponviewer")
                                            addCategory(Intent.CATEGORY_DEFAULT)
                                        }

                                        Log.d("CategoriesScreen", "Attempting to launch CouponViewer with intent: $intent")
                                        context.startActivity(intent)
                                    } catch (e: Exception) {
                                        Log.e("CategoriesScreen", "Failed to open CouponViewer app: ${e.message}", e)

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
                                }
                            )

                            // Success Dialog for this card
                            if (showSuccessDialog) {
                                androidx.compose.material3.AlertDialog(
                                    onDismissRequest = { showSuccessDialog = false },
                                    containerColor = Color.White,
                                    shape = RoundedCornerShape(16.dp),
                                    title = {
                                        Text(
                                            text = "Success!",
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF00C853)
                                        )
                                    },
                                    text = {
                                        Text(
                                            text = "Coupon has been marked as redeemed successfully.",
                                            fontSize = 14.sp,
                                            color = Color(0xFF666666)
                                        )
                                    },
                                    confirmButton = {
                                        Button(
                                            onClick = { showSuccessDialog = false },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = Color(0xFF00C853)
                                            ),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = "OK",
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }
                                    }
                                )
                            }

                            // Error Dialog for this card
                            if (showErrorDialog) {
                                androidx.compose.material3.AlertDialog(
                                    onDismissRequest = { showErrorDialog = false },
                                    containerColor = Color.White,
                                    shape = RoundedCornerShape(16.dp),
                                    title = {
                                        Text(
                                            text = "Error",
                                            fontSize = 20.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.Red
                                        )
                                    },
                                    text = {
                                        Text(
                                            text = errorMessage,
                                            fontSize = 14.sp,
                                            color = Color(0xFF666666)
                                        )
                                    },
                                    confirmButton = {
                                        Button(
                                            onClick = { showErrorDialog = false },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = Color.Red
                                            ),
                                            shape = RoundedCornerShape(8.dp)
                                        ) {
                                            Text(
                                                text = "OK",
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }
                                    }
                                )
                            }
                        }

                        item {
                            Spacer(modifier = Modifier.height(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CategoryHeader(name: String, count: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = name, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.Black
        )
        Text(
            text = "$count coupons",
            fontSize = 14.sp,
            color = DealoraPrimary,
            fontWeight = FontWeight.Medium
        )
    }
}
