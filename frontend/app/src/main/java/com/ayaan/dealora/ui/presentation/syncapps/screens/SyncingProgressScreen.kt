package com.ayaan.dealora.ui.presentation.syncapps.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
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
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.SyncingProgressViewModel
import com.ayaan.dealora.ui.theme.DealoraPrimary
import kotlinx.coroutines.delay

@Composable
fun SyncingProgressScreen(
    selectedApps: List<SyncApp> = emptyList(),
    navController: NavController,
    viewModel: SyncingProgressViewModel = hiltViewModel()
) {
    var currentAppIndex by remember { mutableIntStateOf(0) }
    var syncedApps by remember { mutableIntStateOf(0) }
    var showOtpDialog by remember { mutableStateOf(false) }
    var currentAppForOtp by remember { mutableStateOf<SyncApp?>(null) }
    var isWaitingForOtp by remember { mutableStateOf(false) }

    // Simulate syncing progress
    LaunchedEffect(selectedApps, isWaitingForOtp) {
        if (selectedApps.isNotEmpty() && !isWaitingForOtp) {
            if (currentAppIndex < selectedApps.size) {
                delay(2000) // 2 seconds per app
                // Show OTP dialog after sync timer
                currentAppForOtp = selectedApps[currentAppIndex]
                showOtpDialog = true
                isWaitingForOtp = true
            }
        }
    }

    // Navigate to home when all apps are synced
    LaunchedEffect(syncedApps, currentAppIndex, selectedApps.size) {
        if (currentAppIndex >= selectedApps.size && selectedApps.isNotEmpty()) {
            delay(500) // Small delay before navigation
            navController.navigate(Route.Home.path) {
                popUpTo(0) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    val progress = if (selectedApps.isEmpty()) 0f else syncedApps.toFloat() / selectedApps.size

    Box(modifier = Modifier.fillMaxSize()) {
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
                horizontalAlignment = Alignment.Start, modifier = Modifier.fillMaxWidth()
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
                            color = DealoraPrimary, shape = RoundedCornerShape(4.dp)
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
                            app = app, isSynced = index < syncedApps
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(48.dp))

            // Center - Current Syncing App
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(), contentAlignment = Alignment.Center
            ) {
                if (selectedApps.isNotEmpty() && currentAppIndex < selectedApps.size) {
                    AnimatedSyncingApp(
                        app = selectedApps[currentAppIndex], key = currentAppIndex
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
                        withStyle(
                            style = SpanStyle(
                                color = DealoraPrimary,
                                fontWeight = FontWeight.SemiBold
                            )
                        ) {
                            append("Wait")
                        }
                        append(" till Syncing gets done")
                    }, fontSize = 15.sp, color = Color.Black, textAlign = TextAlign.Center
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

        // OTP Dialog
        if (showOtpDialog && currentAppForOtp != null) {
            OtpDialog(
                app = currentAppForOtp!!,
                viewModel = viewModel,
                onOtpVerified = {
                    showOtpDialog = false
                    syncedApps++
                    currentAppIndex++
                    isWaitingForOtp = false
                    currentAppForOtp = null
                },
                onCancel = {
                    // Skip this app and proceed to next
                    showOtpDialog = false
                    currentAppIndex++
                    isWaitingForOtp = false
                    currentAppForOtp = null
                }
            )
        }
    }
}

@Composable
fun OtpDialog(
    app: SyncApp,
    viewModel: SyncingProgressViewModel,
    onOtpVerified: () -> Unit,
    onCancel: () -> Unit
) {
    var otpValue by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }
    var useDealoraPhone by remember { mutableStateOf(true) }
    var phoneNumber by remember { mutableStateOf("") }

    Dialog(onDismissRequest = { /* Cannot dismiss */ }) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Box(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // App Icon
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .background(Color(0xFFF5F5F5), CircleShape)
                            .padding(16.dp), contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(id = app.iconRes),
                            contentDescription = app.name,
                            modifier = Modifier.size(48.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Enter OTP for ${app.name}",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Enter the 6-digit OTP to verify and sync",
                        fontSize = 14.sp,
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(24.dp))

                    // Use Dealora Phone Checkbox
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { useDealoraPhone = !useDealoraPhone }
                            .padding(vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(24.dp)
                                .background(
                                    color = if (useDealoraPhone) DealoraPrimary else Color.White,
                                    shape = RoundedCornerShape(4.dp)
                                )
                                .border(
                                    width = 2.dp,
                                    color = if (useDealoraPhone) DealoraPrimary else Color.Gray,
                                    shape = RoundedCornerShape(4.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (useDealoraPhone) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Checked",
                                    tint = Color.White,
                                    modifier = Modifier.size(16.dp)
                                )
                            }
                        }

                        Text(
                            text = "Use my Dealora phone number",
                            fontSize = 14.sp,
                            color = Color.Black
                        )
                    }

                    // Phone Number Field (shown when checkbox is unchecked)
                    AnimatedVisibility(visible = !useDealoraPhone) {
                        Column {
                            Spacer(modifier = Modifier.height(12.dp))

                            BasicTextField(
                                value = phoneNumber,
                                onValueChange = { value ->
                                    if (value.all { it.isDigit() } && value.length <= 10) {
                                        phoneNumber = value
                                    }
                                },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                                decorationBox = { innerTextField ->
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(56.dp)
                                            .background(
                                                color = Color(0xFFF5F5F5),
                                                shape = RoundedCornerShape(8.dp)
                                            )
                                            .border(
                                                width = 1.dp,
                                                color = Color(0xFFE0E0E0),
                                                shape = RoundedCornerShape(8.dp)
                                            )
                                            .padding(horizontal = 16.dp),
                                        contentAlignment = Alignment.CenterStart
                                    ) {
                                        if (phoneNumber.isEmpty()) {
                                            Text(
                                                text = "Enter phone number",
                                                fontSize = 14.sp,
                                                color = Color.Gray
                                            )
                                        }
                                        innerTextField()
                                    }
                                }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // OTP Input Fields
                    OtpInputField(
                        otpValue = otpValue, onOtpChange = {
                            if (it.length <= 6) {
                                otpValue = it
                                isError = false
                            }
                        }, isError = isError
                    )

                    if (isError) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Invalid OTP. Please try again.",
                            fontSize = 12.sp,
                            color = Color.Red
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    // Verify Button
                    Button(
                        onClick = {
                            if (otpValue.length == 6) {
                                // Save synced app to database
                                viewModel.saveSyncedApp(app.id, app.name)
                                // Always accept the OTP (simulate successful verification)
                                onOtpVerified()
                            } else {
                                isError = true
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = DealoraPrimary
                        ),
                        shape = RoundedCornerShape(8.dp),
                        enabled = otpValue.length == 6 && (useDealoraPhone || phoneNumber.length == 10)
                    ) {
                        Text(
                            text = "Verify OTP", fontSize = 16.sp, fontWeight = FontWeight.SemiBold
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Cancel Button
                    Button(
                        onClick = {
                            onCancel()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.White
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(
                            text = "Skip this app",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = DealoraPrimary
                        )
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Info text
                    Text(
                        text = "Enter any 6-digit code",
                        fontSize = 12.sp,
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )
                }

                // Close button at top right
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(16.dp)
                        .size(32.dp)
                        .background(Color(0xFFF5F5F5), CircleShape)
                        .clickable { onCancel() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = Color.Gray,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }
        }
    }
}

@Composable
fun OtpInputField(
        otpValue: String, onOtpChange: (String) -> Unit, isError: Boolean
    ) {
        BasicTextField(value = otpValue, onValueChange = { value ->
            if (value.all { it.isDigit() }) {
                onOtpChange(value)
            }
        }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), decorationBox = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(6) { index ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(56.dp)
                            .background(
                                color = if (isError) Color(0xFFFFEBEE) else Color(0xFFF5F5F5),
                                shape = RoundedCornerShape(8.dp)
                            )
                            .border(
                                width = 1.dp, color = when {
                                    isError -> Color.Red
                                    index == otpValue.length -> DealoraPrimary
                                    index < otpValue.length -> DealoraPrimary.copy(alpha = 0.5f)
                                    else -> Color(0xFFE0E0E0)
                                }, shape = RoundedCornerShape(8.dp)
                            ), contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (index < otpValue.length) otpValue[index].toString() else "",
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isError) Color.Red else Color.Black
                        )
                    }
                }
            }
        })
}

