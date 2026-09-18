cmake_minimum_required(VERSION 3.16)
project(HyperDM VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find packages
find_package(CURL REQUIRED)
find_package(nlohmann_json REQUIRED)
find_package(Qt6 COMPONENTS Core Gui Widgets Network REQUIRED)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

# Core Library
add_library(CoreLib
    src/core/DownloadJob.cpp
    src/core/ChunkManager.cpp
    src/core/HlsParser.cpp
)
target_link_libraries(CoreLib PRIVATE CURL::libcurl Qt6::Core Qt6::Network)

# Define Native Host Executable
add_executable(NativeHost 
    native_host/main.cpp
)
target_link_libraries(NativeHost PRIVATE nlohmann_json::nlohmann_json Qt6::Core Qt6::Network)

# Define Qt GUI Executable
add_executable(HyperDM_GUI
    src/gui/main.cpp
    src/gui/MainWindow.cpp
    src/gui/MainWindow.h
)
target_link_libraries(HyperDM_GUI PRIVATE CoreLib Qt6::Widgets Qt6::Network nlohmann_json::nlohmann_json)
