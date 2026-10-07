plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Push notifications need Firebase. The app still builds and runs without
// it (alarms you set on the tablet itself work either way); push starts
// working once app/google-services.json is added -- see android/README.md.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {
    namespace = "za.co.crechely.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "za.co.crechely.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "BASE_URL", "\"https://www.crechely.co.za\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation(platform("com.google.firebase:firebase-bom:33.5.1"))
    implementation("com.google.firebase:firebase-messaging")
}
