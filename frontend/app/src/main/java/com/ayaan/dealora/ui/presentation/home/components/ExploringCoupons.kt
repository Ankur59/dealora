package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.data.api.models.PrivateCoupon
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun ExploringCoupons(
    navController: NavController,
    coupons: List<PrivateCoupon>,
    isLoading: Boolean
) {
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
        coupons.isEmpty() -> {
            // Show empty state with placeholder images
            LazyRow(
                contentPadding = PaddingValues(horizontal = 0.dp)
            ) {
                items(5) { index ->
                    Image(
                        painter = painterResource(R.drawable.coupon_filled),
                        contentDescription = "Coupon Banner",
                        modifier = Modifier
                            .width(300.dp)
                            .height(200.dp)
                    )
                    if (index < 4) {
                        Box(modifier = Modifier.width(17.dp))
                    }
                }
            }
        }
        else -> {
            // Show actual coupons with proper width
            LazyRow(
                contentPadding = PaddingValues(horizontal = 0.dp)
            ) {
                items(coupons.size) { index ->
                    val coupon = coupons[index]
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
                            isSaved = false,
                            showActionButtons = true,
                            onDetailsClick = {
                                navController.navigate(
                                    Route.CouponDetails.createRoute(
                                        couponId = coupon.id,
                                        isPrivate = true
                                    )
                                )
                            },
                            onDiscoverClick = {
                                navController.navigate(
                                    Route.CouponDetails.createRoute(
                                        couponId = coupon.id,
                                        isPrivate = true
                                    )
                                )
                            },
                            onRedeem = { couponId ->
                                navController.navigate(
                                    Route.CouponDetails.createRoute(
                                        couponId = couponId,
                                        isPrivate = true
                                    )
                                )
                            }
                        )
                    }
                }
            }
        }
    }
}