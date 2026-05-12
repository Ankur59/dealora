package com.ayaan.couponviewer.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.ayaan.couponviewer.data.models.CouponData
import com.ayaan.couponviewer.ui.components.*

@Composable
fun CouponViewerScreen(
    couponData: CouponData,
    onRedeemClick: () -> Unit,
    onShareClick: () -> Unit,
    onCopyClick: () -> Unit
) {
    val scrollState = rememberScrollState()
    var termsExpanded by remember { mutableStateOf(false) }
    var showCopyFeedback by remember { mutableStateOf(false) }
    
    val snackbarHostState = remember { SnackbarHostState() }
    
    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = {
            ActionButtons(
                onShareClick = onShareClick,
                onRedeemClick = onRedeemClick
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(scrollState)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Header
            CouponHeader(
                brandName = couponData.brandName,
                brandInitial = couponData.getBrandInitial(),
                category = couponData.category,
                expiryDate = couponData.expiryDate
            )
            
            // Offer details
            DetailsSection(
                title = couponData.title,
                description = couponData.description,
                discountText = couponData.getDiscountText(),
                minimumOrder = couponData.minimumOrder
            )
            
            // Coupon code
            CouponCodeCard(
                couponCode = couponData.couponCode,
                onCopyClick = {
                    onCopyClick()
                    showCopyFeedback = true
                }
            )
            
            // Terms
            if (!couponData.terms.isNullOrBlank()) {
                TermsSection(
                    terms = couponData.terms,
                    isExpanded = termsExpanded,
                    onToggle = { termsExpanded = !termsExpanded }
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
        }
        
        // Copy feedback snackbar logic
        LaunchedEffect(showCopyFeedback) {
            if (showCopyFeedback) {
                snackbarHostState.showSnackbar(
                    message = "Code copied!",
                    duration = SnackbarDuration.Short,
                    withDismissAction = true
                )
                showCopyFeedback = false
            }
        }
    }
}
