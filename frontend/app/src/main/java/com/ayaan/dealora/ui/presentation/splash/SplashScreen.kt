package com.ayaan.dealora.ui.presentation.splash

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.ayaan.dealora.R
import androidx.navigation.NavController
import com.ayaan.dealora.ui.theme.DealoraPrimary

@Composable
fun SplashScreen(navController: NavController) {
    Scaffold(
        containerColor = DealoraPrimary,
        modifier = Modifier.background(DealoraPrimary),
        contentWindowInsets = WindowInsets(0.dp)
    ) {paddingValues ->
        Column(
            modifier = Modifier.fillMaxSize().padding(paddingValues),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .background(Color.White)
            ){
                Image(
                    painter = painterResource(R.drawable.logo),
                    contentDescription = "app logo",
                    modifier = Modifier.fillMaxSize().align(Alignment.Center)
                )
            }
        }
    }
}