package com.ayaan.dealora.ui.presentation.categories

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.data.api.models.RawScrapedCoupon
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.couponsList.components.CategoryBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsFilterSection
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsListTopBar
import com.ayaan.dealora.ui.presentation.couponsList.components.FiltersBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.SortBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.SortOption
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun CategoriesScreen(
    navController: NavController, viewModel: CategoriesViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val currentSortOption by viewModel.currentSortOption.collectAsState()
    val currentCategory by viewModel.currentCategory.collectAsState()
    val currentFilters by viewModel.currentFilters.collectAsState()

    var showSortDialog by remember { mutableStateOf(false) }
    var showFiltersDialog by remember { mutableStateOf(false) }
    var showCategoryDialog by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            CouponsListTopBar(
                searchQuery = searchQuery,
                onSearchQueryChanged = { viewModel.onSearchQueryChanged(it) },
                onBackClick = { navController.popBackStack() },
                // The top-bar switch drives "Exclusive" mode in categories screen
                isPublicMode = uiState.isExclusiveMode,
                onPublicModeChanged = { viewModel.onExclusiveModeChanged(it) },
                showModeSwitch = true
            )
        }, containerColor = Color.White
    ) { innerPadding ->

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color.White)
        ) {

            // ── Filter bar — only show in exclusive mode ──────────────────────
            if (uiState.isExclusiveMode) {
                Spacer(modifier = Modifier.height(12.dp))
                CouponsFilterSection(
                    onSortClick = { showSortDialog = true },
                    onCategoryClick = { showCategoryDialog = true },
                    onFiltersClick = { showFiltersDialog = true }
                )
                Spacer(modifier = Modifier.height(12.dp))
            }

            // ── Body ──────────────────────────────────────────────────────────
            Box(modifier = Modifier.fillMaxSize()) {

                when {
                    // ── Exclusive mode ────────────────────────────────────────
                    uiState.isExclusiveMode -> {
                        ExclusiveCouponsList(
                            coupons = uiState.rawCoupons,
                            isLoading = uiState.isLoadingRawCoupons,
                            errorMessage = uiState.errorMessage,
                            currentPage = uiState.rawCouponsPage,
                            totalPages = uiState.rawCouponsPages,
                            savedCouponIds = uiState.savedCouponIds,
                            onLoadMore = { viewModel.loadNextRawPage() },
                            onSave = { coupon -> viewModel.saveRawCoupon(coupon) },
                            onRemoveSave = { couponId -> viewModel.removeSavedCoupon(couponId) },
                            onRedeem = { coupon, onSuccess, onError ->
                                viewModel.redeemRawCoupon(coupon.id, onSuccess, onError)
                            },
                            onDetailsClick = { coupon ->
                                // Encode coupon as JSON and navigate to details page
                                val couponJson = viewModel.moshi
                                    .adapter(RawScrapedCoupon::class.java)
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
                            onDiscoverClick = { coupon ->
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
                                        Log.e("CategoriesScreen", "Could not open url: ${e.message}", e)
                                    }
                                } else {
                                    Log.w("CategoriesScreen", "No link for raw coupon ${coupon.id}")
                                }
                            }
                        )
                    }

                    // ── Normal category groups loading ────────────────────────
                    uiState.isLoading -> {
                        CircularProgressIndicator(
                            modifier = Modifier.align(Alignment.Center),
                            color = DealoraPrimary
                        )
                    }

                    uiState.errorMessage != null && uiState.categoryGroups.isEmpty() -> {
                        Text(
                            text = uiState.errorMessage!!,
                            color = Color.Gray,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .align(Alignment.Center)
                                .padding(16.dp)
                        )
                    }

                    // ── Normal category groups ────────────────────────────────
                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(bottom = 16.dp)
                        ) {
                            uiState.categoryGroups.forEach { group ->
                                item {
                                    CategoryHeader(group.name, group.totalCount)
                                }

                                items(group.coupons) { coupon ->
                                    val isSaved = uiState.savedCouponIds.contains(coupon.id)
                                    val privateCoupon = viewModel.getPrivateCoupon(coupon.id)

                                    var showSuccessDialog by remember { mutableStateOf(false) }
                                    var showErrorDialog by remember { mutableStateOf(false) }
                                    var errorMessage by remember { mutableStateOf("") }

                                    CouponCard(
                                        brandName = coupon.brandName?.uppercase()?.replace(" ", "\n") ?: "DEALORA",
                                        couponTitle = coupon.couponTitle ?: "Special Offer",
                                        description = coupon.description ?: "",
                                        category = coupon.category,
                                        expiryDays = coupon.daysUntilExpiry,
                                        couponCode = privateCoupon?.couponCode ?: "",
                                        couponId = coupon.id,
                                        isRedeemed = privateCoupon?.status == "redeemed",
                                        couponLink = privateCoupon?.couponLink,
                                        minimumOrderValue = privateCoupon?.minimumOrderValue?.toString(),
                                        isSaved = isSaved,
                                        source = coupon.source ?: privateCoupon?.source,
                                        showActionButtons = !uiState.isPublicMode,
                                        onDetailsClick = {
                                            val couponJson = privateCoupon?.let {
                                                viewModel.moshi.adapter(
                                                    com.ayaan.dealora.data.api.models.PrivateCoupon::class.java
                                                ).toJson(it)
                                            }
                                            navController.navigate(
                                                Route.CouponDetails.createRoute(
                                                    couponId = coupon.id,
                                                    isPrivate = !uiState.isPublicMode,
                                                    couponCode = privateCoupon?.couponCode ?: "WELCOME100",
                                                    couponData = couponJson?.let { Uri.encode(it) }
                                                )
                                            )
                                        },
                                        onSave = { viewModel.saveCoupon(coupon.id, coupon) },
                                        onRemoveSave = { viewModel.removeSavedCoupon(coupon.id) },
                                        onRedeem = { couponId ->
                                            viewModel.redeemCoupon(
                                                couponId = couponId,
                                                onSuccess = { showSuccessDialog = true },
                                                onError = { err ->
                                                    errorMessage = err
                                                    showErrorDialog = true
                                                }
                                            )
                                        },
                                        onDiscoverClick = {
                                            val url = (privateCoupon?.couponLink ?: coupon.source)
                                                ?.trim()?.takeIf { it.isNotEmpty() }
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
                                                    Log.e("CategoriesScreen", "Could not open link", e)
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
                                }

                                item { Spacer(modifier = Modifier.height(16.dp)) }
                            }
                        }
                    }
                }
            }
        }

        // ── Bottom sheets ─────────────────────────────────────────────────────
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
                syncedBrands = emptyList(),
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

