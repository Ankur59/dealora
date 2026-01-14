package com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.data.api.models.CouponDetail
import com.ayaan.dealora.ui.theme.AppColors
@Composable
fun TermsAndConditionsContent(coupon: CouponDetail) {
    Column {
        Text(
            text = "Terms & conditions",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Spacer(modifier = Modifier.height(12.dp))

        if (coupon.terms.toString().isNotBlank()&&coupon.terms!=null) {
            BulletPoint(coupon.terms.toString())
        } else {
            BulletPoint("Valid for a limited time only.")
            BulletPoint("One-time use per user.")
            BulletPoint("Cannot be combined with other offers.")
            coupon.minimumOrder?.let {
                BulletPoint("Minimum order value: ₹$it")
            }
            BulletPoint("Partner can modify or cancel the offer anytime.")
        }
    }
}
