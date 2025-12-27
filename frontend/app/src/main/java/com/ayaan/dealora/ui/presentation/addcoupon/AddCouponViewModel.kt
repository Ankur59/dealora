package com.ayaan.dealora.ui.presentation.addcoupon

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ayaan.dealora.data.api.models.CreateCouponRequest
import com.ayaan.dealora.data.repository.CouponRepository
import com.ayaan.dealora.data.repository.CouponResult
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for AddCoupon screen
 */
@HiltViewModel
class AddCouponViewModel @Inject constructor(
    private val couponRepository: CouponRepository,
    private val firebaseAuth: FirebaseAuth
) : ViewModel() {

    companion object {
        private const val TAG = "AddCouponViewModel"
    }

    private val _uiState = MutableStateFlow(AddCouponUiState())
    val uiState: StateFlow<AddCouponUiState> = _uiState.asStateFlow()
    private val _couponImageBase64 = MutableStateFlow<String?>(null)
    val couponImageBase64: StateFlow<String?> = _couponImageBase64.asStateFlow()

    fun onCouponNameChange(value: String) {
        _uiState.value = _uiState.value.copy(couponName = value)
        Log.d(TAG, "Coupon name changed: $value")
    }

    fun onDescriptionChange(value: String) {
        _uiState.value = _uiState.value.copy(description = value)
        Log.d(TAG, "Description changed: $value")
    }

    fun onExpiryDateChange(value: String) {
        _uiState.value = _uiState.value.copy(expiryDate = value)
        Log.d(TAG, "Expiry date changed: $value")
    }

    fun onCategoryChange(value: String) {
        _uiState.value = _uiState.value.copy(selectedCategory = value)
        Log.d(TAG, "Category changed: $value")
    }

    fun onUsageMethodChange(value: String) {
        _uiState.value = _uiState.value.copy(selectedUsageMethod = value)
        Log.d(TAG, "Usage method changed: $value")
    }

    fun onCouponCodeChange(value: String) {
        _uiState.value = _uiState.value.copy(couponCode = value)
        Log.d(TAG, "Coupon code changed: $value")
    }

    fun onVisitingLinkChange(value: String) {
        _uiState.value = _uiState.value.copy(visitingLink = value)
        Log.d(TAG, "Visiting link changed: $value")
    }

    fun onCouponDetailsChange(value: String) {
        _uiState.value = _uiState.value.copy(couponDetails = value)
        Log.d(TAG, "Coupon details changed: $value")
    }

    /**
     * Validate if all required fields are filled
     */
    fun isFormValid(): Boolean {
        val state = _uiState.value

        // Required fields
        if (state.couponName.isBlank()) {
            Log.d(TAG, "Form invalid: coupon name is blank")
            return false
        }
        if (state.expiryDate.isBlank()) {
            Log.d(TAG, "Form invalid: expiry date is blank")
            return false
        }
        if (state.selectedUsageMethod.isBlank()) {
            Log.d(TAG, "Form invalid: usage method is blank")
            return false
        }

        // Conditional required fields based on usage method
        val isValid = when (state.selectedUsageMethod) {
            "Coupon Code" -> state.couponCode.isNotBlank()
            "Coupon Visiting Link" -> state.visitingLink.isNotBlank()
            "Both" -> state.couponCode.isNotBlank() && state.visitingLink.isNotBlank()
            else -> false
        }

        Log.d(TAG, "Form validation result: $isValid")
        return isValid
    }

    /**
     * Create coupon
     */
    fun createCoupon(onSuccess: () -> Unit, onError: (String) -> Unit) {
        val state = _uiState.value
        val uid = firebaseAuth.currentUser?.uid

        if (uid == null) {
            onError("User not authenticated")
            return
        }

        if (!isFormValid()) {
            onError("Please fill all required fields")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            val request = CreateCouponRequest(
                uid = uid,
                couponName = state.couponName,
                description = state.description.ifBlank { null },
                expireBy = convertToISODate(state.expiryDate),
                categoryLabel = state.selectedCategory.ifBlank { null },
                useCouponVia = state.selectedUsageMethod,
                couponCode = if (state.selectedUsageMethod == "Coupon Code" || state.selectedUsageMethod == "Both") {
                    state.couponCode.ifBlank { null }
                } else null,
                couponVisitingLink = if (state.selectedUsageMethod == "Coupon Visiting Link" || state.selectedUsageMethod == "Both") {
                    state.visitingLink.ifBlank { null }
                } else null,
                couponDetails = state.couponDetails.ifBlank { null }
            )

            when (val result = couponRepository.createCoupon(request)) {
                is CouponResult.Success -> {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                    Log.d(TAG, "Coupon created - coupon id: ${result.coupon.id}")
                    val imageBase64 = result.couponImageBase64
                    Log.d(TAG, "couponImageBase64 is null: ${imageBase64 == null}")
                    Log.d(TAG, "couponImageBase64 is blank: ${imageBase64?.isBlank()}")
                    Log.d(TAG, "couponImageBase64 length: ${imageBase64?.length ?: 0}")
                    // Log first 100 chars to verify data (Base64 strings are too long for full log)
                    Log.d(TAG, "couponImageBase64 preview: ${imageBase64?.take(100)}")
                    _couponImageBase64.value = imageBase64
                    onSuccess()
                }
                is CouponResult.Error -> {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = result.message
                    )
                    onError(result.message)
                }
            }
        }
    }

    /**
     * Convert date string to ISO format
     * Assumes input format is like "31/12/2025" and converts to "2025-12-31T23:59:59.000Z"
     */
    private fun convertToISODate(dateString: String): String {
        return try {
            val parts = dateString.split("/")
            if (parts.size == 3) {
                val day = parts[0].padStart(2, '0')
                val month = parts[1].padStart(2, '0')
                val year = parts[2]
                "${year}-${month}-${day}T23:59:59.000Z"
            } else {
                dateString
            }
        } catch (_: Exception) {
            dateString
        }
    }
}

/**
 * UI State for AddCoupon screen
 */
data class AddCouponUiState(
    val couponName: String = "",
    val description: String = "",
    val expiryDate: String = "",
    val selectedCategory: String = "",
    val selectedUsageMethod: String = "",
    val couponCode: String = "",
    val visitingLink: String = "",
    val couponDetails: String = "",
    val isLoading: Boolean = false,
    val error: String? = null
)

