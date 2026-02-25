package com.ayaan.dealora.ui.presentation.syncapps.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.data.api.models.GmailExtractedCoupon
import com.ayaan.dealora.data.api.models.LinkedEmail
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.GmailSyncState
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.GmailSyncViewModel
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.LinkEmailState
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.LinkEmailViewModel
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.common.api.ApiException

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GmailSyncScreen(
    navController: NavController,
    viewModel: GmailSyncViewModel = hiltViewModel(),
    linkEmailViewModel: LinkEmailViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsState()
    val isSignedIn by viewModel.isSignedIn.collectAsState()
    val linkedEmails by viewModel.linkedEmails.collectAsState()
    val selectedEmail by viewModel.selectedEmail.collectAsState()
    val isLoadingEmails by viewModel.isLoadingEmails.collectAsState()
    val linkEmailState by linkEmailViewModel.state.collectAsState()

    // When a new Gmail is successfully linked → refresh the dropdown automatically
    LaunchedEffect(linkEmailState) {
        if (linkEmailState is LinkEmailState.Success) {
            viewModel.loadLinkedEmails()
            linkEmailViewModel.resetState()
        }
    }

    // Launcher for the Gmail SCAN sign-in (GmailSyncViewModel)
    val signInLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            viewModel.handleSignInResult(account)
        } catch (e: ApiException) {
            android.util.Log.e("GmailSyncScreen", "Sign-in failed. Status code: ${e.statusCode}")
            viewModel.handleSignInResult(null, errorCode = e.statusCode)
        }
    }

    // Launcher for the LINK EMAIL sign-in (LinkEmailViewModel)
    // Separate launcher so serverAuthCode goes to the correct ViewModel
    val linkEmailLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            linkEmailViewModel.handleSignInResult(account)
        } catch (e: ApiException) {
            android.util.Log.e("GmailSyncScreen", "Link email sign-in failed: ${e.statusCode}")
            linkEmailViewModel.handleSignInResult(null)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Gmail Coupon Sync",
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )
                },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.Black
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        // Floating Add Button — bottom-right
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    // Sign out first so Google shows the account picker fresh
                    // (instead of silently reusing the last account)
                    linkEmailViewModel.googleSignInClient.signOut().addOnCompleteListener {
                        linkEmailLauncher.launch(linkEmailViewModel.googleSignInClient.signInIntent)
                    }
                },
                shape = RoundedCornerShape(16.dp),
                containerColor = DealoraPrimary,
                contentColor = Color.White,
                elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp)
            ) {
                // Show spinner while linking is in progress, otherwise show +
                if (linkEmailState is LinkEmailState.Linking) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        strokeWidth = 2.5.dp,
                        color = Color.White
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Add Email Account",
                        modifier = Modifier.size(26.dp)
                    )
                }
            }
        },
        containerColor = Color.White
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {

            Spacer(modifier = Modifier.height(20.dp))

            // ── Email Account Dropdown ─────────────────────────────────────
            EmailDropdown(
                linkedEmails = linkedEmails,
                selectedEmail = selectedEmail,
                isLoading = isLoadingEmails,
                onEmailSelected = { viewModel.selectEmail(it) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // ── Coupon Area (shows placeholder or sync UI) ─────────────────
            if (selectedEmail == null) {
                // Nothing selected yet → placeholder box
                NoEmailSelectedBox()
            } else {
                // Email selected → show the normal state-driven sync content
                SyncContent(
                    state = state,
                    isSignedIn = isSignedIn,
                    onConnectGmail = {
                        signInLauncher.launch(viewModel.googleSignInClient.signInIntent)
                    },
                    onScanAgain = { viewModel.syncWithExistingAccount() },
                    onSignOut = { viewModel.signOut() },
                    onRetry = { viewModel.resetState() }
                )
            }
        }
    }
}

// ── Email Dropdown ────────────────────────────────────────────────────────────

