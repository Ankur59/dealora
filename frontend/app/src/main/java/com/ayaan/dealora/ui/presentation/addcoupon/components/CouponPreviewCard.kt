package com.ayaan.dealora.ui.presentation.addcoupon.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.ayaan.dealora.R

@Composable
fun CouponPreviewCard(
    couponName: String,
    description: String,
    expiryDate: String,
    couponCode: String,
    isRedeemed: Boolean
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(200.dp)
            .padding(vertical = 16.dp)
    ) {
        Image(
            painter = painterResource(R.drawable.coupon_banner),
            contentDescription = "Coupon Banner",
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.FillBounds
        )
    }
}