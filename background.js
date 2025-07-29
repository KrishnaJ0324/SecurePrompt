import { pipeline, env } from './lib/transformers.js';

// Configure transformers.js for Chrome Extensions
// This tells the library where to store downloaded models locally within the extension.
env.localModelPath = chrome.runtime.getURL('models/');
// Prevent the library from trying to download models from external URLs,
// which is restricted by Chrome Extension CSP.
env.allowRemoteModels = true;
// Set the cache directory for models (important for persistent storage)
env.cacheDir = 'models/';

let tokenClassifier = null;
let isModelLoading = false;
let modelLoadPromise = null;

// Initialize the model when the extension starts
async function initializeModel() {
    if (isModelLoading) {
        return modelLoadPromise;
    }

    if (tokenClassifier) {
        return tokenClassifier;
    }

    isModelLoading = true;

    modelLoadPromise = loadModel();

    try {
        tokenClassifier = await modelLoadPromise;
        console.log('Token classification model loaded successfully');
        return tokenClassifier;
    } catch (error) {
        console.error('Failed to load token classification model:', error);
        tokenClassifier = null;
        throw error;
    } finally {
        isModelLoading = false;
    }
}

async function loadModel() {
    try {
        // Using a browser-compatible NER model from Xenova
        // 'Xenova/bert-base-NER' is a good general-purpose Named Entity Recognition model.
        const pipe = await pipeline('token-classification', 'Xenova/bert-base-NER', {
            revision: 'main',
            // You can specify a local path for the model if you pre-download it,
            // but `env.localModelPath` handles this automatically for `transformers.js`.
        });
        return pipe;
    } catch (error) {
        console.error('ML model failed to load or initialize:', error);
        // Return null to indicate model loading failed, so regex fallback is used.
        return null;
    }
}

