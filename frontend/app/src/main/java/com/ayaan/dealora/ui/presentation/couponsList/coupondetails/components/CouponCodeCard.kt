package com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun CouponCodeCard(
    couponCode: Any?,
    couponLink: Any? = null,
    onCopyCode: () -> Unit,
    onCopyLink: () -> Unit = {}
) {
    // Convert Any? to String and check if it's not null or blank
    val code = couponCode?.toString()?.takeIf { it.isNotBlank() }
    val link = couponLink?.toString()?.takeIf { it.isNotBlank() }

    // If neither code nor link is available, don't display anything
    if (code == null && link == null) return

    // Determine what to display
    val isCodeAvailable = code != null
    val displayText = if (isCodeAvailable) code else link ?: ""
    val actionText = if (isCodeAvailable) "📋 Copy Code" else "🔗 Copy Link"
    val onClickAction = if (isCodeAvailable) onCopyCode else onCopyLink

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClickAction),
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
                text = displayText,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText,
                letterSpacing = if (isCodeAvailable) 2.sp else 0.sp,
                overflow = TextOverflow.MiddleEllipsis,
                maxLines = 1
            )

            Text(
                text = actionText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = DealoraPrimary
            )
        }
    }
}

