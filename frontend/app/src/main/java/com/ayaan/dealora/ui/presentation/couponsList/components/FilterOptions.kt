package com.ayaan.dealora.ui.presentation.couponsList.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
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
) {
    /**
     * Convert UI discount type label to API value
     */
    fun getDiscountTypeApiValue(): String? {
        return when (discountType) {
            "Percentage Off (% Off)" -> "Percentage Off"
            else -> discountType // Others match exactly
        }
    }

    /**
     * Convert UI price label to API value
     */
    fun getPriceApiValue(): String? {
        return when (price) {
            "No Minimum Order" -> "no_minimum"
            "Minimum Order Below ₹300" -> "below_300"
            "₹300-₹700" -> "300_700"
            "₹700-₹1500" -> "700_1500"
            "Above ₹1500" -> "above_1500"
            else -> null
        }
    }

    /**
     * Convert UI validity label to API value
     */
    fun getValidityApiValue(): String? {
        return when (validity) {
            "Valid Today" -> "valid_today"
            "Valid This Week" -> "valid_this_week"
            "Valid This Month" -> "valid_this_month"
            "Expired" -> "expired"
            else -> null
        }
    }
}

enum class FilterCategory {
    DISCOUNT_TYPE,
    PRICE,
    VALIDITY,
    BRAND,
    CATEGORY
}

