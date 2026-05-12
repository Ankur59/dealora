package com.ayaan.couponviewer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.couponviewer.data.models.CouponData
import com.ayaan.couponviewer.ui.theme.CouponViewerColors

@Composable
fun CouponCard(
    coupon: CouponData,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = CouponViewerColors.Background
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Brand Logo/Initial
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .clip(CircleShape)
                    .background(CouponViewerColors.Primary.copy(alpha = 0.1f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = coupon.getBrandInitial(),
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = CouponViewerColors.Primary
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Coupon Details
            Column(
                modifier = Modifier.weight(1f)
            ) {
                // Brand Name
                Text(
                    text = coupon.brandName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = CouponViewerColors.TextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Title
                if (!coupon.title.isNullOrBlank()) {
                    Text(
                        text = coupon.title,
                        style = MaterialTheme.typography.bodyMedium,
                        color = CouponViewerColors.TextSecondary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                }

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Discount Badge
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = CouponViewerColors.BadgeBackground
                    ) {
                        Text(
                            text = coupon.getDiscountText(),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = CouponViewerColors.Primary,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }

                    // Category Badge
                    if (!coupon.category.isNullOrBlank()) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = CouponViewerColors.CardBackground
                        ) {
                            Text(
                                text = coupon.category,
                                style = MaterialTheme.typography.labelSmall,
                                color = CouponViewerColors.TextSecondary,
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }

                // Expiry Date
                if (!coupon.expiryDate.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "⏰ ${coupon.expiryDate}",
                        style = MaterialTheme.typography.labelSmall,
                        color = CouponViewerColors.TextTertiary,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}
