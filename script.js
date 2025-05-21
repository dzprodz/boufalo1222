document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const serverUrlInput = document.getElementById('server-url');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const messageArea = document.getElementById('message-area');
    const loginButton = document.getElementById('login-button');

    checkForExistingSession(); // Call on page load

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearMessages();

        const serverUrl = serverUrlInput.value.trim();
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!serverUrl || !username || !password) {
            displayMessage('All fields are required.', 'error');
            return;
        }

        let parsedUrl;
        try {
            parsedUrl = new URL(serverUrl);
            if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
                throw new Error('Invalid protocol.');
            }
        } catch (error) {
            displayMessage('Invalid Server URL. Ensure it starts with http:// or https:// and is a valid address.', 'error');
            return;
        }

        loginButton.disabled = true;
        loginButton.textContent = 'Logging in...';

        const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
        const apiUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

        try {
            const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });

            if (!response.ok) {
                let errorMsg = `HTTP error ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.user_info && errorData.user_info.message) {
                        errorMsg = errorData.user_info.message;
                    } else if (errorData && errorData.message) {
                        errorMsg = errorData.message;
                    }
                } catch (e) { /* Ignore if error response is not JSON */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            if (data.user_info && data.user_info.auth === 1) {
                displayMessage('Login successful!', 'success');
                saveSession(data.user_info, data.server_info, serverUrl); // Save session here
                
                console.log('User Info:', data.user_info);
                console.log('Server Info:', data.server_info);
                // In a real app, you would redirect or update UI here
                // window.location.href = '/dashboard.html';
            } else if (data.user_info && data.user_info.auth === 0) {
                displayMessage(data.user_info.message || 'Authentication failed. Please check your credentials.', 'error');
            } else {
                displayMessage('Login failed. Unexpected response from server.', 'error');
                console.error('Unexpected API response:', data);
            }

        } catch (error) {
            console.error('Login API call failed:', error);
            let errorMessage = 'Login failed. Check server URL and network connection.';
            if (error.message.startsWith('HTTP error') || (error.message.includes('failed') || error.message.includes('check your credentials'))) {
                errorMessage = error.message;
            }
            displayMessage(errorMessage, 'error');
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Login';
        }
    });

    function displayMessage(message, type) {
        messageArea.textContent = message;
        messageArea.className = 'message-area';
        if (type) {
            messageArea.classList.add(type);
        }
    }

    function clearMessages() {
        messageArea.textContent = '';
        messageArea.className = 'message-area';
    }

    function saveSession(userInfo, serverInfo, loggedInServerUrl) {
        try {
            localStorage.setItem('xtream_user_info', JSON.stringify(userInfo));
            localStorage.setItem('xtream_server_info', JSON.stringify(serverInfo));
            localStorage.setItem('xtream_last_login_url', loggedInServerUrl); // Save server URL used for login
            console.log('Session saved to localStorage.');
        } catch (e) {
            console.error('Error saving session to localStorage:', e);
            displayMessage('Could not save session. Your browser might be blocking localStorage or out of space.', 'error');
        }
    }

    function checkForExistingSession() {
        try {
            const userInfoString = localStorage.getItem('xtream_user_info');
            const serverInfoString = localStorage.getItem('xtream_server_info');
            const lastLoginUrl = localStorage.getItem('xtream_last_login_url');

            if (userInfoString && serverInfoString) {
                const userInfo = JSON.parse(userInfoString);
                // const serverInfo = JSON.parse(serverInfoString); // Not used directly in this example, but good to parse/validate

                console.log('Existing session found for user:', userInfo.username);
                displayMessage(`Welcome back, ${userInfo.username}! Session detected.`, 'success');
                
                if (lastLoginUrl) {
                    serverUrlInput.value = lastLoginUrl; // Pre-fill server URL
                }
                
                // For a full auto-login, you might want to:
                // 1. Pre-fill username (if not sensitive or if user opts-in)
                // 2. Automatically submit the form or directly navigate to a dashboard if the session is considered "active"
                //    (e.g. by checking user_info.status == "Active" and perhaps a session expiry timestamp)
                // For now, pre-filling the URL and showing a message is sufficient for this step.
            } else {
                console.log('No existing session found.');
            }
        } catch (e) {
            console.error('Error checking for existing session in localStorage:', e);
            // Don't show a user-facing error here, as it's a background check
        }
    }
});
