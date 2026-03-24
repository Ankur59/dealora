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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.data.api.models.GmailExtractedCoupon
import com.ayaan.dealora.data.api.models.LinkedEmail
import com.ayaan.dealora.data.repository.RemoveEmailResult
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.GmailSyncState
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.GmailSyncViewModel
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.LinkEmailState
import com.ayaan.dealora.ui.presentation.syncapps.viewmodels.LinkEmailViewModel
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraStarYellow
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.common.api.ApiException

// Vibrant card gradient palettes — each email card picks one by index
private val cardGradients = listOf(
    listOf(Color(0xFF6C63FF), Color(0xFF4834D4)),   // Indigo / Purple
    listOf(Color(0xFF11998E), Color(0xFF38EF7D)),   // Teal / Mint
    listOf(Color(0xFFFC4A1A), Color(0xFFF7B733)),   // Orange / Amber
)

private fun gradientForIndex(index: Int): List<Color> =
    cardGradients[index % cardGradients.size]

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GmailSyncScreen(
    navController: NavController,
    viewModel: GmailSyncViewModel = hiltViewModel(),
    linkEmailViewModel: LinkEmailViewModel = hiltViewModel()
) {
    val linkedEmails by viewModel.linkedEmails.collectAsState()
    val perEmailState by viewModel.perEmailState.collectAsState()
    val isRemovingEmail by viewModel.isRemovingEmail.collectAsState()
    val isLoadingEmails by viewModel.isLoadingEmails.collectAsState()
    val linkEmailState by linkEmailViewModel.state.collectAsState()
    val termsAccepted by viewModel.termsAccepted.collectAsState()

    var showTermsDialog by remember { mutableStateOf(false) }

    val context = LocalContext.current

    // ── Toast when a remove-email call completes ──────────────────────────────
    LaunchedEffect(Unit) {
        viewModel.removeEmailEvent.collect { result ->
            when (result) {
                is RemoveEmailResult.Success ->
                    android.widget.Toast.makeText(
                        context,
                        "🗑️ ${result.email} disconnected successfully",
                        android.widget.Toast.LENGTH_LONG
                    ).show()
                is RemoveEmailResult.Error ->
                    android.widget.Toast.makeText(
                        context,
                        "❌ Could not disconnect account. Please try again.",
                        android.widget.Toast.LENGTH_LONG
                    ).show()
            }
        }
    }

    // ── Toast / reload for every link-email outcome ───────────────────────────
    LaunchedEffect(linkEmailState) {
        when (val s = linkEmailState) {
            is LinkEmailState.Success -> {
                android.widget.Toast.makeText(
                    context,
                    "✅ ${s.linkedEmail} linked! Scanning for coupons…",
                    android.widget.Toast.LENGTH_LONG
                ).show()
                viewModel.loadLinkedEmails()
                linkEmailViewModel.resetState()
                // Auto-scan on first link for a great first-run UX
                viewModel.syncForEmail(s.linkedEmail)
            }
            is LinkEmailState.Updated -> {
                android.widget.Toast.makeText(
                    context,
                    "🔄 ${s.linkedEmail} updated successfully!",
                    android.widget.Toast.LENGTH_LONG
                ).show()
                viewModel.loadLinkedEmails()
                linkEmailViewModel.resetState()
            }
            is LinkEmailState.Error -> {
                val msg = if (s.isLimitReached) {
                    "⚠️ Limit reached! You can only link up to 3 Gmail accounts."
                } else {
                    "❌ Could not link account. Please try again."
                }
                android.widget.Toast.makeText(context, msg, android.widget.Toast.LENGTH_LONG).show()
                linkEmailViewModel.resetState()
            }
            else -> Unit
        }
    }

    // ── Launcher for the LINK EMAIL sign-in (LinkEmailViewModel) ─────────────
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
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    if (!termsAccepted) {
                        // Show T&C dialog — user must accept before linking
                        showTermsDialog = true
                    } else {
                        // Terms already accepted — go straight to sign-in
                        linkEmailViewModel.googleSignInClient.signOut().addOnCompleteListener {
                            linkEmailLauncher.launch(linkEmailViewModel.googleSignInClient.signInIntent)
                        }
                    }
                },
                shape = RoundedCornerShape(16.dp),
                containerColor = DealoraPrimary,
                contentColor = Color.White,
                elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 6.dp)
            ) {
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
        containerColor = Color(0xFFF4F6FA)
    ) { paddingValues ->

        // ── Terms & Conditions dialog (shown before first link) ───────────────
        if (showTermsDialog) {
            TermsAcceptanceDialog(
                onDismiss = { showTermsDialog = false },
                onAccept = {
                    viewModel.acceptTerms(
                        onSuccess = {
                            showTermsDialog = false
                            // terms now accepted — launch sign-in
                            linkEmailViewModel.googleSignInClient.signOut().addOnCompleteListener {
                                linkEmailLauncher.launch(linkEmailViewModel.googleSignInClient.signInIntent)
                            }
                        },
                        onError = { msg ->
                            android.widget.Toast.makeText(
                                context,
                                "❌ $msg",
                                android.widget.Toast.LENGTH_LONG
                            ).show()
                        }
                    )
                }
            )
        }

        when {
            isLoadingEmails -> {
                // Full-screen loading while fetching emails for the first time
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        CircularProgressIndicator(color = DealoraPrimary)
                        Text(text = "Loading linked accounts…", fontSize = 14.sp, color = Color.Gray)
                    }
                }
            }

            linkedEmails.isEmpty() -> {
                // Empty state — no linked accounts yet
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(32.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .background(Color(0xFFEEEEEE), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Email,
                                contentDescription = null,
                                tint = Color(0xFFBBBBBB),
                                modifier = Modifier.size(40.dp)
                            )
                        }
                        Spacer(modifier = Modifier.height(20.dp))
                        Text(
                            text = "No Gmail Accounts Linked",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF1A1A1A)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Tap the + button to connect a Gmail account and start scanning for coupons.",
                            fontSize = 14.sp,
                            color = Color(0xFF888888),
                            textAlign = TextAlign.Center,
                            lineHeight = 22.sp
                        )
                    }
                }
            }

            else -> {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(
                        start = 20.dp, end = 20.dp, top = 20.dp, bottom = 96.dp
                    )
                ) {
                    items(linkedEmails, key = { it.email }) { linkedEmail ->
                        val cardIndex = linkedEmails.indexOf(linkedEmail)
                        val cardState = perEmailState[linkedEmail.email] ?: GmailSyncState.Idle

                        EmailSyncCard(
                            linkedEmail = linkedEmail,
                            cardIndex = cardIndex,
                            cardState = cardState,
                            navController = navController,
                            onCouponData = { coupon -> viewModel.couponDataJson(coupon) },
                            onScan = { viewModel.syncForEmail(linkedEmail.email) },
                            onDisconnect = { viewModel.removeLinkedEmail(linkedEmail.email) },
                            onRetry = { viewModel.resetStateForEmail(linkedEmail.email) },
                            onGoToDashboard = {
                                navController.navigate(Route.Dashboard.createRoute())
                            }
                        )
                    }
                }
            }
        }
    }

    // ── Full-screen loading overlay while disconnecting ─────────────────────────
    if (isRemovingEmail) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.Black.copy(alpha = 0.45f))
                .clickable(enabled = false) {},
            contentAlignment = Alignment.Center
        ) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 40.dp, vertical = 28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    CircularProgressIndicator(color = DealoraPrimary)
                    Text(text = "Disconnecting…", fontSize = 14.sp, color = Color.Gray)
                }
            }
        }
    }
}

