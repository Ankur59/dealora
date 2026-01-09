package com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun CouponCodeCard(
    couponCode: String?,
    onCopyCode: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onCopyCode),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFE8DCFF)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {

            Text(
                text = couponCode ?: "No Code",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText,
                letterSpacing = 2.sp
            )

            Text(
                text = "📋 Copy Code",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = DealoraPrimary
            )
        }
    }
}

