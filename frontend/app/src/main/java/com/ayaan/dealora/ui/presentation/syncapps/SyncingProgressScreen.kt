package com.ayaan.dealora.ui.presentation.syncapps

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraPrimary
import kotlinx.coroutines.delay

@Composable
fun SyncingProgressScreen(
    selectedApps: List<SyncApp> = emptyList()
) {
    var currentAppIndex by remember { mutableIntStateOf(0) }
    var syncedApps by remember { mutableIntStateOf(0) }

    // Simulate syncing progress
    LaunchedEffect(selectedApps) {
        if (selectedApps.isNotEmpty()) {
            selectedApps.forEachIndexed { index, _ ->
                currentAppIndex = index
                delay(2000) // 2 seconds per app
                syncedApps++
            }
        }
    }

    val progress = if (selectedApps.isEmpty()) 0f else syncedApps.toFloat() / selectedApps.size

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(40.dp))

        // Title Section
        Column(
            horizontalAlignment = Alignment.Start,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = "Syncing in",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black,
                lineHeight = 38.sp
            )

            Box(
                modifier = Modifier
                    .background(
                        color = DealoraPrimary,
                        shape = RoundedCornerShape(4.dp)
                    )
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "Progress",
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Description Text
        Text(
            text = "Your selected apps are being synced individually. Please wait until all apps are fully synced.",
            fontSize = 14.sp,
            color = Color.Black,
            lineHeight = 20.sp,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Synced Apps Row (shows first few apps with checkmarks)
        if (selectedApps.isNotEmpty()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                selectedApps.take(5).forEachIndexed { index, app ->
                    SyncedAppIcon(
                        app = app,
                        isSynced = index < syncedApps
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(48.dp))

        // Center - Current Syncing App
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            if (selectedApps.isNotEmpty() && currentAppIndex < selectedApps.size) {
                AnimatedSyncingApp(
                    app = selectedApps[currentAppIndex],
                    key = currentAppIndex
                )
            }
        }

        Spacer(modifier = Modifier.height(48.dp))

        // Bottom Section - Progress Text and Bar
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = buildAnnotatedString {
                    withStyle(style = SpanStyle(color = DealoraPrimary, fontWeight = FontWeight.SemiBold)) {
                        append("Wait")
                    }
                    append(" till Syncing gets done")
                },
                fontSize = 15.sp,
                color = Color.Black,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Progress Bar
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(12.dp)
                    .clip(RoundedCornerShape(6.dp)),
                color = DealoraPrimary,
                trackColor = Color(0xFFE8E8FF),
            )
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
fun SyncedAppIcon(
    app: SyncApp,
    isSynced: Boolean
) {
    Box(
        modifier = Modifier.size(56.dp),
        contentAlignment = Alignment.Center
    ) {
        // App Icon Background
        Box(
            modifier = Modifier
                .size(56.dp)
                .background(Color.White, CircleShape)
                .border(1.dp, Color(0xFFE0E0E0), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(id = app.iconRes),
                contentDescription = app.name,
                modifier = Modifier.size(36.dp)
            )
        }

        // Green Checkmark Overlay
        if (isSynced) {
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .align(Alignment.TopEnd)
                    .background(Color(0xFF00C853), CircleShape)
                    .border(2.dp, Color.White, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Synced",
                    tint = Color.White,
                    modifier = Modifier.size(12.dp)
                )
            }
        }
    }
}

@Composable
fun AnimatedSyncingApp(
    app: SyncApp,
    key: Int
) {
    // Pulsing animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val scale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = androidx.compose.animation.core.RepeatMode.Reverse
        ),
        label = "scale"
    )

    AnimatedVisibility(
        visible = true,
        enter = fadeIn() + scaleIn(),
        exit = fadeOut() + scaleOut()
    ) {
        Box(
            modifier = Modifier.size(240.dp),
            contentAlignment = Alignment.Center
        ) {
            // Outer glow circle
            Box(
                modifier = Modifier
                    .size(240.dp)
                    .scale(scale)
                    .background(
                        color = Color(0xFFE8E8FF),
                        shape = CircleShape
                    )
            )

            // Middle circle
            Box(
                modifier = Modifier
                    .size(180.dp)
                    .background(
                        color = Color(0xFFD0D0FF),
                        shape = CircleShape
                    )
            )

            // Inner circle with app icon
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .background(
                        color = Color.White,
                        shape = CircleShape
                    )
                    .border(2.dp, Color(0xFFE0E0E0), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = app.iconRes),
                    contentDescription = app.name,
                    modifier = Modifier.size(80.dp)
                )
            }
        }
    }
}

//@Preview(showBackground = true, showSystemUi = true)
//@Composable
//fun SyncingProgressScreenPreview() {
//    val sampleApps = listOf(
//        SyncApp("zomato", "Zomato", R.drawable.ic_zomato),
//        SyncApp("phonepe", "Phone Pay", R.drawable.ic_phonepe),
//        SyncApp("amazon", "Amazon", R.drawable.ic_amazon),
//        SyncApp("nykaa", "Nykaa", R.drawable.ic_nykaa),
//        SyncApp("cred", "CRED", R.drawable.ic_cred)
//    )
//    SyncingProgressScreen(selectedApps = sampleApps)
//}