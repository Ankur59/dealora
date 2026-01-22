package com.ayaan.dealora.ui.presentation.couponsList

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import androidx.paging.compose.itemKey
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
    val uiState by viewModel.uiState.collectAsState()
    val coupons = viewModel.couponsFlow.collectAsLazyPagingItems()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val currentSortOption by viewModel.currentSortOption.collectAsState()
    val currentCategory by viewModel.currentCategory.collectAsState()
    val currentFilters by viewModel.currentFilters.collectAsState()
    val isPublicMode by viewModel.isPublicMode.collectAsState()

    var showSortDialog by remember { mutableStateOf(false) }

    var showFiltersDialog by remember { mutableStateOf(false) }
    val privateCoupons by viewModel.privateCoupons.collectAsState()
    val savedCouponIds by viewModel.savedCouponIds.collectAsState()

    var showCategoryDialog by remember { mutableStateOf(false) }
    LaunchedEffect(isPublicMode) {
        if (isPublicMode) {
            viewModel.loadCoupons()
        }
    }
    Scaffold(
        containerColor = Color.White, topBar = {
            CouponsListTopBar(searchQuery = searchQuery, onSearchQueryChanged = { query ->
                viewModel.onSearchQueryChanged(query)
            }, onBackClick = {
                navController.popBackStack()
            }, isPublicMode = isPublicMode, onPublicModeChanged = { isPublic ->
                viewModel.onPublicModeChanged(isPublic)
            })
        }) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .background(Color.White)
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            // Filter section with horizontal padding
            Box(modifier = Modifier) {
                CouponsFilterSection(
                    onSortClick = { showSortDialog = true },
                    onCategoryClick = { showCategoryDialog = true },
                    onFiltersClick = { showFiltersDialog = true })
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Handle UI state
            when (uiState) {
                is CouponsListUiState.Loading -> {
                    LoadingContent()
                }

                is CouponsListUiState.Error -> {
                    ErrorContent(
                        message = (uiState as CouponsListUiState.Error).message,
                        onRetry = { viewModel.retry() })
                }

                is CouponsListUiState.Success -> {
                    // Handle paging load states
                    when (val refreshState = coupons.loadState.refresh) {
                        is LoadState.Loading -> {
                            LoadingContent()
                        }

                        is LoadState.Error -> {
                            val errorMessage = refreshState.error.message
                                ?: "Unable to load coupons. Please try again."
                            ErrorContent(
                                message = errorMessage, onRetry = { coupons.retry() })
                        }

                        is LoadState.NotLoading -> {
                            if (!isPublicMode) {
                                if (privateCoupons.isEmpty()) {
                                    PrivateEmptyState()
                                } else {
                                    LazyColumn(
                                        modifier = Modifier.fillMaxSize(),
                                        verticalArrangement = Arrangement.spacedBy(16.dp),
                                        contentPadding = PaddingValues(16.dp)
                                    ) {
                                        items(
                                            count = privateCoupons.size,
                                            key = { index -> privateCoupons[index].id }) { index ->
                                            val privateCoupon = privateCoupons[index]

                                            // State for this specific card
                                            var showSuccessDialog by remember { mutableStateOf(false) }
                                            var showErrorDialog by remember { mutableStateOf(false) }
                                            var errorMessage by remember { mutableStateOf("") }

                                            CouponCard(
                                                brandName = privateCoupon.brandName.uppercase()
                                                    .replace(" ", "\n"),
                                                couponTitle = privateCoupon.couponTitle,
                                                description = privateCoupon.description ?: "",
                                                category = privateCoupon.category,
                                                expiryDays = privateCoupon.daysUntilExpiry,
                                                couponCode = privateCoupon.couponCode ?: "",
                                                couponId = privateCoupon.id,
                                                isRedeemed = privateCoupon.redeemed ?: false,
                                                isSaved = savedCouponIds.contains(privateCoupon.id),
                                                onSave = { couponId ->
                                                    viewModel.saveCouponFromModel(couponId, privateCoupon)
                                                },
                                                onRemoveSave = { couponId ->
                                                    viewModel.removeSavedCoupon(couponId)
                                                },
                                                onRedeem = { couponId ->
                                                    Log.d(
                                                        "CouponsList",
                                                        "Redeem clicked for coupon: $couponId"
                                                    )
                                                    viewModel.redeemCoupon(
                                                        couponId = couponId,
                                                        onSuccess = {
                                                            Log.d(
                                                                "CouponsList",
                                                                "Redeem success for coupon: $couponId"
                                                            )
                                                            showSuccessDialog = true
                                                        },
                                                        onError = { error ->
                                                            Log.e(
                                                                "CouponsList",
                                                                "Redeem error for coupon: $couponId - $error"
                                                            )
                                                            errorMessage = error
                                                            showErrorDialog = true
                                                        })
                                                },
                                                onDetailsClick = {
                                                    navController.navigate(
                                                        Route.CouponDetails.createRoute(
                                                            couponId = privateCoupon.id,
                                                            isPrivate = true,
                                                            couponCode = privateCoupon.couponCode
                                                                ?: "WELCOME100"
                                                        )
                                                    )
                                                },
                                                onDiscoverClick = {
                                                    try {
                                                        // Create implicit intent with custom action
                                                        val intent = Intent().apply {
                                                            action =
                                                                "com.ayaan.couponviewer.SHOW_COUPON"

                                                            // Add coupon data as extras with defaults for null/empty values
                                                            putExtra(
                                                                "EXTRA_COUPON_CODE",
                                                                privateCoupon.couponCode?.takeIf { it.isNotEmpty() }
                                                                    ?: "NO CODE")
                                                            putExtra(
                                                                "EXTRA_COUPON_TITLE",
                                                                privateCoupon.couponTitle?.takeIf { it.isNotEmpty() }
                                                                    ?: "Special Offer")
                                                            putExtra(
                                                                "EXTRA_DESCRIPTION",
                                                                privateCoupon.description?.takeIf { it.isNotEmpty() }
                                                                    ?: "Check app for details")
                                                            putExtra(
                                                                "EXTRA_BRAND_NAME",
                                                                privateCoupon.brandName?.takeIf { it.isNotEmpty() }
                                                                    ?: "Dealora")
                                                            putExtra(
                                                                "EXTRA_CATEGORY",
                                                                privateCoupon.category?.takeIf { it.isNotEmpty() }
                                                                    ?: "General")
                                                            privateCoupon.daysUntilExpiry?.let {
                                                                putExtra(
                                                                    "EXTRA_EXPIRY_DATE",
                                                                    "$it days"
                                                                )
                                                            } ?: putExtra(
                                                                "EXTRA_EXPIRY_DATE",
                                                                "Check app for expiry"
                                                            )
                                                            putExtra(
                                                                "EXTRA_MINIMUM_ORDER",
                                                                privateCoupon.minimumOrderValue?.takeIf { it.isNotEmpty() }
                                                                    ?: "No minimum")
                                                            putExtra(
                                                                "EXTRA_COUPON_LINK",
                                                                privateCoupon.couponLink?.takeIf { it.isNotEmpty() }
                                                                    ?: "")
                                                            putExtra(
                                                                "EXTRA_SOURCE_PACKAGE",
                                                                context.packageName
                                                            )

                                                            // Set package to ensure it opens the right app
                                                            setPackage("com.ayaan.couponviewer")

                                                            // Add category to help Android find the intent handler
                                                            addCategory(Intent.CATEGORY_DEFAULT)
                                                        }

                                                        Log.d(
                                                            "CouponsList",
                                                            "Attempting to launch CouponViewer with intent: $intent"
                                                        )
                                                        Log.d(
                                                            "CouponsList",
                                                            "Coupon Code: ${privateCoupon.couponCode}"
                                                        )

                                                        context.startActivity(intent)
                                                    } catch (e: Exception) {
                                                        Log.e(
                                                            "CouponsList",
                                                            "Failed to open CouponViewer app: ${e.message}",
                                                            e
                                                        )

                                                        // Fallback to Play Store
                                                        try {
                                                            val playStoreIntent =
                                                                Intent(Intent.ACTION_VIEW).apply {
                                                                    data =
                                                                        Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                                                    setPackage("com.android.vending")
                                                                }
                                                            context.startActivity(playStoreIntent)
                                                        } catch (e2: Exception) {
                                                            // Last resort - open in browser
                                                            val browserIntent =
                                                                Intent(Intent.ACTION_VIEW).apply {
                                                                    data =
                                                                        Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                                                }
                                                            context.startActivity(browserIntent)
                                                        }
                                                    }
                                                })

                                            // Success Dialog for this card
                                            if (showSuccessDialog) {
                                                androidx.compose.material3.AlertDialog(
                                                    onDismissRequest = {
                                                        showSuccessDialog = false
                                                    },
                                                    containerColor = Color.White,
                                                    shape = androidx.compose.foundation.shape.RoundedCornerShape(
                                                        16.dp
                                                    ),
                                                    title = {
                                                        Text(
                                                            text = "Success!",
                                                            fontSize = 20.sp,
                                                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                                                            color = Color(
                                                                0xFF00C853
                                                            )
                                                        )
                                                    },
                                                    text = {
                                                        Text(
                                                            text = "Coupon has been marked as redeemed successfully.",
                                                            fontSize = 14.sp,
                                                            color = Color(
                                                                0xFF666666
                                                            )
                                                        )
                                                    },
                                                    confirmButton = {
                                                        Button(
                                                            onClick = { showSuccessDialog = false },
                                                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                                                containerColor = Color(
                                                                    0xFF00C853
                                                                )
                                                            ),
                                                            shape = androidx.compose.foundation.shape.RoundedCornerShape(
                                                                8.dp
                                                            )
                                                        ) {
                                                            Text(
                                                                text = "OK",
                                                                fontSize = 14.sp,
                                                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
                                                            )
                                                        }
                                                    })
                                            }

                                            // Error Dialog for this card
                                            if (showErrorDialog) {
                                                androidx.compose.material3.AlertDialog(
                                                    onDismissRequest = { showErrorDialog = false },
                                                    containerColor = Color.White,
                                                    shape = androidx.compose.foundation.shape.RoundedCornerShape(
                                                        16.dp
                                                    ),
                                                    title = {
                                                        Text(
                                                            text = "Error",
                                                            fontSize = 20.sp,
                                                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                                                            color = Color.Red
                                                        )
                                                    },
                                                    text = {
                                                        Text(
                                                            text = errorMessage,
                                                            fontSize = 14.sp,
                                                            color = Color(
                                                                0xFF666666
                                                            )
                                                        )
                                                    },
                                                    confirmButton = {
                                                        Button(
                                                            onClick = { showErrorDialog = false },
                                                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                                                                containerColor = Color.Red
                                                            ),
                                                            shape = androidx.compose.foundation.shape.RoundedCornerShape(
                                                                8.dp
                                                            )
                                                        ) {
                                                            Text(
                                                                text = "OK",
                                                                fontSize = 14.sp,
                                                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold
                                                            )
                                                        }
                                                    })
                                            }
                                        }
                                    }
                                }
                            } else if (coupons.itemCount == 0) {
                                EmptyContent()
                            } else {
                                // Coupon cards with CouponCard component
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize(),
                                    verticalArrangement = Arrangement.spacedBy(16.dp),
                                    contentPadding = PaddingValues(16.dp)
                                ) {
                                    items(
                                        count = coupons.itemCount,
                                        key = coupons.itemKey { it.id }) { index ->
                                        val coupon = coupons[index]
                                        if (coupon != null) {
                                            CouponCard(
                                                brandName = coupon.brandName?.uppercase()
                                                    ?.replace(" ", "\n") ?: "DEALORA",
                                                couponTitle = coupon.couponTitle ?: "Special Offer",
                                                description = "", // Not available in list API
                                                category = null, // Not available in list API
                                                expiryDays = null, // Not available in list API
                                                couponCode = "", // Not available in list API
                                                couponId = coupon.id,
                                                isRedeemed = false,
                                                isSaved = savedCouponIds.contains(coupon.id),
                                                onSave = { couponId ->
                                                    // For public coupons, save with minimal data since we don't have full details
                                                    viewModel.saveCoupon(couponId, "{}")
                                                },
                                                onRemoveSave = { couponId ->
                                                    viewModel.removeSavedCoupon(couponId)
                                                },
                                                onDetailsClick = {
                                                    navController.navigate(
                                                        Route.CouponDetails.createRoute(
                                                            couponId = coupon.id, isPrivate = false
                                                        )
                                                    )
                                                },
                                                onDiscoverClick = {
                                                    try {
                                                        // Create implicit intent with custom action
                                                        val intent = Intent().apply {
                                                            action =
                                                                "com.ayaan.couponviewer.SHOW_COUPON"

                                                            // Add coupon data as extras with defaults for missing data
                                                            putExtra(
                                                                "EXTRA_COUPON_CODE",
                                                                coupon.couponTitle ?: "DISCOVER"
                                                            )
                                                            putExtra(
                                                                "EXTRA_COUPON_TITLE",
                                                                coupon.couponTitle
                                                                    ?: "Special Offer"
                                                            )
                                                            putExtra(
                                                                "EXTRA_DESCRIPTION",
                                                                "View details in the app for more information"
                                                            )
                                                            putExtra(
                                                                "EXTRA_BRAND_NAME",
                                                                coupon.brandName ?: "Dealora"
                                                            )
                                                            putExtra("EXTRA_CATEGORY", "General")
                                                            putExtra(
                                                                "EXTRA_MINIMUM_ORDER",
                                                                "No minimum"
                                                            )
                                                            putExtra("EXTRA_COUPON_LINK", "")
                                                            putExtra(
                                                                "EXTRA_SOURCE_PACKAGE",
                                                                context.packageName
                                                            )

                                                            // Set package to ensure it opens the right app
                                                            setPackage("com.ayaan.couponviewer")

                                                            // Add category to help Android find the intent handler
                                                            addCategory(Intent.CATEGORY_DEFAULT)
                                                        }

                                                        Log.d(
                                                            "CouponsList",
                                                            "Attempting to launch CouponViewer with intent: $intent"
                                                        )
                                                        Log.d(
                                                            "CouponsList",
                                                            "Coupon Title: ${coupon.couponTitle}"
                                                        )

                                                        context.startActivity(intent)
                                                    } catch (e: Exception) {
                                                        Log.e(
                                                            "CouponsList",
                                                            "Failed to open CouponViewer app: ${e.message}",
                                                            e
                                                        )

                                                        // Fallback to Play Store
                                                        try {
                                                            val playStoreIntent =
                                                                Intent(Intent.ACTION_VIEW).apply {
                                                                    data =
                                                                        Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                                                    setPackage("com.android.vending")
                                                                }
                                                            context.startActivity(playStoreIntent)
                                                        } catch (e2: Exception) {
                                                            // Last resort - open in browser
                                                            val browserIntent =
                                                                Intent(Intent.ACTION_VIEW).apply {
                                                                    data =
                                                                        Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                                                }
                                                            context.startActivity(browserIntent)
                                                        }
                                                    }
                                                })
                                        }
                                    }

                                    // Show loading indicator when loading more items
                                    if (coupons.loadState.append is LoadState.Loading) {
                                        item {
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(16.dp),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                CircularProgressIndicator(
                                                    modifier = Modifier.size(32.dp),
                                                    strokeWidth = 2.dp
                                                )
                                            }
                                        }
                                    }

                                    // Show error when loading more items fails
                                    if (coupons.loadState.append is LoadState.Error) {
                                        item {
                                            Box(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(16.dp),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Column(
                                                    horizontalAlignment = Alignment.CenterHorizontally
                                                ) {
                                                    Text(
                                                        text = "Failed to load more coupons",
                                                        style = MaterialTheme.typography.bodyMedium,
                                                        color = Color.Gray
                                                    )
                                                    Spacer(modifier = Modifier.height(8.dp))
                                                    Button(onClick = { coupons.retry() }) {
                                                        Text("Retry")
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Sort Bottom Sheet
        if (showSortDialog) {
            SortBottomSheet(
                currentSort = currentSortOption,
                onDismiss = { showSortDialog = false },
                onSortSelected = { sortOption ->
                    viewModel.onSortOptionChanged(sortOption)
                })
        }

        // Filters Bottom Sheet
        if (showFiltersDialog) {
            FiltersBottomSheet(
                currentFilters = currentFilters,
                onDismiss = { showFiltersDialog = false },
                onApplyFilters = { filters ->
                    viewModel.onFiltersChanged(filters)
                })
        }

        // Category Bottom Sheet
        if (showCategoryDialog) {
            CategoryBottomSheet(
                currentCategory = currentCategory,
                onDismiss = { showCategoryDialog = false },
                onCategorySelected = { category ->
                    viewModel.onCategoryChanged(category)
                })
        }
    }
}

@Composable
private fun LoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            CircularProgressIndicator()
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Loading your coupons...",
                style = MaterialTheme.typography.bodyMedium,
                color = Color.Gray
            )
        }
    }
}

@Composable
private fun ErrorContent(
    message: String, onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            Text(
                text = "😕", style = MaterialTheme.typography.displayMedium
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
                textAlign = TextAlign.Center,
                color = Color.Gray
            )
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onRetry) {
                Text("Try Again")
            }
        }
    }
}

@Composable
private fun EmptyContent() {
    Box(
        modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            Text(
                text = "🎟️", style = MaterialTheme.typography.displayMedium
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "No coupons yet",
                style = MaterialTheme.typography.titleMedium,
                color = Color.Black
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Start adding coupons to see them here!",
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
                color = Color.Gray
            )
        }
    }
}

