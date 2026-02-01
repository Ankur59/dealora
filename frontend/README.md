# Dealora - Android 

<div align="center">
![Dealora Logo](app/src/main/res/drawable/logo.png)

**A comprehensive Android application for discovering, managing, and tracking promotional coupons across multiple platforms**

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [Design Patterns](#design-patterns)
  - [Layer Architecture](#layer-architecture)
  - [Data Flow](#data-flow)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Setup & Installation](#setup--installation)
  - [Prerequisites](#prerequisites)
  - [Configuration](#configuration)
  - [Building the Project](#building-the-project)
- [Development Guidelines](#development-guidelines)
  - [Code Style](#code-style)
  - [Git Workflow](#git-workflow)
  - [Testing](#testing)
- [API Integration](#api-integration)
- [Navigation Flow](#navigation-flow)
- [State Management](#state-management)
- [Dependency Injection](#dependency-injection)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Overview

**Dealora** is an enterprise-grade Android application built with modern Android development practices. It provides users with a centralized platform to:

- Discover active coupons from multiple brands
- Manage and organize personal coupons
- Sync coupons from popular shopping apps
- Track coupon usage and savings statistics
- Receive notifications about expiring coupons
- Secure authentication via Firebase Phone Auth

The application follows **Clean Architecture** principles, uses **MVVM** pattern, and leverages **Jetpack Compose** for modern, declarative UI development.

---

## Architecture

### Design Patterns

Dealora implements multiple architectural patterns to ensure scalability, maintainability, and testability:

#### 1. **Clean Architecture**
```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│   (UI, ViewModels, Compose Screens, Navigation)        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                     Domain Layer                         │
│         (Use Cases, Business Logic, Models)             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                      Data Layer                          │
│  (Repositories, API Services, Local Database, Paging)  │
└─────────────────────────────────────────────────────────┘
```

#### 2. **MVVM (Model-View-ViewModel)**
- **Model**: Data classes, entities, API responses
- **View**: Composable functions (UI)
- **ViewModel**: State management, business logic orchestration

#### 3. **Repository Pattern**
Abstracts data sources (network, database, cache) from the rest of the application:
- `CouponRepository` - Coupon CRUD operations
- `ProfileRepository` - User profile management
- `FirebaseAuthRepository` - Authentication
- `BackendAuthRepository` - Backend authentication sync
- `SavedCouponRepository` - Local coupon storage
- `SyncedAppRepository` - App synchronization

#### 4. **Dependency Injection (Hilt)**
All dependencies are injected via Dagger Hilt for better testability and modularity.

### Layer Architecture

```
com.ayaan.dealora/
├── data/                          # Data Layer
│   ├── api/                       # Remote data sources
│   │   ├── models/               # API request/response models
│   │   ├── AuthApiService.kt
│   │   ├── CouponApiService.kt
│   │   └── ProfileApiService.kt
│   ├── local/                     # Local data sources
│   │   ├── dao/                  # Room DAOs
│   │   ├── entity/               # Room entities
│   │   └── DealoraDatabase.kt    # Room database
│   ├── repository/                # Repository implementations
│   ├── auth/                      # Authentication logic
│   └── paging/                    # Paging 3 sources
│
├── di/                            # Dependency Injection
│   ├── NetworkModule.kt           # Network dependencies
│   ├── DatabaseModule.kt          # Database dependencies
│   └── AuthModule.kt              # Auth dependencies
│
├── ui/                            # Presentation Layer
│   ├── presentation/              # Feature modules
│   │   ├── auth/                 # Authentication screens
│   │   ├── home/                 # Home screen
│   │   ├── dashboard/            # Dashboard
│   │   ├── couponsList/          # Coupon listing
│   │   ├── profile/              # User profile
│   │   ├── addcoupon/            # Add coupon
│   │   ├── redeemedcoupons/      # Redeemed coupons
│   │   ├── syncapps/             # App sync feature
│   │   ├── notifications/        # Notifications
│   │   ├── navigation/           # Navigation logic
│   │   └── common/               # Shared components
│   └── theme/                     # Material 3 theming
│
├── utils/                         # Utility classes
└── DealoraApplication.kt          # Application class
```

### Data Flow

```
User Action (UI Event)
       ↓
   ViewModel
       ↓
   Repository
       ↓
┌──────┴────────┐
│               │
API Service   Room DB
│               │
└──────┬────────┘
       ↓
   ViewModel (StateFlow)
       ↓
   UI Update (Compose Recomposition)
```

---

## Tech Stack

### Core Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|----------|
| **Language** | Kotlin | 2.0.21 | Primary development language |
| **UI Framework** | Jetpack Compose | 2024.09.00 BOM | Modern declarative UI |
| **Minimum SDK** | API 28 | Android 9.0 (Pie) | Target devices |
| **Target SDK** | API 36 | Latest Android | Future compatibility |
| **Build System** | Gradle Kotlin DSL | 8.13.2 | Build configuration |

### Android Jetpack Components

- **Lifecycle** (2.10.0) - Lifecycle-aware components
- **Navigation Compose** (2.9.6) - Type-safe navigation
- **Room** (2.6.1) - Local database
- **Paging 3** (3.3.2) - Efficient data loading
- **Hilt** (2.48) - Dependency injection
- **Compose Material3** - Material Design 3 components

### Networking & Data

- **Retrofit** (2.9.0) - REST API client
- **OkHttp** (4.12.0) - HTTP client
- **Moshi** (1.15.0) - JSON parsing
- **KSP** (2.0.21-1.0.25) - Kotlin Symbol Processing

### Firebase Services

- **Firebase Authentication** - Phone number authentication
- **Firebase BOM** (34.6.0) - Firebase SDK management

### Testing

- **JUnit** (4.13.2) - Unit testing
- **Espresso** (3.7.0) - UI testing
- **Compose UI Test** - Composable testing

---

## Project Structure

```
dealora/frontend/
│
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/ayaan/dealora/
│   │   │   ├── res/
│   │   │   │   ├── drawable/         # Images and icons
│   │   │   │   ├── values/           # Strings, colors, themes
│   │   │   │   └── xml/              # Data extraction rules
│   │   │   └── AndroidManifest.xml
│   │   ├── androidTest/              # Instrumented tests
│   │   └── test/                     # Unit tests
│   │
│   ├── build.gradle.kts              # App-level build config
│   ├── google-services.json          # Firebase configuration
│   └── proguard-rules.pro            # ProGuard rules
│
├── gradle/
│   ├── libs.versions.toml            # Version catalog
│   └── wrapper/
│
├── build.gradle.kts                  # Project-level build config
├── settings.gradle.kts               # Settings configuration
├── gradle.properties                 # Gradle properties
└── README.md                         # This file
```

---

## Features

### Authentication
- **Phone OTP Authentication** via Firebase
- **Secure session management**
- **Backend synchronization**
- **User profile management**

### Coupon Management
- **Create personal coupons** with custom details
- **Browse active coupons** from multiple brands
- **Save favorite coupons** for quick access
- **Mark coupons as redeemed**
- **Track expiration dates**
- **Categorize by brand/category**

### App Synchronization
- **Sync coupons from popular apps** (Zomato, Amazon, PhonePe, Swiggy, etc.)
- **Progress tracking** during sync
- **Selective app sync**
- **Desync capabilities**

### Dashboard & Analytics
- **Coupon statistics** (active, redeemed, saved)
- **Savings tracker**
- **Visual analytics**
- **Quick actions**

### User Experience
- **Material Design 3** theming
- **Consistent UI components**
- **Smooth animations**
- **Responsive layouts**
- **Push notifications**
- **Advanced search and filtering**

---

## Setup & Installation

### Prerequisites

Before setting up the project, ensure you have the following installed:

1. **Android Studio** (Hedgehog | 2023.1.1 or later)
   - [Download Android Studio](https://developer.android.com/studio)

2. **JDK 11** or higher
   - Verify: `java -version`

3. **Android SDK**
   - API Level 28 (Android 9.0) minimum
   - API Level 36 (Latest) for target

4. **Git**
   - Verify: `git --version`

5. **Firebase Account**
   - Create a project at [Firebase Console](https://console.firebase.google.com)

### Configuration

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd dealora/frontend
```

#### 2. Firebase Setup

1. Create a new Firebase project or use existing one
2. Enable **Phone Authentication** in Firebase Console:
   - Go to Authentication → Sign-in method
   - Enable "Phone" provider
3. Add your Android app to Firebase project:
   - Package name: `com.ayaan.dealora`
   - Download `google-services.json`
4. Place `google-services.json` in `app/` directory

#### 3. Backend Configuration

Update the backend URL in `NetworkModule.kt`:

```kotlin
// app/src/main/java/com/ayaan/dealora/di/NetworkModule.kt
private const val BASE_URL = "YOUR_BACKEND_URL"
```

**For development:**
- Emulator: `http://10.0.2.2:5000/`
- Physical device: Use your computer's IP address or ngrok

#### 4. Local Properties

Create/update `local.properties`:

```properties
sdk.dir=/path/to/Android/Sdk
```

#### 5. Gradle Properties

The `gradle.properties` file should contain:

```properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
```

### Building the Project

#### Option 1: Using Android Studio

1. Open Android Studio
2. Click **File → Open**
3. Navigate to the `frontend` directory
4. Wait for Gradle sync to complete
5. Click **Run** (▶️) or press `Shift + F10`

#### Option 2: Using Command Line

```bash
# Navigate to project directory
cd frontend

# Make gradlew executable (Unix/Mac)
chmod +x gradlew

# Build debug APK
./gradlew assembleDebug

# Install on connected device
./gradlew installDebug

# Build release APK
./gradlew assembleRelease
```

**Output locations:**
- Debug APK: `app/build/outputs/apk/debug/app-debug.apk`
- Release APK: `app/build/outputs/apk/release/app-release.apk`

### Running Tests

```bash
# Run unit tests
./gradlew test

# Run instrumented tests (requires device/emulator)
./gradlew connectedAndroidTest

# Generate test coverage report
./gradlew jacocoTestReport
```

---

## Development Guidelines

### Code Style

This project follows the [Kotlin Coding Conventions](https://kotlinlang.org/docs/coding-conventions.html).

#### Key Guidelines:

1. **Naming Conventions**
   - Classes: `PascalCase` (e.g., `CouponRepository`)
   - Functions/Variables: `camelCase` (e.g., `fetchCoupons()`)
   - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_COUNT`)
   - Composables: `PascalCase` (e.g., `CouponCard()`)

2. **File Organization**
   - One class per file
   - File name matches class name
   - Group related files in packages

3. **Composable Guidelines**
   ```kotlin
   @Composable
   fun FeatureName(
       modifier: Modifier = Modifier,  // Modifier first
       viewModel: ViewModel = hiltViewModel(),
       navController: NavController
   ) {
       // Implementation
   }
   ```

4. **State Management**
   ```kotlin
   // Use StateFlow in ViewModels
   private val _uiState = MutableStateFlow(UiState())
   val uiState: StateFlow<UiState> = _uiState.asStateFlow()
   
   // Collect in Composables
   val uiState by viewModel.uiState.collectAsState()
   ```

### Git Workflow

#### Branch Naming Convention

```
feature/[feature-name]     # New features
bugfix/[bug-description]   # Bug fixes
hotfix/[critical-fix]      # Critical production fixes
refactor/[refactor-scope]  # Code refactoring
docs/[documentation-task]  # Documentation updates
```

#### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Example:**
```
feat(auth): implement phone OTP authentication

- Add Firebase phone authentication
- Create OTP verification screen
- Implement resend OTP functionality

Closes #123
```
## API Integration

### Backend Endpoints

The app integrates with a RESTful backend API. Base URL is configured in `NetworkModule.kt`.

#### Authentication Endpoints

```
POST /auth/signup          # Register new user
POST /auth/signin          # Login existing user
POST /auth/verify          # Verify OTP
GET  /auth/profile         # Get user profile
```

#### Coupon Endpoints

```
GET    /coupons                    # List coupons (paginated)
GET    /coupons/{id}               # Get coupon details
POST   /coupons                    # Create coupon
PUT    /coupons/{id}               # Update coupon
DELETE /coupons/{id}               # Delete coupon
POST   /coupons/redeem             # Mark as redeemed
GET    /coupons/statistics         # Get statistics
POST   /coupons/sync-private       # Sync private coupons
```

#### Profile Endpoints

```
GET  /profile              # Get profile
PUT  /profile              # Update profile
GET  /profile/statistics   # Get user statistics
```

### API Models

API models are located in `data/api/models/`:

```kotlin
// Request
data class CreateCouponRequest(
    val title: String,
    val code: String,
    val expiryDate: String,
    val brand: String?,
    val category: String?,
    val imageBase64: String?
)

// Response
data class Coupon(
    val id: String,
    val title: String,
    val code: String,
    val expiryDate: String,
    val status: String,
    val brand: String?
)
```

### Error Handling

```kotlin
sealed class BackendResult<out T> {
    data class Success<T>(val data: T) : BackendResult<T>()
    data class Error(val message: String) : BackendResult<Nothing>()
}
```

---

## Navigation Flow

### Navigation Graph

The app uses Jetpack Navigation Compose with type-safe routes defined in `Route.kt`:

```
Splash
   ↓
SignUp/SignIn ←→ OTP Verification
   ↓
Home (Dashboard)
   ├─→ Dashboard (Active/Redeemed tabs)
   ├─→ Add Coupon
   ├─→ Redeemed Coupons
   ├─→ Explore Coupons
   │      └─→ Coupon Details
   ├─→ Profile
   │      ├─→ Account Privacy
   │      ├─→ App Privacy
   │      ├─→ Contact Support
   │      ├─→ FAQ
   │      ├─→ About Us
   │      ├─→ Sync Apps
   │      │      ├─→ Select Apps
   │      │      └─→ Syncing Progress
   │      └─→ Desync Apps
   └─→ Notifications
```

### Route Definitions

```kotlin
sealed class Route(val path: String) {
    data object SignUp: Route("signup")
    data object Home: Route("home")
    
    data object CouponDetails: Route(
        "coupondetails/{couponId}?isPrivate={isPrivate}"
    ) {
        fun createRoute(
            couponId: String, 
            isPrivate: Boolean = false
        ) = "coupondetails/$couponId?isPrivate=$isPrivate"
    }
}
```

### Navigation Usage

```kotlin
// In Composable
navController.navigate(Route.Home.path)

// With parameters
navController.navigate(
    Route.CouponDetails.createRoute(
        couponId = "123",
        isPrivate = true
    )
)

// Pop back
navController.popBackStack()

// Pop to specific destination
navController.popUpTo(Route.Home.path)
```

---

## State Management

### ViewModel State Pattern

```kotlin
data class UiState(
    val isLoading: Boolean = false,
    val data: List<Coupon> = emptyList(),
    val errorMessage: String? = null,
    val isSuccess: Boolean = false
)

class CouponViewModel @Inject constructor(
    private val repository: CouponRepository
) : ViewModel() {
    
    private val _uiState = MutableStateFlow(UiState())
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()
    
    fun fetchCoupons() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            
            when (val result = repository.getCoupons()) {
                is Success -> _uiState.update { 
                    it.copy(
                        data = result.data,
                        isLoading = false
                    )
                }
                is Error -> _uiState.update { 
                    it.copy(
                        errorMessage = result.message,
                        isLoading = false
                    )
                }
            }
        }
    }
}
```

### State Collection in Composables

```kotlin
@Composable
fun CouponScreen(viewModel: CouponViewModel = hiltViewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    
    LaunchedEffect(Unit) {
        viewModel.fetchCoupons()
    }
    
    when {
        uiState.isLoading -> LoadingIndicator()
        uiState.errorMessage != null -> ErrorView(uiState.errorMessage)
        else -> CouponList(uiState.data)
    }
}
```

---

## Dependency Injection

### Hilt Setup

The app uses **Dagger Hilt** for dependency injection.

#### Application Class

```kotlin
@HiltAndroidApp
class DealoraApplication : Application()
```

#### Modules

**NetworkModule** - Provides network dependencies:
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun provideRetrofit(): Retrofit { ... }
    
    @Provides
    @Singleton
    fun provideCouponApiService(retrofit: Retrofit): CouponApiService { ... }
}
```

**DatabaseModule** - Provides database dependencies:
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): DealoraDatabase { ... }
}
```

**AuthModule** - Provides authentication dependencies:
```kotlin
@Module
@InstallIn(SingletonComponent::class)
object AuthModule {
    @Provides
    @Singleton
    fun provideFirebaseAuth(): FirebaseAuth = FirebaseAuth.getInstance()
}
```

#### Injection in Components

```kotlin
// ViewModel
@HiltViewModel
class CouponViewModel @Inject constructor(
    private val repository: CouponRepository
) : ViewModel()

// Repository
class CouponRepository @Inject constructor(
    private val apiService: CouponApiService,
    private val dao: CouponDao
)

// Activity
@AndroidEntryPoint
class MainActivity : ComponentActivity()

// Composable
@Composable
fun Screen(viewModel: CouponViewModel = hiltViewModel())
```

---

## Security Considerations

### Authentication Security

1. **Firebase Phone Auth**: Secure OTP-based authentication
2. **Token Management**: Secure storage of auth tokens
3. **Session Management**: Automatic session expiration

### Network Security

1. **HTTPS**: All API calls use HTTPS in production
2. **Certificate Pinning**: (Recommended for production)
3. **API Key Protection**: Keys stored in BuildConfig

### Data Security

1. **Room Database**: Encrypted using SQLCipher (recommended)
2. **Shared Preferences**: Encrypted preferences for sensitive data
3. **ProGuard**: Code obfuscation enabled in release builds

### Permissions

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<!-- Add other permissions as needed -->
```

### Best Practices

- No hardcoded credentials
- Input validation on all user inputs
- SQL injection prevention via Room
- XSS prevention in WebViews
- Secure data transmission (HTTPS)

---

## Contributing

We welcome contributions! Please follow these guidelines:

### Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Submit a pull request

### Contribution Checklist

- Code follows style guidelines
- Self-reviewed the code
- Commented complex sections
- Updated documentation
- Added/updated tests
- All tests pass locally
- No new warnings/errors
- PR description is clear
- Mockups/wireframes (if applicable)

---

## Troubleshooting

### Common Issues

#### Build Failures

**Issue**: Gradle sync fails
```
Solution:
1. File → Invalidate Caches → Invalidate and Restart
2. Delete .gradle folder
3. Clean and rebuild: ./gradlew clean build
```

**Issue**: Dependency resolution errors
```
Solution:
1. Check internet connection
2. Update Gradle wrapper
3. Verify version catalog in libs.versions.toml
```

#### Runtime Issues

**Issue**: App crashes on launch
```
Solutions:
1. Check logcat for stack trace
2. Verify Firebase configuration
3. Clear app data and reinstall
```

**Issue**: Network requests fail
```
Solutions:
1. Check backend URL in NetworkModule
2. Verify internet permission in manifest
3. For physical device, ensure device and server on same network
4. Check server is running
```

**Issue**: Firebase Auth not working
```
Solutions:
1. Verify google-services.json is present
2. Enable Phone Authentication in Firebase Console
3. Check SHA-1 fingerprint is added to Firebase
```

#### Development Issues

**Issue**: Compose preview not rendering
```
Solutions:
1. Rebuild project
2. Invalidate caches
3. Check preview parameters
```

### Getting Help

1. Check existing documentation
2. Search closed issues on GitHub
3. Create new issue with details
4. Contact development team
---

## Acknowledgments

- **Android Jetpack** for modern Android components
- **Firebase** for authentication services
- **Square** for Retrofit and OkHttp
- **Google** for Material Design 3
- **JetBrains** for Kotlin

---