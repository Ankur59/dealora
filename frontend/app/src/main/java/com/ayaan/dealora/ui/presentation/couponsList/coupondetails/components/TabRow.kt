package com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow.Companion.Ellipsis
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.AppColors
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun TabRow(
    selectedTab: Int, tabs: List<String>, onTabSelected: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        tabs.forEachIndexed { index, tab ->
            Button(
                onClick = { onTabSelected(index) }, colors = ButtonDefaults.buttonColors(
                    containerColor = if (selectedTab == index) DealoraPrimary else Color(
                        0xFFE0E0E0
                    ),
                    contentColor = if (selectedTab == index) Color.White else AppColors.SecondaryText
                ), shape = RoundedCornerShape(20.dp), modifier = Modifier.wrapContentSize(),
                contentPadding = PaddingValues(12.dp)
            ) {
                Text(
                    text = tab, fontSize = 13.sp, fontWeight = FontWeight.Normal,
                    maxLines = 1,
                    overflow = Ellipsis,
                )
            }
        }
    }
}
