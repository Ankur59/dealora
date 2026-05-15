package com.ayaan.dealora.ui.presentation.common.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.ayaan.dealora.ui.theme.DealoraPrimary

/**
 * Dialog for verifying if a coupon worked or not after redemption attempt.
 * 
 * @param showDialog Whether to show the dialog
 * @param couponBrand The brand name of the coupon being verified
 * @param couponCode The coupon code (optional)
 * @param onSuccess Called when user indicates the coupon worked
 * @param onFailure Called when user indicates the coupon didn't work
 * @param onDismiss Called when user dismisses the dialog without giving feedback
 */
@Composable
fun CouponVerificationDialog(
    showDialog: Boolean,
    couponBrand: String,
    couponCode: String? = null,
    onSuccess: () -> Unit,
    onFailure: () -> Unit,
    onDismiss: () -> Unit
) {
    if (showDialog) {
        Dialog(
            onDismissRequest = onDismiss,
            properties = DialogProperties(dismissOnBackPress = true, dismissOnClickOutside = false)
        ) {
            Card(
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .padding(24.dp)
                        .fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "Did it work? 🎫",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )

                    Text(
                        text = buildString {
                            append("You recently tried to redeem a coupon for ")
                            append(couponBrand)
                            couponCode?.let { code ->
                                append(" (")
                                append(code)
                                append(")")
                            }
                            append(". Did the coupon work?")
                        },
                        fontSize = 16.sp,
                        textAlign = TextAlign.Center,
                        color = Color(0xFF666666),
                        lineHeight = 22.sp
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Button(
                            onClick = onFailure,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFEF4444),
                                contentColor = Color.White
                            )
                        ) {
                            Text("No ❌", fontWeight = FontWeight.SemiBold)
                        }

                        Button(
                            onClick = onSuccess,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF10B981),
                                contentColor = Color.White
                            )
                        ) {
                            Text("Yes ✅", fontWeight = FontWeight.SemiBold)
                        }
                    }

                    TextButton(
                        onClick = onDismiss,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Maybe later", color = DealoraPrimary)
                    }
                }
            }
        }
    }
}