package com.ayaan.dealora.ui.presentation.addcoupon

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.net.Uri
import android.util.Log
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.ui.window.Dialog
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.ayaan.dealora.R
import com.ayaan.dealora.ui.theme.DealoraPrimary
import com.ayaan.dealora.utils.Base64ImageUtils
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

@Composable
fun CameraScreen(
    navController: NavController,
    viewModel: AddCouponViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val uiState by viewModel.uiState.collectAsState()

    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { granted ->
            hasCameraPermission = granted
        }
    )

    LaunchedEffect(key1 = true) {
        launcher.launch(Manifest.permission.CAMERA)
    }

    // Gallery Picker
    val galleryLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            val base64 = Base64ImageUtils.encodeUriToBase64(context, it)
            base64?.let { b64 ->
                viewModel.processOcr(
                    imageBase64 = b64,
                    onSuccess = {
                        Toast.makeText(context, "Coupon added successfully!", Toast.LENGTH_SHORT).show()
                    },
                    onError = { error ->
                        Toast.makeText(context, "Failed: $error", Toast.LENGTH_LONG).show()
                    }
                )
            }
        }
    }

    // Success Modal
    if (uiState.createdCoupon != null) {
        SuccessCouponDialog(
            coupon = uiState.createdCoupon!!,
            onDismiss = { viewModel.resetCreatedCoupon() },
            onGoToDashboard = {
                viewModel.resetCreatedCoupon()
                navController.navigate(com.ayaan.dealora.ui.presentation.navigation.Route.Dashboard.path) {
                    popUpTo(com.ayaan.dealora.ui.presentation.navigation.Route.Home.path) { inclusive = false }
                }
            }
        )
    }

    if (hasCameraPermission) {
        Box(modifier = Modifier.fillMaxSize()) {
            CameraPreview(
                onCapture = { base64 ->
                    viewModel.processOcr(
                        imageBase64 = base64,
                        onSuccess = {
                            Toast.makeText(context, "Coupon added successfully!", Toast.LENGTH_SHORT).show()
                        },
                        onError = { error ->
                            Toast.makeText(context, "Failed: $error", Toast.LENGTH_LONG).show()
                        }
                    )
                }
            )

            // Top Controls
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(
                    onClick = { navController.popBackStack() },
                    modifier = Modifier.background(Color.Black.copy(alpha = 0.5f), CircleShape)
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Back",
                        tint = Color.White
                    )
                }
            }

            // Bottom Controls
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 48.dp)
            ) {
                // Gallery Icon
                Box(
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .padding(end = 48.dp)
                        .size(48.dp)
                        .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                        .clickable { galleryLauncher.launch("image/*") },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.PhotoLibrary,
                        contentDescription = "Gallery",
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            // Circular progress when processing
            if (uiState.isOcrLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = DealoraPrimary)
                }
            }
        }
    } else {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(text = "Camera permission required")
        }
    }
}

@Composable
fun CameraPreview(
    onCapture: (String) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
    var imageCapture: ImageCapture? by remember { mutableStateOf(null) }
    val previewView = remember { PreviewView(context) }
    val executor = remember { Executors.newSingleThreadExecutor() }

    AndroidView(
        factory = { previewView },
        modifier = Modifier.fillMaxSize()
    ) { view ->
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    preview,
                    imageCapture
                )
            } catch (exc: Exception) {
                Log.e("CameraPreview", "Use case binding failed", exc)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    Box(modifier = Modifier.fillMaxSize()) {
        // Capture Button
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp)
                .size(80.dp)
                .border(4.dp, Color.White, CircleShape)
                .padding(8.dp)
                .background(Color.White, CircleShape)
                .clickable {
                    val capture = imageCapture ?: return@clickable
                    capture.takePicture(
                        executor,
                        object : ImageCapture.OnImageCapturedCallback() {
                            override fun onCaptureSuccess(image: ImageProxy) {
                                val bitmap = image.toBitmap()
                                val rotatedBitmap = rotateBitmap(bitmap, image.imageInfo.rotationDegrees)
                                val base64 = Base64ImageUtils.encodeBitmapToBase64(rotatedBitmap)
                                image.close()
                                base64?.let {
                                    // Main thread for UI
                                    ContextCompat.getMainExecutor(context).execute {
                                        onCapture(it)
                                    }
                                }
                            }

                            override fun onError(exception: ImageCaptureException) {
                                Log.e("CameraPreview", "Capture failed", exception)
                            }
                        }
                    )
                }
        )
    }
}

fun rotateBitmap(bitmap: Bitmap, degrees: Int): Bitmap {
    if (degrees == 0) return bitmap
    val matrix = Matrix()
    matrix.postRotate(degrees.toFloat())
    return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
}

// Extension to convert ImageProxy to Bitmap
fun ImageProxy.toBitmap(): Bitmap {
    val buffer = planes[0].buffer
    val bytes = ByteArray(buffer.remaining())
    buffer.get(bytes)
    return android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
}

@Composable
fun SuccessCouponDialog(
    coupon: com.ayaan.dealora.data.api.models.Coupon,
    onDismiss: () -> Unit,
    onGoToDashboard: () -> Unit
) {
    val formattedDate = remember(coupon.expireBy) {
        coupon.expireBy.substringBefore("T")
    }

    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .background(Color.Transparent)
        ) {
            // Main Coupon Card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White, RoundedCornerShape(24.dp))
                    .border(1.dp, Color.LightGray.copy(alpha = 0.5f), RoundedCornerShape(24.dp))
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Success Icon/Badge
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .background(DealoraPrimary.copy(alpha = 0.1f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = DealoraPrimary,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Coupon Added Successfull",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                    color = Color.Black
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Real "Coupon" looking section
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(DealoraPrimary.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
                        .padding(16.dp)
                ) {
                    Text(
                        text = (coupon.brandName ?: coupon.couponName).uppercase(),
                        style = MaterialTheme.typography.labelMedium,
                        color = DealoraPrimary,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.ExtraBold
                    )
                    
                    Text(
                        text = coupon.couponCode ?: "SCAN_OFFER",
                        style = MaterialTheme.typography.headlineMedium,
                        color = Color.Black,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Black,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )

                    // Dashed divider simulation
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        repeat(20) {
                            Box(modifier = Modifier.size(width = 8.dp, height = 1.dp).background(Color.LightGray))
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text(text = "VALID UNTIL", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                            Text(text = formattedDate, style = MaterialTheme.typography.bodyMedium, color = Color.Black, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(text = "SCAN SUCCESS", style = MaterialTheme.typography.labelSmall, color = Color.Gray)
                            Text(text = "100%", style = MaterialTheme.typography.bodyMedium, color = DealoraPrimary, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Action Buttons
                Button(
                    onClick = onGoToDashboard,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = DealoraPrimary),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text("Go to Dashboard", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(8.dp))

                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Add Another", color = Color.Gray)
                }
            }
        }
    }
}
