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
                                isRedeemed = privateCoupon?.status == "redeemed",
                                couponLink = privateCoupon?.couponLink,
                                minimumOrderValue = privateCoupon?.minimumOrderValue?.toString(),
                                isSaved = isSaved,
                                source = coupon.source ?: privateCoupon?.source,
                                showActionButtons = !uiState.isPublicMode,
                                onDetailsClick = {
                                    val couponJson = privateCoupon?.let { 
                                        viewModel.moshi.adapter(com.ayaan.dealora.data.api.models.PrivateCoupon::class.java).toJson(it)
                                    }
                                    navController.navigate(
                                        Route.CouponDetails.createRoute(
                                            couponId = coupon.id,
                                            isPrivate = !uiState.isPublicMode,
                                            couponCode = privateCoupon?.couponCode ?: "WELCOME100",
                                            couponData = couponJson?.let { Uri.encode(it) }
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
                                    val websiteUrl = privateCoupon?.couponLink?.trim()?.takeIf { it.isNotEmpty() }
                                        ?: coupon.source?.trim()?.takeIf { it.isNotEmpty() }

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
                                            Log.e("CategoriesScreen", "Could not open brand link: ${e.message}", e)
                                        }
                                    } else {
                                        Log.w("CategoriesScreen", "No website link available for this coupon")
                                    }
                                },
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
