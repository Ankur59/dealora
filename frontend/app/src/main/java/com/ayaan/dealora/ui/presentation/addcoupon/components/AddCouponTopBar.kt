package com.ayaan.dealora.ui.presentation.addcoupon.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraGray
import com.ayaan.dealora.ui.theme.DealoraWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddCouponTopBar(onBackClick: () -> Unit) {
    TopAppBar(
        modifier = Modifier.background(Color.White), title = {
            Box(
                modifier = Modifier
                    .border(
                        width = 2.dp, color = DealoraGray, shape = CircleShape
                    )
                    .size(38.dp)
                    .clickable(
                        onClick = onBackClick
                    ),
            ) {
                Image(
                    painter = painterResource(R.drawable.arrow_left),
                    contentDescription = "Left arrow",
                    modifier = Modifier
                        .size(20.dp)
                        .align(Alignment.Center)
                )
            }
        }, windowInsets = WindowInsets(0.dp), colors = TopAppBarDefaults.topAppBarColors(
            containerColor = DealoraWhite
        )
    )
}