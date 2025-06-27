document.addEventListener('DOMContentLoaded', () => {
    // Settings Modal Elements
    const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const wpUrlInput = document.getElementById('wpUrl');
    const wpUsernameInput = document.getElementById('wpUsername');
    const wpPasswordInput = document.getElementById('wpPassword');

    // General UI Elements
    const generateBtn = document.getElementById('generateBtn');
    const postBtn = document.getElementById('postBtn');
    const keywordsInput = document.getElementById('keywords');
    const articleTitleInput = document.getElementById('articleTitle');
    const articleContentInput = document.getElementById('articleContent');
    const loading = document.getElementById('loading');
    const alertContainer = document.getElementById('alert-container');

    // --- Helper Functions ---

    // Show dynamic Bootstrap alerts
    const showAlert = (message, type = 'info') => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        alertContainer.innerHTML = ''; // Clear previous alerts
        alertContainer.append(wrapper);
    };

    // Update post button state based on whether title and content exist
    const updatePostButtonState = () => {
        const hasTitle = articleTitleInput.value.trim() !== '';
        const hasContent = articleContentInput.value.trim() !== '';
        postBtn.disabled = !(hasTitle && hasContent);
    };

    // Load saved settings from localStorage
    const loadSettings = () => {
        openaiApiKeyInput.value = localStorage.getItem('openaiApiKey') || '';
        wpUrlInput.value = localStorage.getItem('wpUrl') || '';
        wpUsernameInput.value = localStorage.getItem('wpUsername') || '';
        wpPasswordInput.value = localStorage.getItem('wpPassword') || '';
    };

    // Save settings to localStorage
    const saveSettings = () => {
        localStorage.setItem('openaiApiKey', openaiApiKeyInput.value);
        localStorage.setItem('wpUrl', wpUrlInput.value);
        localStorage.setItem('wpUsername', wpUsernameInput.value);
        localStorage.setItem('wpPassword', wpPasswordInput.value);
        showAlert(T.alert_settings_saved, 'success');
        settingsModal.hide();
    };

    // --- Event Listeners ---

    // Update post button state on manual input
    articleTitleInput.addEventListener('input', updatePostButtonState);
    articleContentInput.addEventListener('input', updatePostButtonState);

    // Save settings
    saveSettingsBtn.addEventListener('click', saveSettings);

    // Generate Article
    generateBtn.addEventListener('click', async () => {
        const keywords = keywordsInput.value;
        const openaiApiKey = openaiApiKeyInput.value;

        if (!keywords) {
            showAlert(T.alert_keywords_required, 'warning');
            return;
        }
        if (!openaiApiKey) {
            showAlert(T.alert_openai_key_required, 'warning');
            return;
        }

        loading.style.display = 'inline-block';
        generateBtn.disabled = true;

        try {
            const response = await fetch('/generate-article', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords, openai_api_key: openaiApiKey }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            articleTitleInput.value = data.title;
            articleContentInput.value = data.content;
            updatePostButtonState();

        } catch (error) {
            showAlert(T.alert_error.replace('{message}', error.message), 'danger');
        } finally {
            loading.style.display = 'none';
            generateBtn.disabled = false;
        }
    });

    // Post to WordPress
    postBtn.addEventListener('click', async () => {
        const title = articleTitleInput.value;
        const content = articleContentInput.value;
        const wpUrl = wpUrlInput.value;
        const wpUsername = wpUsernameInput.value;
        const wpPassword = wpPasswordInput.value;

        if (!wpUrl || !wpUsername || !wpPassword) {
            showAlert(T.alert_wp_credentials_required, 'warning');
            settingsModal.show();
            return;
        }

        loading.style.display = 'inline-block';
        postBtn.disabled = true;
        showAlert(T.alert_posting, 'info');

        try {
            const response = await fetch('/post-to-wordpress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    content,
                    wp_url: wpUrl,
                    wp_username: wpUsername,
                    wp_password: wpPassword,
                }),
            });

            const result = await response.json();

            if (response.ok) {
                const successMessage = `
                    ${T.alert_post_success.replace('{title}', title)}
                    <a href="${result.url}" target="_blank" class="alert-link">${result.url}</a>
                `;
                showAlert(successMessage, 'success');
                // Clear fields after successful post
                articleTitleInput.value = '';
                articleContentInput.value = '';
                keywordsInput.value = '';
                updatePostButtonState();
            } else {
                throw new Error(result.error || 'Failed to post.');
            }
        } catch (error) {
            showAlert(T.alert_error.replace('{message}', error.message), 'danger');
        } finally {
            loading.style.display = 'none';
            // Re-enable button but let updatePostButtonState decide final state
            postBtn.disabled = false;
            updatePostButtonState();
        }
    });

    // --- Initial Load ---
    loadSettings();
    updatePostButtonState(); // Initial check for post button state
});
