package com.ayaan.dealora.ui.presentation.couponsList.coupondetails

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
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
    navController: NavController,
    viewModel: CouponDetailsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    when (val state = uiState) {
        is CouponDetailsUiState.Loading -> {
            LoadingContent(navController)
        }
        is CouponDetailsUiState.Error -> {
            ErrorContent(
                navController = navController,
                message = state.message,
                onRetry = { viewModel.retry() }
            )
        }
        is CouponDetailsUiState.Success -> {
            CouponDetailsContent(
                navController = navController,
                coupon = state.coupon
            )
        }
    }
}

@Composable
fun LoadingContent(navController: NavController) {
    Scaffold(
        topBar = {
            TopBar(navController = navController, title = "Details")
        },
        containerColor = AppColors.Background
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
    navController: NavController,
    message: String,
    onRetry: () -> Unit
) {
    Scaffold(
        topBar = {
            TopBar(navController = navController, title = "Details")
        },
        containerColor = AppColors.Background
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
                    text = "😕",
                    fontSize = 48.sp
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
                    onClick = onRetry,
                    colors = ButtonDefaults.buttonColors(
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
    coupon: CouponDetail
) {
    var selectedTab by remember { mutableStateOf(0) }
    val tabs = listOf("Details", "How to redeem", "Terms & conditions")
    val clipboardManager = LocalClipboardManager.current

    Scaffold(topBar = {
        TopBar(
            navController = navController, title = "Details"
        )
    }, containerColor = AppColors.Background, bottomBar = {
        BottomActionButtons(
            couponLink = coupon.couponVisitingLink?.toString(),
            onRedeemed = { /* Handle Redeemed */ }
        )
    }) { paddingValues ->
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
                    initial = coupon.display?.initial ?: coupon.brandName?.toString()?.firstOrNull()?.toString() ?: "?"
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
                    }
                )
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
}

@Composable
fun BrandHeader(
    brandName: String,
    categoryLabel: String?,
    daysUntilExpiry: Int?,
    initial: String
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
                text = initial,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
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