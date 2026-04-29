package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.ayaan.dealora.data.api.models.PendingInteraction
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun MultiFleetFeedbackPopup(
    interactions: List<PendingInteraction>,
    onResolve: (String, String) -> Unit, // interactionId, outcome
    onDismissAll: () -> Unit
) {
    if (interactions.isEmpty()) return

    val displayList = interactions.take(5)

    Dialog(
        onDismissRequest = onDismissAll,
        properties = DialogProperties(dismissOnBackPress = true, dismissOnClickOutside = false)
    ) {
        Card(
            shape = RoundedCornerShape(28.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "How were these deals? 🏷️",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.PrimaryText,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Help the community by letting us know if these coupons worked for you.",
                    fontSize = 14.sp,
                    textAlign = TextAlign.Center,
                    color = AppColors.SecondaryText,
                    modifier = Modifier.padding(horizontal = 8.dp)
                )

                Spacer(modifier = Modifier.height(20.dp))

                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 400.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(displayList) { interaction ->
                        FeedbackItem(
                            interaction = interaction,
                            onSuccess = { onResolve(interaction.id, "success") },
                            onFailure = { onResolve(interaction.id, "failure") }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = onDismissAll,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1F0FF), contentColor = DealoraPrimary)
                ) {
                    Text("Maybe later", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
fun FeedbackItem(
    interaction: PendingInteraction,
    onSuccess: () -> Unit,
    onFailure: () -> Unit
) {
    Surface(
        color = Color(0xFFF9F9FF),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = interaction.brandName,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.PrimaryText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (!interaction.couponCode.isNullOrBlank()) {
                    Text(
                        text = interaction.couponCode,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = DealoraPrimary,
                        letterSpacing = 1.sp
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                IconButton(
                    onClick = onFailure,
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = Color(0xFFFFEBEE),
                        contentColor = Color(0xFFD32F2F)
                    ),
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Failed", modifier = Modifier.size(20.dp))
                }

                IconButton(
                    onClick = onSuccess,
                    colors = IconButtonDefaults.iconButtonColors(
                        containerColor = Color(0xFFE8F5E9),
                        contentColor = Color(0xFF388E3C)
                    ),
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(Icons.Default.Check, contentDescription = "Worked", modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}
