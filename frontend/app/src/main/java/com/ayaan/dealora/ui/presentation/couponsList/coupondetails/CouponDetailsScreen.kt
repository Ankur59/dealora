package com.ayaan.dealora.ui.presentation.couponsList.coupondetails

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.data.api.models.CouponDetail
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components.BottomActionButtons
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components.Chip
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components.CouponCodeCard
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components.DetailsContent
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components.HowToRedeemContent
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components.OfferTitle
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components.TabRow
import com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components.TermsAndConditionsContent
import com.ayaan.dealora.ui.presentation.profile.components.TopBar
import com.ayaan.dealora.ui.theme.AppColors

@Composable
fun CouponDetailsScreen(
    navController: NavController, viewModel: CouponDetailsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val isPrivateMode by viewModel.isPrivateMode.collectAsState()

    when (val state = uiState) {
        is CouponDetailsUiState.Loading -> {
            LoadingContent(navController)
        }

        is CouponDetailsUiState.Error -> {
            ErrorContent(
                navController = navController,
                message = state.message,
                onRetry = { viewModel.retry() })
        }

        is CouponDetailsUiState.Success -> {
            CouponDetailsContent(
                navController = navController,
                coupon = state.coupon,
                isPrivateMode = isPrivateMode,
                viewModel = viewModel
            )
        }
    }
}

@Composable
fun LoadingContent(navController: NavController) {
    Scaffold(
        topBar = {
            TopBar(navController = navController, title = "Details")
        }, containerColor = AppColors.Background
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                CircularProgressIndicator()
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Loading coupon details...",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText
                )
            }
        }
    }
}

@Composable
fun ErrorContent(
    navController: NavController, message: String, onRetry: () -> Unit
) {
    Scaffold(
        topBar = {
            TopBar(navController = navController, title = "Details")
        }, containerColor = AppColors.Background
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.padding(24.dp)
            ) {
                Text(
                    text = "😕", fontSize = 48.sp
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = message,
                    fontSize = 16.sp,
                    textAlign = TextAlign.Center,
                    color = AppColors.SecondaryText
                )
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = onRetry, colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF5B4CFF)
                    )
                ) {
                    Text("Try Again")
                }
            }
        }
    }
}

