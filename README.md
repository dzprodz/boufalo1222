# Xtream IPTV Web App - Login System

This project is the initial implementation of a login system for an Xtream Codes IPTV Web App. It allows users to log in using their Xtream Codes API credentials.

## Features Implemented

*   **Xtream Login**:
    *   Input fields for Server URL, Username, and Password.
    *   Validation of input fields.
    *   Communication with the Xtream Codes `/player_api.php` endpoint.
    *   Handles successful login and displays user information (in console).
    *   Handles authentication failures and other API/network errors.
*   **Session Management**:
    *   Saves successful login details (user info, server info, and server URL) to the browser's `localStorage`.
    *   On page load, checks for an existing session.
    *   If a session exists, pre-fills the Server URL field and displays a welcome message.
*   **Styling**:
    *   Basic futuristic-themed UI with a dark palette, rounded elements, and hover effects.
    *   Responsive design for the login form.

## Project Structure

*   `index.html`: The main HTML file for the login page.
*   `style.css`: CSS file for styling the login page.
*   `script.js`: JavaScript file handling login logic, API interaction, and session management.

## How to Use

1.  Clone or download the repository.
2.  Open the `index.html` file in a modern web browser (e.g., Chrome, Firefox, Safari, Edge).
3.  Enter your Xtream Codes Server URL (including `http://` or `https://` and port, e.g., `http://my.iptv.server:8080`), Username, and Password.
4.  Click the "Login" button.
5.  Check the browser's console for logged user and server information upon successful login.
6.  Messages regarding the login status (success, error, validation) will be displayed on the page.
7.  On subsequent visits, if you logged in successfully before, the Server URL field should be pre-filled.

## Future Development

This is the foundational login module. Future development will include:
*   Dashboard for displaying channels, VOD, series.
*   EPG integration.
*   Video player implementation.
*   And many more features as outlined in the main project description.
