package com.ayaan.dealora


import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.asImageBitmap
import java.io.ByteArrayOutputStream
import java.io.InputStream
import kotlin.collections.forEach
import kotlin.io.encoding.ExperimentalEncodingApi

object Base64ImageUtils {

    /**
     * Decodes a Base64 string to a Bitmap.
     * Automatically handles data URI prefixes (e.g., "data:image/jpeg;base64,...")
     *
     * @param base64String The Base64 encoded string (with or without data URI prefix)
     * @return Decoded Bitmap, or null if decoding fails
     *
     * @example
     * ```kotlin
     * val bitmap = Base64ImageUtils.decodeBase64ToBitmap("data:image/png;base64,iVBORw0...")
     * ```
     */
    @OptIn(ExperimentalEncodingApi::class)
    fun decodeBase64ToBitmap(base64String: String?): Bitmap? {
        if (base64String.isNullOrBlank()) return null

        return try {
            // Remove data URI prefix if present (e.g., "data:image/jpeg;base64,")
            val cleanBase64 = cleanBase64String(base64String)

            // Decode Base64 to byte array
            val decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT)

            // Convert byte array to Bitmap
            BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    /**
     * Decodes a Base64 string to an ImageBitmap for use in Jetpack Compose.
     * Automatically handles data URI prefixes.
     *
     * @param base64String The Base64 encoded string (with or without data URI prefix)
     * @return Decoded ImageBitmap, or null if decoding fails
     *
     * @example
     * ```kotlin
     * val imageBitmap = Base64ImageUtils.decodeBase64ToImageBitmap(base64String)
     * if (imageBitmap != null) {
     *     Image(bitmap = imageBitmap, contentDescription = "Image")
     * }
     * ```
     */
    fun decodeBase64ToImageBitmap(base64String: String?): ImageBitmap {
        return decodeBase64ToBitmap(base64String)?.asImageBitmap() ?: ImageBitmap(1, 1)
    }
//    /**
//     * Converts drawn paths to a bitmap with specified dimensions, maintaining proportional spacing
//     * @param paths List of PathData to draw
//     * @param width Bitmap width in pixels
//     * @param height Bitmap height in pixels
//     * @param canvasWidth Original canvas width (used to calculate proportions)
//     * @param canvasHeight Original canvas height (used to calculate proportions)
//     * @return Bitmap with white background and black signature with maintained padding
//     */
//    fun convertPathsToBitmap(
//        paths: List<VectorProperty.PathData>,
//        width: Int,
//        height: Int,
//        canvasWidth: Float = 0f,
//        canvasHeight: Float = 0f
//    ): Bitmap? {
//        return try {
//            if (paths.isEmpty()) return null
//
//            // Calculate bounding box of all paths
//            var minX = Float.MAX_VALUE
//            var maxX = Float.MIN_VALUE
//            var minY = Float.MAX_VALUE
//            var maxY = Float.MIN_VALUE
//
//            paths.forEach { pathData ->
//                val bounds = android.graphics.RectF()
//                pathData.path.asAndroidPath().computeBounds(bounds, true)
//
//                // Account for stroke width
//                val strokeOffset = pathData.strokeWidth / 2f
//                minX = minOf(minX, bounds.left - strokeOffset)
//                maxX = maxOf(maxX, bounds.right + strokeOffset)
//                minY = minOf(minY, bounds.top - strokeOffset)
//                maxY = maxOf(maxY, bounds.bottom + strokeOffset)
//            }
//
//            val signatureWidth = maxX - minX
//            val signatureHeight = maxY - minY
//
//            Log.d("SignatureDrawDialog", "Bounding box: minX=$minX, maxX=$maxX, minY=$minY, maxY=$maxY")
//            Log.d("SignatureDrawDialog", "Signature size: ${signatureWidth}x${signatureHeight}")
//
//            // Calculate proportional padding from original canvas
//            val leftPadding = if (canvasWidth > 0) minX / canvasWidth else 0f
//            val topPadding = if (canvasHeight > 0) minY / canvasHeight else 0f
//            val rightPadding = if (canvasWidth > 0) (canvasWidth - maxX) / canvasWidth else 0f
//            val bottomPadding = if (canvasHeight > 0) (canvasHeight - maxY) / canvasHeight else 0f
//
//            Log.d("SignatureDrawDialog", "Original padding - Left: $leftPadding, Top: $topPadding, Right: $rightPadding, Bottom: $bottomPadding")
//
//            // Create bitmap with white background
//            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
//            val canvas = android.graphics.Canvas(bitmap)
//
//            // Fill with white background
//            canvas.drawColor(android.graphics.Color.WHITE)
//
//            // Calculate scaling to fit signature in target bitmap while maintaining padding
//            val targetLeftPadding = leftPadding * width
//            val targetRightPadding = rightPadding * width
//            val targetTopPadding = topPadding * height
//            val targetBottomPadding = bottomPadding * height
//
//            val availableWidth = width - targetLeftPadding - targetRightPadding
//            val availableHeight = height - targetTopPadding - targetBottomPadding
//
//            val scaleX = if (signatureWidth > 0) availableWidth / signatureWidth else 1f
//            val scaleY = if (signatureHeight > 0) availableHeight / signatureHeight else 1f
//            val scale = minOf(scaleX, scaleY)
//
//            Log.d("SignatureDrawDialog", "Scale: $scale, Available: ${availableWidth}x${availableHeight}")
//
//            // Calculate translation to position signature with padding
//            val scaledSignatureWidth = signatureWidth * scale
//            val scaledSignatureHeight = signatureHeight * scale
//            val translateX = targetLeftPadding + (availableWidth - scaledSignatureWidth) / 2f - (minX * scale)
//            val translateY = targetTopPadding + (availableHeight - scaledSignatureHeight) / 2f - (minY * scale)
//
//            Log.d("SignatureDrawDialog", "Translation: x=$translateX, y=$translateY")
//
//            // Create paint for drawing paths
//            val paint = android.graphics.Paint().apply {
//                isAntiAlias = true
//                style = android.graphics.Paint.Style.STROKE
//                strokeCap = android.graphics.Paint.Cap.ROUND
//                strokeJoin = android.graphics.Paint.Join.ROUND
//                color = android.graphics.Color.BLACK
//            }
//
//            // Save canvas state
//            canvas.save()
//
//            // Apply transformations
//            canvas.translate(translateX, translateY)
//            canvas.scale(scale, scale)
//
//            // Draw each path
//            paths.forEach { pathData ->
//                paint.strokeWidth = pathData.strokeWidth
//                canvas.drawPath(pathData.path.asAndroidPath(), paint)
//            }
//
//            // Restore canvas state
//            canvas.restore()
//
//            Log.d("SignatureDrawDialog", "Bitmap created: ${width}x${height} with proportional padding")
//            bitmap
//        } catch (e: Exception) {
//            Log.e("SignatureDrawDialog", "Error creating bitmap", e)
//            null
//        }
//    }
    /**
     * Encodes a URI to a Base64 string with data URI prefix.
     *
     * @param context Android context
     * @param uri Image URI to encode
     * @param quality JPEG compression quality (0-100), default is 80
     * @param format Image format (JPEG or PNG), default is JPEG
     * @param includeDataUriPrefix Whether to include "data:image/...;base64," prefix, default is true
     * @return Base64 encoded string with data URI prefix, or null if encoding fails
     *
     * @example
     * ```kotlin
     * val base64 = Base64ImageUtils.encodeUriToBase64(
     *     context = context,
     *     uri = imageUri,
     *     quality = 80,
     *     format = Bitmap.CompressFormat.JPEG
     * )
     * ```
     */
//    fun encodeUriToBase64(
//        context: Context,
//        uri: Uri?,
//        quality: Int = 80,
//        format: Bitmap.CompressFormat = Bitmap.CompressFormat.JPEG,
//        includeDataUriPrefix: Boolean = true
//    ): String? {
//        if (uri == null) return null
//
//        return try {
//            val inputStream: InputStream? = context.contentResolver.openInputStream(uri)
//            val byteArrayOutputStream = ByteArrayOutputStream()
//            val buffer = ByteArray(1024)
//            var length: Int
//
//            inputStream?.use { input ->
//                while (input.read(buffer).also { length = it } != -1) {
//                    byteArrayOutputStream.write(buffer, 0, length)
//                }
//            }
//
//            val imageBytes = byteArrayOutputStream.toByteArray()
//            val base64String = Base64.encodeToString(imageBytes, Base64.NO_WRAP)
//
//            if (includeDataUriPrefix) {
//                // Get MIME type from URI or use default based on format
//                val mimeType = context.contentResolver.getType(uri)
//                    ?: when (format) {
//                        Bitmap.CompressFormat.PNG -> "image/png"
//                        Bitmap.CompressFormat.WEBP -> "image/webp"
//                        else -> "image/jpeg"
//                    }
//                "data:$mimeType;base64,$base64String"
//            } else {
//                base64String
//            }
//        } catch (e: Exception) {
//            e.printStackTrace()
//            null
//        }
//    }

    /**
     * Encodes a Bitmap to a Base64 string with optional compression.
     *
     * @param bitmap Bitmap to encode
     * @param quality JPEG/WEBP compression quality (0-100), default is 80
     * @param format Image format (JPEG, PNG, or WEBP), default is JPEG
     * @param includeDataUriPrefix Whether to include "data:image/...;base64," prefix, default is true
     * @return Base64 encoded string, or null if encoding fails
     *
     * @example
     * ```kotlin
     * val base64 = Base64ImageUtils.encodeBitmapToBase64(
     *     bitmap = myBitmap,
     *     quality = 90,
     *     format = Bitmap.CompressFormat.PNG
     * )
     * ```
     */
//    @RequiresApi(Build.VERSION_CODES.R)
//    fun encodeBitmapToBase64(
//        bitmap: Bitmap?,
//        quality: Int = 80,
//        format: Bitmap.CompressFormat = Bitmap.CompressFormat.JPEG,
//        includeDataUriPrefix: Boolean = true
//    ): String? {
//        if (bitmap == null) return null
//
//        return try {
//            val outputStream = ByteArrayOutputStream()
//            bitmap.compress(format, quality, outputStream)
//            val byteArray = outputStream.toByteArray()
//            val base64String = Base64.encodeToString(byteArray, Base64.NO_WRAP)
//
//            if (includeDataUriPrefix) {
//                val mimeType = when (format) {
//                    Bitmap.CompressFormat.PNG -> "image/png"
//                    Bitmap.CompressFormat.WEBP, Bitmap.CompressFormat.WEBP_LOSSLESS, Bitmap.CompressFormat.WEBP_LOSSY -> "image/webp"
//                    else -> "image/jpeg"
//                }
//                "data:$mimeType;base64,$base64String"
//            } else {
//                base64String
//            }
//        } catch (e: Exception) {
//            e.printStackTrace()
//            null
//        }
//    }

    /**
     * Cleans a Base64 string by removing the data URI prefix if present.
     * Handles various formats:
     * - "data:image/png;base64,..." -> removes prefix
     * - "data:image/jpeg;base64,..." -> removes prefix
     * - Plain Base64 string -> returns as is
     *
     * @param base64String The Base64 string to clean
     * @return Clean Base64 string without data URI prefix
     */
    private fun cleanBase64String(base64String: String): String {
        return when {
            base64String.startsWith("data:image") -> {
                // Remove everything up to and including "base64,"
                base64String.substringAfter("base64,")
            }
            base64String.contains("base64,") -> {
                // Handle other data URI formats
                base64String.substringAfter("base64,")
            }
            else -> base64String
        }
    }

    /**
     * Checks if a string is a valid Base64 encoded image with data URI prefix.
     *
     * @param input String to check
     * @return True if the string appears to be a Base64 encoded image
     */
    fun isBase64Image(input: String?): Boolean {
        if (input.isNullOrBlank()) return false

        return input.startsWith("data:image") ||
               input.matches(Regex("^[A-Za-z0-9+/]*={0,2}\$"))
    }

    /**
     * Extracts the MIME type from a Base64 data URI string.
     *
     * @param base64String Base64 string with data URI prefix
     * @return MIME type (e.g., "image/png"), or null if not found
     *
     * @example
     * ```kotlin
     * val mimeType = Base64ImageUtils.extractMimeType("data:image/png;base64,...")
     * // Returns: "image/png"
     * ```
     */
    fun extractMimeType(base64String: String?): String? {
        if (base64String.isNullOrBlank() || !base64String.startsWith("data:")) {
            return null
        }

        return try {
            val mimeTypePart = base64String.substringAfter("data:").substringBefore(";")
            mimeTypePart.takeIf { it.isNotEmpty() }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Decodes multiple Base64 strings to Bitmaps.
     * Useful for processing image lists/galleries.
     *
     * @param base64Strings List of Base64 encoded strings
     * @return List of decoded Bitmaps (null entries are filtered out)
     *
     * @example
     * ```kotlin
     * val bitmaps = Base64ImageUtils.decodeMultipleBase64ToBitmaps(imageList)
     * ```
     */
    fun decodeMultipleBase64ToBitmaps(base64Strings: List<String>?): List<Bitmap> {
        if (base64Strings.isNullOrEmpty()) return emptyList()

        return base64Strings.mapNotNull { decodeBase64ToBitmap(it) }
    }

    /**
     * Decodes the first valid Base64 image from a list.
     * Useful when you only need one image from a list of potential images.
     *
     * @param base64Strings List of Base64 encoded strings
     * @return First successfully decoded Bitmap, or null if none could be decoded
     *
     * @example
     * ```kotlin
     * val firstImage = Base64ImageUtils.decodeFirstBase64ToBitmap(item.itemImages)
     * ```
     */
    fun decodeFirstBase64ToBitmap(base64Strings: List<String>?): Bitmap? {
        if (base64Strings.isNullOrEmpty()) return null

        return base64Strings.firstNotNullOfOrNull { decodeBase64ToBitmap(it) }
    }

    /**
     * Decodes the first valid Base64 image from a list to ImageBitmap.
     *
     * @param base64Strings List of Base64 encoded strings
     * @return First successfully decoded ImageBitmap, or null if none could be decoded
     */
    fun decodeFirstBase64ToImageBitmap(base64Strings: List<String>?): ImageBitmap? {
        return decodeFirstBase64ToBitmap(base64Strings)?.asImageBitmap()
    }
}