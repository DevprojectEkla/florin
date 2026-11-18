# 💰 Florin

**Your personal finance tracker, simplified.**

Florin is a desktop application for managing your personal finances with privacy-first approach. All your data stays on your device.

![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- 📊 **Dashboard** - Visual overview of income, expenses, and balance
- 💳 **Transaction Management** - Import and categorize bank transactions
- 📁 **Category System** - Flexible categories (income, fixed, variable, savings, capital investments)
- 📈 **Budget Tracking** - Set and monitor monthly budgets
- 💼 **Investment Portfolio** - Track your savings and capital investments
- 🌍 **Multi-language** - French and English support
- 🔒 **Privacy-first** - All data stored locally with password protection
- 🏦 **Bank Import** - Support for Crédit Agricole Excel exports

## 📦 Installation

### Linux

#### Debian/Ubuntu (.deb)
```bash
# Download the .deb package from the latest release
wget https://github.com/DevprojectEkla/florin/releases/download/v0.4.0/Florin_0.4.0_amd64.deb

# Install
sudo dpkg -i Florin_0.4.0_amd64.deb

# Fix dependencies if needed
sudo apt-get install -f
```

#### Fedora/RHEL/CentOS (.rpm)
```bash
# Download the .rpm package from the latest release
wget https://github.com/DevprojectEkla/florin/releases/download/v0.4.0/Florin-0.4.0-1.x86_64.rpm

# Install
sudo rpm -i Florin-0.4.0-1.x86_64.rpm
```

#### Arch Linux (.pkg.tar.zst)
```bash
# Download the .pkg.tar.zst package from the latest release, then:
sudo pacman -U florin-*.pkg.tar.zst
```

Or build it yourself from a checkout (needs `rust`, `nodejs`, `npm`, `webkit2gtk-4.1`, `gtk3`):
```bash
cd packaging/arch
makepkg -si
```

### Windows

Download `Florin_0.4.0_x64_en-US.msi` from the [releases page](https://github.com/DevprojectEkla/florin/releases) and run the installer.

### macOS

Download `Florin_0.4.0_universal.dmg` from the [releases page](https://github.com/DevprojectEkla/florin/releases), open it, and drag Florin to your Applications folder.

### Android

Download `florin-v0.4.0-android.apk` from the [releases page](https://github.com/DevprojectEkla/florin/releases) and install it on your Android device.

**Installation Steps:**
1. Enable "Install from Unknown Sources" in your Android device settings
2. Download the APK file to your device
3. Open the APK file and tap "Install"
4. Launch Florin from your app drawer

**Requirements:** Android 7.0 (API 24) or higher

## 🚀 Quick Start

1. **Launch Florin** - Open the application from your applications menu (or app drawer on Android)
2. **Set Password** - Create a password to protect your data (default dev password: `testtest`)
3. **Create Account** - Add your bank account information
4. **Import Transactions** - Import your first bank statement (Excel format from Crédit Agricole)
5. **Categorize** - Assign categories to your transactions
6. **Track** - Monitor your finances on the dashboard

## 🔄 Updates

- **Windows, macOS, Linux AppImage**: Florin checks GitHub for a newer version when it starts and offers to download and install it (Settings > Updates). Updates are signed; the app refuses anything that doesn't match its built-in public key. You can turn the launch check off in Settings > Updates.
- **.deb / .rpm / Arch**: Florin tells you a new version exists and links to the release page; install it with your package manager (`dpkg`, `rpm`, `pacman -U`).
- **Android**: install the new APK manually.

Updates arrive from the `latest.json` file attached to each published GitHub release. Draft releases are not offered to users until published.

### Releasing (maintainers)

Release builds are signed with the Tauri updater key. The private key lives only in the GitHub secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (and in a private backup); the public key is in `src-tauri/tauri.conf.json`. Losing the private key means installed apps can no longer be updated. Local `npm run tauri build` needs the same two variables exported, or add `--config '{"bundle":{"createUpdaterArtifacts":false}}'` to skip signing.

## 🛠️ Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20.19+ or v22.12+)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

### Installation

```bash
# Clone the repository
git clone https://github.com/DevprojectEkla/florin.git
cd florin

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Building

```bash
# Build for production
npm run tauri build

# Outputs will be in src-tauri/target/release/bundle/
```

### Building for Android

```bash
# Prerequisites
# - Android SDK installed
# - Android NDK installed  
# - Java Development Kit (JDK) 17 or higher

# Add Android Rust targets (one-time setup)
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android

# Initialize Android project (one-time setup)
npm run tauri android init

# Build APK
npm run tauri android build

# Output: src-tauri/gen/android/app/build/outputs/apk/
```

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri 2.0 + Rust
- **Database**: SQLite (via Tauri SQL plugin)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **i18n**: react-i18next
- **Parsing**: SheetJS (xlsx)
- **Auth**: Argon2 password hashing

## 📁 Project Structure

```
florin/
├── src/                      # React frontend
│   ├── components/          # UI components
│   ├── pages/              # Page components
│   ├── db/                 # Database layer
│   ├── hooks/              # React hooks
│   ├── lib/                # Utilities
│   ├── locales/            # i18n translations
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/                # Rust source code
│   └── Cargo.toml          # Rust dependencies
└── package.json            # Node dependencies
```

## 🔐 Security

- **Password Protection**: Your data is protected with Argon2 password hashing
- **Local Storage**: All data stored locally in SQLite database
- **No Cloud**: No data sent to external servers
- **Privacy-first**: Your financial data never leaves your device

## 📝 Database Location

Your data is stored in:
- **Linux**: `~/.config/com.devprojectekla.florin/florin.db`
- **Windows**: `%APPDATA%\com.devprojectekla.florin\florin.db`
- **macOS**: `~/Library/Application Support/com.devprojectekla.florin/florin.db`
- **Android**: `/data/data/com.devprojectekla.florin/databases/florin.db` (internal storage)

## 🌐 Supported Languages

- 🇫🇷 French (Français)
- 🇬🇧 English

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Development

### Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

### Available Scripts

```bash
npm run dev          # Start Vite dev server
npm run build        # Build frontend
npm run tauri dev    # Run Tauri in development mode
npm run tauri build  # Build production bundle
```

## 🐛 Known Issues

- AppImage build may fail on some Linux distributions (use .deb or .rpm instead)
- Node.js v21.x shows Vite warning (use v20.19+ or v22.12+ for best compatibility)

## 📮 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/DevprojectEkla/florin/issues).

---

Made with ❤️ by DevprojectEkla
