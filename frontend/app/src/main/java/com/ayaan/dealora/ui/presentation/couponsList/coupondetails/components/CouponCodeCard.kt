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
import androidx.compose.ui.text.style.TextAlign
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
    onLinkClick: () -> Unit = {}
) {
    val code = couponCode?.toString()?.takeIf { it.isNotBlank() }
    val link = couponLink?.toString()?.takeIf { it.isNotBlank() }

    if (code == null && link == null) return

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (code != null) {
            SingleActionCard(
                text = code,
                actionText = "📋 Copy Code",
                onClick = onCopyCode,
                isCode = true
            )
        }

        if (link != null) {
            SingleActionCard(
                text = link,
                actionText = "🔗 Open Link & Copy Code",
                onClick = onLinkClick,
                isCode = false
            )
        }
    }
}

@Composable
private fun SingleActionCard(
    text: String,
    actionText: String,
    onClick: () -> Unit,
    isCode: Boolean
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
                text = text,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText,
                letterSpacing = if (isCode) 2.sp else 0.sp,
                overflow = TextOverflow.MiddleEllipsis,
                maxLines = 1,
                textAlign = TextAlign.Center
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


