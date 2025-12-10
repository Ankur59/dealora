package com.ayaan.dealora.ui.presentation.addcoupon.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.ContainerColorFocused
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraRed

@Composable
fun UseCouponViaSection(
    selectedMethod: String,
    onMethodChange: (String) -> Unit
) {
    var isExpanded by remember { mutableStateOf(false) }
    val options = listOf("Coupon Code", "Coupon Visiting Link", "Both")

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Use Coupon Via",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color.Black
            )
            Text(
                text = " *",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = DealoraRed
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Main selector button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(ContainerColorFocused)
                .clickable { isExpanded = !isExpanded }
                .padding(horizontal = 16.dp, vertical = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = selectedMethod.ifEmpty { "Select method" },
                fontSize = 14.sp,
                color = if (selectedMethod.isEmpty()) Color.Gray else Color.Black,
                modifier = Modifier.weight(1f)
            )
            Icon(
                imageVector = Icons.Default.KeyboardArrowRight,
                contentDescription = "Expand",
                modifier = Modifier.rotate(if (isExpanded) 90f else 0f),
                tint = Color.Gray
            )
        }

        // Dropdown options
        AnimatedVisibility(
            visible = isExpanded,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(ContainerColorFocused)
            ) {
                options.forEach { option ->
                    val isSelected = option == selectedMethod
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onMethodChange(option)
                                isExpanded = false
                            }
                            .background(
                                if (isSelected) DealoraPrimary.copy(alpha = 0.1f)
                                else Color.Transparent
                            )
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = option,
                            fontSize = 14.sp,
                            color = if (isSelected) DealoraPrimary else Color.Black,
                            fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal
                        )
                    }
                }
            }
        }
    }
}