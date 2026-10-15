import java.util.Properties
import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Versão automática: incrementa a cada build local. O CI (GitHub Actions) passa
// -PappVersionName / -PappVersionCode derivados da tag e tem prioridade.
//
// O contador é guardado na pasta do Gradle do utilizador (persistentCounter),
// FORA do projeto, para que extrair um zip novo NÃO reinicie a contagem.
// O version.properties do projeto fica apenas como valor inicial de referência.
val ciVersionName = findProperty("appVersionName") as String?
val ciVersionCode = (findProperty("appVersionCode") as String?)?.toIntOrNull()

val projectVersionFile = rootProject.file("version.properties")
val projectVersionProps = Properties().apply {
    if (projectVersionFile.exists()) projectVersionFile.inputStream().use { load(it) }
}
val persistentCounter = File(gradle.gradleUserHomeDir, "tconnect-build.properties")
val counterProps = Properties().apply {
    if (persistentCounter.exists()) persistentCounter.inputStream().use { load(it) }
}

// Lê o contador persistente primeiro; se não existir, usa o do projeto; senão 5.
var buildNumber = (counterProps.getProperty("BUILD")
    ?: projectVersionProps.getProperty("BUILD")
    ?: "5").toInt()

val isBuilding = gradle.startParameter.taskNames.any { n ->
    listOf("assemble", "bundle", "install").any { n.contains(it, ignoreCase = true) }
}
if (ciVersionName == null && isBuilding) {
    buildNumber += 1
    // Guarda no contador persistente (fora do projeto) e também no do projeto.
    counterProps.setProperty("BUILD", buildNumber.toString())
    persistentCounter.outputStream().use { counterProps.store(it, "T-Connect contador persistente de build") }
    projectVersionProps.setProperty("BUILD", buildNumber.toString())
    projectVersionFile.outputStream().use { projectVersionProps.store(it, "T-Connect build counter (ref)") }
    println("T-Connect versão: 2.39.$buildNumber (versionCode ${2400 + buildNumber})")
}
val appVersionName = ciVersionName ?: "2.39.$buildNumber"
val appVersionCode = ciVersionCode ?: (2400 + buildNumber)

// Assinatura: lê de keystore.properties (local) OU de variáveis de ambiente (CI).
val keystoreProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun signCfg(propKey: String, envKey: String): String? =
    keystoreProps.getProperty(propKey) ?: System.getenv(envKey)
val storeFilePath = signCfg("storeFile", "KEYSTORE_FILE")

android {
    namespace = "com.tconnect.child"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
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

    signingConfigs {
        // Chave de assinatura FIXA do T-Connect, versionada no repositório.
        // Garante que TODAS as compilações (debug e release, no CI ou local) são
        // assinadas sempre com a MESMA chave — assim é possível atualizar o app por
        // cima do anterior sem desinstalar (sem o erro de "conflito de pacote").
        create("tconnect") {
            storeFile = file("tconnect-signing.jks")
            storePassword = "tconnect2026"
            keyAlias = "tconnect"
            keyPassword = "tconnect2026"
        }
        create("release") {
            if (storeFilePath != null) {
                storeFile = file(storeFilePath)
                storePassword = signCfg("storePassword", "KEYSTORE_PASSWORD")
                keyAlias = signCfg("keyAlias", "KEY_ALIAS")
                keyPassword = signCfg("keyPassword", "KEY_PASSWORD")
            }
        }
    }

    flavorDimensions += "app"
    productFlavors {
        create("child") {
            dimension = "app"
            applicationId = "com.tconnect.child"
            buildConfigField(
                "String",
                "START_URL",
                "\"https://appassets.androidplatform.net/assets/tc236/child/index.html\""
            )
        }
        create("guardian") {
            dimension = "app"
            applicationId = "com.tconnect.guardian"
            buildConfigField(
                "String",
                "START_URL",
                "\"https://appassets.androidplatform.net/assets/tc236/guardian/index.html\""
            )
        }
    }

    buildTypes {
        // O CI compila as variantes "debug"; assinamo-las com a chave FIXA do T-Connect
        // (em vez da debug.keystore gerada ao acaso em cada runner, que mudava a assinatura
        // a cada build e causava o "conflito de pacote" ao atualizar).
        getByName("debug") {
            signingConfig = signingConfigs.getByName("tconnect")
        }
        getByName("release") {
            isMinifyEnabled = false
            // Usa a chave personalizada (keystore.properties/env) se existir; senão, a chave FIXA.
            signingConfig = if (storeFilePath != null)
                signingConfigs.getByName("release")
            else
                signingConfigs.getByName("tconnect")
        }
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core:1.13.1")
}
