package com.ayaan.dealora.ui.presentation.couponsList.coupondetails.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.AppColors

@Composable
fun OfferTitle(title: String, description: String?) {
    Column {
        Text(
            text = title,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        description?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = it, fontSize = 14.sp, color = AppColors.SecondaryText, lineHeight = 20.sp
            )
        }
    }
}