// ── Email Sync Card ───────────────────────────────────────────────────────────

@Composable
private fun EmailSyncCard(
    linkedEmail: LinkedEmail,
    cardIndex: Int,
    cardState: GmailSyncState,
    navController: NavController,
    onCouponData: (com.ayaan.dealora.data.api.models.GmailExtractedCoupon) -> String?,
    onScan: () -> Unit,
    onDisconnect: () -> Unit,
    onRetry: () -> Unit,
    onGoToDashboard: () -> Unit
) {
    val gradientColors = gradientForIndex(cardIndex)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column {

            // ── Gradient Header ───────────────────────────────────────────────
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        brush = Brush.linearGradient(colors = gradientColors),
                        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
                    )
                    .padding(horizontal = 20.dp, vertical = 20.dp)
            ) {
                Column {
                    // Email icon + address
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(Color.White.copy(alpha = 0.25f), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Email,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Text(
                            text = linkedEmail.email,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    // Last synced row
                    if (linkedEmail.lastSynced != null) {
                        Spacer(modifier = Modifier.height(12.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Schedule,
                                contentDescription = null,
                                tint = Color.White.copy(alpha = 0.85f),
                                modifier = Modifier.size(14.dp)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Last synced: ${formatLastSynced(linkedEmail.lastSynced!!)} IST",
                                fontSize = 12.sp,
                                color = Color.White.copy(alpha = 0.85f)
                            )
                        }
                    }
                }
            }

            // ── Card Body ─────────────────────────────────────────────────────
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp)) {
                when (cardState) {

                    is GmailSyncState.Idle -> {
                        CardActionButtons(
                            onScan = onScan,
                            onDisconnect = onDisconnect,
                            onGoToDashboard = onGoToDashboard,
                            gradientColors = gradientColors
                        )
                    }

                    is GmailSyncState.SigningIn,
                    is GmailSyncState.Syncing -> {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 24.dp)
                        ) {
                            CircularProgressIndicator(
                                color = gradientColors[0],
                                modifier = Modifier.size(44.dp)
                            )
                            Spacer(modifier = Modifier.height(14.dp))
                            Text(
                                text = "Scanning your promo emails…",
                                fontSize = 14.sp,
                                color = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "This may take up to 3 minutes",
                                fontSize = 12.sp,
                                color = Color(0xFFBBBBBB)
                            )
                        }
                    }

                    is GmailSyncState.Success -> {
                        // Stats row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            MiniStatCard(
                                modifier = Modifier.weight(1f),
                                label = "Extracted",
                                value = cardState.extractedCount.toString(),
                                color = Color(0xFF2E7D32)
                            )
                            MiniStatCard(
                                modifier = Modifier.weight(1f),
                                label = "Skipped",
                                value = cardState.skippedCount.toString(),
                                color = Color(0xFF757575)
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        // Coupon list or empty message
                        if (cardState.coupons.isEmpty()) {
                            AnimatedVisibility(visible = true, enter = fadeIn(), exit = fadeOut()) {
                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 12.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CheckCircle,
                                        contentDescription = null,
                                        tint = gradientColors[0],
                                        modifier = Modifier.size(36.dp)
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text(
                                        text = "No new coupons found in your last 7 days of promotional emails.",
                                        fontSize = 13.sp,
                                        color = Color.Gray,
                                        textAlign = TextAlign.Center,
                                        lineHeight = 20.sp
                                    )
                                }
                            }
                        } else {
                            Text(
                                text = "Coupons Added to Your List",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp,
                                color = Color(0xFF1A1A1A)
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            // Scrollable coupon list inside card (constrained height)
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                cardState.coupons.forEach { coupon ->
                                    ExtractedCouponCard(
                                        coupon = coupon,
                                        accentColor = gradientColors[0],
                                        onDetails = {
                                            val json = onCouponData(coupon)
                                            navController.navigate(
                                                Route.CouponDetails.createRoute(
                                                    couponId = coupon.id ?: return@ExtractedCouponCard,
                                                    isPrivate = true,
                                                    couponCode = coupon.couponCode,
                                                    couponData = android.net.Uri.encode(json)
                                                )
                                            )
                                        }
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        // Action buttons after success
                        CardActionButtons(
                            onScan = onScan,
                            onDisconnect = onDisconnect,
                            onGoToDashboard = onGoToDashboard,
                            gradientColors = gradientColors,
                            scanLabel = "Scan Again"
                        )
                    }

                    is GmailSyncState.Error -> {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 16.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                tint = Color(0xFFEA4335),
                                modifier = Modifier.size(40.dp)
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Something went wrong",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 15.sp,
                                color = Color.Black
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = cardState.message,
                                fontSize = 12.sp,
                                color = Color.Gray,
                                textAlign = TextAlign.Center,
                                lineHeight = 18.sp
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = onRetry,
                                colors = ButtonDefaults.buttonColors(containerColor = gradientColors[0]),
                                shape = RoundedCornerShape(10.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(46.dp)
                            ) {
                                Text("Try Again", fontWeight = FontWeight.SemiBold, color = Color.White)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Shared 3-button action row ────────────────────────────────────────────────

@Composable
private fun CardActionButtons(
    onScan: () -> Unit,
    onDisconnect: () -> Unit,
    onGoToDashboard: () -> Unit,
    gradientColors: List<Color>,
    scanLabel: String = "Scan for Coupons"
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {

        // Scan button — filled with card gradient
        Button(
            onClick = onScan,
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
            shape = RoundedCornerShape(12.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        brush = Brush.linearGradient(colors = gradientColors),
                        shape = RoundedCornerShape(12.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = scanLabel,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }
        }

        // Dashboard + Disconnect side by side
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            OutlinedButton(
                onClick = onGoToDashboard,
                modifier = Modifier
                    .weight(1f)
                    .height(46.dp),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.5.dp, gradientColors[0])
            ) {
                Icon(
                    imageVector = Icons.Default.Dashboard,
                    contentDescription = null,
                    tint = gradientColors[0],
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = "Dashboard",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = gradientColors[0]
                )
            }

            OutlinedButton(
                onClick = onDisconnect,
                modifier = Modifier
                    .weight(1f)
                    .height(46.dp),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFFCCCCCC))
            ) {
                Text(
                    text = "Disconnect",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF999999)
                )
            }
        }
    }
}

// ── Mini stat card inside email card ─────────────────────────────────────────

@Composable
private fun MiniStatCard(
    modifier: Modifier,
    label: String,
    value: String,
    color: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF8F8F8)),
        shape = RoundedCornerShape(10.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(text = value, fontSize = 26.sp, fontWeight = FontWeight.Bold, color = color)
            Spacer(modifier = Modifier.height(2.dp))
            Text(text = label, fontSize = 11.sp, color = Color.Gray)
        }
    }
}

