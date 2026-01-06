package com.ayaan.dealora.ui.presentation.addcoupon.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.Icon
import androidx.compose.material3.MenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.DealoraBackground
import com.ayaan.dealora.ui.theme.DealoraPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CouponDropdown(
    label: String,
    value: String,
    options: List<String>,
    onValueChange: (String) -> Unit,
    isRequired: Boolean
) {
    var expanded by rememberSaveable { mutableStateOf(false) }

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Black
            )
            if (isRequired) {
                Text(
                    text = " *", fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Color.Red
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        ExposedDropdownMenuBox(
            expanded = expanded, onExpandedChange = { expanded = it },
        ) {
            OutlinedTextField(
                value = value,
                onValueChange = {},
                readOnly = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(),
                trailingIcon = {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Dropdown",
                        tint = Color.Gray
                    )
                },
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = DealoraBackground,
                    unfocusedContainerColor = DealoraBackground,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent,
                ),
                shape = RoundedCornerShape(8.dp),
                singleLine = true
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                containerColor = DealoraBackground,
                modifier= Modifier.height(140.dp)) {
                options.forEach { option ->
                    val isSelected = option == value
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = option,
                                color = if (isSelected) DealoraPrimary else Color.Black,
                                fontWeight = if (isSelected) FontWeight.Medium else FontWeight.Normal
                            )
                        },
                        onClick = {
                            onValueChange(option)
                            expanded = false
                        },
                        colors = MenuDefaults.itemColors(
                            textColor = if (isSelected) DealoraPrimary else Color.Black
                        ),
                        modifier = Modifier.background(
                            if (isSelected) DealoraPrimary.copy(alpha = 0.1f) else Color.Transparent
                        ),
                        contentPadding = PaddingValues(vertical = 1.dp, horizontal = 12.dp)
                    )
                }
            }
        }
    }
}