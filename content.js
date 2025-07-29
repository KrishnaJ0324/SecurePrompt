// content.js
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// This function is now primarily for initial, fixed regex replacements
// The AI model and more comprehensive regex are in the background script
function replacePrvateInfo(paragraph, phoneReplacement, ipReplacement, emailReplacement, urlReplacement) {
    const phoneNumber = /\+?\d{2}?\s?\(?\d{3}\)?\s?\-?\d{2}\s?\d\s?\-?\d{4}|\(?\d{3}\)?\s?\-?\d{2}\s?\d\s?\-?\d{4}/g;
    const ipAddress = /\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3}/g;
    const emailPattern = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})*/g;
    const urlPattern = /(https?:\/\/)?(?:[a-zA-Z0-9-]*[a-zA-Z][a-zA-Z0-9-]*\.)+([a-zA-Z]){2,}(:[0-9]+)?(\/[a-zA-Z0-9&%_./-]*)?/g;

    return paragraph.replace(phoneNumber, phoneReplacement).replace(emailPattern, emailReplacement).replace(urlPattern, urlReplacement).replace(ipAddress, ipReplacement);
}

// Function to send message to background script and get token predictions
async function getTokenPredictions(text) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'predictTokens', text: text },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (response.success) {
                    resolve(response.predictions);
                } else {
                    reject(new Error(response.error || 'Unknown error occurred'));
                }
            }
        );
    });
}

async function mainFunction() {
    const elem = document.querySelector("#prompt-textarea");
    const send_btn = document.querySelector("#composer-submit-button");
    const send_arrow = document.querySelector("#composer-submit-button svg");
    const proseMirror = document.querySelector("#prompt-textarea");

    if (!elem) {
        console.log('Target textarea not found, retrying...');
        setTimeout(mainFunction, 1000); // Retry after 1 second
        return;
    }

    const originalText = elem.innerText;

    if (!originalText || originalText.trim().length === 0) {
        console.log('No text to process');
        return;
    }

    // Fetch redaction terms from extension storage
    chrome.storage.local.get([
        'phoneReplacement', 'ipReplacement', 'emailReplacement', 'urlReplacement'
    ], async function (data) {
        const phoneReplacement = data.phoneReplacement || "[PHONE NUMBER]";
        const ipReplacement = data.ipReplacement || "[ran.ran.ip.addr]";
        const emailReplacement = data.emailReplacement || "[email@gmail.com]";
        const urlReplacement = data.urlReplacement || "[example.com]";

        let redactedText = originalText
            .replace(/<br class="ProseMirror-trailingBreak">\s*/g, '') // Remove <br> tags and any trailing spaces
            .replace(/<p>\s*<\/p>/g, '')  // Remove empty <p> tags
            .replaceAll("\r", '') // Removing any CRs
            .trim();  // Remove any leading or trailing spaces;

        // Apply initial regex replacements (these are also covered by background script's regex, but can be a quick first pass)
        redactedText = replacePrvateInfo(redactedText, phoneReplacement, ipReplacement, emailReplacement, urlReplacement);

        // Step 1: Fetch AI-based and comprehensive regex redactions from background script
        try {
            console.log('Requesting token predictions for text:', redactedText.substring(0, Math.min(redactedText.length, 100)) + '...');

            const predictions = await getTokenPredictions(redactedText);

            console.log('Received predictions:', predictions);

            if (predictions && Array.isArray(predictions)) {
                // Sort predictions by length in descending order to avoid partial replacements
                // e.g., replace "John Doe" before "John"
                predictions.sort((a, b) => b.word.length - a.word.length);

                for (const entity of predictions) {
                    // Skip SEX entity and low confidence predictions (adjust score threshold as needed)
                    if (entity.entity !== "SEX" && entity.score >= 0.5) {
                        const placeholder = getPlaceholderForEntity(entity.entity);
                        // Use 'gi' for global and case-insensitive replacement
                        const safeRegex = new RegExp(escapeRegExp(entity.word), 'gi');
                        redactedText = redactedText.replace(safeRegex, placeholder);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to get predictions from background script:", error);
            // If background script fails, redactedText still contains initial regex replacements
        }

        // Apply updated redacted text to the DOM only if it has changed
        if (elem && redactedText !== originalText) {
            elem.innerHTML = redactedText;

            // Visual feedback
            if (send_btn) {
                send_btn.style.background = "linear-gradient(to bottom right,  rgb(0, 255, 255), rgb(255, 0, 255), rgb(255, 255, 0))";
            }
            if (send_arrow) {
                send_arrow.style.filter = "invert(1)";
            }

            // Reset visual feedback on next input
            if (proseMirror) {
                proseMirror.addEventListener("input", () => {
                    if (send_btn) {
                        send_btn.style.background = "#000";
                    }
                    if (send_arrow) {
                        send_arrow.style.filter = "none";
                    }
                }, { once: true });
            }
        }
    });
}

// Function to get appropriate placeholder for different entity types
function getPlaceholderForEntity(entityType) {
    const placeholders = {
        'PHONE': '[PHONE NUMBER]',
        'EMAIL': '[email@gmail.com]',
        'IP_ADDRESS': '[ran.ran.ip.addr]',
        'URL': '[example.com]',
        'CREDIT_CARD': '[CREDIT CARD]',
        'SSN': '[SSN]',
        'ADDRESS': '[ADDRESS]',
        'DATE': '[DATE]',
        'PER': '[PERSON]', // Common NER label for Person
        'PERSON': '[PERSON]',
        'ORG': '[ORGANIZATION]', // Common NER label for Organization
        'ORGANIZATION': '[ORGANIZATION]',
        'LOC': '[LOCATION]', // Common NER label for Location
        'LOCATION': '[LOCATION]',
        'MISC': '[MISC]', // Miscellaneous entity
        'GPE': '[LOCATION]', // Geopolitical Entity (often treated as location)
        'MONEY': '[MONEY]',
        'PERCENT': '[PERCENT]',
        'TIME': '[TIME]',
        'CARDINAL': '[NUMBER]',
        'ORDINAL': '[NUMBER]'
    };

    return placeholders[entityType.toUpperCase()] || `[${entityType.toUpperCase()}]`;
}

// Initialize the function when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mainFunction);
} else {
    mainFunction();
}

// Also run when navigating to new pages (for Single Page Applications like ChatGPT)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        // Give the page some time to render after navigation
        setTimeout(mainFunction, 2000);
    }
}).observe(document, { subtree: true, childList: true });

// Listen for keyboard shortcut to trigger redaction manually
document.addEventListener('keydown', function (event) {
    // Ctrl+Alt+R or Cmd+Alt+R to trigger redaction
    if ((event.ctrlKey || event.metaKey) && event.altKey && event.key === 'r') {
        event.preventDefault();
        mainFunction();
    }
});
