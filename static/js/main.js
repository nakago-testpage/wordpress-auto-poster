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
    const keywordsInput = document.getElementById('keywords');
    const loading = document.getElementById('loading');
    const alertContainer = document.getElementById('alert-container');

    // Article Preview Elements
    const previewContainer = document.getElementById('article-preview-container');
    const previewTitle = document.getElementById('article-title-preview');
    const previewContent = document.getElementById('article-preview-content');
    const postBtn = document.getElementById('postBtn');
    const editBtn = document.getElementById('editBtn');

    // Markdown Editor Elements
    const editorContainer = document.getElementById('markdown-editor-container');
    const articleTitleInput = document.getElementById('articleTitle');
    const articleContentInput = document.getElementById('articleContent');
    const updatePreviewBtn = document.getElementById('updatePreviewBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    // Holds the state of the article being worked on
    let currentArticle = {
        title: '',
        html_content: '',
        markdown_content: ''
    };

    // Manual Post Elements
    const manualPostBtn = document.getElementById('manualPostBtn');
    const manualPreviewBtn = document.getElementById('manualPreviewBtn');
    const manualTitleInput = document.getElementById('manualTitle');
    const manualContentInput = document.getElementById('manualContent');

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
    }

    function toggleLoading(isLoading) {
        loading.style.display = isLoading ? 'inline-block' : 'none';
        generateBtn.disabled = isLoading;
    }

    function showPreview() {
        previewContainer.style.display = 'block';
        editorContainer.style.display = 'none';
    }

    function showEditor() {
        previewContainer.style.display = 'none';
        editorContainer.style.display = 'block';
        // Populate editor with current article data
        articleTitleInput.value = currentArticle.title;
        articleContentInput.value = currentArticle.markdown_content;
    }

    function hideEditor() {
        editorContainer.style.display = 'none';
        previewContainer.style.display = 'block';
    }

    function updateArticleState(data) {
        currentArticle.title = data.title;
        currentArticle.html_content = data.html_content;
        currentArticle.markdown_content = data.markdown_content;

        // Update preview
        previewTitle.textContent = currentArticle.title;
        previewContent.innerHTML = currentArticle.html_content;
    }

    async function handleGenerateArticle() {
        const keywords = keywordsInput.value.trim();
        const openaiApiKey = localStorage.getItem('openaiApiKey');

        if (!keywords) {
            showAlert(T.keywords_placeholder, 'warning');
            return;
        }
        // The check for openaiApiKey is removed to allow server-side key usage.
        // The backend will now check for an environment variable if no key is provided.

        toggleLoading(true);
        previewContainer.style.display = 'none';
        editorContainer.style.display = 'none';

        try {
            const response = await fetch('/generate-article', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords, openai_api_key: openaiApiKey }),
            });

            const data = await response.json();

            if (response.ok) {
                updateArticleState(data);
                showPreview();
            } else {
                showAlert(data.error || 'An unknown error occurred.');
            }
        } catch (error) {
            showAlert('Failed to connect to the server. Please try again.');
        } finally {
            toggleLoading(false);
        }
    }

    async function handleUpdatePreview() {
        const newMarkdown = articleContentInput.value;
        const newTitle = articleTitleInput.value;

        try {
            const response = await fetch('/convert-markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown_text: newMarkdown })
            });
            const data = await response.json();

            if (response.ok) {
                // Update state with new title and converted HTML
                currentArticle.title = newTitle;
                currentArticle.html_content = data.html_content;
                currentArticle.markdown_content = newMarkdown;

                // Update preview display and switch back
                previewTitle.textContent = currentArticle.title;
                previewContent.innerHTML = currentArticle.html_content;
                hideEditor();
            } else {
                showAlert(data.error || 'Failed to update preview.');
            }
        } catch (error) {
            showAlert('Failed to connect to server for preview update.');
        }
    }

    async function handlePostToWordPress() {
        const { title, html_content } = currentArticle;
        const wpUrl = localStorage.getItem('wpUrl');
        const wpUsername = localStorage.getItem('wpUsername');
        const wpPassword = localStorage.getItem('wpPassword');

        if (!title || !html_content) {
            showAlert(T.alert_title_content_required);
            return;
        }
        if (!wpUrl || !wpUsername || !wpPassword) {
            showAlert(T.alert_wp_creds_missing);
            return;
        }

        postBtn.disabled = true;
        postBtn.textContent = T.alert_posting;

        try {
            const response = await fetch('/post-to-wordpress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: title,
                    content: html_content, // Send the final HTML content
                    wp_url: wpUrl, 
                    wp_username: wpUsername, 
                    wp_password: wpPassword 
                }),
            });

            const data = await response.json();

            if (response.ok) {
                let successMsg = T.alert_post_success.replace('{title}', title);
                if (data.url) {
                    successMsg += ` <a href="${data.url}" target="_blank">${T.wp_url_label}</a>`;
                }
                showAlert(successMsg, 'success');
            } else {
                showAlert(data.error || 'An unknown error occurred during posting.');
            }
        } catch (error) {
            showAlert('Failed to connect to the WordPress server.');
        } finally {
            postBtn.disabled = false;
            postBtn.textContent = T.post_btn;
        }
    }

    async function handleManualPreview() {
        const title = manualTitleInput.value.trim();
        const markdownContent = manualContentInput.value.trim();

        if (!title || !markdownContent) {
            showAlert(T.alert_title_content_required, 'warning');
            return;
        }

        try {
            const response = await fetch('/convert-markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown_text: markdownContent })
            });
            const data = await response.json();

            if (response.ok) {
                updateArticleState({
                    title: title,
                    html_content: data.html_content,
                    markdown_content: markdownContent
                });
                showPreview();
            } else {
                showAlert(data.error || 'Failed to update preview.', 'danger');
            }
        } catch (error) {
            showAlert(`Error: ${error.message}`, 'danger');
        }
    }

    async function handleManualPost() {
        const title = manualTitleInput.value.trim();
        const markdownContent = manualContentInput.value.trim();
        const wpUrl = localStorage.getItem('wpUrl');
        const wpUsername = localStorage.getItem('wpUsername');
        const wpPassword = localStorage.getItem('wpPassword');

        if (!title || !markdownContent) {
            showAlert(T.alert_title_content_required, 'warning');
            return;
        }

        if (!wpUrl || !wpUsername || !wpPassword) {
            showAlert(T.alert_wp_creds_missing, 'warning');
            return;
        }

        manualPostBtn.disabled = true;
        manualPostBtn.textContent = T.alert_posting;

        try {
            // Step 1: Convert Markdown to HTML
            const convertResponse = await fetch('/convert-markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markdown_text: markdownContent })
            });

            const convertData = await convertResponse.json();
            if (!convertResponse.ok) {
                throw new Error(convertData.error || 'Failed to convert Markdown.');
            }
            const htmlContent = convertData.html_content;

            // Step 2: Post to WordPress
            const postResponse = await fetch('/post-to-wordpress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    content: htmlContent,
                    wp_url: wpUrl,
                    wp_username: wpUsername,
                    wp_password: wpPassword
                }),
            });

            const postData = await postResponse.json();

            if (postResponse.ok) {
                let successMsg = T.alert_post_success.replace('{title}', title);
                if (postData.url) {
                    successMsg += ` <a href="${postData.url}" target="_blank">${T.wp_url_label}</a>`;
                }
                showAlert(successMsg, 'success');
                manualTitleInput.value = ''; // Clear fields on success
                manualContentInput.value = '';
            } else {
                showAlert(postData.error || 'An unknown error occurred during posting.', 'danger');
            }
        } catch (error) {
            showAlert(`Error: ${error.message}`, 'danger');
        } finally {
            manualPostBtn.disabled = false;
            manualPostBtn.textContent = T.manual_post_btn;
        }
    }

    function saveSettings() {
        localStorage.setItem('openaiApiKey', document.getElementById('openaiApiKey').value);
        localStorage.setItem('wpUrl', document.getElementById('wpUrl').value);
        localStorage.setItem('wpUsername', document.getElementById('wpUsername').value);
        localStorage.setItem('wpPassword', document.getElementById('wpPassword').value);
        
        const settingsModal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        settingsModal.hide();
        showAlert(T.alert_settings_saved, 'success');
    }

    function loadSettings() {
        document.getElementById('openaiApiKey').value = localStorage.getItem('openaiApiKey') || '';
        document.getElementById('wpUrl').value = localStorage.getItem('wpUrl') || '';
        document.getElementById('wpUsername').value = localStorage.getItem('wpUsername') || '';
        document.getElementById('wpPassword').value = localStorage.getItem('wpPassword') || '';
    }

    // --- Event Listeners ---
    if (generateBtn) generateBtn.addEventListener('click', handleGenerateArticle);
    if (postBtn) postBtn.addEventListener('click', handlePostToWordPress);
    if (editBtn) editBtn.addEventListener('click', showEditor);
    if (updatePreviewBtn) updatePreviewBtn.addEventListener('click', handleUpdatePreview);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', hideEditor);
    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
    if (manualPostBtn) manualPostBtn.addEventListener('click', handleManualPost);
    if (manualPreviewBtn) manualPreviewBtn.addEventListener('click', handleManualPreview);

    // Load settings from localStorage on page load
    loadSettings();
});