@OptIn(ExperimentalMaterial3Api::class)
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

    var selectedFilterCategory by remember { mutableStateOf(FilterCategory.DISCOUNT_TYPE) }

    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scrollState = rememberScrollState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Color(0xD9D9D9).copy(alpha = 0.58f),
        shape = RoundedCornerShape(topStart = 41.dp, topEnd = 41.dp),
        dragHandle = null
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(828.dp)
                .background(
                    color = Color.White,
                    shape = RoundedCornerShape(topStart = 41.dp, topEnd = 41.dp)
                )
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 24.dp, end = 24.dp, top = 50.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Filters",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color(0xFF1E1E1E)
                )
                IconButton(
                    onClick = onDismiss,
                    modifier = Modifier.size(31.dp)
                ) {
                    Icon(
                        painter = painterResource(id = android.R.drawable.ic_menu_close_clear_cancel),
                        contentDescription = "Close",
                        tint = Color.Black,
                        modifier = Modifier.size(31.dp)
                    )
                }
            }

            // Main content with sidebar and options
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 100.dp)
            ) {
                // Left sidebar with filter category buttons
                Column(
                    modifier = Modifier.width(142.dp), // 24dp left padding + 118dp button width
                    verticalArrangement = Arrangement.spacedBy(0.dp)
                ) {
                    FilterCategoryButton(
                        text = "Discount Type",
                        isSelected = selectedFilterCategory == FilterCategory.DISCOUNT_TYPE,
                        onClick = { selectedFilterCategory = FilterCategory.DISCOUNT_TYPE },
                        modifier = Modifier.padding(start = 24.dp, top = 0.dp)
                    )
                    FilterCategoryButton(
                        text = "Price",
                        isSelected = selectedFilterCategory == FilterCategory.PRICE,
                        onClick = { selectedFilterCategory = FilterCategory.PRICE },
                        modifier = Modifier.padding(start = 24.dp, top = 8.dp)
                    )
                    FilterCategoryButton(
                        text = "Validity",
                        isSelected = selectedFilterCategory == FilterCategory.VALIDITY,
                        onClick = { selectedFilterCategory = FilterCategory.VALIDITY },
                        modifier = Modifier.padding(start = 24.dp, top = 8.dp)
                    )
                    FilterCategoryButton(
                        text = "Brand",
                        isSelected = selectedFilterCategory == FilterCategory.BRAND,
                        onClick = { selectedFilterCategory = FilterCategory.BRAND },
                        modifier = Modifier.padding(start = 24.dp, top = 8.dp)
                    )
                    FilterCategoryButton(
                        text = "Category",
                        isSelected = selectedFilterCategory == FilterCategory.CATEGORY,
                        onClick = { selectedFilterCategory = FilterCategory.CATEGORY },
                        modifier = Modifier.padding(start = 24.dp, top = 8.dp)
                    )
                }

                // Right content area
                Box(
                    modifier = Modifier
                        .weight(1f)
                ) {
                    // Light purple background - positioned to start right after sidebar
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(end = 24.dp)
                            .fillMaxHeight()
                            .background(
                                color = Color(0xFFE8E4F8).copy(alpha = 0.6f),
                                shape = RoundedCornerShape(0.dp)
                            )
                    )

                    // Scrollable options list with proper positioning
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 30.dp, top = 20.dp, end = 24.dp)
                            .verticalScroll(scrollState)
                    ) {
                        when (selectedFilterCategory) {
                            FilterCategory.DISCOUNT_TYPE -> {
                                FilterOptionList(
                                    options = listOf(
                                        "Percentage Off (% Off)",
                                        "Flat Discount",
                                        "Cashback",
                                        "Buy 1 Get 1",
                                        "Free Delivery",
                                        "Wallet/UPI Offers",
                                        "Prepaid Only Offers",
                                        "Saved Coupons"
                                    ),
                                    selectedOption = selectedDiscountType,
                                    onOptionSelected = { selectedDiscountType = it }
                                )
                            }
                            FilterCategory.PRICE -> {
                                FilterOptionList(
                                    options = listOf(
                                        "No Minimum Order",
                                        "Minimum Order Below ₹300",
                                        "₹300–₹700",
                                        "₹700–₹1500",
                                        "Above ₹1500"
                                    ),
                                    selectedOption = selectedPrice,
                                    onOptionSelected = { selectedPrice = it }
                                )
                            }
                            FilterCategory.VALIDITY -> {
                                FilterOptionList(
                                    options = listOf(
                                        "Valid Today",
                                        "Valid This Week",
                                        "Valid This Month",
                                        "Expired"
                                    ),
                                    selectedOption = selectedValidity,
                                    onOptionSelected = { selectedValidity = it }
                                )
                            }
                            FilterCategory.BRAND -> {
                                FilterOptionList(
                                    options = listOf(
                                        "Zomato",
                                        "Swiggy",
                                        "Myntra",
                                        "Amazon",
                                        "Nykaa",
                                        "Ajio",
                                        "Flipkart",
                                        "Uber",
                                        "Croma",
                                        "Mamaearth"
                                    ),
                                    selectedOption = selectedBrand,
                                    onOptionSelected = { selectedBrand = it }
                                )
                            }
                            FilterCategory.CATEGORY -> {
                                FilterOptionList(
                                    options = listOf(
                                        "See all",
                                        "Food",
                                        "Fashion",
                                        "Beauty",
                                        "Electronics",
                                        "Travel",
                                        "Grocery",
                                        "Entertainment"
                                    ),
                                    selectedOption = selectedCategory,
                                    onOptionSelected = { selectedCategory = it }
                                )
                            }
                        }
                    }
                }
            }

            // Footer with coupon count and Done button
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 32.dp)
                    .align(Alignment.BottomCenter)
            ) {
//                Text(
//                    text = "50+ Coupons",
//                    fontSize = 16.sp,
//                    fontWeight = FontWeight.Medium,
//                    color = DealoraPrimary,
//                    modifier = Modifier
//                        .align(Alignment.CenterHorizontally)
//                        .padding(bottom = 16.dp)
//                )

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
                        .height(59.dp)
                        .padding(horizontal = 24.dp),
                    shape = RoundedCornerShape(17.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = DealoraPrimary
                    )
                ) {
                    Text(
                        text = "Done",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun FilterCategoryButton(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .width(118.dp)
            .height(49.dp)
            .background(
                color = if (isSelected) DealoraPrimary else Color(0xFFECECEC),
                shape = RoundedCornerShape(5.dp)
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = if (isSelected) Color.White else Color(0xFF626262),
            lineHeight = 61.sp // Match Figma line height
        )
    }
}

@Composable
private fun FilterOptionList(
    options: List<String>,
    selectedOption: String?,
    onOptionSelected: (String?) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(0.dp)
    ) {
        options.forEachIndexed { index, option ->
            FilterOptionItem(
                text = option,
                isSelected = selectedOption == option,
                onClick = { onOptionSelected(if (selectedOption == option) null else option) }
            )
            if (index < options.size - 1) {
                Spacer(modifier = Modifier.height(0.dp))
            }
        }
    }
}

@Composable
private fun FilterOptionItem(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
            .padding(end = 16.dp)
            .clickable(onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Start
    ) {
        // Radio button indicator
        Box(
            modifier = Modifier
                .size(20.dp),
            contentAlignment = Alignment.Center
        ) {
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .background(
                            color = DealoraPrimary,
                            shape = CircleShape
                        )
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .border(
                            width = 1.5.dp,
                            color = Color(0xFF9E9E9E),
                            shape = CircleShape
                        )
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Text(
            text = text,
            fontSize = 15.sp,
            fontWeight = FontWeight.Normal,
            color = Color(0xFF1E1E1E)
        )
    }
}