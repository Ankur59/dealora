package com.ayaan.dealora.ui.presentation.common.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraPrimary

/**
 * Helper function to get brand logo resource with fallback to default logo
 */
private fun getBrandLogoResource(brandName: String): Int {
    return when (brandName.replace("\n", "").trim().lowercase()) {
        "zomato" -> R.drawable.zomato_logo
        "swiggy" -> R.drawable.swiggy_logo
        "blinkit" -> R.drawable.blinkit_logo
        "amazon" -> R.drawable.azon_logo
        "flipkart" -> R.drawable.flipkart
        "nykaa" -> R.drawable.nykaa_logo
        "cred" -> R.drawable.cred_logo
        "phonepe", "phone pay" -> R.drawable.phonepe_logo
        "myntra" -> R.drawable.myntra
        "dealora" -> R.drawable.logo
        else -> R.drawable.logo
    }
}
@Composable
fun CouponCard(
    brandName: String = "BOMBAY\nSHAVING\nCOMPANY",
    couponTitle: String = "Buy 1 items,\nGet extra 10% off",
    description: String = "Get Extra 10% off on mcaffine Bodywash, lotion and many more.",
    category: String? = "Beauty",
    expiryDays: Int? = 3,
    couponCode: String = "",
    couponId: String? = null,
    isRedeemed: Boolean = false,
    onDetailsClick: () -> Unit = {},
    onDiscoverClick: () -> Unit = {},
    onRedeem: ((String) -> Unit)? = null
) {
    var showRedeemDialog by remember { mutableStateOf(false) }

    // Get brand logo with fallback to default logo
    val painter: Int = remember(brandName) {
        getBrandLogoResource(brandName)
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            // Purple Header Section
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF5B3FD9))
                    .padding(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Logo Circle
                    Box(
                        modifier = Modifier
                            .size(50.dp)
                            .background(Color(0xFF1E88A8), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(painter),
                            contentDescription = null,
                            modifier = Modifier
                                .fillMaxSize()
                                .clip(CircleShape)
                        )
//                        Text(
//                            text = brandName,
//                            color = Color.White,
//                            fontSize = 7.sp,
//                            fontWeight = FontWeight.Bold,
//                            lineHeight = 8.sp,
//                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
//                        )
                    }

                    // Center Content
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 12.dp)
                    ) {
                        Text(
                            text = couponTitle,
                            color = Color.White,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            lineHeight = 20.sp,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            if (category != null) {
                                Chip(text = category)
                            }
                            if (expiryDays != null) {
                                Chip(text = "Expiry in $expiryDays days")
                            }
                        }
                    }

                    // Star Icon
                    Icon(
                        imageVector = Icons.Outlined.BookmarkBorder,
                        contentDescription = "Featured",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            // Gray Footer Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFE8E8E8))
                    .padding(12.dp)
            ) {
                Text(
                    text = description,
                    fontSize = 13.sp,
                    color = Color(0xFF333333),
                    lineHeight = 16.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Buttons Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // Details Button
                    TextButton(
                        onClick = onDetailsClick,
                        modifier = Modifier
                            .weight(1f)
                            .height(36.dp),
                        contentPadding = PaddingValues(0.dp),
                        enabled = !isRedeemed
                    ) {
                        Text(
                            text = "Details",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (!isRedeemed) DealoraPrimary else Color.Gray
                        )
                    }

                    // Redeemed Button
                    OutlinedButton(
                        onClick = {
                            if (!isRedeemed) {
                                showRedeemDialog = true
                            }
                        },
                        modifier = Modifier
                            .weight(1f)
                            .height(36.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (isRedeemed) Color(0xFFD0D0D0) else Color.White,
                            contentColor = Color(0xFF666666)
                        ),
                        border = BorderStroke(
                            width = 1.dp,
                            brush = androidx.compose.ui.graphics.SolidColor(Color(0xFFCCCCCC))
                        ),
                        contentPadding = PaddingValues(0.dp),
                        enabled = !isRedeemed
                    ) {
                        Text(
                            text = if (isRedeemed) "Redeemed" else "Redeem",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    // Discover Button
                    Button(
                        onClick = onDiscoverClick,
                        modifier = Modifier
                            .weight(1f)
                            .height(36.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF5B3FD9)
                        ),
                        contentPadding = PaddingValues(0.dp),
                        enabled = !isRedeemed
                    ) {
                        Text(
                            text = "Discover", fontSize = 13.sp, fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }

    // Redeem Confirmation Dialog
    if (showRedeemDialog) {
        RedeemConfirmationDialog(onConfirm = {
            showRedeemDialog = false
            if (couponId != null && onRedeem != null) {
                onRedeem(couponId)
            }
        }, onDismiss = {
            showRedeemDialog = false
        })
    }
}

@Composable
fun RedeemConfirmationDialog(
    onConfirm: () -> Unit, onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color.White,
        shape = RoundedCornerShape(16.dp),
        title = {
            Text(
                text = "Mark as Redeemed?",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black
            )
        },
        text = {
            Column {
                Text(
                    text = "Are you sure you want to mark this coupon as redeemed?",
                    fontSize = 14.sp,
                    color = Color(0xFF666666),
                    lineHeight = 20.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "This action cannot be undone and the coupon will be marked as used.",
                    fontSize = 13.sp,
                    color = Color(0xFF999999),
                    lineHeight = 18.sp
                )
            }
        },
        confirmButton = {
            Button(
                onClick = onConfirm, colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF5B3FD9)
                ), shape = RoundedCornerShape(8.dp)
            ) {
                Text(
                    text = "Yes, Mark Redeemed", fontSize = 14.sp, fontWeight = FontWeight.SemiBold
                )
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss
            ) {
                Text(
                    text = "Cancel",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color(0xFF666666)
                )
            }
        })
}

@Composable
fun Chip(text: String) {
    Box(
        modifier = Modifier
            .background(Color(0x40FFFFFF), RoundedCornerShape(12.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(
            text = text, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Normal
        )
    }
}

@Preview
@Composable
fun CouponCardPreview() {
    CouponCard()
}