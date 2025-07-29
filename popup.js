document.addEventListener('DOMContentLoaded', function () {
    // Load saved settings
    chrome.storage.local.get([
        'phoneReplacement', 'ipReplacement', 'emailReplacement', 'urlReplacement'
    ], function (data) {
        document.getElementById('phoneReplacement').value = data.phoneReplacement || '[PHONE NUMBER]';
        document.getElementById('ipReplacement').value = data.ipReplacement || '[ran.ran.ip.addr]';
        document.getElementById('emailReplacement').value = data.emailReplacement || '[email@gmail.com]';
        document.getElementById('urlReplacement').value = data.urlReplacement || '[example.com]';
    });

    // Save settings
    document.getElementById('saveSettings').addEventListener('click', function () {
        const settings = {
            phoneReplacement: document.getElementById('phoneReplacement').value,
            ipReplacement: document.getElementById('ipReplacement').value,
            emailReplacement: document.getElementById('emailReplacement').value,
            urlReplacement: document.getElementById('urlReplacement').value
        };

        chrome.storage.local.set(settings, function () {
            showStatus('Settings saved successfully!', 'success');
        });
    });

    // Test AI model
    document.getElementById('testModel').addEventListener('click', function () {
        showStatus('Testing AI model...', 'success');

        chrome.runtime.sendMessage(
            { action: 'predict', text: 'Hello, my name is John Doe and my email is john.doe@example.com' },
            function (response) {
                if (response.success) {
                    showStatus(`AI model working! Found ${response.data.predictions.length} entities.`, 'success');
                } else {
                    showStatus(`AI model error: ${response.error}`, 'error');
                }
            }
        );
    });

    function showStatus(message, type) {
        const statusDiv = document.getElementById('status');
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }
});