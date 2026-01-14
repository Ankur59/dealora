package com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.data.api.models.CouponDetail
import com.ayaan.dealora.ui.theme.AppColors

@Composable
fun HowToRedeemContent(coupon: CouponDetail) {
    Column {
        Text(
            text = "How to redeem",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(12.dp))
        NumberedPoint(1, "Copy the coupon code${coupon.couponCode?.let { " ($it)" } ?: ""}.")
        NumberedPoint(
            2,
            "Go to ${coupon.brandName ?: "the partner"} ${if (coupon.useCouponVia?.toString()?.lowercase() == "app") "app" else if (coupon.useCouponVia?.toString()?.lowercase() == "website") "website" else "app/website"}."
        )
        NumberedPoint(3, "Add items to cart and apply the code at checkout.")
        NumberedPoint(4, "Complete payment to claim the offer.")
    }
}
