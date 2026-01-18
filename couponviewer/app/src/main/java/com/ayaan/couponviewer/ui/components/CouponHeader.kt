package com.ayaan.couponviewer.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.couponviewer.ui.theme.CouponViewerColors

@Composable
fun CouponHeader(
    brandName: String,
    brandInitial: String,
    category: String?,
    expiryDate: String?
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        // Brand Logo Circle
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(CouponViewerColors.Secondary)
        ) {
            Text(
                text = brandInitial,
                color = Color.White,
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp
                )
            )
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Brand Name
        Text(
            text = brandName,
            style = MaterialTheme.typography.titleLarge,
            color = CouponViewerColors.TextPrimary
        )
        
        Spacer(modifier = Modifier.height(12.dp))
        
        // Badges Row
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (!category.isNullOrBlank()) {
                BadgeChip(text = category)
            }
            
            if (!expiryDate.isNullOrBlank()) {
                BadgeChip(text = expiryDate)
            }
        }
    }
}

@Composable
private fun BadgeChip(text: String) {
    Surface(
        color = CouponViewerColors.BadgeBackground,
        shape = RoundedCornerShape(16.dp)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            style = MaterialTheme.typography.titleSmall,
            color = CouponViewerColors.Primary
        )
    }
}
