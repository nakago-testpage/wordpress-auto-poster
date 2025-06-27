# WordPress AI Article Auto Poster

This web service generates SEO-optimized articles using AI based on user-provided keywords and posts them to a WordPress site.

## Setup

1.  **Install Dependencies:**
    ```bash
    # If you have python3 installed
    pip3 install -r requirements.txt
    # Or, if you use pip
    pip install -r requirements.txt
    ```

2.  **Run the Application:**
    ```bash
    flask run
    ```

3.  Open your browser and navigate to `http://127.0.0.1:5000`.

4.  **Configure Settings:**
    -   Click the "Settings" button in the top-right corner.
    -   Enter your OpenAI API Key.
    -   Enter your WordPress Site URL, Username, and an [Application Password](https://www.wpbeginner.com/wp-tutorials/how-to-create-an-application-password-in-wordpress/).
    -   Click "Save Changes". The settings will be saved in your browser for future use.
