package com.ayaan.dealora.ui.presentation.couponsList.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraSecondary

@Composable
fun CouponsFilterSection(
    onSortClick: () -> Unit = {},
    onCategoryClick: () -> Unit = {},
    onFiltersClick: () -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(47.dp)
            .padding(horizontal = 12.dp)
            .background(color = DealoraSecondary, shape = RoundedCornerShape(size = 90.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            FilterButton(
                icon = {
                    Icon(
                        painter = painterResource(R.drawable.sort),
                        contentDescription = "Sort",
                        modifier = Modifier.size(16.dp),
                    )
                },
                text = "Sort",
                onClick = onSortClick,
                modifier = Modifier.weight(1f)
            )

            // Vertical Divider
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(24.dp)
                    .background(Color(0xFFE0E0E0))
            )

            // Category Button
            FilterButton(
                icon = {
                    Icon(
                        painter = painterResource(R.drawable.category),
                        contentDescription = "Category",
                        modifier = Modifier.size(16.dp),
                    )
                },
                text = "Category",
                onClick = onCategoryClick,
                modifier = Modifier.weight(1f)
            )

            // Vertical Divider
            Box(
                modifier = Modifier
                    .width(1.dp)
                    .height(24.dp)
                    .background(Color(0xFFE0E0E0))
            )

            // Filters Button
            FilterButton(
                icon = {
                    Icon(
                        painter = painterResource(R.drawable.filter),
                        contentDescription = "Filters",
                        modifier = Modifier.size(16.dp),
                    )
                },
                text = "Filters",
                onClick = onFiltersClick,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun FilterButton(
    icon: @Composable () -> Unit,
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(start = 5.dp, top = 5.dp, end = 5.dp, bottom = 5.dp)
        .background(color = Color.White, shape = RoundedCornerShape(size = 32.dp))
            .padding(start = 10.dp, top = 10.dp, end = 10.dp, bottom = 10.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon()
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = Color(0xFF1E1E1E),
            textAlign = TextAlign.Center,
            lineHeight = 18.sp,
            modifier = Modifier.offset(y = (-1).dp),
        )
    }
}