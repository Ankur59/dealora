package com.ayaan.dealora.ui.presentation.categories

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.common.components.CouponCard
import com.ayaan.dealora.ui.presentation.couponsList.components.CouponsListTopBar
import com.ayaan.dealora.ui.presentation.navigation.Route
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun CategoriesScreen(
    navController: NavController,
    viewModel: CategoriesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            CouponsListTopBar(
                searchQuery = searchQuery,
                onSearchQueryChanged = { 
                    searchQuery = it
                    viewModel.onSearchQueryChanged(it)
                },
                onBackClick = { navController.popBackStack() },
                isPublicMode = uiState.isPublicMode,
                onPublicModeChanged = { viewModel.onPublicModeChanged(it) },
                showModeSwitch = true
            )
        },
        containerColor = Color.White
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = DealoraPrimary
                )
            } else if (uiState.errorMessage != null) {
                Text(
                    text = uiState.errorMessage!!,
                    color = Color.Red,
                    modifier = Modifier.align(Alignment.Center).padding(16.dp)
                )
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 16.dp)
                ) {
                    uiState.categoryGroups.forEach { group ->
                        item {
                            CategoryHeader(group.name, group.totalCount)
                        }
                        
                        items(group.coupons) { coupon ->
                            CouponCard(
                                brandName = coupon.brandName?.uppercase()?.replace(" ", "\n") ?: "DEALORA",
                                couponTitle = coupon.couponTitle ?: "Special Offer",
                                description = coupon.description ?: "",
                                category = coupon.category,
                                expiryDays = coupon.daysUntilExpiry,
                                couponId = coupon.id,
                                showActionButtons = false,
                                onDetailsClick = {
                                    navController.navigate(
                                        Route.CouponDetails.createRoute(
                                            couponId = coupon.id, isPrivate = false
                                        )
                                    )
                                }
                            )
                        }
                        
                        item {
                            Spacer(modifier = Modifier.height(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CategoryHeader(name: String, count: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = name,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.Black
        )
        Text(
            text = "$count coupons",
            fontSize = 14.sp,
            color = DealoraPrimary,
            fontWeight = FontWeight.Medium
        )
    }
}