@Composable
private fun EmailDropdown(
    linkedEmails: List<LinkedEmail>,
    selectedEmail: String?,
    isLoading: Boolean,
    onEmailSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxWidth()) {
        // Trigger row
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .border(
                    width = 1.5.dp,
                    color = if (selectedEmail != null) DealoraPrimary else Color(0xFFDDDDDD),
                    shape = RoundedCornerShape(12.dp)
                )
                .background(Color(0xFFFAFAFA))
                .clickable(enabled = !isLoading && linkedEmails.isNotEmpty()) {
                    expanded = true
                }
                .padding(horizontal = 16.dp, vertical = 14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Email,
                    contentDescription = null,
                    tint = if (selectedEmail != null) DealoraPrimary else Color(0xFFAAAAAA),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))

                when {
                    isLoading -> {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = DealoraPrimary
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Loading accounts…",
                                fontSize = 14.sp,
                                color = Color(0xFFAAAAAA)
                            )
                        }
                    }
                    linkedEmails.isEmpty() -> {
                        Text(
                            text = "No linked accounts — tap + to add one",
                            fontSize = 14.sp,
                            color = Color(0xFFAAAAAA),
                            modifier = Modifier.weight(1f)
                        )
                    }
                    else -> {
                        Text(
                            text = selectedEmail ?: "Select an email account",
                            fontSize = 14.sp,
                            color = if (selectedEmail != null) Color(0xFF1A1A1A) else Color(0xFF888888),
                            modifier = Modifier.weight(1f)
                        )
                        Icon(
                            imageVector = Icons.Default.ArrowDropDown,
                            contentDescription = null,
                            tint = Color(0xFF888888)
                        )
                    }
                }
            }
        }

        // Dropdown list
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier
                .fillMaxWidth(0.9f)
                .background(Color.White)
        ) {
            linkedEmails.forEach { entry ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(
                                text = entry.email,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium,
                                color = Color(0xFF1A1A1A)
                            )
                        }
                    },
                    onClick = {
                        onEmailSelected(entry.email)
                        expanded = false
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Email,
                            contentDescription = null,
                            tint = DealoraPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                )
            }
        }
    }
}

// ── No-email-selected placeholder ────────────────────────────────────────────

@Composable
private fun NoEmailSelectedBox() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 220.dp)
            .clip(RoundedCornerShape(16.dp))
            .border(
                width = 1.dp,
                color = Color(0xFFE8E8E8),
                shape = RoundedCornerShape(16.dp)
            )
            .background(Color(0xFFF9F9F9)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(32.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .background(Color(0xFFEEEEEE), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Email,
                    contentDescription = null,
                    tint = Color(0xFFBBBBBB),
                    modifier = Modifier.size(32.dp)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Please select an email to see the scanned coupons",
                fontSize = 14.sp,
                color = Color(0xFF999999),
                textAlign = TextAlign.Center,
                lineHeight = 22.sp
            )
        }
    }
}

// ── State-driven sync content (shown after email is selected) ─────────────────

@Composable
private fun SyncContent(
    state: GmailSyncState,
    isSignedIn: Boolean,
    onConnectGmail: () -> Unit,
    onScanAgain: () -> Unit,
    onSignOut: () -> Unit,
    onRetry: () -> Unit
) {
    when (val s = state) {

        is GmailSyncState.Idle -> {
            IdleContent(
                isSignedIn = isSignedIn,
                onConnectGmail = onConnectGmail,
                onScanAgain = onScanAgain,
                onSignOut = onSignOut
            )
        }

        is GmailSyncState.SigningIn,
        is GmailSyncState.Syncing -> {
            LoadingContent(
                message = if (state is GmailSyncState.SigningIn)
                    "Connecting to Gmail…"
                else
                    "Scanning your promo emails…"
            )
        }

        is GmailSyncState.Success -> {
            SuccessContent(
                extractedCount = s.extractedCount,
                skippedCount = s.skippedCount,
                coupons = s.coupons,
                onScanAgain = onRetry,
                onSignOut = onSignOut
            )
        }

        is GmailSyncState.Error -> {
            ErrorContent(
                message = s.message,
                onRetry = onRetry
            )
        }
    }
}

// ── Sub-composables ──────────────────────────────────────────────────────────

@Composable
private fun IdleContent(
    isSignedIn: Boolean,
    onConnectGmail: () -> Unit,
    onScanAgain: () -> Unit,
    onSignOut: () -> Unit
) {
    Spacer(modifier = Modifier.height(8.dp))

    if (!isSignedIn) {
        Button(
            onClick = onConnectGmail,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEA4335)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Email,
                contentDescription = null,
                tint = Color.White
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "Connect Gmail",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }
    } else {
        Button(
            onClick = onScanAgain,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(containerColor = DealoraPrimary),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = "Scan for Coupons",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(text = "Disconnect Gmail", color = Color.Gray)
        }
    }

    Spacer(modifier = Modifier.height(24.dp))

    // Privacy note
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF5F5F5)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "🔒  Privacy & Safety",
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = Color.Black
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = "• Only promotional emails are scanned\n• No emails are stored on our servers\n• Access can be revoked at any time\n• We read only — never send or modify",
                fontSize = 13.sp,
                color = Color.Gray,
                lineHeight = 20.sp
            )
        }
    }
}

