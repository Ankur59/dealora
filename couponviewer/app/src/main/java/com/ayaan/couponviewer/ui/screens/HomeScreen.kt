package com.ayaan.couponviewer.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.couponviewer.ui.theme.CouponViewerColors

@Composable
fun HomeScreen(
    onNavigateToRewards: () -> Unit
) {
    Scaffold { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(CouponViewerColors.Background),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // App Logo/Icon
            Surface(
                modifier = Modifier
                    .size(120.dp),
                shape = RoundedCornerShape(30.dp),
                color = CouponViewerColors.Primary.copy(alpha = 0.1f)
            ) {
                Box(
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CardGiftcard,
                        contentDescription = "Coupon Icon",
                        modifier = Modifier.size(64.dp),
                        tint = CouponViewerColors.Primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Welcome Text
            Text(
                text = "Welcome to",
                style = MaterialTheme.typography.headlineSmall,
                color = CouponViewerColors.TextSecondary,
                fontWeight = FontWeight.Normal
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Coupon Viewer",
                style = MaterialTheme.typography.headlineLarge,
                color = CouponViewerColors.Primary,
                fontWeight = FontWeight.Bold,
                fontSize = 36.sp
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Your one-stop destination for\nall your coupon needs",
                style = MaterialTheme.typography.bodyLarge,
                color = CouponViewerColors.TextSecondary,
                textAlign = TextAlign.Center,
                lineHeight = 24.sp
            )

            Spacer(modifier = Modifier.height(48.dp))

            // Browse Rewards Button
            Button(
                onClick = onNavigateToRewards,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 32.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = CouponViewerColors.Primary,
                    contentColor = CouponViewerColors.Background
                ),
                shape = RoundedCornerShape(16.dp),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp)
            ) {
                Text(
                    text = "Browse Rewards",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Info Card
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = CouponViewerColors.CardBackground
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "💰 Exclusive Deals",
                        style = MaterialTheme.typography.bodyMedium,
                        color = CouponViewerColors.TextPrimary,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Save big on your favorite brands",
                        style = MaterialTheme.typography.bodySmall,
                        color = CouponViewerColors.TextSecondary,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
