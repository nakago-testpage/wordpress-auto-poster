import os
import json
import openai
import markdown2
import requests
import argparse
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from requests.auth import HTTPBasicAuth

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Secret key for session management

# Load translations from file
try:
    with open('translations.json', 'r', encoding='utf-8') as f:
        translations = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    print("Warning: translations.json not found or is invalid. Using empty translations.")
    translations = {}

def get_language():
    """Gets the user's language from the session."""
    return session.get('language', 'ja')  # Default to Japanese

def get_page_texts(lang):
    """Gets the page texts for the given language."""
    return translations.get(lang, translations.get('en', {}))

@app.route('/')
def index():
    """Renders the main page with the appropriate language."""
    lang = get_language()
    page_texts = get_page_texts(lang)
    return render_template('index.html', T=page_texts, lang=lang)

@app.route('/language/<lang>')
def set_language(lang):
    """Sets the user's language preference in the session."""
    session['language'] = lang
    return redirect(url_for('index'))

@app.route('/generate-article', methods=['POST'])
def generate_article():
    """Generates an article using OpenAI, formats it as Markdown, and converts to HTML."""
    data = request.get_json()
    keywords = data.get('keywords')
    openai_api_key = data.get('openai_api_key')

    if not keywords:
        return jsonify({'error': 'Keywords are required.'}), 400

    # Prioritize API key from the request, but fall back to environment variable
    api_key = openai_api_key or os.environ.get('OPENAI_API_KEY')

    if not api_key:
        page_texts = get_page_texts(get_language())
        error_msg = page_texts.get('alert_api_key_missing', 'OpenAI API key is not configured. Please provide it in the settings or set the OPENAI_API_KEY environment variable on the server.')
        return jsonify({'error': error_msg}), 400

    openai.api_key = api_key
    lang = get_language()
    language_name = "日本語" if lang == "ja" else "English"

    try:
        prompt = f"""
        You are a professional blog writer tasked with creating a high-quality, SEO-friendly blog post in {language_name}.
        The article must be well-structured for the WordPress block editor.

        # Keywords
        {keywords}

        # Instructions
        1.  Create a compelling and relevant title.
        2.  Write the article content using Markdown format.
        3.  The structure must include:
            - A main heading (H2).
            - Several subheadings (H3).
            - Paragraphs, and where appropriate, bulleted or numbered lists.
        4.  Ensure the content is engaging, informative, and optimized for the given keywords.

        # Output Format
        Strictly adhere to the following format. Do not include any other text, explanations, or backticks.
        ---
        Title: [Insert title here]
        ---
        Content:
        ## [Main Heading Here]
        [Paragraphs of text...]

        ### [Subheading Here]
        [Paragraphs of text...]
        """

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a professional blog writer who is an expert in Markdown."},
                {"role": "user", "content": prompt}
            ]
        )

        article_text = response.choices[0].message['content'].strip()

        # Extract title and content from the response
        parts = article_text.split('---')
        if len(parts) >= 3:
            title = parts[1].replace('Title:', '').strip()
            markdown_content = parts[2].replace('Content:', '', 1).strip()
        else:
            # Fallback if the format is not as expected
            title = "Generated Article"
            markdown_content = article_text

        # Convert Markdown to HTML
        html_content = markdown2.markdown(markdown_content)

        return jsonify({
            'title': title,
            'html_content': html_content,
            'markdown_content': markdown_content
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/post-to-wordpress', methods=['POST'])
def post_to_wordpress():
    """Posts the generated article to a WordPress site."""
    data = request.get_json()
    title = data.get('title')
    content = data.get('content')
    wp_url = data.get('wp_url')
    wp_username = data.get('wp_username')
    wp_password = data.get('wp_password')

    if not all([title, content, wp_url, wp_username, wp_password]):
        return jsonify({'error': 'Missing required fields for WordPress posting.'}), 400

    api_url = f"{wp_url.rstrip('/')}/wp-json/wp/v2/posts"
    post_data = {
        'title': title,
        'content': content,
        'status': 'publish'
    }

    try:
        response = requests.post(
            api_url,
            auth=HTTPBasicAuth(wp_username, wp_password),
            json=post_data,
            timeout=30
        )
        response.raise_for_status()  # Raise an exception for bad status codes (4xx or 5xx)

        # If the request was successful, WordPress should return JSON
        response_data = response.json()
        post_url = response_data.get('link', '')

        return jsonify({'message': f'Article "{title}" posted successfully!', 'url': post_url})

    except requests.exceptions.JSONDecodeError:
        # This can happen if WordPress returns a 2xx status but the body is not JSON
        # (e.g., due to a plugin conflict or server misconfiguration).
        print(f"DEBUG: WordPress returned a non-JSON response for a successful request. Response: {response.text}")
        error_message = "WordPress returned an unexpected response. This might be due to a plugin conflict or server misconfiguration. The raw response has been logged to the server console for debugging."
        return jsonify({'error': error_message}), 500

    except requests.exceptions.RequestException as e:
        # Handles connection errors, timeouts, and HTTP error responses (4xx/5xx)
        error_message = f"A request to the WordPress site failed: {e}"
        # Try to extract a more user-friendly error from the response body
        if e.response is not None:
            try:
                # WordPress REST API usually returns errors in JSON format
                wp_error = e.response.json()
                # The 'message' field is the most user-friendly part
                if 'message' in wp_error:
                    error_message = wp_error['message']
            except requests.exceptions.JSONDecodeError:
                # If the error response isn't JSON, it might be HTML from a security plugin
                print(f"DEBUG: WordPress returned a non-JSON error response. Status: {e.response.status_code}, Body: {e.response.text}")
                error_message = f"The WordPress site returned an unexpected error (Status: {e.response.status_code}). This could be caused by a security plugin. The full error has been logged to the server console."
        
        return jsonify({'error': error_message}), 500

    except Exception as e:
        # Catch any other unexpected errors
        print(f"An unexpected error occurred in post_to_wordpress: {e}")
        return jsonify({'error': 'An unexpected server error occurred. Please check the logs.'}), 500

@app.route('/convert-markdown', methods=['POST'])
def convert_markdown():
    """Converts Markdown text to HTML for preview updates."""
    data = request.get_json()
    markdown_text = data.get('markdown_text', '')
    html_content = markdown2.markdown(markdown_text)
    return jsonify({'html_content': html_content})

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Run the Flask app on a specified port.')
    parser.add_argument('--port', type=int, default=5000, help='The port to run the web server on.')
    args = parser.parse_args()
    app.run(debug=True, port=args.port)
