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
    val tabs = listOf("Details", "How to redeem", "Terms & condition")
    val clipboardManager = LocalClipboardManager.current

    Scaffold(topBar = {
        TopBar(
            navController = navController, title = "Details"
        )
    }, containerColor = AppColors.Background, bottomBar = {
        BottomActionButtons(
            couponLink = coupon.couponVisitingLink,
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
                    brandName = coupon.brandName ?: "Brand",
                    categoryLabel = coupon.categoryLabel,
                    daysUntilExpiry = coupon.display?.daysUntilExpiry,
                    initial = coupon.display?.initial ?: coupon.brandName?.firstOrNull()?.toString() ?: "?"
                )
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Offer Title
            item {
                OfferTitle(
                    title = coupon.couponTitle ?: "Special Offer",
                    description = coupon.description
                )
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Coupon Code Card
            item {
                CouponCodeCard(
                    couponCode = coupon.couponCode,
                    onCopyCode = {
                        coupon.couponCode?.let {
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

@Composable
fun Chip(text: String, backgroundColor: Color) {
    Box(
        modifier = Modifier
            .background(backgroundColor, RoundedCornerShape(16.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(
            text = text, fontSize = 12.sp, color = Color(0xFF5B4CFF), fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun OfferTitle(title: String, description: String?) {
    Column {
        Text(
            text = title,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        description?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = it,
                fontSize = 14.sp,
                color = AppColors.SecondaryText,
                lineHeight = 20.sp
            )
        }
    }
}

@Composable
fun CouponCodeCard(couponCode: String?, onCopyCode: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onCopyCode),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFE8DCFF)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = couponCode ?: "No Code",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.PrimaryText,
                letterSpacing = 2.sp
            )

            Text(
                text = "📋 Copy Code",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF5B4CFF)
            )
        }
    }
}

@Composable
fun TabRow(
    selectedTab: Int, tabs: List<String>, onTabSelected: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        tabs.forEachIndexed { index, tab ->
            Button(
                onClick = { onTabSelected(index) }, colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedTab == index) Color(0xFF5B4CFF) else Color(
                        0xFFE0E0E0
                    ),
                    contentColor = if (selectedTab == index) Color.White else AppColors.SecondaryText
                ), shape = RoundedCornerShape(20.dp), modifier = Modifier.wrapContentWidth()
            ) {
                Text(
                    text = tab, fontSize = 13.sp, fontWeight = FontWeight.Normal
                )
            }
        }
    }
}

@Composable
fun DetailsContent(coupon: CouponDetail) {
    Column {
        Text(
            text = "Details",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(12.dp))

        coupon.display?.formattedExpiry?.let {
            BulletPoint("Expires on $it")
        }

        coupon.discountValue?.let { value ->
            // Handle both String and numeric values
            val valueStr = value.toString()
            val discountText = when (coupon.discountType?.lowercase()) {
                "flat" -> "Flat ₹$valueStr off"
                "percentage" -> "$valueStr% off"
                else -> valueStr
            }

            val minimumText = coupon.minimumOrder?.let { min ->
                " on minimum order of ₹${min}"
            } ?: ""

            BulletPoint(discountText + minimumText)
        }

        coupon.couponDetails?.let {
            BulletPoint(it)
        }

        when (coupon.useCouponVia?.lowercase()) {
            "both" -> BulletPoint("Valid on App and Website")
            "app" -> BulletPoint("Valid only on App")
            "website" -> BulletPoint("Valid only on Website")
        }
    }
}

@Composable
fun HowToRedeemContent(coupon: CouponDetail) {
    Column {
        Text(
            text = "How to redeem",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(12.dp))
        NumberedPoint(1, "Copy the coupon code${coupon.couponCode?.let { " ($it)" } ?: ""}.")
        NumberedPoint(2, "Go to ${coupon.brandName ?: "the partner"} ${if (coupon.useCouponVia?.lowercase() == "app") "app" else if (coupon.useCouponVia?.lowercase() == "website") "website" else "app/website"}.")
        NumberedPoint(3, "Add items to cart and apply the code at checkout.")
        NumberedPoint(4, "Complete payment to claim the offer.")
    }
}

@Composable
fun TermsAndConditionsContent(coupon: CouponDetail) {
    Column {
        Text(
            text = "Terms & conditions",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(12.dp))

        if (!coupon.terms.isNullOrBlank()) {
            BulletPoint(coupon.terms)
        } else {
            BulletPoint("Valid for a limited time only.")
            BulletPoint("One-time use per user.")
            BulletPoint("Cannot be combined with other offers.")
            coupon.minimumOrder?.let {
                BulletPoint("Minimum order value: ₹$it")
            }
            BulletPoint("Partner can modify or cancel the offer anytime.")
        }
    }
}

@Composable
fun BulletPoint(text: String) {
    Row(
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        Text(
            text = "• ", fontSize = 14.sp, color = AppColors.PrimaryText
        )
        Text(
            text = text, fontSize = 14.sp, color = AppColors.SecondaryText, lineHeight = 20.sp
        )
    }
}

@Composable
fun NumberedPoint(number: Int, text: String) {
    Row(
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        Text(
            text = "$number. ",
            fontSize = 14.sp,
            color = AppColors.PrimaryText,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = text, fontSize = 14.sp, color = AppColors.SecondaryText, lineHeight = 20.sp
        )
    }
}

@Composable
fun BottomActionButtons(
    couponLink: String?,
    onRedeemed: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(), color = AppColors.CardBackground, shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = onRedeemed,
                modifier = Modifier
                    .weight(1f)
                    .height(50.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = AppColors.PrimaryText
                )
            ) {
                Text(
                    text = "Redeemed", fontSize = 16.sp, fontWeight = FontWeight.Medium
                )
            }

            Button(
                onClick = {
                    // Open coupon link in browser or app
                    // This would typically use Android Intent to open the URL
                },
                modifier = Modifier
                    .weight(1f)
                    .height(50.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFF5B4CFF)
                ),
                enabled = !couponLink.isNullOrBlank()
            ) {
                Text(
                    text = "Discover",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White
                )
            }
        }
    }
}