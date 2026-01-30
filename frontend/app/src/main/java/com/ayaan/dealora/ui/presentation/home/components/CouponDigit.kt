package com.ayaan.dealora.ui.presentation.home.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.DealoraWhite

@Composable
fun CouponDigit(digit: String) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .background(
                DealoraWhite.copy(alpha = 0.2f),
                RoundedCornerShape(8.dp)
            )
            .border(
                1.dp,
                DealoraWhite.copy(alpha = 0.3f),
                RoundedCornerShape(8.dp)
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = digit,
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            color = DealoraWhite
        )
    }
}
