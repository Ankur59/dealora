package com.ayaan.couponviewer.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ayaan.couponviewer.ui.theme.CouponViewerColors

@Composable
fun ActionButtons(
    onShareClick: () -> Unit,
    onRedeemClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Share Button
        OutlinedButton(
            onClick = onShareClick,
            modifier = Modifier
                .weight(0.4f)
                .height(56.dp),
            border = BorderStroke(2.dp, CouponViewerColors.Primary),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = CouponViewerColors.Primary
            )
        ) {
            Icon(
                imageVector = Icons.Default.Share,
                contentDescription = "Share",
                modifier = Modifier.padding(end = 8.dp)
            )
            Text(
                text = "Share",
                style = MaterialTheme.typography.labelLarge
            )
        }
        
        // Redeem Now Button
        Button(
            onClick = onRedeemClick,
            modifier = Modifier
                .weight(0.6f)
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = CouponViewerColors.Primary,
                contentColor = CouponViewerColors.Background
            ),
            elevation = ButtonDefaults.buttonElevation(defaultElevation = 2.dp)
        ) {
            Text(
                text = "Redeem Now",
                style = MaterialTheme.typography.labelLarge
            )
        }
    }
}