// ── Exclusive mode list ───────────────────────────────────────────────────────

@Composable
private fun ExclusiveCouponsList(
    coupons: List<RawScrapedCoupon>,
    isLoading: Boolean,
    errorMessage: String?,
    currentPage: Int,
    totalPages: Int,
    savedCouponIds: Set<String>,
    onLoadMore: () -> Unit,
    onSave: (RawScrapedCoupon) -> Unit,
    onRemoveSave: (String) -> Unit,
    onRedeem: (RawScrapedCoupon, () -> Unit, (String) -> Unit) -> Unit,
    onDetailsClick: (RawScrapedCoupon) -> Unit,
    onDiscoverClick: (RawScrapedCoupon) -> Unit
) {
    when {
        isLoading && coupons.isEmpty() -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = DealoraPrimary)
            }
        }

        !isLoading && coupons.isEmpty() -> {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                    modifier = Modifier.padding(24.dp)
                ) {
                    Text("🎟️", fontSize = 48.sp)
                    Spacer(Modifier.height(16.dp))
                    Text(
                        text = "No exclusive coupons found",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 18.sp,
                        color = Color.Black
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = errorMessage ?: "Try adjusting your filters or check back later.",
                        fontSize = 14.sp,
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }

        else -> {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(0.dp),
                contentPadding = PaddingValues(bottom = 24.dp)
            ) {
                itemsIndexed(coupons, key = { _, c -> c.id }) { index, coupon ->
                    val isSaved = savedCouponIds.contains(coupon.id)
                    var showSuccessDialog by remember { mutableStateOf(false) }
                    var showErrorDialog by remember { mutableStateOf(false) }
                    var errorMsg by remember { mutableStateOf("") }
                    // Track local redeemed state (raw coupons have no backend redeem status)
                    var isRedeemedLocal by remember { mutableStateOf(false) }

                    CouponCard(
                        brandName = coupon.brandName.uppercase().replace(" ", "\n"),
                        couponTitle = coupon.couponTitle ?: "Exclusive Offer",
                        description = coupon.description ?: "",
                        category = coupon.category,
                        expiryDays = coupon.daysUntilExpiry,
                        couponCode = coupon.couponCode ?: "",
                        couponId = coupon.id,
                        isRedeemed = isRedeemedLocal,
                        couponLink = coupon.couponLink,
                        discountType = coupon.discountType,
                        isSaved = isSaved,
                        source = coupon.couponLink, // header colour fallback
                        showActionButtons = true,
                        onSave = { onSave(coupon) },
                        onRemoveSave = { onRemoveSave(coupon.id) },
                        onRedeem = { _ ->
                            onRedeem(
                                coupon,
                                {
                                    isRedeemedLocal = true
                                    showSuccessDialog = true
                                },
                                { err ->
                                    errorMsg = err
                                    showErrorDialog = true
                                }
                            )
                        },
                        onDetailsClick = { onDetailsClick(coupon) },
                        onDiscoverClick = { onDiscoverClick(coupon) }
                    )

                    RedeemResultDialogs(
                        showSuccess = showSuccessDialog,
                        showError = showErrorDialog,
                        errorMessage = errorMsg,
                        onSuccessDismiss = { showSuccessDialog = false },
                        onErrorDismiss = { showErrorDialog = false }
                    )

                    // Trigger next page load when near end
                    if (index == coupons.size - 3 && currentPage < totalPages) {
                        onLoadMore()
                    }
                }

                // Loading indicator for pagination
                if (isLoading && coupons.isNotEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = DealoraPrimary)
                        }
                    }
                }

                // End-of-list indicator
                if (!isLoading && currentPage >= totalPages && coupons.isNotEmpty()) {
                    item {
                        Text(
                            text = "You've seen all ${coupons.size} exclusive coupons",
                            fontSize = 13.sp,
                            color = Color.Gray,
                            textAlign = TextAlign.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 16.dp)
                        )
                    }
                }
            }
        }
    }
}

