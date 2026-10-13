plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

val vName = (project.findProperty("versionName") as String?) ?: "0.0.0-dev"
val vCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1

val ksPath = System.getenv("ANDROID_KEYSTORE_PATH")
val ksPass = System.getenv("ANDROID_KEYSTORE_PASSWORD")
val kAlias = System.getenv("ANDROID_KEY_ALIAS")
val kPass = System.getenv("ANDROID_KEY_PASSWORD")
val hasReleaseKey = listOf(ksPath, ksPass, kAlias, kPass).all { !it.isNullOrBlank() }

android {
    namespace = "com.tickflow.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.tickflow.app"
        minSdk = 24
        targetSdk = 35
        versionName = vName
        versionCode = vCode
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                storeFile = file(ksPath!!)
                storePassword = ksPass
                keyAlias = kAlias
                keyPassword = kPass
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig =
                if (hasReleaseKey) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    debugImplementation(libs.androidx.compose.ui.tooling)
}