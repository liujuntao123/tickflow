pluginManagement {
    repositories {
        // 本机（无 CI 环境变量）访问 maven.google.com 受限 → 优先阿里云镜像；CI runner 直连官方源更快
        if (System.getenv("CI").isNullOrEmpty()) {
            maven("https://maven.aliyun.com/repository/gradle-plugin")
            maven("https://maven.aliyun.com/repository/google")
            maven("https://maven.aliyun.com/repository/central")
        }
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        if (System.getenv("CI").isNullOrEmpty()) {
            maven("https://maven.aliyun.com/repository/google")
            maven("https://maven.aliyun.com/repository/central")
        }
        google()
        mavenCentral()
    }
}

rootProject.name = "TickFlow"
include(":app")