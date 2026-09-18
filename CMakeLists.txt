cmake_minimum_required(VERSION 3.16)
project(HyperDM VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find packages
find_package(CURL REQUIRED)
find_package(nlohmann_json REQUIRED)

# Core Library
add_library(CoreLib
    src/core/DownloadJob.cpp
    src/core/ChunkManager.cpp
)
target_link_libraries(CoreLib PRIVATE CURL::libcurl)

# Define Native Host Executable
add_executable(NativeHost 
    native_host/main.cpp
)
target_link_libraries(NativeHost PRIVATE CoreLib nlohmann_json::nlohmann_json)
