package com.ayaan.couponviewer.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ayaan.couponviewer.data.models.CouponData
import com.ayaan.couponviewer.ui.components.CouponCard
import com.ayaan.couponviewer.ui.theme.CouponViewerColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RewardsScreen(
    coupons: List<CouponData>,
    onCouponClick: (Int) -> Unit,
    onBackClick: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Rewards",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = CouponViewerColors.Primary,
                    titleContentColor = CouponViewerColors.Background,
                    navigationIconContentColor = CouponViewerColors.Background
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Text(
                    text = "Available Coupons",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = CouponViewerColors.TextPrimary,
                    modifier = Modifier.padding(bottom = 8.dp)
                )
            }

            itemsIndexed(coupons) { index, coupon ->
                CouponCard(
                    coupon = coupon,
                    onClick = { onCouponClick(index) }
                )
            }

            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
