package com.ayaan.dealora.ui.presentation.addcoupon

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.addcoupon.components.AddCouponTopBar
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponDatePicker
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponDropdown
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponInputField
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponPreviewCard
import com.ayaan.dealora.ui.presentation.addcoupon.components.UseCouponViaSection
import com.ayaan.dealora.ui.theme.*

@Composable
fun AddCoupons(navController: NavController) {
    var couponName by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var expiryDate by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf("") }
    var selectedUsageMethod by remember { mutableStateOf("") }
    var couponCode by remember { mutableStateOf("") }
    var visitingLink by remember { mutableStateOf("") }
    var couponDetails by remember { mutableStateOf("") }
    Scaffold(
        topBar = {
            // Top Bar
            AddCouponTopBar(
                onBackClick = { navController.navigateUp() })
        },
        contentWindowInsets = WindowInsets(0.dp),
        containerColor = DealoraWhite
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color.White)
        ) {
            // Scrollable Content
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 20.dp)
            ) {
                Spacer(modifier = Modifier.height(24.dp))

                // Coupon Name Field
                CouponInputField(
                    label = "Coupon Name",
                    value = couponName,
                    onValueChange = { couponName = it },
                    isRequired = true
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Description Field
                CouponInputField(
                    label = "Description",
                    value = description,
                    onValueChange = { description = it },
                    minLines = 4,
                    isRequired = false
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Expire By and Category Label Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        CouponDatePicker(
                            label = "Expire By",
                            value = expiryDate,
                            onValueChange = { expiryDate = it },
                            isRequired = true
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        CouponDropdown(
                            label = "Category Label",
                            value = selectedCategory,
                            options = listOf(
                                "Food",
                                "Fashion",
                                "Grocery",
                                "Beauty",
                                "Entertainment"
                            ),
                            onValueChange = { selectedCategory = it },
                            isRequired = false
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Use Coupon Via
                UseCouponViaSection(
                    selectedMethod = selectedUsageMethod,
                    onMethodChange = { selectedUsageMethod = it })

                Spacer(modifier = Modifier.height(20.dp))

                // Conditional Fields based on usage method
                when (selectedUsageMethod) {
                    "Coupon Code" -> {
                        CouponInputField(
                            label = "Coupon Code",
                            value = couponCode,
                            onValueChange = { couponCode = it },
                            isRequired = true
                        )
                    }

                    "Coupon Visiting Link" -> {
                        CouponInputField(
                            label = "Coupon Visiting link",
                            value = visitingLink,
                            onValueChange = { visitingLink = it },
                            isRequired = true
                        )
                    }

                    "Both" -> {
                        CouponInputField(
                            label = "Coupon Code",
                            value = couponCode,
                            onValueChange = { couponCode = it },
                            isRequired = true
                        )
                        Spacer(modifier = Modifier.height(20.dp))
                        CouponInputField(
                            label = "Coupon Visiting link",
                            value = visitingLink,
                            onValueChange = { visitingLink = it },
                            isRequired = true
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Coupon Details
                CouponInputField(
                    label = "Coupon Details",
                    value = couponDetails,
                    onValueChange = { couponDetails = it },
                    minLines = 4,
                    isRequired = false
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Review Section
                Text(
                    text = "Review your coupon",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black,
                    modifier = Modifier.padding(bottom = 12.dp)
                )

                CouponPreviewCard(
                    couponName = couponName,
                    description = description,
                    expiryDate = expiryDate,
                    couponCode = couponCode,
                    isRedeemed = false
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Add Coupon Button
                Button(
                    onClick = { /* Add coupon logic */ },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = DealoraPrimary
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "Add Coupon",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}