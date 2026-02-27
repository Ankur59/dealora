package com.ayaan.dealora.ui.presentation.addcoupon

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.ui.presentation.addcoupon.components.AddCouponTopBar
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponDatePicker
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponDropdown
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponInputField
import com.ayaan.dealora.ui.presentation.addcoupon.components.UseCouponViaSection
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DocumentScanner
import androidx.compose.material3.Icon
import com.ayaan.dealora.ui.theme.DealoraGray
import androidx.compose.foundation.clickable


@Composable
fun AddCoupons(
    navController: NavController,
    viewModel: AddCouponViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
<<<<<<< HEAD
    val couponImageBase64 by viewModel.couponImageBase64.collectAsState()
    val couponImageBitmap: ImageBitmap= Base64ImageUtils.decodeBase64ToImageBitmap(couponImageBase64 )
    
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: android.net.Uri? ->
        uri?.let {
            val base64 = Base64ImageUtils.encodeUriToBase64(context, it)
            base64?.let { b64 ->
                viewModel.processOcr(
                    imageBase64 = b64,
                    onSuccess = {
                        Toast.makeText(context, "OCR processed successfully!", Toast.LENGTH_SHORT).show()
                    },
                    onError = { error ->
                        Toast.makeText(context, "OCR failed: $error", Toast.LENGTH_LONG).show()
                    }
                )
            }
        }
    }

    LaunchedEffect(uiState, couponImageBase64) {

        Log.d("AddCoupons", "uiState updated: $uiState")
        Log.d("AddCoupons", "isFormValid: ${viewModel.isFormValid()}")
        Log.d("AddCoupons", "couponImageBase64: $couponImageBase64")
        Log.d("AddCoupons", "couponImageBitmap: $couponImageBitmap")
    }


    Scaffold(
        topBar = {
            AddCouponTopBar(
                onBackClick = { navController.navigateUp() })
        }, contentWindowInsets = WindowInsets(0.dp), containerColor = DealoraWhite
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color.White)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
            ) {
                Text(
                    text = "Add your Coupons", style = TextStyle(
                        fontSize = 32.sp,
                        lineHeight = 47.sp,
                        fontWeight = FontWeight(500),
                        color = Color.Black,
                    )
                )
            }
<<<<<<< HEAD
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(49.dp)
                        .background(color = DealoraPrimary, shape = RoundedCornerShape(size = 9.dp)),
                ) {
                    Text(
                        text = "Manually", style = TextStyle(
                            fontSize = 24.sp,
                            fontWeight = FontWeight(500),
                            color = DealoraWhite,
                        ), modifier = Modifier.align(Alignment.Center)
                    )
                }
                
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(49.dp)
                        .background(
                            color = if (uiState.isOcrLoading) DealoraGray else DealoraWhite, 
                            shape = RoundedCornerShape(size = 9.dp)
                        )

                        .background(color = Color.Transparent) // placeholder for border
                        .clickable(enabled = !uiState.isOcrLoading) {
                            galleryLauncher.launch("image/*")
                        }
                        .then(
                            if (!uiState.isOcrLoading) Modifier.background(Color.White) else Modifier
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        if (uiState.isOcrLoading) {
                            CircularProgressIndicator(
                                modifier = Modifier.height(20.dp).width(20.dp),
                                strokeWidth = 2.dp,
                                color = DealoraPrimary
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.DocumentScanner,
                                contentDescription = "Scan",
                                tint = DealoraPrimary,
                                modifier = Modifier.height(20.dp).width(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = "Scan", style = TextStyle(
                                    fontSize = 24.sp,
                                    fontWeight = FontWeight(500),
                                    color = DealoraPrimary,
                                )
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
            ) {
                Text(
                    text = "Your selected apps are being synced individually.\nPlease wait until all apps are fully synced.",
                    lineHeight = 18.sp
                )
            }
=======

>>>>>>> main
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 20.dp)
            ) {
                Spacer(modifier = Modifier.height(10.dp))

                // Coupon Name Field
                CouponInputField(
                    label = "Coupon Name",
                    value = uiState.couponName,
                    onValueChange = { viewModel.onCouponNameChange(it) },
                    isRequired = true
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Description Field
                CouponInputField(
                    label = "Description",
                    value = uiState.description,
                    onValueChange = { viewModel.onDescriptionChange(it) },
                    minLines = 4,
                    isRequired = false
                )

                Spacer(modifier = Modifier.height(20.dp))

                // Expire By and Category Label Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        CouponDatePicker(
                            label = "Expire By",
                            value = uiState.expiryDate,
                            onValueChange = { viewModel.onExpiryDateChange(it) },
                            isRequired = true
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        CouponDropdown(
                            label = "Category Label", value = uiState.selectedCategory, options = listOf(
                                "Food", "Fashion", "Electronics", "Travel", "Health", "Other"
                            ), onValueChange = { viewModel.onCategoryChange(it) }, isRequired = false
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Use Coupon Via
                UseCouponViaSection(
                    selectedMethod = uiState.selectedUsageMethod,
                    onMethodChange = { viewModel.onUsageMethodChange(it) })

                Spacer(modifier = Modifier.height(20.dp))

                // Conditional Fields based on usage method
                when (uiState.selectedUsageMethod) {
                    "Coupon Code" -> {
                        CouponInputField(
                            label = "Coupon Code",
                            value = uiState.couponCode,
                            onValueChange = { viewModel.onCouponCodeChange(it) },
                            isRequired = true
                        )
                    }

                    "Coupon Visiting Link" -> {
                        CouponInputField(
                            label = "Coupon Visiting link",
                            value = uiState.visitingLink,
                            onValueChange = { viewModel.onVisitingLinkChange(it) },
                            isRequired = true
                        )
                    }

                    "Both" -> {
                        CouponInputField(
                            label = "Coupon Code",
                            value = uiState.couponCode,
                            onValueChange = { viewModel.onCouponCodeChange(it) },
                            isRequired = true
                        )
                        Spacer(modifier = Modifier.height(20.dp))
                        CouponInputField(
                            label = "Coupon Visiting link",
                            value = uiState.visitingLink,
                            onValueChange = { viewModel.onVisitingLinkChange(it) },
                            isRequired = true
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Coupon Details
                CouponInputField(
                    label = "Coupon Details",
                    value = uiState.couponDetails,
                    onValueChange = { viewModel.onCouponDetailsChange(it) },
                    minLines = 4,
                    isRequired = false
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Add Coupon Button
                Button(
                    onClick = {
                        viewModel.createCoupon(
                            onSuccess = {
                                Toast.makeText(
                                    context,
                                    "Coupon added successfully!",
                                    Toast.LENGTH_SHORT
                                ).show()
//                                navController.navigateUp()
                            },
                            onError = { errorMessage ->
                                println(errorMessage)
                            }
                        )
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = DealoraPrimary,
                        disabledContainerColor = DealoraPrimary.copy(alpha = 0.5f)
                    ),
                    shape = RoundedCornerShape(12.dp),
                    enabled = viewModel.isFormValid() && !uiState.isLoading
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.height(24.dp).width(24.dp)
                        )
                    } else {
                        Text(
                            text = "Add Coupon",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}