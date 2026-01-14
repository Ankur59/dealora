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
fun DetailsContent(coupon: CouponDetail) {
    Column {
        Text(
            text = "Details",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(12.dp))

        coupon.display?.formattedExpiry?.let {
            BulletPoint("Expires on $it")
        }

        coupon.discountValue?.let { value ->
            // Handle both String and numeric values
            val valueStr = value.toString()
            val discountText = when (coupon.discountType?.toString()?.lowercase()) {
                "flat" -> "Flat ₹$valueStr off"
                "percentage" -> "$valueStr% off"
                else -> valueStr
            }

            val minimumText = coupon.minimumOrder?.let { min ->
                " on minimum order of ₹${min}"
            } ?: ""

            BulletPoint(discountText + minimumText)
        }

        coupon.couponDetails?.let {
            BulletPoint(it.toString())
        }

        when (coupon.useCouponVia?.toString()?.lowercase()) {
            "both" -> BulletPoint("Valid on App and Website")
            "app" -> BulletPoint("Valid only on App")
            "website" -> BulletPoint("Valid only on Website")
        }
    }
}