@Composable
fun CouponDetailsContent(
    navController: NavController,
    coupon: CouponDetail,
    isPrivateMode: Boolean = false,
    viewModel: CouponDetailsViewModel? = null
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Details", "How to redeem", "Terms & conditions")
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current

    // State for redeem dialog
    var showRedeemDialog by remember { mutableStateOf(false) }
    var showRedeemSuccess by remember { mutableStateOf(false) }
    var redeemError by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopBar(
                navController = navController, title = "Details"
            )
        },
        containerColor = AppColors.Background,
        bottomBar = {
            // Only show bottom action buttons when in private mode
            if (isPrivateMode) {
                BottomActionButtons(
                    couponLink = coupon.couponVisitingLink?.toString(),
                    onRedeemed = {
                        // Show confirmation dialog
                        showRedeemDialog = true
                    },
                    onDiscoverClick = {
                        try {
                            val intent = Intent().apply {
                                action = "com.ayaan.couponviewer.SHOW_COUPON"

                                // Add coupon data as extras
                                putExtra("EXTRA_COUPON_CODE", coupon.couponCode.toString())
                                putExtra("EXTRA_COUPON_TITLE", coupon.couponTitle?.toString() ?: "Special Offer")
                                putExtra("EXTRA_DESCRIPTION", coupon.description?.toString())
                                putExtra("EXTRA_BRAND_NAME", coupon.brandName?.toString() ?: "Brand")
                                putExtra("EXTRA_CATEGORY", coupon.categoryLabel?.toString())
                                putExtra("EXTRA_EXPIRY_DATE", coupon.display?.daysUntilExpiry?.toString())
                                putExtra("EXTRA_MINIMUM_ORDER", coupon.minimumOrder?.toString())
                                putExtra("EXTRA_DISCOUNT_VALUE", coupon.discountValue?.toString())
                                putExtra("EXTRA_DISCOUNT_TYPE", coupon.discountType?.toString())
                                putExtra("EXTRA_TERMS", coupon.terms?.toString())
                                putExtra("EXTRA_COUPON_LINK", coupon.couponVisitingLink?.toString())
                                putExtra("EXTRA_SOURCE_PACKAGE", context.packageName)

                                setPackage("com.ayaan.couponviewer")
                                addCategory(Intent.CATEGORY_DEFAULT)
                            }

                            Log.d("CouponDetailsScreen", "Launching CouponViewer with intent: $intent")
                            context.startActivity(intent)
                        } catch (e: Exception) {
                            Log.e("CouponDetailsScreen", "Failed to open CouponViewer app: ${e.message}", e)

                            // Fallback to Play Store
                            try {
                                val playStoreIntent = Intent(Intent.ACTION_VIEW).apply {
                                    data = Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                    setPackage("com.android.vending")
                                }
                                context.startActivity(playStoreIntent)
                            } catch (e2: Exception) {
                                // Last resort - open in browser
                                val browserIntent = Intent(Intent.ACTION_VIEW).apply {
                                    data = Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                }
                                context.startActivity(browserIntent)
                            }
                        }
                    }
                )
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Brand Header
            item {
                BrandHeader(
                    brandName = coupon.brandName?.toString() ?: "Brand",
                    categoryLabel = coupon.categoryLabel?.toString(),
                    daysUntilExpiry = coupon.display?.daysUntilExpiry,
                    initial = coupon.display?.initial ?: coupon.brandName?.toString()?.firstOrNull()
                        ?.toString() ?: "?"
                )
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Offer Title
            item {
                OfferTitle(
                    title = coupon.couponTitle?.toString() ?: "Special Offer",
                    description = coupon.description?.toString()
                )
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Coupon Code Card
            item {
                CouponCodeCard(
                    couponCode = coupon.couponCode,
                    couponLink = coupon.couponVisitingLink,
                    onCopyCode = {
                        coupon.couponCode?.toString()?.takeIf { it.isNotBlank() }?.let {
                            clipboardManager.setText(AnnotatedString(it))
                        }
                    },
                    onCopyLink = {
                        coupon.couponVisitingLink?.toString()?.takeIf { it.isNotBlank() }?.let {
                            clipboardManager.setText(AnnotatedString(it))
                        }
                    })
            }

            item {
                Spacer(modifier = Modifier.height(24.dp))
            }

            // About Section with Tabs
            item {
                Text(
                    text = "About",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )
            }

            item {
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Tab Row
            item {
                TabRow(
                    selectedTab = selectedTab, tabs = tabs, onTabSelected = { selectedTab = it })
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Tab Content
            item {
                when (selectedTab) {
                    0 -> DetailsContent(coupon)
                    1 -> HowToRedeemContent(coupon)
                    2 -> TermsAndConditionsContent(coupon)
                }
            }

            item {
                Spacer(modifier = Modifier.height(100.dp))
            }
        }
    }

    // Redeem Confirmation Dialog
    if (showRedeemDialog) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showRedeemDialog = false },
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
                    onClick = {
                        showRedeemDialog = false
                        viewModel?.redeemCoupon(
                            onSuccess = {
                                showRedeemSuccess = true
                            },
                            onError = { error ->
                                redeemError = error
                            }
                        )
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF5B3FD9)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "Yes, Mark Redeemed",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            },
            dismissButton = {
                TextButton(
                    onClick = { showRedeemDialog = false }
                ) {
                    Text(
                        text = "Cancel",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF666666)
                    )
                }
            }
        )
    }

    // Success Dialog
    if (showRedeemSuccess) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showRedeemSuccess = false },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text(
                    text = "Success!",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF00C853)
                )
            },
            text = {
                Text(
                    text = "Coupon has been marked as redeemed successfully.",
                    fontSize = 14.sp,
                    color = Color(0xFF666666)
                )
            },
            confirmButton = {
                Button(
                    onClick = { showRedeemSuccess = false },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF00C853)
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "OK",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        )
    }

    // Error Dialog
    redeemError?.let { error ->
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { redeemError = null },
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text(
                    text = "Error",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Red
                )
            },
            text = {
                Text(
                    text = error,
                    fontSize = 14.sp,
                    color = Color(0xFF666666)
                )
            },
            confirmButton = {
                Button(
                    onClick = { redeemError = null },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.Red
                    ),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "OK",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        )
    }
}

@Composable
fun BrandHeader(
    brandName: String, categoryLabel: String?, daysUntilExpiry: Int?, initial: String
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Brand Logo
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(Color(0xFF00BFA5)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = initial, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.White
            )
        }

        Column {
            Text(
                text = brandName,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )

            Spacer(modifier = Modifier.height(8.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                categoryLabel?.let {
                    Chip(text = it, backgroundColor = Color(0xFFE8DCFF))
                }
                daysUntilExpiry?.let {
                    val expiryText = when {
                        it == 0 -> "Expires today"
                        it == 1 -> "Expires in 1 day"
                        it < 0 -> "Expired"
                        else -> "Expires in $it days"
                    }
                    Chip(text = expiryText, backgroundColor = Color(0xFFE8DCFF))
                }
            }
        }
    }
}