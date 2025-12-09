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
import com.ayaan.dealora.ui.theme.*

@Composable
fun AddCoupons(navController: NavController) {
    var couponName by remember { mutableStateOf("Buy one Get one") }
    var description by remember { mutableStateOf("Get Extra 10% off on mcaffine Bodywash, lotion and many more.") }
    var expiryDate by remember { mutableStateOf("22.11.2025") }
    var selectedCategory by remember { mutableStateOf("Food") }
    var selectedUsageMethod by remember { mutableStateOf("Both") }
    var couponCode by remember { mutableStateOf("678544") }
    var visitingLink by remember { mutableStateOf("https://in.images.search.google.com/sea") }
    var couponDetails by remember { mutableStateOf("Details") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        // Top Bar
        AddCouponTopBar(
            onBackClick = { navController.navigateUp() })

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
                        options = listOf("Food", "Fashion", "Grocery", "Beauty", "Entertainment"),
                        onValueChange = { selectedCategory = it },
                        isRequired = false
                    )
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Use Coupon Via
            UseCouponViaSection(
                selectedMethod = selectedUsageMethod, onMethodChange = { selectedUsageMethod = it })

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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddCouponTopBar(onBackClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(DealoraPrimary)
            .padding(horizontal = 16.dp, vertical = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onBackClick, modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Add your Coupons ",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Box(
                        modifier = Modifier
                            .background(
                                color = Color.White.copy(alpha = 0.3f),
                                shape = RoundedCornerShape(6.dp)
                            )
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "Manually",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White
                        )
                    }
                }

                Text(
                    text = "Your selected apps are being synced individually.\nPlease wait until all apps are fully synced.",
                    fontSize = 11.sp,
                    color = Color.White.copy(alpha = 0.9f),
                    lineHeight = 14.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}

@Composable
fun CouponInputField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    isRequired: Boolean,
    minLines: Int = 1
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Black
            )
            if (isRequired) {
                Text(
                    text = " *", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Red
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        TextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = if (minLines > 1) 100.dp else 50.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color(0xFFF5F5F5),
                unfocusedContainerColor = Color(0xFFF5F5F5),
                disabledContainerColor = Color(0xFFF5F5F5),
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
            ),
            shape = RoundedCornerShape(8.dp),
            minLines = minLines
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CouponDatePicker(
    label: String, value: String, onValueChange: (String) -> Unit, isRequired: Boolean
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Black
            )
            if (isRequired) {
                Text(
                    text = " *", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Red
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            leadingIcon = {
                Icon(
                    painter = painterResource(id = R.drawable.solar_calendar_linear),
                    contentDescription = "Calendar",
                    modifier = Modifier.size(20.dp),
                    tint = Color.Gray
                )
            },
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color(0xFFF5F5F5),
                unfocusedContainerColor = Color(0xFFF5F5F5),
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
            ),
            shape = RoundedCornerShape(8.dp),
            singleLine = true
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CouponDropdown(
    label: String,
    value: String,
    options: List<String>,
    onValueChange: (String) -> Unit,
    isRequired: Boolean
) {
    var expanded by remember { mutableStateOf(false) }

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Black
            )
            if (isRequired) {
                Text(
                    text = " *", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Red
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        ExposedDropdownMenuBox(
            expanded = expanded, onExpandedChange = { expanded = it }) {
            OutlinedTextField(
                value = value,
                onValueChange = {},
                readOnly = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                trailingIcon = {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Dropdown",
                        tint = Color.Gray
                    )
                },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color(0xFFF5F5F5),
                    unfocusedContainerColor = Color(0xFFF5F5F5),
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                ),
                shape = RoundedCornerShape(8.dp),
                singleLine = true
            )

            ExposedDropdownMenu(
                expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { option ->
                    DropdownMenuItem(text = { Text(option) }, onClick = {
                        onValueChange(option)
                        expanded = false
                    })
                }
            }
        }
    }
}

@Composable
fun UseCouponViaSection(
    selectedMethod: String, onMethodChange: (String) -> Unit
) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Use Coupon Via",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color.Black
            )
            Text(
                text = " *", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Red
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    color = Color(0xFFF5F5F5), shape = RoundedCornerShape(8.dp)
                )
                .clickable { /* Open bottom sheet or dialog */ }
                .padding(horizontal = 16.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = selectedMethod, fontSize = 14.sp, color = Color.Black
            )
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = "Select",
                tint = Color.Gray,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

@Composable
fun CouponPreviewCard(
    couponName: String,
    description: String,
    expiryDate: String,
    couponCode: String,
    isRedeemed: Boolean
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = DealoraPrimary, shape = RoundedCornerShape(12.dp)
            )
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top
        ) {
            // Left side - Icon and details
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(
                            color = Color.White.copy(alpha = 0.2f), shape = CircleShape
                        ), contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "B",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Column {
                    Text(
                        text = couponName,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "Expiry date: $expiryDate",
                        fontSize = 11.sp,
                        color = Color.White.copy(alpha = 0.9f),
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }

            // Right side - Icons
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(
                    painter = painterResource(id = R.drawable.solar_calendar_linear),
                    contentDescription = "Copy",
                    tint = Color.White,
                    modifier = Modifier.size(18.dp)
                )
                Box(
                    modifier = Modifier
                        .background(
                            color = Color.White.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Manually Added",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                }
            }
        }

        // Bottom section
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 60.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Bottom
        ) {
            Column {
                Text(
                    text = description,
                    fontSize = 11.sp,
                    color = Color.White.copy(alpha = 0.9f),
                    lineHeight = 14.sp,
                    modifier = Modifier.width(200.dp)
                )

                Row(
                    modifier = Modifier.padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Details",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                        modifier = Modifier
                            .background(
                                color = Color.White.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                    Text(
                        text = if (isRedeemed) "Redeemed" else "Unredeemed",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White,
                        modifier = Modifier
                            .background(
                                color = Color.White.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(4.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }

            Button(
                onClick = { /* Discover action */ },
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White
                ),
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                modifier = Modifier.height(36.dp)
            ) {
                Text(
                    text = "Discover",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = DealoraPrimary
                )
            }
        }
    }
}