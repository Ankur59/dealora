package com.ayaan.dealora.ui.presentation.couponsList.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryBottomSheet(
    currentCategory: String? = null,
    onDismiss: () -> Unit,
    onCategorySelected: (String?) -> Unit
) {
    var selectedCategory by remember { mutableStateOf(currentCategory) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

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
                    text = "Categories",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.Black
                )
                IconButton(
                    onClick = onDismiss
                ) {
                    Icon(
                        painter = painterResource(id = android.R.drawable.ic_menu_close_clear_cancel),
                        contentDescription = "Close",
                        tint = Color.Black
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Category Grid
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // First Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    CategoryItem(
                        name = "Food",
                        imageRes = R.drawable.category_food,
                        isSelected = selectedCategory == "Food",
                        onClick = {
                            selectedCategory = if (selectedCategory == "Food") null else "Food"
                        }
                    )
                    CategoryItem(
                        name = "Fashion",
                        imageRes = R.drawable.category_fashion,
                        isSelected = selectedCategory == "Fashion",
                        onClick = {
                            selectedCategory = if (selectedCategory == "Fashion") null else "Fashion"
                        }
                    )
                    CategoryItem(
                        name = "Grocery",
                        imageRes = R.drawable.category_grocery,
                        isSelected = selectedCategory == "Grocery",
                        onClick = {
                            selectedCategory = if (selectedCategory == "Grocery") null else "Grocery"
                        }
                    )
                    CategoryItem(
                        name = "Wallet Rewards",
                        imageRes = R.drawable.category_wallet,
                        isSelected = selectedCategory == "Wallet Rewards",
                        onClick = {
                            selectedCategory = if (selectedCategory == "Wallet Rewards") null else "Wallet Rewards"
                        }
                    )
                }

                // Second Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    CategoryItem(
                        name = "Beauty",
                        imageRes = R.drawable.category_beauty,
                        isSelected = selectedCategory == "Beauty",
                        onClick = {
                            selectedCategory = if (selectedCategory == "Beauty") null else "Beauty"
                        }
                    )
                    CategoryItem(
                        name = "Travel",
                        imageRes = R.drawable.category_travel,
                        isSelected = selectedCategory == "Travel",
                        onClick = {
                            selectedCategory = if (selectedCategory == "Travel") null else "Travel"
                        }
                    )
                    CategoryItem(
                        name = "Entertainment",
                        imageRes = R.drawable.category_entertainment,
                        isSelected = selectedCategory == "Entertainment",
                        onClick = {
                            selectedCategory = if (selectedCategory == "Entertainment") null else "Entertainment"
                        }
                    )
                    CategoryItemSeeAll(
                        isSelected = selectedCategory == "See All",
                        onClick = {
                            selectedCategory = if (selectedCategory == "See All") null else "See All"
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Done Button
            Button(
                onClick = {
                    onCategorySelected(selectedCategory)
                    onDismiss()
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 24.dp)
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

@Composable
private fun CategoryItem(
    name: String,
    imageRes: Int,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(80.dp)
            .clickable { onClick() }
    ) {
        Box(
            modifier = Modifier.size(64.dp),
            contentAlignment = Alignment.Center
        ) {
            // Selection indicator background
            if (isSelected) {
                Box(
                    modifier = Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF6C5CE7).copy(alpha = 0.1f))
                )
            }

            Image(
                painter = painterResource(id = imageRes),
                contentDescription = name,
                modifier = Modifier.size(64.dp)
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = name,
            fontSize = 12.sp,
            color = if (isSelected) Color(0xFF6C5CE7) else Color.Black,
            textAlign = TextAlign.Center,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.W500,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun CategoryItemSeeAll(
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(80.dp)
            .clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(DealoraPrimary),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "See All",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = DealoraWhite,
                textAlign = TextAlign.Center
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Empty space for alignment
        Text(
            text = "",
            fontSize = 12.sp
        )
    }
}