// ── Extracted coupon mini card ────────────────────────────────────────────────

@Composable
private fun ExtractedCouponCard(
    coupon: GmailExtractedCoupon,
    accentColor: Color,
    onDetails: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (coupon.id != null) Modifier.clickable { onDetails() } else Modifier
            ),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = CardDefaults.outlinedCardBorder()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left accent stripe
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(48.dp)
                    .background(accentColor, RoundedCornerShape(4.dp))
            )
            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = coupon.brandName ?: "Unknown Brand",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = Color(0xFF1A1A1A),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (!coupon.couponName.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = coupon.couponName,
                        fontSize = 12.sp,
                        color = Color.Gray,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Spacer(modifier = Modifier.width(10.dp))

            // Right side: code + discount badge + details arrow
            Column(horizontalAlignment = Alignment.End) {
                if (!coupon.couponCode.isNullOrBlank()) {
                    Box(
                        modifier = Modifier
                            .background(Color(0xFFF0F0F0), RoundedCornerShape(6.dp))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = coupon.couponCode,
                            fontWeight = FontWeight.Bold,
                            fontSize = 12.sp,
                            color = Color(0xFF333333),
                            letterSpacing = 1.sp,
                            maxLines = 1

                        )
                    }
                }
                if (coupon.discountValue != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    val discountText = if (coupon.discountType == "percentage")
                        "${coupon.discountValue.toInt()}% OFF"
                    else
                        "₹${coupon.discountValue.toInt()} OFF"
                    Box(
                        modifier = Modifier
                            .background(accentColor.copy(alpha = 0.12f), RoundedCornerShape(6.dp))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = discountText,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = accentColor
                        )
                    }
                }
                // Details arrow — tapping anywhere on the card triggers navigation
                if (coupon.id != null) {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.End
                    ) {
                        Text(
                            text = "Details",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = accentColor
                        )
                        Spacer(modifier = Modifier.width(2.dp))
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                            contentDescription = "View details",
                            tint = accentColor,
                            modifier = Modifier.size(12.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Helper to format an ISO UTC date string and convert it to IST (UTC+5:30).
 */
private fun formatLastSynced(raw: String): String {
    return try {
        if (raw.contains("T")) {
            val dateTimePart = raw.trimEnd('Z').split("T")
            val dateParts = dateTimePart[0].split("-")
            val timeParts = dateTimePart[1].substring(0, 5).split(":")

            var hours = timeParts[0].toInt()
            var minutes = timeParts[1].toInt()
            val month = dateParts[1].toInt()
            var day = dateParts[2].toInt()

            minutes += 30
            hours += 5
            if (minutes >= 60) { minutes -= 60; hours++ }
            if (hours >= 24) { hours -= 24; day++ }

            val formattedDate = "%02d-%02d".format(month, day)
            val formattedTime = "%02d:%02d".format(hours, minutes)
            "$formattedDate, $formattedTime"
        } else {
            raw
        }
    } catch (e: Exception) {
        raw
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Terms & Conditions Dialog
// ─────────────────────────────────────────────────────────────────────────────

private val TERMS_TEXT = """
Email Access — Consent Dialog
Key Terms & Conditions
Mandatory disclosures for in-app consent dialog | Based on Privacy Policy v.1.0 | 1 Feb 2026

By tapping 'Allow Email Access', you grant Dealora read-only access to your Gmail account to find and save coupon codes on your behalf.

1. What Dealora Will Access

• Access type: Read Only — we can never send emails from your account
• Emails read: Only promotional/marketing emails from brands and retailers
• Permission used: Gmail read only (gmail.readonly) via OAuth 2.0
• Data extracted: Coupon code, merchant name, discount value, expiry date only
• Emails NOT read: Personal emails, banking OTPs, medical, government, or financial emails

2. What We Do — and What We Never Do

What We DO:
• Scan promotional emails for coupon codes
• Show discovered coupons on your Dealora dashboard
• Send expiry alerts for high value coupons
• Delete coupon data 7 days after expiry
• Delete all your data within 30 days if you disconnect

What We DON'T Do:
• Read personal emails or conversations
• Store your email password (we never see it)
• Send any email from your account
• Sell or share your data with advertisers
• Access emails received before you opted in

3. How Access Works (OAuth 2.0)

Dealora uses Google's secure OAuth 2.0 login — you will be taken to Google's official login page. Dealora never sees or stores your Gmail password. Access is granted through a revocable token only.

4. Your Rights — You Are Always in Control

✓ Revoke access anytime: Settings > Email Parsing > Disconnect Gmail
✓ Via Google: myaccount.google.com > Security > Third-party apps > Dealora > Remove Access
✓ Request deletion of all extracted data: privacy@dealora.in
✓ Disabling stops all scanning immediately; data deleted within 30 days
✓ Alternative: Forward coupon emails manually to coupons@dealora.app (no OAuth needed)

5. Data Retention — At a Glance

• Active coupon data: Until expiry + 7 days, then auto deleted
• Expired coupon data: Auto deleted 7 days after expiry date
• Consent & activity logs: 3 years (regulatory compliance)
• On access revocation: All coupon data deleted within 30 days
• On account deletion: All data deleted within 30 days

6. Security Commitments

✓ All data in transit protected with TLS 1.3 encryption
✓ All stored coupon data encrypted with AES 256
✓ Your OAuth token stored in a hardware security module (HSM) — never logged
✓ All data stored on AWS servers within India (ap-south-1)
✓ Security breach notification within 72 hours if your data is ever affected

7. Google API Compliance

Dealora's use of Gmail data strictly follows the Google API Services User Data Policy (Limited Use). We use your Gmail data only to power the coupon discovery feature — for no other purpose.

8. Age Restriction

This feature is only available to users aged 18 and above. If we discover a minor has activated email parsing, access is immediately revoked and all data deleted.

9. Governing Law

This feature is governed by the Information Technology Act 2000 and the Digital Personal Data Protection Act 2023 (India). You have full rights to access, correct, export, and delete your data under the DPDP Act.

10. Questions & Grievances

• General queries: privacy@dealora.in
• Data deletion requests: privacy@dealora.in with subject 'Data Deletion Request'
• Grievance Officer: grievance@dealora.in
• Response time: Acknowledgement within 24 hours, resolution within 30 days

This is a summary for consent purposes. The full Privacy Policy and Terms of Use are available at dealora.in/legal
""".trimIndent()

@Composable
fun TermsAcceptanceDialog(
    onDismiss: () -> Unit,
    onAccept: () -> Unit
) {
    var agreed by remember { mutableStateOf(false) }
    var isAccepting by remember { mutableStateOf(false) }
    val scrollState = rememberScrollState()

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(20.dp),
            color = Color.White,
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                // Header
                Text(
                    text = "Gmail Sync",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = DealoraPrimary
                )
                Text(
                    text = "Terms & Conditions",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF555555)
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Scrollable area: terms text + checkbox at the bottom
                // User must scroll to reach the checkbox before they can accept
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f, fill = false)
                        .heightIn(max = 420.dp)
                        .verticalScroll(scrollState)
                ) {
                    Text(
                        text = TERMS_TEXT,
                        fontSize = 12.sp,
                        lineHeight = 19.sp,
                        color = Color(0xFF333333)
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // Checkbox — intentionally at bottom of scroll so user must read first
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { agreed = !agreed }
                            .background(Color(0xFFF0F4FF), RoundedCornerShape(10.dp))
                            .padding(8.dp)
                    ) {
                        Checkbox(
                            checked = agreed,
                            onCheckedChange = { agreed = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = DealoraPrimary
                            )
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "I have read and agree to the Terms & Conditions",
                            fontSize = 13.sp,
                            color = Color(0xFF333333)
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                }

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = onDismiss,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("Cancel", color = Color(0xFF666666))
                    }

                    Button(
                        onClick = {
                            isAccepting = true
                            onAccept()
                        },
                        enabled = agreed && !isAccepting,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = DealoraPrimary,
                            disabledContainerColor = Color(0xFFBBBBBB)
                        )
                    ) {
                        if (isAccepting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = Color.White
                            )
                        } else {
                            Text("Continue", color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}
