🔐 SecurePrompt – Privacy Information Masker

SecurePrompt is a Chrome extension that automatically detects and masks sensitive information in AI prompts to protect your privacy. It prevents accidental sharing of personal data like emails, phone numbers, and account numbers when interacting with AI platforms.

✨ Features

    🔹 Real-Time Masking – Automatically hides sensitive information before sending prompts.

    🔹 Regex + ML Hybrid Detection – Uses pattern matching and a trained anonymizer model for accuracy.

    🔹 Privacy-First – Works entirely in your browser; no data leaves your system.

    🔹 Lightweight Chrome Extension – Easy to install and use.

🧠 Machine Learning Model

SecurePrompt integrates an Open PII Masking 500K English Anonymizer model to detect and anonymize sensitive data.

    ⚠ Note: The ML model is not included in this repository due to size and licensing considerations.
    The extension in this repo uses regex-based masking by default.

🎥 Demo Video

Check out the working demo of SecurePrompt on YouTube: [![Secureprompt Project Demo](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/vqDXX9u62uY?feature=shared)

🛠️ Tech Stack
Layer	Technologies / Tools
Frontend	HTML5, CSS3, JavaScript
Extension	Chrome Extension (Manifest V3)
Detection Logic	Regex + Lightweight ML (Open PII Masking)
ML Framework	TensorFlow.js (for local inference)
🚀 Installation

    Clone this repository

    git clone https://github.com/your-username/secureprompt.git
    cd secureprompt

    Open Chrome and navigate to chrome://extensions/

    Enable Developer Mode (top-right)

    Click Load Unpacked and select the project folder

    The extension will now appear in your Chrome toolbar.

📝 Usage

    Open an AI platform like ChatGPT or Bard.

    Type a prompt containing sensitive information.

    SecurePrompt will mask sensitive data before sending.

    Check the masked output to ensure your privacy is protected.

📹 Project Demo 
    
    https://youtu.be/vqDXX9u62uY?feature=shared

🎥 Watch on YouTube: SecurePrompt – Privacy Information Masker Demo
🤝 Contributing

We welcome contributions!

    Fork the repository

    Create a new branch (git checkout -b feature-name)

    Commit your changes (git commit -m "Added new feature")

    Push your branch (git push origin feature-name)

    Open a Pull Request


📧 Contact

Krishna J

    GitHub: KrishnaJ0324

    Email: krishna0324@yahoo.com