// Enhanced regex-based privacy detection as fallback
function detectPrivacyEntitiesWithRegex(text) {
    const entities = [];

    // Phone number patterns
    const phoneRegex = /\+?\d{2}?\s?\(?\d{3}\)?\s?\-?\d{2}\s?\d\s?\-?\d{4}|\(?\d{3}\)?\s?\-?\d{2}\s?\d\s?\-?\d{4}|\+?[\d\s\-\(\)]{10,}/g;
    let match;
    while ((match = phoneRegex.exec(text)) !== null) {
        entities.push({
            entity: 'PHONE',
            word: match[0],
            score: 0.95,
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // Email patterns
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})*/g;
    while ((match = emailRegex.exec(text)) !== null) {
        entities.push({
            entity: 'EMAIL',
            word: match[0],
            score: 0.98,
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // IP address patterns
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    while ((match = ipRegex.exec(text)) !== null) {
        entities.push({
            entity: 'IP_ADDRESS',
            word: match[0],
            score: 0.92,
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // URL patterns
    const urlRegex = /(https?:\/\/)?(?:[a-zA-Z0-9-]*[a-zA-Z][a-zA-Z0-9-]*\.)+([a-zA-Z]){2,}(:[0-9]+)?(\/[a-zA-Z0-9&%_./-]*)?/g;
    while ((match = urlRegex.exec(text)) !== null) {
        entities.push({
            entity: 'URL',
            word: match[0],
            score: 0.90,
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // Credit card patterns (basic, not exhaustive)
    const creditCardRegex = /\b(?:\d{4}[\s-]?){3}\d{4}\b/g;
    while ((match = creditCardRegex.exec(text)) !== null) {
        entities.push({
            entity: 'CREDIT_CARD',
            word: match[0],
            score: 0.88,
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // Social Security Number patterns (US format)
    const ssnRegex = /\b\d{3}-?\d{2}-?\d{4}\b/g;
    while ((match = ssnRegex.exec(text)) !== null) {
        entities.push({
            entity: 'SSN',
            word: match[0],
            score: 0.93,
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // Address patterns (basic, highly variable)
    const addressRegex = /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Place|Pl|Square|Sq|Terrace|Ter|Way|Wy)\b/gi;
    while ((match = addressRegex.exec(text)) !== null) {
        entities.push({
            entity: 'ADDRESS',
            word: match[0],
            score: 0.75,
            start: match.index,
            end: match.index + match[0].length
        });
    }

    // Date patterns (various common formats)
    const dateRegex = /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4})\b/gi;
    while ((match = dateRegex.exec(text)) !== null) {
        entities.push({
            entity: 'DATE',
            word: match[0],
            score: 0.70,
            start: match.index,
            end: match.index + match[0].length
        });
    }

    return entities;
}

// Group tokens using BIO scheme (adapted for both ML and regex results)
function groupTokens(predictions) {
    const grouped = [];
    let currentEntity = null;

    // Sort predictions by start position if available to handle overlapping/adjacent entities correctly
    const sortedPredictions = predictions.sort((a, b) => {
        if (a.start !== undefined && b.start !== undefined) {
            return a.start - b.start;
        }
        return 0; // Maintain original order if start/end not available (e.g., from simple regex)
    });

    for (const token of sortedPredictions) {
        const { entity, word, score } = token;

        // Handle BIO format if present (from ML models)
        if (entity.startsWith('B-')) {
            // Start of a new entity
            if (currentEntity) {
                currentEntity.word = currentEntity.word.trim(); // Trim previous entity's word
                grouped.push(currentEntity);
            }

            currentEntity = {
                entity: entity.slice(2), // remove "B-"
                score: score,
                word: word,
            };
        } else if (entity.startsWith('I-') && currentEntity && currentEntity.entity === entity.slice(2)) {
            // Continuation of the same entity
            currentEntity.word += word;
            currentEntity.score = Math.min(currentEntity.score, score); // conservative score
        } else {
            // Not part of any recognized BIO entity or a direct entity from regex
            if (currentEntity) {
                currentEntity.word = currentEntity.word.trim();
                grouped.push(currentEntity);
                currentEntity = null;
            }

            // If it's a direct entity (not BIO format, and not 'O' for 'Other'), add it directly
            if (!entity.startsWith('O') && entity !== 'O') {
                grouped.push({
                    entity: entity,
                    score: score,
                    word: word.trim()
                });
            }
        }
    }

    if (currentEntity) {
        currentEntity.word = currentEntity.word.trim();
        grouped.push(currentEntity);
    }

    return grouped;
}

// Message handler for content script communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'predictTokens') {
        handleTokenPrediction(request.text)
            .then(result => sendResponse({ success: true, predictions: result }))
            .catch(error => {
                console.error('Token prediction error:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Indicates we'll send a response asynchronously
    }
});

async function handleTokenPrediction(inputText) {
    let rawPredictions = [];

    // Try to use ML model first
    try {
        if (!tokenClassifier) {
            await initializeModel();
        }

        if (tokenClassifier) {
            console.log('Using ML model for token classification');
            rawPredictions = await tokenClassifier(inputText);
        }
    } catch (modelError) {
        console.warn('ML model failed or not loaded, using regex fallback:', modelError);
    }

    // Always use regex detection as fallback or enhancement
    const regexEntities = detectPrivacyEntitiesWithRegex(inputText);

    // Combine ML and regex results
    // Prioritize ML predictions if they overlap with regex, or merge unique ones.
    const allPredictions = [...rawPredictions];

    // Add regex entities, avoiding duplicates if ML already found them
    for (const regexEnt of regexEntities) {
        const isDuplicate = allPredictions.some(mlEnt =>
            mlEnt.word === regexEnt.word && mlEnt.entity === regexEnt.entity
        );
        if (!isDuplicate) {
            allPredictions.push(regexEnt);
        }
    }

    console.log('Combined raw predictions:', allPredictions);

    // Group tokens using BIO scheme
    const grouped = groupTokens(allPredictions);

    console.log('Grouped predictions:', grouped);

    return grouped;
}

// Initialize model when extension starts
chrome.runtime.onStartup.addListener(() => {
    initializeModel().catch(error => {
        console.error('Failed to initialize model on startup:', error);
    });
});

chrome.runtime.onInstalled.addListener(() => {
    initializeModel().catch(error => {
        console.error('Failed to initialize model on install:', error);
    });
});

chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
    });
});