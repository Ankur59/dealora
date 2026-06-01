package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.BorderStroke
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
import com.ayaan.dealora.data.api.models.PendingPartnerInteraction
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit

/**
 * Feedback popup for partner (exclusive) coupon interactions.
 *
 * Shown on app open when the user has PENDING partner coupon interactions
 * (i.e. they tapped Discover on a partner coupon but haven't told us
 * whether it worked yet).
 *
 * Each row has ✕ (didn't work → failure) and ✓ (worked → success) buttons.
 * "Maybe later" dismisses all as skipped.
 */
@Composable
fun MultiPartnerFeedbackPopup(
    interactions: List<PendingPartnerInteraction>,
    onResolve:    (couponId: String, outcome: String) -> Unit,
    onDismissAll: () -> Unit
) {
    if (interactions.isEmpty()) return

    val displayList = interactions.take(10)   // cap at 10 rows per session

    Dialog(
        onDismissRequest = onDismissAll,
        properties = DialogProperties(dismissOnBackPress = true, dismissOnClickOutside = false)
    ) {
        Card(
            shape     = RoundedCornerShape(28.dp),
            colors    = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp),
            modifier  = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp)
        ) {
            Box(modifier = Modifier.fillMaxWidth()) {
                IconButton(
                    onClick = onDismissAll,
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = AppColors.SecondaryText
                    )
                }

                Column(
                    modifier              = Modifier
                        .padding(top = 36.dp, start = 24.dp, end = 24.dp, bottom = 24.dp)
                        .fillMaxWidth(),
                    horizontalAlignment   = Alignment.CenterHorizontally
                ) {
                    Text(
                        text      = "Did these partner deals work? 🏷️",
                        fontSize  = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color     = AppColors.PrimaryText,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text      = "Let us know if these exclusive coupons worked for you.",
                        fontSize  = 14.sp,
                        textAlign = TextAlign.Center,
                        color     = AppColors.SecondaryText,
                        modifier  = Modifier.padding(horizontal = 8.dp)
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    LazyColumn(
                        modifier            = Modifier
                            .fillMaxWidth()
                            .heightIn(max = 400.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(displayList) { interaction ->
                            PartnerFeedbackItem(
                                interaction = interaction,
                                onSuccess   = { onResolve(interaction.couponId, "success") },
                                onFailure   = { onResolve(interaction.couponId, "failure") }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PartnerFeedbackItem(
    interaction: PendingPartnerInteraction,
    onSuccess:   () -> Unit,
    onFailure:   () -> Unit
) {
    Surface(
        color    = Color(0xFFF9F9FF),
        shape    = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier            = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment   = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text       = interaction.brandName,
                    fontSize   = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color      = AppColors.PrimaryText,
                    maxLines   = 1,
                    overflow   = TextOverflow.Ellipsis
                )
                val relativeTime = formatRelativeTime(interaction.createdAt)
                if (relativeTime.isNotEmpty()) {
                    Text(
                        text     = relativeTime,
                        fontSize = 11.sp,
                        color    = AppColors.SecondaryText,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
                if (!interaction.couponCode.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Surface(
                        color = Color(0xFFF0EFFF),
                        shape = RoundedCornerShape(6.dp),
                        border = BorderStroke(1.dp, DealoraPrimary.copy(alpha = 0.3f))
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "✂️",
                                fontSize = 11.sp,
                                modifier = Modifier.padding(end = 6.dp)
                            )
                            Text(
                                text          = interaction.couponCode,
                                fontSize      = 12.sp,
                                fontWeight    = FontWeight.Bold,
                                color         = DealoraPrimary,
                                letterSpacing = 1.sp
                            )
                        }
                    }
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                // Didn't work
                IconButton(
                    onClick = onFailure,
                    colors  = IconButtonDefaults.iconButtonColors(
                        containerColor = Color(0xFFFFEBEE),
                        contentColor   = Color(0xFFD32F2F)
                    ),
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Didn't work", modifier = Modifier.size(20.dp))
                }

                // Worked
                IconButton(
                    onClick = onSuccess,
                    colors  = IconButtonDefaults.iconButtonColors(
                        containerColor = Color(0xFFE8F5E9),
                        contentColor   = Color(0xFF388E3C)
                    ),
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(Icons.Default.Check, contentDescription = "Worked", modifier = Modifier.size(20.dp))
                }
            }
        }
    }
}

private fun formatRelativeTime(isoString: String?): String {
    if (isoString.isNullOrBlank()) return ""
    return try {
        val date = parseIsoString(isoString) ?: return ""
        val now = System.currentTimeMillis()
        val diff = now - date.time
        
        if (diff < 0) return "used today"
        
        val days = TimeUnit.MILLISECONDS.toDays(diff)
        when {
            days == 0L -> "used today"
            days == 1L -> "used yesterday"
            days < 7L -> "used $days days ago"
            days in 7L..13L -> "used last week"
            days in 14L..20L -> "used 2 weeks ago"
            days in 21L..27L -> "used 3 weeks ago"
            else -> "used over a month ago"
        }
    } catch (e: Exception) {
        ""
    }
}

private fun parseIsoString(isoString: String): Date? {
    val formats = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
        "yyyy-MM-dd'T'HH:mm:ss'Z'",
        "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
        "yyyy-MM-dd'T'HH:mm:ssZ"
    )
    for (format in formats) {
        try {
            val sdf = SimpleDateFormat(format, Locale.US)
            sdf.timeZone = TimeZone.getTimeZone("UTC")
            return sdf.parse(isoString)
        } catch (e: Exception) {
            // continue
        }
    }
    return null
}
