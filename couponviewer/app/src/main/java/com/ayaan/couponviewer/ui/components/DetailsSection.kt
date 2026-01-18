package com.ayaan.couponviewer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ayaan.couponviewer.ui.theme.CouponViewerColors

@Composable
fun DetailsSection(
    title: String?,
    description: String?,
    discountText: String,
    minimumOrder: String?
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Coupon Title
        if (!title.isNullOrBlank()) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = CouponViewerColors.TextPrimary,
                maxLines = 2
            )
        }
        
        // Description
        if (!description.isNullOrBlank()) {
            Text(
                text = description,
                style = MaterialTheme.typography.bodyLarge,
                color = CouponViewerColors.TextSecondary
            )
        }
        
        // Discount Info Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    color = CouponViewerColors.CardBackground,
                    shape = RoundedCornerShape(12.dp)
                )
                .padding(16.dp)
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = "💰 $discountText",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = CouponViewerColors.TextPrimary
                )
                
                if (!minimumOrder.isNullOrBlank() && minimumOrder != "0") {
                    Text(
                        text = "📦 Min. Order: ₹$minimumOrder",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CouponViewerColors.TextSecondary
                    )
                }
            }
        }
    }
}