// ── Reusable success / error dialogs ─────────────────────────────────────────

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
            shape = RoundedCornerShape(16.dp),
            title = {
                Text("Success!", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFF00C853))
            },
            text = {
                Text("Coupon has been marked as redeemed successfully.", fontSize = 14.sp, color = Color(0xFF666666))
            },
            confirmButton = {
                Button(
                    onClick = onSuccessDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853)),
                    shape = RoundedCornerShape(8.dp)
                ) { Text("OK", fontSize = 14.sp, fontWeight = FontWeight.SemiBold) }
            }
        )
    }

    if (showError) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = onErrorDismiss,
            containerColor = Color.White,
            shape = RoundedCornerShape(16.dp),
            title = {
                Text("Error", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color.Red)
            },
            text = {
                Text(errorMessage, fontSize = 14.sp, color = Color(0xFF666666))
            },
            confirmButton = {
                Button(
                    onClick = onErrorDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Color.Red),
                    shape = RoundedCornerShape(8.dp)
                ) { Text("OK", fontSize = 14.sp, fontWeight = FontWeight.SemiBold) }
            }
        )
    }
}

// ── Category header ───────────────────────────────────────────────────────────

@Composable
fun CategoryHeader(name: String, count: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = name, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.Black)
        Text(
            text = "$count coupons",
            fontSize = 14.sp,
            color = DealoraPrimary,
            fontWeight = FontWeight.Medium
        )
    }
}
