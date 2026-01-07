package com.ayaan.dealora.ui.presentation.profile.contactsupport

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.ayaan.dealora.ui.theme.AppColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopBar(
    navController: NavController,
    title: String
) {
    TopAppBar(
        title = {
            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )
        },
        navigationIcon = {
            IconButton(onClick = { navController.navigateUp() }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = AppColors.IconTint
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = AppColors.Background
        )
    )
}

@Composable
fun ContactSupportScreen(navController: NavController) {
    Scaffold(
        topBar = {
            TopBar(
                navController = navController,
                title = "Contact Support"
            )
        },
        containerColor = AppColors.Background
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp, vertical = 16.dp)
        ) {
            ContactCard()
        }
    }
}

@Composable
fun ContactCard() {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .wrapContentHeight(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 2.dp
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            // Title
            Text(
                text = "Contact Us",
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            // Description
            Text(
                text = "Contact us for help you need, we are all here to help you",
                fontSize = 14.sp,
                color = AppColors.SecondaryText,
                lineHeight = 20.sp
            )
            
            Spacer(modifier = Modifier.height(20.dp))
            
            // Phone Number
            ContactItem(
                icon = painterResource(id = android.R.drawable.ic_menu_call),
                text = "+91 65464394623"
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Email
            ContactItem(
                icon = painterResource(id = android.R.drawable.ic_dialog_email),
                text = "dsdbfkk@mail.com"
            )
        }
    }
}

@Composable
fun ContactItem(
    icon: androidx.compose.ui.graphics.painter.Painter,
    text: String
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Icon(
            painter = icon,
            contentDescription = null,
            modifier = Modifier.size(20.dp),
            tint = AppColors.IconTint
        )
        
        Spacer(modifier = Modifier.width(12.dp))
        
        Text(
            text = text,
            fontSize = 15.sp,
            color = AppColors.PrimaryText
        )
    }
}