package com.ayaan.dealora.ui.presentation.home

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.basicMarquee
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.outlined.Search
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.common.components.CouponVerificationDialog
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import com.ayaan.dealora.ui.presentation.home.components.CategoryGrid
import com.ayaan.dealora.ui.presentation.home.components.ExclusiveBannerCard
import com.ayaan.dealora.ui.presentation.home.components.StatisticsCard
import com.ayaan.dealora.ui.presentation.home.components.ExploringCoupons
import com.ayaan.dealora.ui.presentation.home.components.MultiFleetFeedbackPopup
import com.ayaan.dealora.ui.presentation.home.components.MultiPartnerFeedbackPopup
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.presentation.navigation.navbar.AppTopBar
import com.ayaan.dealora.ui.presentation.navigation.navbar.DealoraBottomBar
import com.ayaan.dealora.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    navController: NavController, viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val savedCouponIds by viewModel.savedCouponIds.collectAsState()
    var isSearchExpanded by remember { mutableStateOf(false) }
    val searchQuery by viewModel.searchQuery.collectAsState()
    val context = LocalContext.current

    if (isSearchExpanded) {
        val listState = rememberLazyListState()
        var activeVerificationCoupon by remember { mutableStateOf<com.ayaan.dealora.data.api.models.PartnerCoupon?>(null) }
        val shouldLoadMore = remember {
            derivedStateOf {
                val lastVisibleItem = listState.layoutInfo.visibleItemsInfo.lastOrNull()
                lastVisibleItem != null && lastVisibleItem.index >= listState.layoutInfo.totalItemsCount - 5
            }
        }

        LaunchedEffect(shouldLoadMore.value) {
            if (shouldLoadMore.value) {
                viewModel.loadNextSearchPage()
            }
        }

        Scaffold(
            topBar = {
                // Custom Search Top Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White)
                        .padding(horizontal = 8.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = {
                        isSearchExpanded = false
                        viewModel.onSearchQueryChanged("")
                    }) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = Color.Black
                        )
                    }

                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { viewModel.onSearchQueryChanged(it) },
                        placeholder = { Text("Search Amazon, Nike, Myntra...", fontSize = 14.sp) },
                        leadingIcon = {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Search",
                                tint = Color.Gray
                            )
                        },
                        trailingIcon = {
                            if (searchQuery.isNotEmpty()) {
                                IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                    Icon(
                                        imageVector = Icons.Default.Close,
                                        contentDescription = "Clear",
                                        tint = Color.Gray
                                    )
                                }
                            }
                        },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = DealoraPrimary,
                            unfocusedBorderColor = Color.LightGray,
                            focusedContainerColor = Color(0xFFF5F5F5),
                            unfocusedContainerColor = Color(0xFFF5F5F5)
                        ),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .weight(1f)
                            .padding(end = 8.dp)
                    )
                }
            },
            containerColor = DealoraBackground,
            contentWindowInsets = WindowInsets(0)
        ) { paddingValues ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
            ) {
                when {
                    searchQuery.isEmpty() -> {
                        // Prompt view with trending search tags
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Search,
                                contentDescription = null,
                                modifier = Modifier.size(64.dp),
                                tint = Color.LightGray
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "Search Verified Coupons",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Black
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Search public partner coupons with high health scores.",
                                fontSize = 14.sp,
                                color = Color.Gray,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                            Text(
                                text = "Trending Brands:",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.Black
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                listOf("Myntra", "Nike", "Flipkart", "Amazon").forEach { brand ->
                                    Box(
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(100.dp))
                                            .background(Color.White)
                                            .border(1.dp, Color.LightGray, RoundedCornerShape(100.dp))
                                            .clickable {
                                                viewModel.onSearchQueryChanged(brand)
                                            }
                                            .padding(horizontal = 16.dp, vertical = 8.dp)
                                    ) {
                                        Text(
                                            text = brand,
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Medium,
                                            color = Color.DarkGray
                                        )
                                    }
                                }
                            }
                        }
                    }

                    uiState.isLoadingSearchCoupons && uiState.searchCoupons.isEmpty() -> {
                        CircularProgressIndicator(
                            modifier = Modifier.align(Alignment.Center),
                            color = DealoraPrimary
                        )
                    }

                    uiState.searchError != null && uiState.searchCoupons.isEmpty() -> {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = uiState.searchError ?: "An error occurred",
                                fontSize = 14.sp,
                                color = Color.Red,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = { viewModel.loadSearchCoupons(resetPage = true) },
                                colors = ButtonDefaults.buttonColors(containerColor = DealoraPrimary)
                            ) {
                                Text("Retry", color = Color.White)
                            }
                        }
                    }

                    uiState.searchCoupons.isEmpty() -> {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = "No verified coupons found for \"$searchQuery\"",
                                fontSize = 14.sp,
                                color = Color.Gray,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                        }
                    }

                    else -> {
                        LazyColumn(
                            state = listState,
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(bottom = 32.dp, top = 8.dp)
                        ) {
                            items(uiState.searchCoupons) { coupon ->
                                CouponCard(
                                    brandName = coupon.brandName,
                                    couponId = coupon.id,
                                    couponTitle = coupon.couponTitle ?: "Offer",
                                    description = coupon.description ?: "",
                                    couponCode = coupon.couponCode ?: "",
                                    discountValue = coupon.discount,
                                    category = coupon.category,
                                    expiryDays = coupon.daysUntilExpiry,
                                    isSaved = savedCouponIds.contains(coupon.id),
                                    isRedeemed = coupon.isRedeemed == true,
                                    merchantLogoUrl = coupon.merchantLogo,
                                    healthScore = coupon.healthScore,
                                    discoverButtonLabel = "Use Now",
                                    onDetailsClick = {
                                        val couponJson = viewModel.moshi
                                            .adapter(com.ayaan.dealora.data.api.models.PartnerCoupon::class.java)
                                            .toJson(coupon)
                                        navController.navigate(
                                            Route.CouponDetails.createRoute(
                                                couponId = coupon.id,
                                                isPrivate = false,
                                                couponCode = coupon.couponCode ?: "",
                                                couponData = Uri.encode(couponJson)
                                            )
                                        )
                                    },
                                    onDiscoverClick = {
                                        viewModel.trackPartnerDiscover(coupon.id)
                                        val url = coupon.couponLink?.trim()?.takeIf { it.isNotEmpty() }
                                        if (url != null) {
                                            try {
                                                val uri = Uri.parse(
                                                    if (url.startsWith("http://") || url.startsWith("https://"))
                                                        url else "https://$url"
                                                )
                                                context.startActivity(
                                                    Intent(Intent.ACTION_VIEW, uri).apply {
                                                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                                    }
                                                )
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "Invalid link", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    },
                                    onSave = { id -> viewModel.savePartnerCoupon(coupon) },
                                    onRemoveSave = { id -> viewModel.removeSavedCoupon(coupon.id) },
                                    onRedeem = { id ->
                                        activeVerificationCoupon = coupon
                                    }
                                )
                            }

                            if (uiState.isLoadingSearchCoupons) {
                                item {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator(
                                            modifier = Modifier.size(24.dp),
                                            color = DealoraPrimary,
                                            strokeWidth = 2.dp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        activeVerificationCoupon?.let { coupon ->
            CouponVerificationDialog(
                showDialog = true,
                couponBrand = coupon.brandName,
                couponCode = coupon.couponCode,
                onSuccess = {
                    val couponId = coupon.id
                    activeVerificationCoupon = null
                    viewModel.votePartnerCoupon(couponId, "success")
                    viewModel.redeemPartnerCoupon(
                        couponId = couponId,
                        onSuccess = {
                            Toast.makeText(context, "Coupon marked as redeemed!", Toast.LENGTH_SHORT).show()
                            viewModel.loadSearchCoupons(resetPage = true)
                        },
                        onError = { msg ->
                            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                        }
                    )
                },
                onFailure = {
                    val couponId = coupon.id
                    activeVerificationCoupon = null
                    viewModel.votePartnerCoupon(couponId, "failure")
                    viewModel.redeemPartnerCoupon(
                        couponId = couponId,
                        onSuccess = {
                            Toast.makeText(context, "Feedback recorded successfully!", Toast.LENGTH_SHORT).show()
                            viewModel.loadSearchCoupons(resetPage = true)
                        },
                        onError = { msg ->
                            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                        }
                    )
                },
                onDismiss = {
                    activeVerificationCoupon = null
                }
            )
        }
    } else {
        // Show fleet coupon feedback popup (scraped/exclusive coupons)
        if (uiState.pendingInteractions.isNotEmpty()) {
            MultiFleetFeedbackPopup(
                interactions = uiState.pendingInteractions,
                onResolve = { couponId, outcome ->
                    viewModel.resolveInteraction(couponId, outcome)
                },
                onDismissAll = {
                    viewModel.skipAllInteractions()
                }
            )
        }

        // Show partner coupon feedback popup (exclusive toggle / ai-coupon-engine coupons)
        if (uiState.pendingPartnerInteractions.isNotEmpty() && uiState.pendingInteractions.isEmpty()) {
            MultiPartnerFeedbackPopup(
                interactions = uiState.pendingPartnerInteractions,
                onResolve    = { couponId, outcome ->
                    viewModel.resolvePartnerInteraction(couponId, outcome)
                },
                onDismissAll = {
                    viewModel.skipAllPartnerInteractions()
                }
            )
        }
        
        val snackbarHostState = remember { SnackbarHostState() }

        LaunchedEffect(Unit){
            viewModel.fetchProfile()
            viewModel.fetchStatistics()
            viewModel.fetchExploreCoupons()
            viewModel.updateFcmToken()
        }
        Scaffold(
            topBar = {
                AppTopBar(navController)
            },
            contentWindowInsets = WindowInsets(0),
            containerColor = DealoraBackground,
            snackbarHost = {
                SnackbarHost(hostState = snackbarHostState)
            },
            floatingActionButton = {
                DealoraBottomBar(
                    navController = navController
                )
            },
            floatingActionButtonPosition = FabPosition.Center
        ) { innerPadding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
            ) {
                Spacer(modifier = Modifier.height(24.dp))

                // Welcome Text with dynamic user name
                when {
                    uiState.isLoading -> {
                        Row(
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Hey, ",
                                fontSize = 28.sp,
                                fontWeight = FontWeight.W400
                            )
                            CircularProgressIndicator(
                                modifier = Modifier.size(24.dp),
                                color = DealoraPrimary,
                                strokeWidth = 2.dp
                            )
                        }
                    }
                    uiState.errorMessage != null -> {
                        Column {
                            val errorText = buildAnnotatedString {
                                append("Hey, ")
                                withStyle(style = SpanStyle(color = DealoraPrimary, fontWeight = FontWeight.Bold)) {
                                    append("User")
                                }
                            }
                            Text(
                                text = errorText,
                                fontSize = 28.sp,
                                fontWeight = FontWeight.W400
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = uiState.errorMessage ?: "Error loading profile",
                                    fontSize = 12.sp,
                                    color = Color.Red,
                                    modifier = Modifier.weight(1f)
                                )
                                TextButton(
                                    onClick = { viewModel.retry() },
                                    modifier = Modifier.padding(start = 8.dp)
                                ) {
                                    Text(
                                        text = "Retry",
                                        fontSize = 12.sp,
                                        color = DealoraPrimary,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                    else -> {
                        val userName = if(uiState.user?.name!=null)(", "+uiState.user?.name ) else ("")
                        val welcomeText = buildAnnotatedString {
                            append("Hey")
                            withStyle(style = SpanStyle(color = DealoraPrimary, fontWeight = FontWeight.Bold)) {
                                append(userName)
                            }
                        }
                        Text(
                            text = welcomeText,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.W400
                        )
                    }
                }

                Text(
                    text = "Your smart savings dashboard is ready.",
                    fontSize = 14.sp,
                    color = DealoraTextGray,
                    modifier = Modifier.padding(top = 4.dp)
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Public Search Banner Card replacing StatisticsCard and ExclusiveBannerCard
                PublicSearchBannerCard(
                    onSearchClick = {
                        isSearchExpanded = true
                    }
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Explore Category
                Text(
                    text = "Explore Category",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Category Grid
                CategoryGrid(navController)
                Spacer(modifier = Modifier.height(24.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 2.dp, end = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Explore Coupons",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.Black
                    )
                    Text(
                        text = "See all",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.W600,
                        color = DealoraPrimary,
                        textDecoration = TextDecoration.Underline,
                        modifier = Modifier.clickable(onClick = {
                            navController.navigate(Route.ExploreCoupons.createRoute(sortBy = "expiring_soon"))
                        })
                    )
                }
                Spacer(modifier = Modifier.height(16.dp))
                ExploringCoupons(
                    navController = navController,
                    coupons = uiState.exploreCoupons,
                    isLoading = uiState.isLoadingCoupons,
                    savedCouponIds = savedCouponIds,
                    viewModel = viewModel
                )
                Spacer(modifier = Modifier.height(120.dp))
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PublicSearchBannerCard(
    onSearchClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onSearchClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF5B3FD9)),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxWidth()
        ) {
            // Main Content Area with padding
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Top white card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color.White.copy(alpha = 0.95f))
                        .padding(vertical = 18.dp, horizontal = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Public coupons that\nactually work.",
                        color = Color(0xFF1E144B),
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 28.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Find real, working discount codes from your favorite brands instantly. Every coupon is verified before it appears in search.",
                    color = Color.White.copy(alpha = 0.85f),
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    fontWeight = FontWeight.Normal
                )

                Spacer(modifier = Modifier.height(18.dp))

                // Search Input box lookalike
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .background(Color.White, RoundedCornerShape(8.dp))
                        .padding(start = 12.dp, end = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = Color.Gray,
                        modifier = Modifier.size(22.dp)
                    )
                    Text(
                        text = "Search Amazon, Nike, Myntra...",
                        color = Color.Gray,
                        fontSize = 14.sp,
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 8.dp)
                    )
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFFFBC02D))
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Search",
                            color = Color.Black,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // Dashed border pill
                Box(
                    modifier = Modifier
                        .drawBehind {
                            val stroke = Stroke(
                                width = 1.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f), 0f)
                            )
                            drawRoundRect(
                                color = Color.White.copy(alpha = 0.5f),
                                style = stroke,
                                cornerRadius = androidx.compose.ui.geometry.CornerRadius(100.dp.toPx())
                            )
                        }
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "Only Public • Verified Coupon • 98% Accurate",
                        color = Color.White.copy(alpha = 0.9f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))
            }

            // Scrolling yellow banner at bottom
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(38.dp)
                    .background(Color(0xFFFFF176)),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Myntra  ★  Nike  ★  Flipkart  ★  Amazon  ★  Myntra  ★  Nike  ★  Flipkart  ★  Amazon  ★  Myntra  ★  Nike  ★  Flipkart  ★  Amazon",
                    color = Color.Black,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .fillMaxWidth()
                        .basicMarquee(iterations = Int.MAX_VALUE)
                )
            }
        }
    }
}