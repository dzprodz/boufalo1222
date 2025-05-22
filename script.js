// Global variables for session
window.currentUserInfo = null;
window.currentServerUrl = null;
// Global variables for search
window.originalChannelsForCategory = null; 
window.currentCategoryType = null; 

// Global HLS.js instance and player elements
let hls = null; 
let playerModal = null;
let videoPlayer = null;
let closePlayerButton = null;
let playerStreamInfo = null;

// Helper function to show loading spinner
function showLoadingSpinner(containerElement, messageText = '') {
    if (!containerElement) return;
    let messageHtml = messageText ? `<p class="loading-message">${messageText}</p>` : '';
    containerElement.innerHTML = `
        <div class="loading-spinner-container">
            <div class="loading-spinner"></div>
            ${messageHtml}
        </div>`;
}

// Helper function to show content placeholder
function showContentPlaceholder(containerElement, iconName, message) {
    if (!containerElement) return;
    containerElement.innerHTML = `
        <div class="content-placeholder">
            <span class="material-symbols-rounded">${iconName}</span>
            <p>${message}</p>
        </div>`;
}


document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const serverUrlInput = document.getElementById('server-url');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const messageArea = document.getElementById('message-area');
    const loginButton = document.getElementById('login-button');
    const loginSection = document.getElementById('login-section');
    const mainAppSection = document.getElementById('main-app-section');
    const searchBox = document.getElementById('search-box');
    
    const categoryToggleButton = document.getElementById('category-toggle-button');
    const categoriesSidebar = document.getElementById('categories-sidebar');

    playerModal = document.getElementById('player-modal');
    videoPlayer = document.getElementById('video-player');
    closePlayerButton = document.getElementById('close-player-button');
    playerStreamInfo = document.getElementById('player-stream-info');

    if (searchBox) {
        searchBox.addEventListener('input', handleSearch);
    }

    if (closePlayerButton) {
        closePlayerButton.addEventListener('click', closePlayer);
    }

    if (categoryToggleButton && categoriesSidebar) {
        categoryToggleButton.addEventListener('click', () => {
            categoriesSidebar.classList.toggle('open');
        });

        categoriesSidebar.addEventListener('click', (event) => {
            if (window.innerWidth <= 768 && event.target.matches('#categories-container li')) {
                categoriesSidebar.classList.remove('open');
            }
        });
    }

    const categoriesContainerInitial = document.getElementById('categories-container');
    if (categoriesContainerInitial) showContentPlaceholder(categoriesContainerInitial, 'login', 'Please log in to load categories.');
    const channelsContainerInitial = document.getElementById('channels-container');
    if (channelsContainerInitial) showContentPlaceholder(channelsContainerInitial, 'tv_off', 'Select a category to see content.');

    checkForExistingSession();

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

        try {
            new URL(serverUrl);
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
                } catch (e) { /* Ignore */ }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            if (data.user_info && data.user_info.auth === 1) {
                saveSession(data.user_info, data.server_info, serverUrl);
                
                window.currentUserInfo = data.user_info;
                window.currentServerUrl = serverUrl;

                console.log('User Info:', window.currentUserInfo);
                console.log('Server Info:', data.server_info);

                if (loginSection) loginSection.style.display = 'none';
                if (mainAppSection) mainAppSection.style.display = 'flex';
                fetchCategories(window.currentUserInfo, window.currentServerUrl);
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
        if (!playerModal || !playerModal.classList.contains('visible')) { // Check class instead of style
             messageArea.textContent = '';
             messageArea.className = 'message-area';
        }
    }

    function saveSession(userInfo, serverInfo, loggedInServerUrl) {
        try {
            localStorage.setItem('xtream_user_info', JSON.stringify(userInfo));
            localStorage.setItem('xtream_server_info', JSON.stringify(serverInfo));
            localStorage.setItem('xtream_last_login_url', loggedInServerUrl);
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

            if (userInfoString && serverInfoString && lastLoginUrl) {
                const storedUserInfo = JSON.parse(userInfoString);
                window.currentUserInfo = storedUserInfo;
                window.currentServerUrl = lastLoginUrl;

                console.log('Existing session found for user:', window.currentUserInfo.username);
                if (loginSection) loginSection.style.display = 'none';
                if (mainAppSection) mainAppSection.style.display = 'flex';
                
                serverUrlInput.value = window.currentServerUrl;
                fetchCategories(window.currentUserInfo, window.currentServerUrl);
            } else {
                console.log('No existing session found or session incomplete.');
                if (mainAppSection) mainAppSection.style.display = 'none';
                if (loginSection) loginSection.style.display = 'block';
            }
        } catch (e) {
            console.error('Error checking for existing session in localStorage:', e);
            localStorage.clear();
            window.currentUserInfo = null; 
            window.currentServerUrl = null;
            window.originalChannelsForCategory = null;
            window.currentCategoryType = null;
            if (mainAppSection) mainAppSection.style.display = 'none';
            if (loginSection) loginSection.style.display = 'block';
        }
    }

    async function fetchCategories(userInfo, serverUrl) {
        const categoriesContainer = document.getElementById('categories-container');
        showLoadingSpinner(categoriesContainer, 'Loading categories...'); 

        const { username, password } = userInfo;
        if (!password) {
            showContentPlaceholder(categoriesContainer, 'lock_person', 'Session error. Please log in again.');
            localStorage.clear();
            window.currentUserInfo = null; window.currentServerUrl = null;
            window.originalChannelsForCategory = null; window.currentCategoryType = null;
            if (loginSection) loginSection.style.display = 'block';
            if (mainAppSection) mainAppSection.style.display = 'none';
            return;
        }

        const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
        const actions = { live: 'get_live_categories', vod: 'get_vod_categories', series: 'get_series_categories' };
        const categories = { live: [], vod: [], series: [] }; 
        let fetchErrorOccurred = false;

        for (const type of Object.keys(actions)) {
            const apiUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&action=${actions[type]}`;
            try {
                const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' }});
                if (!response.ok) {
                    let errorDetail = `HTTP error ${response.status}`;
                    try { const errorJson = await response.json(); if(errorJson && errorJson.message) errorDetail = errorJson.message; } catch(jsonError) { /* ignore */ }
                    throw new Error(errorDetail + ` while fetching ${type} categories`);
                }
                const data = await response.json();
                if (data && Array.isArray(data)) {
                    categories[type] = data;
                } else if ((type === 'series' || type === 'vod') && (data === null || (typeof data === 'object' && Object.keys(data).length === 0))) {
                    categories[type] = [];
                } else {
                    console.warn(`Unexpected data format for ${type} categories:`, data);
                    categories[type] = []; 
                }
            } catch (error) {
                console.error(`Failed to fetch ${type} categories:`, error);
                fetchErrorOccurred = true;
            }
        }
        
        window.xtreamCategories = categories;

        if (
            (!categories.live || categories.live.length === 0) &&
            (!categories.vod || categories.vod.length === 0) &&
            (!categories.series || categories.series.length === 0)
        ) {
            if(fetchErrorOccurred) {
                showContentPlaceholder(categoriesContainer, 'signal_disconnected', 'Could not load categories. Check server or connection.');
            } else {
                showContentPlaceholder(categoriesContainer, 'category', 'No categories available from this server.');
            }
        } else {
            renderCategories(categories); 
        }
    }

    function renderCategories(categories) {
        const categoriesContainer = document.getElementById('categories-container');
        if (!categoriesContainer) {
            console.error('Categories container not found');
            return;
        }
        categoriesContainer.innerHTML = ''; 

        let html = '';
        let hasContent = false;

        if (categories.live && categories.live.length > 0) {
            hasContent = true;
            html += `<h3><span class="material-symbols-rounded category-title-icon">live_tv</span> Live TV</h3><ul>`;
            categories.live.forEach(cat => {
                html += `<li data-category-id="${cat.category_id}" data-category-type="live" data-category-name="${encodeURIComponent(cat.category_name)}">${cat.category_name}</li>`;
            });
            html += '</ul>';
        }
        if (categories.vod && categories.vod.length > 0) {
            hasContent = true;
            html += `<h3><span class="material-symbols-rounded category-title-icon">movie</span> VOD</h3><ul>`;
            categories.vod.forEach(cat => {
                html += `<li data-category-id="${cat.category_id}" data-category-type="vod" data-category-name="${encodeURIComponent(cat.category_name)}">${cat.category_name}</li>`;
            });
            html += '</ul>';
        }
        if (categories.series && categories.series.length > 0) {
            hasContent = true;
            html += `<h3><span class="material-symbols-rounded category-title-icon">video_library</span> Series</h3><ul>`;
            categories.series.forEach(cat => {
                html += `<li data-category-id="${cat.category_id}" data-category-type="series" data-category-name="${encodeURIComponent(cat.category_name)}">${cat.category_name}</li>`;
            });
            html += '</ul>';
        }

        if (!hasContent) { 
             showContentPlaceholder(categoriesContainer, 'category', 'No categories available from this server.');
             return;
        }
        categoriesContainer.innerHTML = html;

        const categoryItems = categoriesContainer.querySelectorAll('li');
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                const categoryId = item.dataset.categoryId;
                const categoryType = item.dataset.categoryType;
                const categoryName = decodeURIComponent(item.dataset.categoryName);
                
                const searchBox = document.getElementById('search-box');
                if (searchBox) searchBox.value = ''; 
                
                handleCategoryClick(categoryId, categoryType, categoryName);
            });
        });
    }

    async function handleCategoryClick(categoryId, categoryType, categoryName) {
        const channelsContainer = document.getElementById('channels-container');
        showLoadingSpinner(channelsContainer, `Loading ${categoryName}...`); 

        const categoryItems = document.querySelectorAll('#categories-container li');
        categoryItems.forEach(item => item.classList.remove('active'));
        const activeCategoryElement = document.querySelector(`#categories-container li[data-category-id="${categoryId}"][data-category-type="${categoryType}"]`);
        if (activeCategoryElement) {
            activeCategoryElement.classList.add('active');
        }
        
        if (window.innerWidth <= 768 && categoriesSidebar && categoriesSidebar.classList.contains('open')) {
            categoriesSidebar.classList.remove('open');
        }


        const userInfo = window.currentUserInfo || JSON.parse(localStorage.getItem('xtream_user_info'));
        const serverUrl = window.currentServerUrl || localStorage.getItem('xtream_last_login_url');

        if (!userInfo || !serverUrl || !userInfo.username || !userInfo.password) {
            showContentPlaceholder(channelsContainer, 'lock_person', 'Session error. Please log in again.');
            window.originalChannelsForCategory = null; 
            window.currentCategoryType = null;
            return;
        }

        const { username, password } = userInfo;
        const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
        let action = '';
        let params = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

        switch (categoryType) {
            case 'live': action = 'get_live_streams'; params += `&category_id=${categoryId}`; break;
            case 'vod': action = 'get_vod_streams'; params += `&category_id=${categoryId}`; break;
            case 'series': action = 'get_series_info'; params += `&series_id=${categoryId}`; break;
            default:
                showContentPlaceholder(channelsContainer, 'error_outline', 'Unknown category type.');
                window.originalChannelsForCategory = null; 
                window.currentCategoryType = null;
                return;
        }

        const apiUrl = `${baseUrl}/player_api.php?${params}&action=${action}`;

        try {
            const response = await fetch(apiUrl, { method: 'GET', headers: { 'Accept': 'application/json' }});
            if (!response.ok) {
                 let errorDetail = `HTTP error ${response.status}`;
                 try { 
                     const errorJson = await response.json(); 
                     if(errorJson && (errorJson.message || (errorJson.user_info && errorJson.user_info.message))) 
                        errorDetail = errorJson.message || errorJson.user_info.message;
                 } catch(jsonError) { /* ignore */ }
                throw new Error(`${errorDetail}`);
            }
            const data = await response.json();
            
            console.log(`Data for ${categoryType} - ${categoryName} (ID: ${categoryId}):`, data);
            
            window.originalChannelsForCategory = data; 
            window.currentCategoryType = categoryType;  
            const searchBox = document.getElementById('search-box');
            if (searchBox) searchBox.value = ''; 

            renderChannels(data, categoryType, false); 

        } catch (error) {
            console.error(`Failed to fetch content for ${categoryName}:`, error);
            showContentPlaceholder(channelsContainer, 'signal_disconnected', `Error loading: ${error.message || 'Check connection.'}`);
            window.originalChannelsForCategory = null; 
            window.currentCategoryType = null;
        }
    }

    function renderChannels(items, categoryType, isSearchResult = false) {
        const channelsContainer = document.getElementById('channels-container');
        channelsContainer.innerHTML = ''; 

        if (!items || (Array.isArray(items) && items.length === 0)) {
            if (categoryType === 'series' && items && typeof items === 'object' && items.info) {
            } else {
                let message = isSearchResult ? "No results match your search." : `No items found in this category.`;
                let icon = isSearchResult ? "search_off" : "sentiment_very_dissatisfied"; 
                showContentPlaceholder(channelsContainer, icon, message);
                return;
            }
        }

        const grid = document.createElement('div');
        grid.className = 'channels-grid';

        if (categoryType === 'series' && typeof items === 'object' && !Array.isArray(items) && items.info) {
            const seriesInfo = items; 
            const card = document.createElement('div');
            card.className = 'channel-card series-info-card'; 
            let coverImg = seriesInfo.info.cover_big || seriesInfo.info.movie_image || './placeholder.png';
            card.innerHTML = `
                <img src="${coverImg}" alt="${seriesInfo.info.name || 'Series Cover'}" onerror="this.onerror=null;this.src='./placeholder.png';">
                <div class="card-body">
                    <h3>${seriesInfo.info.name || 'N/A'}</h3>
                    <p><strong>Released:</strong> ${seriesInfo.info.releasedate || 'N/A'}</p>
                    <p><strong>Director:</strong> ${seriesInfo.info.director || 'N/A'}</p>
                    <p><strong>Cast:</strong> ${seriesInfo.info.cast || 'N/A'}</p>
                    <p class="plot"><strong>Plot:</strong> ${seriesInfo.info.plot || 'N/A'}</p>
                    ${seriesInfo.info.youtube_trailer ? `<p><a href="https://www.youtube.com/watch?v=${seriesInfo.info.youtube_trailer}" target="_blank">Watch Trailer</a></p>` : ''}
                </div>
            `;
            if (seriesInfo.episodes) {
                let seasonsHtml = '<div class="series-seasons"><h4>Seasons:</h4><ul>';
                for (const seasonNum in seriesInfo.episodes) {
                    seasonsHtml += `<li>Season ${seasonNum} (${seriesInfo.episodes[seasonNum].length} episodes)</li>`;
                }
                seasonsHtml += '</ul></div>';
                const cardBody = card.querySelector('.card-body');
                if (cardBody) cardBody.innerHTML += seasonsHtml; else card.innerHTML += seasonsHtml;
            }
            grid.appendChild(card);
        } else if (Array.isArray(items)) { 
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'channel-card';
                card.dataset.streamId = categoryType === 'series' ? item.series_id : (item.stream_id || item.id);
                card.dataset.streamType = categoryType;
                card.dataset.streamName = encodeURIComponent(item.name || item.title || 'Unknown Stream');
                let name = item.name || item.title || 'Unnamed Stream';
                let iconUrl = item.stream_icon || item.icon || item.icon_url || item.movie_image || item.cover || item.logo || './placeholder.png';
                card.innerHTML = `
                    <img src="${iconUrl}" alt="${name}" onerror="this.onerror=null;this.src='./placeholder.png';">
                    <div class="card-body">
                        <h4>${name}</h4>
                        ${categoryType === 'vod' && item.rating_5based ? `<p>Rating: ${Number(item.rating_5based).toFixed(1)}/5</p>` : ''}
                        ${categoryType === 'vod' && item.duration ? `<p>Duration: ${item.duration}</p>` : ''}
                    </div>
                `;
                card.addEventListener('click', () => handleStreamClick(card.dataset));
                grid.appendChild(card);
            });
        }

        channelsContainer.appendChild(grid);
        if (grid.childNodes.length === 0 && !(categoryType === 'series' && typeof items === 'object' && items.info)) {
           let message = isSearchResult ? "No results match your search." : `No items found in this category.`;
           let icon = isSearchResult ? "search_off" : "sentiment_very_dissatisfied";
           showContentPlaceholder(channelsContainer, icon, message);
        }
    }

    function handleStreamClick(streamData) {
        const decodedStreamName = decodeURIComponent(streamData.streamName);
        
        const userInfo = window.currentUserInfo || JSON.parse(localStorage.getItem('xtream_user_info'));
        let serverUrl = window.currentServerUrl || localStorage.getItem('xtream_last_login_url');
    
        if (!userInfo || !serverUrl || !userInfo.username || !userInfo.password) {
            displayMessage('Cannot play stream: User session or server info is missing. Please log in again.', 'error');
            console.error('User session or server info missing for stream URL construction.');
            return;
        }
        
        serverUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
        const username = userInfo.username;
        const password = userInfo.password;
        const streamId = streamData.streamId;
        let streamUrl = '';
        let fullStreamInfo = {};
        let isHlsStream = false; 
    
        switch (streamData.streamType) {
            case 'live':
                streamUrl = `${serverUrl}/live/${username}/${password}/${streamId}.ts`;
                isHlsStream = true; 
                fullStreamInfo = { type: 'live', name: decodedStreamName, source: streamUrl, streamId: streamId, originalData: streamData };
                break;
            case 'vod':
                let containerExtension = 'mp4'; 
                if (window.originalChannelsForCategory && Array.isArray(window.originalChannelsForCategory)) {
                    const vodItem = window.originalChannelsForCategory.find(item => (String(item.stream_id) === String(streamId) || String(item.id) === String(streamId)));
                    if (vodItem && vodItem.container_extension) {
                        containerExtension = vodItem.container_extension.toLowerCase();
                    }
                }
                streamUrl = `${serverUrl}/movie/${username}/${password}/${streamId}.${containerExtension}`;
                if (containerExtension === 'm3u8') {
                    isHlsStream = true;
                } else {
                    isHlsStream = false; 
                }
                fullStreamInfo = { type: 'vod', name: decodedStreamName, source: streamUrl, streamId: streamId, containerExtension: containerExtension, isHls: isHlsStream, originalData: streamData };
                break;
            case 'series':
                console.log(`Series selected: ${decodedStreamName} (ID: ${streamId}). Episode player not implemented.`);
                displayMessage(`Series selected: ${decodedStreamName}. To play, select an episode (not yet implemented).`, 'success');
                if (playerModal) playerModal.classList.remove('visible'); // Ensure it's hidden
                return; 
            default:
                console.error('Unknown stream type:', streamData.streamType);
                displayMessage('Cannot play stream: Unknown stream type.', 'error');
                return;
        }
    
        console.log('Player Data:', fullStreamInfo);
    
        if (playerModal) playerModal.classList.add('visible');
        if (playerStreamInfo) playerStreamInfo.textContent = decodedStreamName;
    
        if (hls) { 
            hls.destroy();
            hls = null;
        }
        videoPlayer.removeAttribute('src'); 
        videoPlayer.load(); 
    
        if (isHlsStream) {
            if (Hls.isSupported()) {
                console.log("HLS.js is supported. Initializing HLS.js player for HLS stream.");
                hls = new Hls({
                    debug: true, 
                    xhrSetup: function(xhr, url) {
                        try {
                            xhr.withCredentials = true; 
                            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                            console.log(`[HLS.js XHR Setup] withCredentials set for URL: ${url}`);
                        } catch (e) {
                            console.error("[HLS.js XHR Setup] Error setting XHR properties:", e);
                        }
                    }
                });
                hls.loadSource(streamUrl);
                hls.attachMedia(videoPlayer);
                hls.on(Hls.Events.MANIFEST_PARSED, function() {
                    console.log("Manifest parsed. Attempting to play HLS stream...");
                    videoPlayer.play().catch(error => {
                        console.error("Error trying to play video with HLS.js:", error);
                        displayMessage(`Error playing ${decodedStreamName}: ${error.message}`, 'error');
                    });
                });
                hls.on(Hls.Events.ERROR, function(event, data) {
                    console.error('HLS.js Error:', data);
                    if (data.fatal) {
                        switch(data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                displayMessage(`Network error playing ${decodedStreamName}. Check connection or stream.`, 'error');
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                 displayMessage(`Media error playing ${decodedStreamName}. Stream may be corrupt or incompatible.`, 'error');
                                break;
                            default:
                                displayMessage(`Error playing ${decodedStreamName}: ${data.details || 'Unknown HLS error'}`, 'error');
                                if(hls) hls.destroy(); hls = null; 
                                break;
                        }
                    } else if (data.details === 'bufferStalledError') {
                        displayMessage(`Buffering: ${decodedStreamName}...`, 'success');
                    } else if (data.response && (data.response.code === 403 || data.response.code === 401)) {
                        displayMessage(`Access denied for ${decodedStreamName}. Check credentials or stream permissions.`, 'error');
                    }
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) { 
                console.log("Native HLS playback is supported. Using native player for HLS stream:", streamUrl);
                videoPlayer.src = streamUrl;
                const playPromise = videoPlayer.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Error trying to play HLS video natively:", error);
                        displayMessage(`Error playing ${decodedStreamName}: ${error.message}`, 'error');
                    });
                }
                videoPlayer.addEventListener('error', function(e) {
                    console.error('Native HLS player error:', e);
                    displayMessage(`Error playing ${decodedStreamName}: Native player error.`, 'error');
                }, { once: true });
            } else {
                console.error("HLS is not supported for this HLS stream.");
                displayMessage("Your browser does not support HLS video playback.", "error");
                if (playerModal) playerModal.classList.remove('visible');
            }
        } else { 
            console.log("Progressive download stream. Setting video src directly:", streamUrl);
            const videoFormat = `video/${fullStreamInfo.containerExtension || 'mp4'}`;
            if (videoPlayer.canPlayType(videoFormat)) {
                videoPlayer.src = streamUrl;
                const playPromise = videoPlayer.play(); 
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error("Error trying to play progressive download video:", error);
                        displayMessage(`Error playing ${decodedStreamName}: ${error.message}`, 'error');
                    });
                }
                videoPlayer.addEventListener('error', function(e) {
                    console.error('Native player error for progressive download:', e);
                    displayMessage(`Error playing ${decodedStreamName}: Player error.`, 'error');
                }, { once: true });
            } else {
                console.error(`Browser cannot play video format: ${fullStreamInfo.containerExtension}`);
                displayMessage(`Your browser does not support the .${fullStreamInfo.containerExtension} video format.`, "error");
                if (playerModal) playerModal.classList.remove('visible');
            }
        }
        
        const allCards = document.querySelectorAll('.channel-card');
        allCards.forEach(card => card.classList.remove('active-stream'));
        const clickedCard = document.querySelector(`.channel-card[data-stream-id='${streamId}'][data-stream-type='${streamData.streamType}']`);
        if (clickedCard) {
            clickedCard.classList.add('active-stream');
        }
    }
    
    function closePlayer() {
        if (playerModal) playerModal.classList.remove('visible');
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.removeAttribute('src'); 
            videoPlayer.load(); 
        }
        if (hls) {
            hls.destroy();
            hls = null;
        }
        if (playerStreamInfo) playerStreamInfo.textContent = '';
        
        const allCards = document.querySelectorAll('.channel-card.active-stream');
        allCards.forEach(card => card.classList.remove('active-stream'));
        clearMessages(); 
    }

    function handleSearch() {
        const searchBox = document.getElementById('search-box');
        const searchTerm = searchBox.value.toLowerCase().trim();
    
        if (!window.originalChannelsForCategory) {
            return; 
        }
        
        if (window.currentCategoryType === 'series' && 
            typeof window.originalChannelsForCategory === 'object' && 
            !Array.isArray(window.originalChannelsForCategory) && 
            window.originalChannelsForCategory.info) {
            
            if (searchTerm) {
                displayMessage("Search applies to lists of channels/VODs, not the detailed series view. Clear search or select a list category.", "error");
            } else {
                clearMessages(); 
            }
            return; 
        }
    
        if (!searchTerm) {
            renderChannels(window.originalChannelsForCategory, window.currentCategoryType, false); 
            return;
        }
    
        if (!Array.isArray(window.originalChannelsForCategory)) {
            console.warn('Original data for category is not an array, cannot filter:', window.originalChannelsForCategory);
            renderChannels([], window.currentCategoryType, true); 
            return;
        }
    
        const filteredItems = window.originalChannelsForCategory.filter(item => {
            const itemName = (item.name || item.title || '').toLowerCase();
            return itemName.includes(searchTerm);
        });
    
        renderChannels(filteredItems, window.currentCategoryType, true); 
    }

    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            closePlayer(); 
            localStorage.clear();
            window.currentUserInfo = null; 
            window.currentServerUrl = null;
            window.originalChannelsForCategory = null;
            window.currentCategoryType = null;
            const searchBox = document.getElementById('search-box');
            if (searchBox) searchBox.value = '';

            console.log('Session cleared. Logged out.');
            if (mainAppSection) mainAppSection.style.display = 'none';
            if (loginSection) loginSection.style.display = 'block';
            serverUrlInput.value = ''; usernameInput.value = ''; passwordInput.value = '';
            clearMessages();
            const channelsContainer = document.getElementById('channels-container');
            if(channelsContainer) showContentPlaceholder(channelsContainer, 'tv_off', 'Select a category to see content.');
            const categoriesContainer = document.getElementById('categories-container');
            if(categoriesContainer) showContentPlaceholder(categoriesContainer, 'login', 'Login to load categories.');


            displayMessage('You have been logged out.', 'success');
        });
    }
});