@Composable
fun SyncedAppIcon(
        app: SyncApp, isSynced: Boolean
    ) {
        Box(
            modifier = Modifier.size(56.dp), contentAlignment = Alignment.Center
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
                        .border(2.dp, Color.White, CircleShape), contentAlignment = Alignment.Center
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
        app: SyncApp, key: Int
    ) {
        // Pulsing animation
        val infiniteTransition = rememberInfiniteTransition(label = "pulse")
        val scale by infiniteTransition.animateFloat(
            initialValue = 1f, targetValue = 1.1f, animationSpec = infiniteRepeatable(
                animation = tween(1000, easing = LinearEasing),
                repeatMode = RepeatMode.Reverse
            ), label = "scale"
        )

        AnimatedVisibility(
            visible = true, enter = fadeIn() + scaleIn(), exit = fadeOut() + scaleOut()
        ) {
            Box(
                modifier = Modifier.size(240.dp), contentAlignment = Alignment.Center
            ) {
                // Outer glow circle
                Box(
                    modifier = Modifier
                        .size(240.dp)
                        .scale(scale)
                        .background(
                            color = Color(0xFFE8E8FF), shape = CircleShape
                        )
                )

                // Middle circle
                Box(
                    modifier = Modifier
                        .size(180.dp)
                        .background(
                            color = Color(0xFFD0D0FF), shape = CircleShape
                        )
                )

                // Inner circle with app icon
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .background(
                            color = Color.White, shape = CircleShape
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
