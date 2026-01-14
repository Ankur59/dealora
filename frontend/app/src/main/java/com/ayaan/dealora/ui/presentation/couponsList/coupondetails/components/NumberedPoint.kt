package com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.AppColors

@Composable
fun NumberedPoint(number: Int, text: String) {
    Row(
        modifier = Modifier.padding(vertical = 4.dp)
    ) {
        Text(
            text = "$number. ",
            fontSize = 14.sp,
            color = AppColors.PrimaryText,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = text, fontSize = 14.sp, color = AppColors.SecondaryText, lineHeight = 20.sp
        )
    }
}
