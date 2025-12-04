package com.ayaan.dealora.ui.presentation.components

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.ui.theme.DealoraRed

@Composable
fun DealoraFieldLabel(
    text: String,
    isRequired: Boolean = false,
    modifier: Modifier = Modifier
) {
    Text(
        text = buildAnnotatedString {
            append(text)
            if (isRequired) {
                withStyle(style = SpanStyle(color = DealoraRed)) {
                    append("*")
                }
            }
        },
        fontSize = 16.sp,
        fontWeight = FontWeight.Medium,
        color = Color.Black,
        modifier = modifier
    )
}

@Composable
fun DealoraLabeledTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    isRequired: Boolean = false,
    placeholder: String = "",
    keyboardType: androidx.compose.ui.text.input.KeyboardType = androidx.compose.ui.text.input.KeyboardType.Text,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null
) {
    androidx.compose.foundation.layout.Column(modifier = modifier) {
        DealoraFieldLabel(text = label, isRequired = isRequired)
        Spacer(modifier = Modifier.height(8.dp))
        DealoraTextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = placeholder,
            keyboardType = keyboardType,
            leadingIcon = leadingIcon,
            trailingIcon = trailingIcon
        )
    }
}

