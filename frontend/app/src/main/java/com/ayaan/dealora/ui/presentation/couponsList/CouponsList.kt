package com.ayaan.dealora.ui.presentation.couponsList

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.data.api.models.PartnerCoupon
import com.ayaan.dealora.data.api.models.RawScrapedCoupon
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.couponsList.components.CategoryBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsFilterSection
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsListTopBar
import com.ayaan.dealora.ui.presentation.couponsList.components.FiltersBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.PrivateEmptyState
import com.ayaan.dealora.ui.presentation.couponsList.components.SortBottomSheet
import com.ayaan.dealora.ui.presentation.navigation.Route

@Composable
fun CouponsList(
    navController: NavController, viewModel: CouponsListViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val uiState by viewModel.uiState.collectAsState()
    val rawCoupons by viewModel.rawCoupons.collectAsState()
    val isLoadingRawCoupons by viewModel.isLoadingRawCoupons.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val currentSortOption by viewModel.currentSortOption.collectAsState()
    val currentCategory by viewModel.currentCategory.collectAsState()
    val currentFilters by viewModel.currentFilters.collectAsState()
    val isPublicMode by viewModel.isPublicMode.collectAsState()
    val syncedBrands by viewModel.syncedBrands.collectAsState()
    val isLoadingPrivateCoupons by viewModel.isLoadingPrivateCoupons.collectAsState()
    // Partner coupons (exclusive toggle ON)
    val partnerCouponsActive   by viewModel.partnerCouponsActive.collectAsState()
    val partnerCouponsRedeemed by viewModel.partnerCouponsRedeemed.collectAsState()
    val partnerCouponsExpired  by viewModel.partnerCouponsExpired.collectAsState()
    val isLoadingPartnerCoupons by viewModel.isLoadingPartnerCoupons.collectAsState()
    val exclusiveTab            by viewModel.exclusiveTab.collectAsState()

    var showSortDialog by remember { mutableStateOf(false) }
    var showFiltersDialog by remember { mutableStateOf(false) }
    val privateCoupons by viewModel.privateCoupons.collectAsState()
    val savedCouponIds by viewModel.savedCouponIds.collectAsState()
    var showCategoryDialog by remember { mutableStateOf(false) }

    // Navigation parameters
    val categoryParam = navController.currentBackStackEntry?.arguments?.getString("category")
    val isPublicParam = navController.currentBackStackEntry?.arguments?.getBoolean("isPublic") ?: false
    val sortByParam = navController.currentBackStackEntry?.arguments?.getString("sortBy")

    LaunchedEffect(sortByParam) {
        if (!sortByParam.isNullOrEmpty()) {
            com.ayaan.dealora.ui.presentation.couponsList.components.SortOption.entries.find { it.apiValue == sortByParam }?.let {
                viewModel.onSortOptionChanged(it)
            }
        }
    }

    LaunchedEffect(isPublicParam) {
        if (isPublicParam) viewModel.onPublicModeChanged(true)
    }

    LaunchedEffect(categoryParam) {
        if (categoryParam != null) viewModel.onCategoryChanged(categoryParam)
    }

    Scaffold(
        containerColor = Color.White,
        topBar = {
            CouponsListTopBar(
                searchQuery = searchQuery,
                onSearchQueryChanged = { viewModel.onSearchQueryChanged(it) },
                onBackClick = { navController.popBackStack() },
                isPublicMode = isPublicMode,
                onPublicModeChanged = { viewModel.onPublicModeChanged(it) }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .background(Color.White)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            CouponsFilterSection(
                onSortClick = { showSortDialog = true },
                onCategoryClick = { showCategoryDialog = true },
                onFiltersClick = { showFiltersDialog = true }
            )

            Spacer(modifier = Modifier.height(12.dp))

            when (uiState) {
                is CouponsListUiState.Loading -> LoadingContent()
                is CouponsListUiState.Error -> ErrorContent(
                    message = (uiState as CouponsListUiState.Error).message,
                    onRetry = { viewModel.retry() }
                )
                is CouponsListUiState.Success -> {
                    if (!isPublicMode) {
                        // Private Mode
                        if (isLoadingPrivateCoupons) {
                            LoadingContent()
                        } else if (privateCoupons.isEmpty()) {
                            PrivateEmptyState()
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(16.dp),
                                contentPadding = PaddingValues(16.dp)
                            ) {
                                itemsIndexed(privateCoupons, key = { _, c -> c.id }) { _, privateCoupon ->
                                    var showSuccessDialog by remember { mutableStateOf(false) }
                                    var showErrorDialog by remember { mutableStateOf(false) }
                                    var errorMessage by remember { mutableStateOf("") }

                                    CouponCard(
                                        brandName = privateCoupon.brandName.uppercase().replace(" ", "\n"),
                                        couponTitle = privateCoupon.couponTitle ?: (privateCoupon.brandName.uppercase() + " coupon"),
                                        description = privateCoupon.description ?: "",
                                        category = privateCoupon.category,
                                        expiryDays = privateCoupon.daysUntilExpiry,
                                        couponCode = privateCoupon.couponCode ?: "",
                                        couponId = privateCoupon.id,
                                        isRedeemed = privateCoupon.status == "redeemed",
                                        isSaved = savedCouponIds.contains(privateCoupon.id),
                                        source = privateCoupon.source,
                                        onSave = { couponId -> viewModel.saveCouponFromModel(couponId, privateCoupon) },
                                        onRemoveSave = { couponId -> viewModel.removeSavedCoupon(couponId) },
                                        onRedeem = { couponId ->
                                            viewModel.redeemCoupon(
                                                couponId = couponId,
                                                onSuccess = { showSuccessDialog = true },
                                                onError = { error ->
                                                    errorMessage = error
                                                    showErrorDialog = true
                                                }
                                            )
                                        },
                                        onDetailsClick = {
                                            val couponJson = viewModel.moshi.adapter(com.ayaan.dealora.data.api.models.PrivateCoupon::class.java).toJson(privateCoupon)
                                            navController.navigate(
                                                Route.CouponDetails.createRoute(
                                                    couponId = privateCoupon.id,
                                                    isPrivate = true,
                                                    couponCode = privateCoupon.couponCode ?: "WELCOME100",
                                                    couponData = Uri.encode(couponJson)
                                                )
                                            )
                                        },
                                        onDiscoverClick = {
                                            val websiteUrl = privateCoupon.couponLink?.toString()?.trim()?.takeIf { it.isNotEmpty() }
                                            openUrl(context, websiteUrl)
                                        }
                                    )

                                    RedeemResultDialogs(
                                        showSuccess = showSuccessDialog,
                                        showError = showErrorDialog,
                                        errorMessage = errorMessage,
                                        onSuccessDismiss = { showSuccessDialog = false },
                                        onErrorDismiss = { showErrorDialog = false }
                                    )
                                }
                            }
                        }
                    } else {
                        // ── Exclusive Mode — Partner Coupons (ai-coupon-engine) ─────────────

                        // Active / Redeemed / Expired tab row
                        ExclusiveTabRow(
                            currentTab    = exclusiveTab,
                            onTabSelected = { viewModel.onExclusiveTabChanged(it) }
                        )

                        val displayCoupons: List<PartnerCoupon> = when (exclusiveTab) {
                            ExclusiveTab.ACTIVE   -> partnerCouponsActive
                            ExclusiveTab.REDEEMED -> partnerCouponsRedeemed
                            ExclusiveTab.EXPIRED  -> partnerCouponsExpired
                        }

                        if (isLoadingPartnerCoupons && displayCoupons.isEmpty()) {
                            LoadingContent()
                        } else if (displayCoupons.isEmpty()) {
                            EmptyContent(tab = exclusiveTab)
                        } else {
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                verticalArrangement = Arrangement.spacedBy(16.dp),
                                contentPadding = PaddingValues(16.dp)
                            ) {
                                itemsIndexed(displayCoupons, key = { _, c -> c.id }) { index, coupon ->
                                    var showSuccessDialog by remember { mutableStateOf(false) }
                                    var showFeedbackDialog by remember { mutableStateOf(false) }
                                    var showErrorDialog   by remember { mutableStateOf(false) }
                                    var errorMessage      by remember { mutableStateOf("") }

                                    val isAlreadyRedeemed =
                                        exclusiveTab == ExclusiveTab.REDEEMED ||
                                        coupon.isRedeemed == true

                                    CouponCard(
                                        brandName     = coupon.brandName.uppercase().replace(" ", "\n"),
                                        couponTitle   = coupon.couponTitle ?: coupon.discount ?: "Partner Offer",
                                        description   = coupon.description ?: "",
                                        category      = coupon.category,
                                        expiryDays    = coupon.daysUntilExpiry,
                                        couponCode    = coupon.couponCode ?: "",
                                        couponId      = coupon.id,
                                        isRedeemed    = isAlreadyRedeemed,
                                        isSaved       = savedCouponIds.contains(coupon.id),
                                        source        = coupon.couponLink,
                                        showActionButtons = true,
                                        merchantLogoUrl = coupon.merchantLogo,
                                        healthScore   = coupon.healthScore,
                                        discoverButtonLabel = "Use Now",
                                        onSave        = { _ -> viewModel.savePartnerCoupon(coupon) },
                                        onRemoveSave  = { id -> viewModel.removeSavedCoupon(id) },
                                        onRedeem      = { _ ->
                                            if (!isAlreadyRedeemed) {
                                                showFeedbackDialog = true
                                            }
                                        },
                                        onDetailsClick = {
                                            val couponJson = viewModel.moshi
                                                .adapter(PartnerCoupon::class.java)
                                                .toJson(coupon)
                                            navController.navigate(
                                                Route.CouponDetails.createRoute(
                                                    couponId   = coupon.id,
                                                    isPrivate  = false,
                                                    couponCode = coupon.couponCode ?: "",
                                                    couponData = Uri.encode(couponJson)
                                                )
                                            )
                                        },
                                        // Use Now — opens the affiliate tracking link
                                        // Also records a "discover" interaction so the
                                        // feedback popup can ask if the coupon worked.
                                        onDiscoverClick = {
                                            coupon.couponCode?.let { code ->
                                                if (code.isNotEmpty()) {
                                                    clipboardManager.setText(AnnotatedString(code))
                                                }
                                            }
                                            viewModel.recordPartnerDiscover(coupon)
                                            openUrl(context, coupon.couponLink)
                                        }
                                    )

                                    RedeemResultDialogs(
                                        showSuccess      = showSuccessDialog,
                                        showError        = showErrorDialog,
                                        errorMessage     = errorMessage,
                                        onSuccessDismiss = { showSuccessDialog = false },
                                        onErrorDismiss   = { showErrorDialog   = false }
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
                                                Text(
                                                    text = "Your feedback helps us keep the best deals for everyone!",
                                                    fontSize = 14.sp,
                                                    color = Color(0xFF666666)
                                                )
                                            },
                                            confirmButton = {
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
                                                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
                                                ) {
                                                    Text("Yes, it worked!", color = Color.White)
                                                }
                                            },
                                            dismissButton = {
                                                Column {
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
                                                        shape = RoundedCornerShape(8.dp),
                                                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
                                                    ) {
                                                        Text("No, it didn't work")
                                                    }
                                                    TextButton(
                                                        onClick = { showFeedbackDialog = false },
                                                        modifier = Modifier.align(Alignment.CenterHorizontally)
                                                    ) {
                                                        Text("Cancel", color = Color.Gray)
                                                    }
                                                }
                                            }
                                        )
                                    }

                                    // Pagination trigger
                                    if (index == displayCoupons.size - 1 &&
                                        viewModel.getPartnerCouponsPage() < viewModel.getPartnerCouponsPages()
                                    ) {
                                        viewModel.loadNextPartnerPage()
                                    }
                                }

                                // Inline loading spinner at bottom during pagination
                                if (isLoadingPartnerCoupons && displayCoupons.isNotEmpty()) {
                                    item {
                                        Box(
                                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                                            contentAlignment = Alignment.Center
                                        ) { CircularProgressIndicator() }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Bottom Sheets
        if (showSortDialog) {
            SortBottomSheet(
                currentSort = currentSortOption,
                onDismiss = { showSortDialog = false },
                onSortSelected = { viewModel.onSortOptionChanged(it) }
            )
        }

        if (showFiltersDialog) {
            FiltersBottomSheet(
                currentFilters = currentFilters,
                syncedBrands = syncedBrands,
                onDismiss = { showFiltersDialog = false },
                onApplyFilters = { viewModel.onFiltersChanged(it) }
            )
        }

        if (showCategoryDialog) {
            CategoryBottomSheet(
                currentCategory = currentCategory,
                onDismiss = { showCategoryDialog = false },
                onCategorySelected = { viewModel.onCategoryChanged(it) }
            )
        }
    }
}

private fun openUrl(context: android.content.Context, url: String?) {
    val websiteUrl = url?.trim()?.takeIf { it.isNotEmpty() }
    if (websiteUrl != null) {
        try {
            val uri = Uri.parse(
                if (websiteUrl.startsWith("http://") || websiteUrl.startsWith("https://"))
                    websiteUrl
                else
                    "https://$websiteUrl"
            )
            context.startActivity(Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
        } catch (e: Exception) {
            Log.e("CouponsList", "Could not open link: ${e.message}", e)
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

@Composable
private fun LoadingContent() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            CircularProgressIndicator()
            Spacer(Modifier.height(16.dp))
            Text(text = "Loading your coupons...", style = MaterialTheme.typography.bodyMedium, color = Color.Gray)
        }
    }
}

@Composable
private fun ErrorContent(message: String, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center, modifier = Modifier.padding(24.dp)) {
            Text(text = "😕", style = MaterialTheme.typography.displayMedium)
            Spacer(Modifier.height(16.dp))
            Text(text = message, style = MaterialTheme.typography.bodyLarge, textAlign = TextAlign.Center, color = Color.Gray)
            Spacer(Modifier.height(24.dp))
            Button(onClick = onRetry) { Text("Try Again") }
        }
    }
}

@Composable
private fun EmptyContent(tab: ExclusiveTab = ExclusiveTab.ACTIVE) {
    val emoji = when (tab) {
        ExclusiveTab.REDEEMED -> "✅"
        ExclusiveTab.EXPIRED  -> "⏰"
        else                  -> "🎟️"
    }
    val title = when (tab) {
        ExclusiveTab.REDEEMED -> "No redeemed coupons yet"
        ExclusiveTab.EXPIRED  -> "No expired coupons"
        else                  -> "No partner coupons found"
    }
    val subtitle = when (tab) {
        ExclusiveTab.REDEEMED -> "Redeem a coupon from the Active tab and it will appear here."
        ExclusiveTab.EXPIRED  -> "All your coupons are still active — great!"
        else                  -> "Try adjusting your filters or check back later."
    }
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            Text(text = emoji, style = MaterialTheme.typography.displayMedium)
            Spacer(Modifier.height(16.dp))
            Text(text = title, style = MaterialTheme.typography.titleMedium, color = Color.Black)
            Spacer(Modifier.height(8.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
                color = Color.Gray
            )
        }
    }
}

/** Tab row shown at the top of the exclusive partner coupon list. */
@Composable
private fun ExclusiveTabRow(
    currentTab: ExclusiveTab,
    onTabSelected: (ExclusiveTab) -> Unit
) {
    val tabs = listOf(
        ExclusiveTab.ACTIVE   to "Active",
        ExclusiveTab.REDEEMED to "Redeemed",
        ExclusiveTab.EXPIRED  to "Expired"
    )
    val activeColor   = Color(0xFF6200EE)
    val inactiveColor = Color(0xFF6200EE).copy(alpha = 0.12f)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        tabs.forEach { (tab, label) ->
            val selected = currentTab == tab
            Button(
                onClick = { onTabSelected(tab) },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selected) activeColor else inactiveColor,
                    contentColor   = if (selected) Color.White else activeColor
                ),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                Text(
                    text       = label,
                    fontSize   = 13.sp,
                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}
