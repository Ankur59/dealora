package com.ayaan.dealora.ui.presentation.common.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraTextGray
import com.ayaan.dealora.ui.theme.DealoraWhite

@Composable
fun SearchBar(){
    // Search Bar
    OutlinedTextField(
        value = "",
        onValueChange = {},
        placeholder = {
            Text(
                "Search Coupons", color = DealoraTextGray, fontSize = 14.sp
            )
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = "Search",
                tint = DealoraTextGray
            )
        },
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedContainerColor = DealoraWhite,
            focusedContainerColor = DealoraWhite,
            unfocusedBorderColor = Color(0xFFE0E0E0),
            focusedBorderColor = DealoraPrimary
        )
    )
}