package com.ayaan.dealora.ui.presentation.couponsList.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.DealoraPrimary

data class FilterOptions(
    val discountType: String? = null,
    val price: String? = null,
    val validity: String? = null,
    val brand: String? = null,
    val category: String? = null
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun FiltersBottomSheet(
    currentFilters: FilterOptions = FilterOptions(),
    onDismiss: () -> Unit,
    onApplyFilters: (FilterOptions) -> Unit
) {
    var selectedDiscountType by remember { mutableStateOf(currentFilters.discountType) }
    var selectedPrice by remember { mutableStateOf(currentFilters.price) }
    var selectedValidity by remember { mutableStateOf(currentFilters.validity) }
    var selectedBrand by remember { mutableStateOf(currentFilters.brand) }
    var selectedCategory by remember { mutableStateOf(currentFilters.category) }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scrollState = rememberScrollState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color.White,
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(top = 12.dp, bottom = 8.dp)
                    .width(40.dp)
                    .height(4.dp)
                    .background(
                        color = Color(0xFFE0E0E0),
                        shape = RoundedCornerShape(2.dp)
                    )
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Filters",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black
                )
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier
                ) {
                    Icon(
                        painter = painterResource(id = android.R.drawable.ic_menu_close_clear_cancel),
                        contentDescription = "Close",
                        tint = Color.Black
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Scrollable content
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f, fill = false)
                    .verticalScroll(scrollState)
                    .padding(horizontal = 24.dp)
            ) {
                // Discount Type Section
                FilterSection(
                    title = "Discount Type",
                    options = listOf("Percentage Off (%)", "Flat Discount", "Cashback", "Buy 1 Get 1", "Free Delivery", "Wallet/UPI Offers", "Prepaid Only Offers", "Saved Coupons"),
                    selectedOption = selectedDiscountType,
                    onOptionSelected = { selectedDiscountType = it }
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Price Section
                FilterSection(
                    title = "Price",
                    options = listOf("No Minimum Order", "Minimum Order Below ₹300", "₹300-₹700", "₹700-₹1500", "Above ₹1500"),
                    selectedOption = selectedPrice,
                    onOptionSelected = { selectedPrice = it }
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Validity Section
                FilterSection(
                    title = "Validity",
                    options = listOf("Valid Today", "Valid This Week", "Valid This Month", "Expired"),
                    selectedOption = selectedValidity,
                    onOptionSelected = { selectedValidity = it }
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Brand Section
                FilterSection(
                    title = "Brand",
                    options = listOf("Zomato", "Swiggy", "Myntra", "Amazon", "Nykaa", "Ajio", "Flipkart", "Uber", "Croma", "Manswearth"),
                    selectedOption = selectedBrand,
                    onOptionSelected = { selectedBrand = it }
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Category Section
                FilterSection(
                    title = "Category",
                    options = listOf("See All", "Food", "Fashion", "Beauty", "Electronics", "Travel", "Grocery", "Entertainment"),
                    selectedOption = selectedCategory,
                    onOptionSelected = { selectedCategory = it }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Footer with coupon count and button
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
            ) {
//                Text(
//                    text = "50+ Coupons",
//                    fontSize = 14.sp,
//                    color = Color(0xFF6C5CE7),
//                    fontWeight = FontWeight.Medium,
//                    modifier = Modifier.align(Alignment.CenterHorizontally)
//                )

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = {
                        onApplyFilters(
                            FilterOptions(
                                discountType = selectedDiscountType,
                                price = selectedPrice,
                                validity = selectedValidity,
                                brand = selectedBrand,
                                category = selectedCategory
                            )
                        )
                        onDismiss()
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = DealoraPrimary
                    )
                ) {
                    Text(
                        text = "Done",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FilterSection(
    title: String,
    options: List<String>,
    selectedOption: String?,
    onOptionSelected: (String?) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = title,
            fontSize = 16.sp,
            fontWeight = FontWeight.Medium,
            color = Color.Black
        )

        Spacer(modifier = Modifier.height(12.dp))

        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            options.forEach { option ->
                FilterChip(
                    text = option,
                    isSelected = selectedOption == option,
                    onClick = {
                        onOptionSelected(if (selectedOption == option) null else option)
                    }
                )
            }
        }
    }
}

@Composable
private fun FilterChip(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .background(
                color = if (isSelected) Color(0xFF6C5CE7) else Color.White,
                shape = RoundedCornerShape(20.dp)
            )
            .border(
                width = 1.dp,
                color = if (isSelected) Color(0xFF6C5CE7) else Color(0xFFE0E0E0),
                shape = RoundedCornerShape(20.dp)
            )
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 10.dp)
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            color = if (isSelected) Color.White else Color.Gray
        )
    }
}