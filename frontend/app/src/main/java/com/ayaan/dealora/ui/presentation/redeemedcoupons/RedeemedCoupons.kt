package com.ayaan.dealora.ui.presentation.redeemedcoupons

import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.couponsList.components.CategoryBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsFilterSection
import com.ayaan.dealora.ui.presentation.couponsList.components.FiltersBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.SortBottomSheet
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraGray

@Composable
fun RedeemedCoupons(
    navController: NavController, viewModel: RedeemedCouponsViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val filteredCoupons by viewModel.filteredCoupons.collectAsState()
    val currentSortOption by viewModel.currentSortOption.collectAsState()
    val currentCategory by viewModel.currentCategory.collectAsState()
    val currentFilters by viewModel.currentFilters.collectAsState()

    var showSortDialog by remember { mutableStateOf(false) }
    var showFiltersDialog by remember { mutableStateOf(false) }
    var showCategoryDialog by remember { mutableStateOf(false) }

    Scaffold(
        containerColor = Color.White, topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {

                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .border(
                            width = 1.5.dp, color = DealoraGray, shape = CircleShape
                        )
                        .clickable {
                            navController.popBackStack()
                        }, contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(R.drawable.arrow_left),
                        contentDescription = "Back",
                        modifier = Modifier.size(20.dp)
                    )
                }

                Text(
                    text = "Redeemed Coupons",
                    color = Color.Black,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.size(24.dp))
            }
        }) { innerPadding ->
        Column(
            modifier = Modifier
                .padding(innerPadding)
                .background(Color.White)
                .fillMaxSize()
        ) {
            Spacer(modifier = Modifier.height(12.dp))

            // Search Bar
            TextField(
                value = searchQuery,
                onValueChange = { viewModel.onSearchQueryChanged(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                placeholder = {
                    Text(
                        text = "Search coupons...", color = Color.Gray
                    )
                },
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
                                contentDescription = "Clear search",
                                tint = Color.Gray
                            )
                        }
                    }
                },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color(0xFFF5F5F5),
                    unfocusedContainerColor = Color(0xFFF5F5F5),
                    disabledContainerColor = Color(0xFFF5F5F5),
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                    disabledIndicatorColor = Color.Transparent
                ),
                shape = RoundedCornerShape(12.dp),
                singleLine = true
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Filter section
            Box(modifier = Modifier) {
                CouponsFilterSection(
                    onSortClick = { showSortDialog = true },
                    onCategoryClick = { showCategoryDialog = true },
                    onFiltersClick = { showFiltersDialog = true })
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Content
            when (uiState) {
                is RedeemedCouponsUiState.Loading -> {
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
                                text = "Loading your redeemed coupons...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.Gray
                            )
                        }
                    }
                }

                is RedeemedCouponsUiState.Error -> {
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
                                text = (uiState as RedeemedCouponsUiState.Error).message,
                                style = MaterialTheme.typography.bodyLarge,
                                textAlign = TextAlign.Center,
                                color = Color.Gray
                            )
                            Spacer(modifier = Modifier.height(24.dp))
                            Button(onClick = { viewModel.retry() }) {
                                Text("Try Again")
                            }
                        }
                    }
                }

                is RedeemedCouponsUiState.Success -> {
                    if (filteredCoupons.isEmpty()) {
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
                                    text = "No redeemed coupons yet",
                                    style = MaterialTheme.typography.titleMedium,
                                    color = Color.Black
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Redeem your favorite coupons to see them here!",
                                    style = MaterialTheme.typography.bodyMedium,
                                    textAlign = TextAlign.Center,
                                    color = Color.Gray
                                )
                            }
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(16.dp),
                            contentPadding = PaddingValues(16.dp)
                        ) {
                            items(
                                count = filteredCoupons.size,
                                key = { index -> filteredCoupons[index].id }) { index ->
                                val coupon = filteredCoupons[index]

                                CouponCard(
                                    brandName = coupon.brandName.uppercase().replace(" ", "\n"),
                                    couponTitle = coupon.couponTitle,
                                    description = coupon.description ?: "",
                                    category = coupon.category,
                                    expiryDays = coupon.daysUntilExpiry,
                                    couponCode = coupon.couponCode ?: "",
                                    couponId = coupon.id,
                                    isRedeemed = true, // Always true since we're only showing redeemed ones
                                    isSaved = false,
                                    showGreenRedeemedButton = true, // Show green button in redeemed screen
                                    onDetailsClick = {
                                        navController.navigate(
                                            Route.CouponDetails.createRoute(
                                                couponId = coupon.id,
                                                isPrivate = true,
                                                couponCode = coupon.couponCode ?: "WELCOME100"
                                            )
                                        )
                                    },
                                    onDiscoverClick = {
                                        try {
                                            val intent = Intent().apply {
                                                action = "com.ayaan.couponviewer.SHOW_COUPON"
                                                putExtra(
                                                    "EXTRA_COUPON_CODE",
                                                    coupon.couponCode?.takeIf { it.isNotEmpty() }
                                                        ?: "NO CODE")
                                                putExtra(
                                                    "EXTRA_COUPON_TITLE",
                                                    coupon.couponTitle?.takeIf { it.isNotEmpty() }
                                                        ?: "Special Offer")
                                                putExtra(
                                                    "EXTRA_DESCRIPTION",
                                                    coupon.description?.takeIf { it.isNotEmpty() }
                                                        ?: "Check app for details")
                                                putExtra(
                                                    "EXTRA_BRAND_NAME",
                                                    coupon.brandName?.takeIf { it.isNotEmpty() }
                                                        ?: "Dealora")
                                                putExtra(
                                                    "EXTRA_CATEGORY",
                                                    coupon.category?.takeIf { it.isNotEmpty() }
                                                        ?: "General")
                                                coupon.daysUntilExpiry?.let {
                                                    putExtra("EXTRA_EXPIRY_DATE", "$it days")
                                                } ?: putExtra(
                                                    "EXTRA_EXPIRY_DATE",
                                                    "Check app for expiry"
                                                )
                                                putExtra(
                                                    "EXTRA_MINIMUM_ORDER",
                                                    coupon.minimumOrderValue?.takeIf { it.isNotEmpty() }
                                                        ?: "No minimum")
                                                putExtra(
                                                    "EXTRA_COUPON_LINK",
                                                    coupon.couponLink?.takeIf { it.isNotEmpty() }
                                                        ?: "")
                                                putExtra(
                                                    "EXTRA_SOURCE_PACKAGE",
                                                    context.packageName
                                                )
                                                setPackage("com.ayaan.couponviewer")
                                                addCategory(Intent.CATEGORY_DEFAULT)
                                            }

                                            context.startActivity(intent)
                                        } catch (e: Exception) {
                                            Log.e(
                                                "RedeemedCoupons",
                                                "Failed to open CouponViewer: ${e.message}"
                                            )
                                            try {
                                                val playStoreIntent =
                                                    Intent(Intent.ACTION_VIEW).apply {
                                                        data =
                                                            Uri.parse("https://play.google.com/store/apps/details?id=com.ayaan.couponviewer")
                                                        setPackage("com.android.vending")
                                                    }
                                                context.startActivity(playStoreIntent)
                                            } catch (e2: Exception) {
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
