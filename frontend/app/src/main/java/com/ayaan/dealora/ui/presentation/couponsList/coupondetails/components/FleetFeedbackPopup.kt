package com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.ayaan.dealora.data.api.models.PendingInteraction
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun FleetFeedbackPopup(
    interaction: PendingInteraction,
    onResolve: (String) -> Unit // "success", "failure", "skipped"
) {
    Dialog(
        onDismissRequest = { onResolve("skipped") },
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
                    color = AppColors.PrimaryText
                )

                Text(
                    text = "You recently used a coupon for ${interaction.brandName}.",
                    fontSize = 16.sp,
                    textAlign = TextAlign.Center,
                    color = AppColors.SecondaryText
                )

                if (!interaction.couponCode.isNullOrBlank()) {
                    Surface(
                        color = Color(0xFFF5F5F5),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.padding(vertical = 8.dp)
                    ) {
                        Text(
                            text = interaction.couponCode,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Medium,
                            letterSpacing = 2.sp,
                            color = Color.Black
                        )
                    }
                }

                Text(
                    text = "Help other users by sharing if this coupon worked for you.",
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    color = AppColors.SecondaryText.copy(alpha = 0.8f)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { onResolve("failure") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.Red),
                        border = ButtonDefaults.outlinedButtonBorder.copy(brush = androidx.compose.ui.graphics.SolidColor(Color.Red))
                    ) {
                        Text("No ❌")
                    }

                    Button(
                        onClick = { onResolve("success") },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))
                    ) {
                        Text("Yes ✅")
                    }
                }

                TextButton(
                    onClick = { onResolve("skipped") }
                ) {
                    Text("Maybe later", color = AppColors.SecondaryText)
                }
            }
        }
    }
}
