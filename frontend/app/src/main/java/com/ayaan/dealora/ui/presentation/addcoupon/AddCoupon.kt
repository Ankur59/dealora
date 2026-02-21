package com.ayaan.dealora.ui.presentation.addcoupon

import android.util.Log
import android.widget.Toast
import androidx.compose.foundation.Image
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.utils.Base64ImageUtils
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.presentation.addcoupon.components.AddCouponTopBar
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponDatePicker
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponDropdown
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponInputField
import com.ayaan.dealora.ui.presentation.addcoupon.components.CouponPreviewCard
import com.ayaan.dealora.ui.presentation.addcoupon.components.UseCouponViaSection
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.ui.theme.DealoraWhite

@Composable
fun AddCoupons(
    navController: NavController,
    viewModel: AddCouponViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val couponImageBase64 by viewModel.couponImageBase64.collectAsState()
    val couponImageBitmap: ImageBitmap= Base64ImageUtils.decodeBase64ToImageBitmap(couponImageBase64 )
    LaunchedEffect(uiState, couponImageBase64) {
        Log.d("AddCoupons", "uiState updated: $uiState")
        Log.d("AddCoupons", "isFormValid: ${viewModel.isFormValid()}")
        Log.d("AddCoupons", "couponImageBase64: $couponImageBase64")
        Log.d("AddCoupons", "couponImageBitmap: $couponImageBitmap")
    }


    Scaffold(
        topBar = {
            // Top Bar
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
            Box(
                modifier = Modifier
                    .padding(horizontal = 6.dp)
                    .width(155.dp)
                    .height(49.dp)
                    .background(color = DealoraPrimary, shape = RoundedCornerShape(size = 9.dp)),
            ) {
                Text(
                    text = "Manually", style = TextStyle(
                        fontSize = 32.sp,
                        lineHeight = 47.sp,
                        fontWeight = FontWeight(500),
                        color = DealoraWhite,
                    ), modifier = Modifier.align(Alignment.Center)
                )
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

//                Spacer(modifier = Modifier.height(24.dp))

                // Review Section
//                Text(
//                    text = "Review your coupon",
//                    fontSize = 14.sp,
//                    fontWeight = FontWeight.SemiBold,
//                    color = Color.Black,
//                    modifier = Modifier.padding(bottom = 12.dp)
//                )

//                CouponPreviewCard(
//                    couponName = uiState.couponName,
//                    description = uiState.description,
//                    expiryDate = uiState.expiryDate,
//                    couponCode = uiState.couponCode,
//                    isRedeemed = false
//                )
                Image(
                    bitmap = couponImageBitmap?: ImageBitmap.imageResource(id = R.drawable.coupon_banner1),
                    contentDescription = "Coupon Image",
                    modifier = Modifier
                        .fillMaxSize()
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