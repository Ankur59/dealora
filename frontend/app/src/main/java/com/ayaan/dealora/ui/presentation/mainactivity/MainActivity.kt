package com.ayaan.dealora.ui.presentation.mainactivity

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.ayaan.dealora.ui.presentation.navigation.DealoraApp
import com.ayaan.dealora.ui.theme.DealoraTheme
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
//        enableEdgeToEdge()
        val user= FirebaseAuth.getInstance().currentUser?.uid
        Log.d("MainActivity", "User: $user")
        setContent {
            DealoraTheme(darkTheme = false) {
                Scaffold(modifier = Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) { innerPadding ->
                    DealoraApp(
                        navController = rememberNavController(),
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    )
                }
            }
        }
    }
}