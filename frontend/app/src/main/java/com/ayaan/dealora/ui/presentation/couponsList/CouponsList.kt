package com.ayaan.dealora.ui.presentation.couponsList

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import androidx.paging.LoadState
import androidx.paging.compose.collectAsLazyPagingItems
import androidx.paging.compose.itemKey
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponListItemCard
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsFilterSection
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsListTopBar
import com.ayaan.dealora.ui.presentation.couponsList.components.SortBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.SortOption
import com.ayaan.dealora.ui.presentation.couponsList.components.FiltersBottomSheet
import com.ayaan.dealora.ui.presentation.couponsList.components.FilterOptions
import com.ayaan.dealora.ui.presentation.couponsList.components.CategoryBottomSheet

@Composable
fun CouponsList(
    navController: NavController,
    viewModel: CouponsListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val coupons = viewModel.couponsFlow.collectAsLazyPagingItems()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val currentSortOption by viewModel.currentSortOption.collectAsState()
    val currentCategory by viewModel.currentCategory.collectAsState()

    var showSortDialog by remember { mutableStateOf(false) }

    var showFiltersDialog by remember { mutableStateOf(false) }
    var currentFilters by remember { mutableStateOf(FilterOptions()) }

    var showCategoryDialog by remember { mutableStateOf(false) }
    LaunchedEffect(Unit){
        viewModel.loadCoupons()
    }
    Scaffold(
        containerColor = Color.White,
        topBar = {
            CouponsListTopBar(
                searchQuery = searchQuery,
                onSearchQueryChanged = { query ->
                    viewModel.onSearchQueryChanged(query)
                },
                onBackClick = {
                    navController.popBackStack()
                }
            )
        }
    ) { innerPadding ->
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
                    onFiltersClick = { showFiltersDialog = true }
                )
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
                        onRetry = { viewModel.retry() }
                    )
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
                                message = errorMessage,
                                onRetry = { coupons.retry() }
                            )
                        }
                        is LoadState.NotLoading -> {
                            if (coupons.itemCount == 0) {
                                EmptyContent()
                            } else {
                                // Coupon cards stretch edge-to-edge with 16dp vertical spacing
                                LazyColumn(
                                    modifier = Modifier.fillMaxSize()
                                        .padding(start = 54.dp),
                                    verticalArrangement = Arrangement.spacedBy(16.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    items(
                                        count = coupons.itemCount,
                                        key = coupons.itemKey { it.id }
                                    ) { index ->
                                        val coupon = coupons[index]
                                        if (coupon != null) {
                                            CouponListItemCard(
                                                coupon = coupon,
                                                modifier = Modifier.fillMaxWidth()
                                            )
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
                }
            )
        }

        // Filters Bottom Sheet
        if (showFiltersDialog) {
            FiltersBottomSheet(
                currentFilters = currentFilters,
                onDismiss = { showFiltersDialog = false },
                onApplyFilters = { filters ->
                    currentFilters = filters
                    // TODO: Apply filters logic here
                    // viewModel.applyFilters(filters)
                }
            )
        }

        // Category Bottom Sheet
        if (showCategoryDialog) {
            CategoryBottomSheet(
                currentCategory = currentCategory,
                onDismiss = { showCategoryDialog = false },
                onCategorySelected = { category ->
                    viewModel.onCategoryChanged(category)
                }
            )
        }
    }
}

@Composable
private fun LoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
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
    message: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            Text(
                text = "😕",
                style = MaterialTheme.typography.displayMedium
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
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.padding(24.dp)
        ) {
            Text(
                text = "🎟️",
                style = MaterialTheme.typography.displayMedium
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