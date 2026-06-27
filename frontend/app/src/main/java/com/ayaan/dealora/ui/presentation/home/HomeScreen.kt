package com.ayaan.dealora.ui.presentation.home

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.ImeAction
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
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
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
    val isSearchExpanded = uiState.isSearchExpanded
    val searchQuery by viewModel.searchQuery.collectAsState()
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current

    if (isSearchExpanded) {
        BackHandler {
            viewModel.setSearchExpanded(false)
            viewModel.onSearchQueryChanged("")
        }
        val listState = rememberLazyListState()
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
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.White)
                ) {
                    // Custom Search Top Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 8.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = {
                            viewModel.setSearchExpanded(false)
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
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = {
                                viewModel.forceSearch()
                            }),
                            leadingIcon = {
                                Icon(
                                    imageVector = Icons.Default.Search,
                                    contentDescription = "Search",
                                    tint = Color.Gray
                                )
                            },
                            trailingIcon = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    if (uiState.searchCategories.isNotEmpty()) {
                                        var expanded by remember { mutableStateOf(false) }
                                        Box(modifier = Modifier.wrapContentSize(Alignment.TopEnd)) {
                                            TextButton(
                                                onClick = { expanded = true },
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                                                modifier = Modifier.height(36.dp)
                                            ) {
                                                Text(
                                                    text = uiState.selectedSearchCategory ?: "All",
                                                    color = DealoraPrimary,
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            
                                            DropdownMenu(
                                                expanded = expanded,
                                                onDismissRequest = { expanded = false },
                                                modifier = Modifier.background(Color.White)
                                            ) {
                                                DropdownMenuItem(
                                                    text = { Text("All Categories") },
                                                    onClick = {
                                                        expanded = false
                                                        viewModel.onSearchCategoryChanged(null)
                                                    }
                                                )
                                                uiState.searchCategories.forEach { category ->
                                                    DropdownMenuItem(
                                                        text = { Text(category) },
                                                        onClick = {
                                                            expanded = false
                                                            viewModel.onSearchCategoryChanged(category)
                                                        }
                                                    )
                                                }
                                            }
                                        }
                                    }
                                    if (searchQuery.isNotEmpty()) {
                                        IconButton(onClick = { viewModel.onSearchQueryChanged("") }) {
                                            Icon(
                                                imageVector = Icons.Default.Close,
                                                contentDescription = "Clear",
                                                tint = Color.Gray
                                            )
                                        }
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

                    // Segmented chips: Coupon and Offer
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 16.dp, end = 16.dp, bottom = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        val currentMode = uiState.searchMode
                        listOf("Coupon", "Offer").forEach { mode ->
                            val isSelected = currentMode == mode
                            val backgroundColor by androidx.compose.animation.animateColorAsState(
                                targetValue = if (isSelected) DealoraPrimary else Color(0xFFF5F5F5),
                                label = "bg_color"
                            )
                            val textColor by androidx.compose.animation.animateColorAsState(
                                targetValue = if (isSelected) Color.White else Color.Gray,
                                label = "text_color"
                            )

                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(100.dp))
                                    .background(backgroundColor)
                                    .clickable {
                                        viewModel.onSearchModeChanged(mode)
                                    }
                                    .padding(vertical = 10.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = mode,
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = textColor
                                )
                            }
                        }
                    }

                    // Premium Hint/Caption Text below the chips
                    Text(
                        text = "Type 3 characters to auto-search, or press Enter key to force search",
                        color = Color.Gray,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 16.dp, end = 16.dp, bottom = 12.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
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
                                text = "Search public partner coupons.",
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

                    // Check if search query exists but is too short (< 3 characters)
                    searchQuery.isNotEmpty() && searchQuery.length < 3 && !uiState.isSearchForced -> {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(80.dp)
                                    .background(Color(0xFFF5F5F5), shape = CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Search,
                                    contentDescription = null,
                                    modifier = Modifier.size(44.dp),
                                    tint = Color.LightGray
                                )
                            }
                            Spacer(modifier = Modifier.height(24.dp))
                            Text(
                                text = "Keep Typing",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Black
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Enter at least ${3 - searchQuery.length} more character${if (3 - searchQuery.length > 1) "s" else ""}",
                                fontSize = 14.sp,
                                color = Color.Gray,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "\"$searchQuery\" (${searchQuery.length}/3)",
                                fontSize = 12.sp,
                                color = DealoraPrimary,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                fontWeight = FontWeight.SemiBold
                            )
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
                            Box(
                                modifier = Modifier
                                    .size(80.dp)
                                    .background(Color(0xFFF5F5F5), shape = CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Search,
                                    contentDescription = null,
                                    modifier = Modifier.size(44.dp),
                                    tint = Color.LightGray
                                )
                            }
                            Spacer(modifier = Modifier.height(24.dp))
                            Text(
                                text = "No Coupons Found",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Black
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Try a different search term",
                                fontSize = 14.sp,
                                color = Color.Gray,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                            Button(
                                onClick = { viewModel.loadSearchCoupons(resetPage = true) },
                                colors = ButtonDefaults.buttonColors(containerColor = DealoraPrimary),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .height(44.dp)
                                    .align(Alignment.CenterHorizontally)
                            ) {
                                Text("Try Again", color = Color.White, fontSize = 14.sp)
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
                            Box(
                                modifier = Modifier
                                    .size(80.dp)
                                    .background(Color(0xFFF5F5F5), shape = CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.Search,
                                    contentDescription = null,
                                    modifier = Modifier.size(44.dp),
                                    tint = Color.LightGray
                                )
                            }
                            Spacer(modifier = Modifier.height(24.dp))
                            Text(
                                text = "No Coupons Found",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.Black
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "We couldn't find any coupons for \"$searchQuery\"",
                                fontSize = 14.sp,
                                color = Color.Gray,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Try searching for popular brands like Nike, Myntra, or Flipkart",
                                fontSize = 12.sp,
                                color = Color(0xFFC0C0C0),
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
                                var showSuccessDialog by remember { mutableStateOf(false) }
                                var showFeedbackDialog by remember { mutableStateOf(false) }
                                var showErrorDialog by remember { mutableStateOf(false) }
                                var errorMessage by remember { mutableStateOf("") }

                                val isAlreadyRedeemed = coupon.isRedeemed == true

                                CouponCard(
                                    brandName = coupon.brandName.uppercase().replace(" ", "\n"),
                                    couponId = coupon.id,
                                    couponTitle = coupon.couponTitle ?: coupon.discount ?: "Partner Offer",
                                    description = coupon.description ?: "",
                                    couponCode = coupon.couponCode ?: "",
                                    discountValue = coupon.discount,
                                    category = coupon.category,
                                    expiryDays = coupon.daysUntilExpiry,
                                    isSaved = savedCouponIds.contains(coupon.id),
                                    isRedeemed = isAlreadyRedeemed,
                                    merchantLogoUrl = coupon.merchantLogo,
                                    source = coupon.couponLink,
                                    showActionButtons = true,
                                    discoverButtonLabel = "Use Now",
                                    isNewUser = coupon.isNewUser == true,
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
                                         val isOffer = coupon.offerType == "Offer"
                                         if (!isOffer) {
                                             coupon.couponCode?.let { code ->
                                                 if (code.isNotEmpty()) {
                                                     clipboardManager.setText(AnnotatedString(code))
                                                 }
                                             }
                                             viewModel.recordPartnerDiscover(coupon)
                                         }
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
                                         if (!isAlreadyRedeemed) {
                                             if (coupon.offerType == "Offer") {
                                                 viewModel.redeemPartnerCoupon(
                                                     couponId = coupon.id,
                                                     onSuccess = { showSuccessDialog = true },
                                                     onError = { err ->
                                                         errorMessage = err
                                                         showErrorDialog = true
                                                     }
                                                 )
                                             } else {
                                                 showFeedbackDialog = true
                                             }
                                         }
                                     }
                                )

                                RedeemResultDialogs(
                                    showSuccess = showSuccessDialog,
                                    showError = showErrorDialog,
                                    errorMessage = errorMessage,
                                    onSuccessDismiss = { showSuccessDialog = false },
                                    onErrorDismiss = { showErrorDialog = false }
                                )

                                if (showFeedbackDialog) {
                                    AlertDialog(
                                        onDismissRequest = { showFeedbackDialog = false },
                                        containerColor = Color.White,
                                        shape = RoundedCornerShape(16.dp),
                                        title = {
                                            Text(
                                                text = "Did this coupon work?",
                                                fontSize = 20.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = Color.Black
                                            )
                                        },
                                        text = {
                                            Column(
                                                modifier = Modifier.fillMaxWidth(),
                                                verticalArrangement = Arrangement.spacedBy(12.dp)
                                            ) {
                                                Text(
                                                    text = "Your feedback helps us keep the best deals for everyone!",
                                                    fontSize = 14.sp,
                                                    color = Color(0xFF666666),
                                                    lineHeight = 20.sp
                                                )

                                                Spacer(modifier = Modifier.height(8.dp))

                                                Button(
                                                    onClick = {
                                                        showFeedbackDialog = false
                                                        viewModel.votePartnerCoupon(coupon.id, "success")
                                                        viewModel.redeemPartnerCoupon(
                                                            couponId = coupon.id,
                                                            onSuccess = { showSuccessDialog = true },
                                                            onError = { err ->
                                                                errorMessage = err
                                                                showErrorDialog = true
                                                            }
                                                        )
                                                    },
                                                    colors = ButtonDefaults.buttonColors(
                                                        containerColor = Color(0xFF4CAF50)
                                                    ),
                                                    shape = RoundedCornerShape(8.dp),
                                                    modifier = Modifier.fillMaxWidth().height(48.dp)
                                                ) {
                                                    Text("Yes, it worked!", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                                                }

                                                OutlinedButton(
                                                    onClick = {
                                                        showFeedbackDialog = false
                                                        viewModel.votePartnerCoupon(coupon.id, "failure")
                                                        viewModel.redeemPartnerCoupon(
                                                            couponId = coupon.id,
                                                            onSuccess = { showSuccessDialog = true },
                                                            onError = { err ->
                                                                errorMessage = err
                                                                showErrorDialog = true
                                                            }
                                                        )
                                                    },
                                                    colors = ButtonDefaults.outlinedButtonColors(
                                                        contentColor = Color(0xFFE53935)
                                                    ),
                                                    border = BorderStroke(1.dp, Color(0xFFE53935)),
                                                    shape = RoundedCornerShape(8.dp),
                                                    modifier = Modifier.fillMaxWidth().height(48.dp)
                                                ) {
                                                    Text("No, it didn't work", fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                                                }

                                                TextButton(
                                                    onClick = { showFeedbackDialog = false },
                                                    modifier = Modifier.align(Alignment.CenterHorizontally)
                                                ) {
                                                    Text("Cancel", color = Color.Gray, fontSize = 14.sp, fontWeight = FontWeight.Medium)
                                                }
                                            }
                                        },
                                        confirmButton = {},
                                        dismissButton = {}
                                    )
                                }
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
                        viewModel.setSearchExpanded(true)
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
                            navController.navigate(Route.Dashboard.createRoute(tab = "active", sortBy = "expiring_soon"))
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
                        text = "Verified by AI.\nTrusted by Shoppers",
                        color = Color(0xFF1E144B),
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        lineHeight = 28.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

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
                        text = "Save More • Verified Deals • No Wasted Time",
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
                    text = "Search 6,000+ brands and stores..  ★  Search 6,000+ brands and stores..  ★  Search 6,000+ brands and stores..",
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

@Composable
private fun RedeemResultDialogs(
    showSuccess: Boolean,
    showError: Boolean,
    errorMessage: String,
    onSuccessDismiss: () -> Unit,
    onErrorDismiss: () -> Unit
) {
    if (showSuccess) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = onSuccessDismiss,
            containerColor = Color.White,
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            title = {
                Text(text = "Success!", fontSize = 20.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = Color(0xFF00C853))
            },
            text = {
                Text(text = "Coupon has been marked as redeemed successfully.", fontSize = 14.sp, color = Color(0xFF666666))
            },
            confirmButton = {
                androidx.compose.material3.Button(
                    onClick = onSuccessDismiss,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853)),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
                ) {
                    Text(text = "OK", fontSize = 14.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                }
            })
    }

    if (showError) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = onErrorDismiss,
            containerColor = Color.White,
            shape = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
            title = {
                Text(text = "Error", fontSize = 20.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, color = Color.Red)
            },
            text = {
                Text(text = errorMessage, fontSize = 14.sp, color = Color(0xFF666666))
            },
            confirmButton = {
                androidx.compose.material3.Button(
                    onClick = onErrorDismiss,
                    colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Color.Red),
                    shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)
                ) {
                    Text(text = "OK", fontSize = 14.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                }
            })
    }
}