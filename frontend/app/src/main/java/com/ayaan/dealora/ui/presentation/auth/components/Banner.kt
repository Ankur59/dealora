package com.ayaan.dealora.ui.presentation.auth.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraWhite

@Composable
fun Banner(
    painter: Painter= painterResource(id = R.drawable.create_account_banner)
){
    // Top Banner with stars
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(230.dp), contentAlignment = Alignment.Center
    ) {
        // Placeholder for banner drawable (R.drawable.banner_bg)
        Image(
            painter = painter,
            contentDescription = "Banner",
            modifier = Modifier.fillMaxSize()
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top,
            modifier = Modifier.padding(bottom = 40.dp)
        ) {
            Text(
                text = "Dealora",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = DealoraWhite
            )

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "CREATE YOUR\nACCOUNT",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = DealoraWhite,
                textAlign = TextAlign.Center,
                lineHeight = 28.sp
            )
        }
    }
}