@Composable
private fun LoadingContent(message: String) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        CircularProgressIndicator(color = DealoraPrimary, modifier = Modifier.size(52.dp))
        Spacer(modifier = Modifier.height(20.dp))
        Text(text = message, fontSize = 15.sp, color = Color.Gray)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "This may take up to 30 seconds",
            fontSize = 12.sp,
            color = Color(0xFFBBBBBB)
        )
    }
}

@Composable
private fun SuccessContent(
    extractedCount: Int,
    skippedCount: Int,
    coupons: List<GmailExtractedCoupon>,
    onScanAgain: () -> Unit,
    onSignOut: () -> Unit
) {
    // Stats row
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        StatCard(
            modifier = Modifier.weight(1f),
            label = "Extracted",
            value = extractedCount.toString(),
            color = Color(0xFF2E7D32)
        )
        StatCard(
            modifier = Modifier.weight(1f),
            label = "Skipped",
            value = skippedCount.toString(),
            color = Color(0xFF757575)
        )
    }

    Spacer(modifier = Modifier.height(20.dp))

    AnimatedVisibility(visible = coupons.isEmpty(), enter = fadeIn(), exit = fadeOut()) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                tint = DealoraPrimary,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "No new coupons found in your last 7 days of promotional emails.",
                fontSize = 14.sp,
                color = Color.Gray,
                textAlign = TextAlign.Center,
                lineHeight = 20.sp
            )
        }
    }

    if (coupons.isNotEmpty()) {
        Text(
            text = "Coupons Added to Your List",
            fontWeight = FontWeight.SemiBold,
            fontSize = 15.sp,
            color = Color.Black,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(10.dp))
        LazyColumn(
            modifier = Modifier.heightIn(max = 320.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(coupons) { coupon ->
                ExtractedCouponCard(coupon = coupon)
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
    } else {
        Spacer(modifier = Modifier.height(8.dp))
    }

    Button(
        onClick = onScanAgain,
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp),
        colors = ButtonDefaults.buttonColors(containerColor = DealoraPrimary),
        shape = RoundedCornerShape(12.dp)
    ) {
        Text("Scan Again", fontWeight = FontWeight.SemiBold)
    }

    Spacer(modifier = Modifier.height(8.dp))

    OutlinedButton(
        onClick = onSignOut,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Text("Disconnect Gmail", color = Color.Gray)
    }

    Spacer(modifier = Modifier.height(16.dp))
}

@Composable
private fun ErrorContent(message: String, onRetry: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(
            imageVector = Icons.Default.Warning,
            contentDescription = null,
            tint = Color(0xFFEA4335),
            modifier = Modifier.size(52.dp)
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Something went wrong",
            fontWeight = FontWeight.SemiBold,
            fontSize = 16.sp,
            color = Color.Black
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = message,
            fontSize = 13.sp,
            color = Color.Gray,
            textAlign = TextAlign.Center,
            lineHeight = 18.sp
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(containerColor = DealoraPrimary),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
        ) {
            Text("Try Again", fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun StatCard(
    modifier: Modifier,
    label: String,
    value: String,
    color: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F8F8)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = value, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = color)
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = label, fontSize = 12.sp, color = Color.Gray)
        }
    }
}

@Composable
private fun ExtractedCouponCard(coupon: GmailExtractedCoupon) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Text(
                    text = coupon.brandName ?: "Unknown Brand",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = Color.Black,
                    modifier = Modifier.weight(1f)
                )
                if (coupon.discountValue != null) {
                    val discountText = if (coupon.discountType == "percentage")
                        "${coupon.discountValue.toInt()}% OFF"
                    else
                        "₹${coupon.discountValue.toInt()} OFF"
                    Box(
                        modifier = Modifier
                            .background(DealoraPrimary.copy(alpha = 0.1f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = discountText,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = DealoraPrimary
                        )
                    }
                }
            }

            if (!coupon.couponCode.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .background(Color(0xFFF0F0F0), RoundedCornerShape(6.dp))
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                ) {
                    Text(
                        text = coupon.couponCode,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        color = Color(0xFF333333),
                        letterSpacing = 1.sp
                    )
                }
            }

            if (!coupon.couponName.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = coupon.couponName, fontSize = 12.sp, color = Color.Gray)
            }
        }
    }
}
