// Global variables for session
window.currentUserInfo = null;
window.currentServerUrl = null;
// Global variables for search
window.originalChannelsForCategory = null; 
window.currentCategoryType = null; 
window.m3uChannels = null; 
window.m3uEpgUrls = []; 
window.m3uFileName = null; 

// Player elements and Video.js instance
let videoJsPlayer = null;
let playerViewModal = null; 
let mainVideoPlayerElement = null; 
let playerCloseButton = null; 
let playerStreamTitle = null; 


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
    const loginMessageArea = document.getElementById('login-message-area'); 
    const loginButton = document.getElementById('login-button');
    const loginView = document.getElementById('login-view'); 
    const mainAppView = document.getElementById('main-app-view'); 
    const searchInput = document.getElementById('search-input'); 
    
    const sidebarToggleMobile = document.getElementById('sidebar-toggle-mobile');
    const categoriesSidebar = document.getElementById('sidebar'); 

    const m3uUploadTriggerButton = document.getElementById('m3u-upload-trigger-button');
    const m3uUploadSidebarButton = document.getElementById('m3u-upload-sidebar-button');
    const m3uFileInput = document.getElementById('m3u-file-input-main'); 

    playerViewModal = document.getElementById('player-view-modal');
    mainVideoPlayerElement = document.getElementById('main-video-player');
    playerCloseButton = document.getElementById('player-close-button');
    playerStreamTitle = document.getElementById('player-stream-title');

    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    if (playerCloseButton) {
        playerCloseButton.addEventListener('click', closePlayer);
    }

    if (sidebarToggleMobile && categoriesSidebar) {
        sidebarToggleMobile.addEventListener('click', () => {
            categoriesSidebar.classList.toggle('open');
        });

        categoriesSidebar.addEventListener('click', (event) => {
            if (window.innerWidth <= 768 && event.target.matches('#category-nav li')) { 
                categoriesSidebar.classList.remove('open');
            }
        });
    }
    
    if (m3uUploadTriggerButton && m3uFileInput) {
        m3uUploadTriggerButton.addEventListener('click', () => m3uFileInput.click());
    }
    if (m3uUploadSidebarButton && m3uFileInput) {
        m3uUploadSidebarButton.addEventListener('click', () => m3uFileInput.click());
    }

    if (m3uFileInput) {
        m3uFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const m3uContent = e.target.result;
                    try {
                        window.m3uEpgUrls = []; 
                        const channels = parseM3U(m3uContent);
                        window.m3uFileName = file.name; 
                        console.log('Parsed M3U Channels:', channels);
                        if (window.m3uEpgUrls.length > 0) {
                            console.log("EPG URLs extracted from M3U:", window.m3uEpgUrls);
                        }
                        if (channels.length > 0) {
                            displayUIMessage(`Successfully parsed ${channels.length} channels from ${file.name}. Displaying...`, 'success', loginMessageArea); 
                            window.m3uChannels = channels; 
                            window.xtreamCategories = null; 
                            window.originalChannelsForCategory = null; 
                            window.currentCategoryType = 'm3u'; 
                            
                            loginView.style.display = 'none';
                            mainAppView.style.display = 'flex';
                            if(searchInput) searchInput.value = ''; 

                            displayM3UChannels(channels); 
                        } else {
                            displayUIMessage('No channels found in the M3U file.', 'error', loginMessageArea);
                        }
                    } catch (error) {
                        console.error("Error parsing M3U:", error);
                        displayUIMessage(`Error parsing M3U file: ${error.message}`, 'error', loginMessageArea);
                    } finally {
                        m3uFileInput.value = null; 
                    }
                };
                reader.onerror = function() {
                    console.error("Error reading M3U file.");
                    displayUIMessage('Error reading M3U file.', 'error', loginMessageArea);
                    m3uFileInput.value = null;
                };
                reader.readAsText(file);
            }
        });
    }

    const categoryNav = document.getElementById('category-nav'); 
    if (categoryNav) showContentPlaceholder(categoryNav, 'login', 'Please log in or upload M3U.');
    const channelGridContainer = document.getElementById('channel-grid-container'); 
    if (channelGridContainer) showContentPlaceholder(channelGridContainer, 'tv_off', 'Select a category to see content.');

    checkForExistingSession();
    updateBreadcrumbs(null, null); 

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearUIMessages(loginMessageArea);

        const serverUrlVal = serverUrlInput.value.trim();
        const usernameVal = usernameInput.value.trim();
        const passwordVal = passwordInput.value;

        if (!serverUrlVal || !usernameVal || !passwordVal) {
            displayUIMessage('All fields are required.', 'error', loginMessageArea);
            return;
        }

        try {
            new URL(serverUrlVal);
        } catch (error) {
            displayUIMessage('Invalid Server URL. Ensure it starts with http:// or https:// and is a valid address.', 'error', loginMessageArea);
            return;
        }

        loginButton.disabled = true;
        loginButton.innerHTML = '<span class="material-symbols-rounded spin">sync</span> Connecting...'; 

        const baseUrl = serverUrlVal.endsWith('/') ? serverUrlVal.slice(0, -1) : serverUrlVal;
        const apiUrl = `${baseUrl}/player_api.php?username=${encodeURIComponent(usernameVal)}&password=${encodeURIComponent(passwordVal)}`;

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
                saveSession(data.user_info, data.server_info, serverUrlVal);
                
                window.currentUserInfo = data.user_info;
                window.currentServerUrl = serverUrlVal;
                window.m3uChannels = null; 
                window.m3uFileName = null; 
                window.m3uEpgUrls = [];

                console.log('User Info:', window.currentUserInfo);
                console.log('Server Info:', data.server_info);

                loginView.style.display = 'none';
                mainAppView.style.display = 'flex';
                fetchCategories(window.currentUserInfo, window.currentServerUrl);
                updateBreadcrumbs(null, null); 
            } else if (data.user_info && data.user_info.auth === 0) {
                displayUIMessage(data.user_info.message || 'Authentication failed. Please check your credentials.', 'error', loginMessageArea);
            } else {
                displayUIMessage('Login failed. Unexpected response from server.', 'error', loginMessageArea);
                console.error('Unexpected API response:', data);
            }

        } catch (error) {
            console.error('Login API call failed:', error);
            let errorMessage = 'Login failed. Check server URL and network connection.';
            if (error.message.startsWith('HTTP error') || (error.message.includes('failed') || error.message.includes('check your credentials'))) {
                errorMessage = error.message;
            }
            displayUIMessage(errorMessage, 'error', loginMessageArea);
        } finally {
            loginButton.disabled = false;
            loginButton.innerHTML = '<span class="material-symbols-rounded">login</span> Connect';
        }
    });
    
    function displayUIMessage(message, type, areaElement) {
        const targetArea = areaElement || loginMessageArea; 
        if(targetArea){
            targetArea.textContent = message;
            targetArea.className = 'message-area'; 
            if (type) {
                targetArea.classList.add(type);
            }
        }
    }

    function clearUIMessages(areaElement) {
        const targetArea = areaElement || loginMessageArea;
        if (targetArea && (!playerViewModal || playerViewModal.style.display === 'none')) { 
             targetArea.textContent = '';
             targetArea.className = 'message-area';
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
            displayUIMessage('Could not save session. Your browser might be blocking localStorage or out of space.', 'error', loginMessageArea);
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
                loginView.style.display = 'none';
                mainAppView.style.display = 'flex';
                
                if(serverUrlInput) serverUrlInput.value = window.currentServerUrl;
                fetchCategories(window.currentUserInfo, window.currentServerUrl);
                updateBreadcrumbs(null, null); 
            } else {
                console.log('No existing session found or session incomplete.');
                mainAppView.style.display = 'none';
                loginView.style.display = 'flex';
            }
        } catch (e) {
            console.error('Error checking for existing session in localStorage:', e);
            localStorage.clear();
            window.currentUserInfo = null; 
            window.currentServerUrl = null;
            window.originalChannelsForCategory = null;
            window.currentCategoryType = null;
            mainAppView.style.display = 'none';
            loginView.style.display = 'flex';
        }
    }

    async function fetchCategories(userInfo, serverUrl) {
        const categoryNavContainer = document.getElementById('category-nav');
        showLoadingSpinner(categoryNavContainer, 'Loading categories...'); 

        const { username, password } = userInfo;
        if (!password) {
            showContentPlaceholder(categoryNavContainer, 'lock_person', 'Session error. Please log in again.');
            localStorage.clear();
            window.currentUserInfo = null; window.currentServerUrl = null;
            window.originalChannelsForCategory = null; window.currentCategoryType = null;
            loginView.style.display = 'flex';
            mainAppView.style.display = 'none';
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
                showContentPlaceholder(categoryNavContainer, 'signal_disconnected', 'Could not load categories.');
            } else {
                showContentPlaceholder(categoryNavContainer, 'category', 'No categories available.');
            }
        } else {
            renderCategories(categories); 
        }
         updateBreadcrumbs(null, null); 
    }

    function renderCategories(categories) { 
        const categoryNavContainer = document.getElementById('category-nav');
        if (!categoryNavContainer) return;
        categoryNavContainer.innerHTML = ''; 

        let html = '';
        let hasContent = false;
        const categoryTypes = [ 
            { key: 'live', name: 'Live TV', icon: 'live_tv' },
            { key: 'vod', name: 'Movies', icon: 'movie' }, 
            { key: 'series', name: 'TV Series', icon: 'video_library' } 
        ];

        categoryTypes.forEach(catType => {
            if (categories[catType.key] && categories[catType.key].length > 0) {
                hasContent = true;
                html += `<div class="category-group"><h3><span class="material-symbols-rounded category-title-icon">${catType.icon}</span> ${catType.name}</h3><ul>`;
                categories[catType.key].forEach(cat => {
                    html += `<li data-category-id="${cat.category_id}" data-category-type="${catType.key}" data-category-name="${encodeURIComponent(cat.category_name)}">${cat.category_name}</li>`;
                });
                html += '</ul></div>';
            }
        });
        

        if (!hasContent) { 
             showContentPlaceholder(categoryNavContainer, 'category', 'No categories available.');
             return;
        }
        categoryNavContainer.innerHTML = html;

        const categoryItems = categoryNavContainer.querySelectorAll('li[data-category-type]');
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                const categoryId = item.dataset.categoryId;
                const categoryType = item.dataset.categoryType;
                const categoryName = decodeURIComponent(item.dataset.categoryName);
                
                if(searchInput) searchInput.value = ''; 
                
                handleCategoryClick(categoryId, categoryType, categoryName);
            });
        });
    }
    
    function displayM3UChannels(parsedChannels) { 
        const categoryNavContainer = document.getElementById('category-nav');
        const channelGridContainer = document.getElementById('channel-grid-container');
        
        categoryNavContainer.innerHTML = '';
        showContentPlaceholder(channelGridContainer, 'playlist_play', 'Select a group from your M3U playlist.');
    
        let m3uCategories = {};
        let hasGroups = false;
        parsedChannels.forEach(channel => {
            const group = channel.group || `M3U: ${window.m3uFileName || 'Playlist'}`; 
            if (channel.group) hasGroups = true;
            if (!m3uCategories[group]) {
                m3uCategories[group] = [];
            }
            m3uCategories[group].push(channel);
        });
    
        if (!hasGroups && parsedChannels.length > 0) {
            const defaultGroupName = `M3U: ${window.m3uFileName || 'Playlist'}`;
            renderM3UCategories([{ name: defaultGroupName, type: 'm3u_group' }], m3uCategories, true);
        } else if (Object.keys(m3uCategories).length > 0) {
            const categoryListForRender = Object.keys(m3uCategories).map(groupName => ({
                name: groupName,
                type: 'm3u_group' 
            }));
            renderM3UCategories(categoryListForRender, m3uCategories, false);
            updateBreadcrumbs('m3u', null); 
        } else {
            showContentPlaceholder(categoryNavContainer, 'error', 'No displayable content found in M3U.');
            updateBreadcrumbs(null, null);
        }
    }

    function renderM3UCategories(categoryList, allM3UChannelsGrouped, autoSelectFirst) {
        const categoryNavContainer = document.getElementById('category-nav');
        categoryNavContainer.innerHTML = ''; 
    
        if (!categoryList || categoryList.length === 0) {
            showContentPlaceholder(categoryNavContainer, 'category', 'No groups in M3U.');
            return;
        }
    
        let html = `<div class="category-group"><h3><span class="material-symbols-rounded category-title-icon">playlist_play</span> M3U: ${window.m3uFileName || 'Playlist'}</h3><ul>`;
        categoryList.forEach(cat => {
            const groupChannelCount = allM3UChannelsGrouped[cat.name] ? allM3UChannelsGrouped[cat.name].length : 0;
            html += `<li data-m3u-group-name="${encodeURIComponent(cat.name)}" data-category-type="m3u_group">
                        <span class="material-symbols-rounded category-item-icon">folder_open</span>
                        <span class="category-name-text">${cat.name}</span> 
                        <span class="category-count">(${groupChannelCount})</span>
                     </li>`;
        });
        html += '</ul></div>';
        categoryNavContainer.innerHTML = html;
    
        const categoryItems = categoryNavContainer.querySelectorAll('li[data-category-type="m3u_group"]');
        categoryItems.forEach(item => {
            item.addEventListener('click', () => {
                const groupName = decodeURIComponent(item.dataset.m3uGroupName);
                
                categoryItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
    
                window.originalChannelsForCategory = allM3UChannelsGrouped[groupName] || [];
                window.currentCategoryType = 'm3u_group'; 
                if(searchInput) searchInput.value = ''; 
                renderChannels(window.originalChannelsForCategory, 'm3u_group', false);
                updateBreadcrumbs('m3u_group', groupName);
    
                if (window.innerWidth <= 768 && categoriesSidebar && categoriesSidebar.classList.contains('open')) {
                    categoriesSidebar.classList.remove('open');
                }
            });
        });
        
        if (autoSelectFirst && categoryItems.length > 0) {
            categoryItems[0].click(); 
        }
    }


    async function handleCategoryClick(categoryId, categoryType, categoryName) { 
        const channelGridContainer = document.getElementById('channel-grid-container');
        showLoadingSpinner(channelGridContainer, `Loading ${categoryName}...`); 
        updateBreadcrumbs(categoryType, categoryName); 

        const categoryItems = document.querySelectorAll('#category-nav li'); 
        categoryItems.forEach(item => item.classList.remove('active'));
        const activeCategoryElement = document.querySelector(`#category-nav li[data-category-id="${categoryId}"][data-category-type="${categoryType}"]`);
        if (activeCategoryElement) {
            activeCategoryElement.classList.add('active');
        }
        
        if (window.innerWidth <= 768 && categoriesSidebar && categoriesSidebar.classList.contains('open')) {
            categoriesSidebar.classList.remove('open');
        }

        const userInfo = window.currentUserInfo;
        const serverUrl = window.currentServerUrl;

        if (!userInfo || !serverUrl || !userInfo.username || !userInfo.password) {
            showContentPlaceholder(channelGridContainer, 'lock_person', 'Session error. Please log in again.');
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
                showContentPlaceholder(channelGridContainer, 'error_outline', 'Unknown category type.');
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
            if(searchInput) searchInput.value = ''; 

            renderChannels(data, categoryType, false); 

        } catch (error) {
            console.error(`Failed to fetch content for ${categoryName}:`, error);
            showContentPlaceholder(channelGridContainer, 'signal_disconnected', `Error loading: ${error.message || 'Check connection.'}`);
            window.originalChannelsForCategory = null; 
            window.currentCategoryType = null;
        }
    }

    function renderChannels(items, categoryType, isSearchResult = false) {
        const channelGridContainer = document.getElementById('channel-grid-container'); 
        if (!channelGridContainer) {
            console.error("#channel-grid-container not found!");
            return;
        }
        channelGridContainer.innerHTML = ''; 
    
        if (!items || (Array.isArray(items) && items.length === 0)) {
            if (categoryType === 'series' && items && typeof items === 'object' && items.info) {
            } else {
                let message = isSearchResult ? "No results match your search." : 
                              (categoryType === 'm3u' || categoryType === 'm3u_group' ? "No channels in this M3U group." : "No items found in this category.");
                let icon = isSearchResult ? "search_off" : "sentiment_very_dissatisfied"; 
                showContentPlaceholder(channelGridContainer, icon, message);
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
                <div class="channel-card-thumbnail-container" style="width: 200px; height: 300px; padding-top: 0; flex-shrink: 0;"> 
                    <img src="${coverImg}" alt="${seriesInfo.info.name || 'Series Cover'}" onerror="this.onerror=null;this.src='./placeholder.png';">
                </div>
                <div class="channel-card-body">
                    <h3 class="channel-card-title">${seriesInfo.info.name || 'N/A'}</h3>
                    <p class="channel-card-info"><strong>Released:</strong> ${seriesInfo.info.releasedate || 'N/A'}</p>
                    <p class="channel-card-info"><strong>Director:</strong> ${seriesInfo.info.director || 'N/A'}</p>
                    <p class="channel-card-info"><strong>Cast:</strong> ${seriesInfo.info.cast || 'N/A'}</p>
                    <p class="plot channel-card-info">${seriesInfo.info.plot || 'N/A'}</p>
                    ${seriesInfo.info.youtube_trailer ? `<p class="channel-card-info"><a href="https://www.youtube.com/watch?v=${seriesInfo.info.youtube_trailer}" target="_blank" rel="noopener noreferrer">Watch Trailer</a></p>` : ''}
                </div>
            `;
            if (seriesInfo.episodes) {
                let seasonsHtml = '<div class="series-seasons"><h4 class="channel-card-info">Seasons:</h4><ul>';
                for (const seasonNum in seriesInfo.episodes) {
                    seasonsHtml += `<li>Season ${seasonNum} (${seriesInfo.episodes[seasonNum].length} episodes)</li>`;
                }
                seasonsHtml += '</ul></div>';
                const body = card.querySelector('.channel-card-body');
                if (body) body.innerHTML += seasonsHtml; else card.innerHTML += seasonsHtml;
            }
            grid.appendChild(card);
        } else if (Array.isArray(items)) { 
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'channel-card';
                card.dataset.streamId = categoryType === 'm3u' || categoryType === 'm3u_group' ? item.stream_id : (categoryType === 'series' ? item.series_id : (item.stream_id || item.id));
                card.dataset.streamType = categoryType === 'm3u_group' ? 'm3u' : categoryType; 
                card.dataset.streamName = encodeURIComponent(item.name || item.title || 'Unknown Stream');
                if (categoryType === 'm3u' || categoryType === 'm3u_group') {
                    card.dataset.m3uUrl = item.url; 
                }
    
                let name = item.name || item.title || 'Unnamed Stream';
                let iconUrl = item.logo || item.stream_icon || item.icon || item.icon_url || item.movie_image || item.cover || './placeholder.png';
                let chnoDisplay = item.chno ? `<span class="channel-card-chno">${item.chno}</span>` : '';
                
                card.innerHTML = `
                    <div class="channel-card-thumbnail-container">
                        <img src="${iconUrl}" alt="${name}" onerror="this.onerror=null;this.src='./placeholder.png';">
                    </div>
                    <div class="channel-card-body">
                        <h4 class="channel-card-title">${chnoDisplay} ${name}</h4>
                        ${((categoryType === 'vod' || ((categoryType === 'm3u' || categoryType === 'm3u_group') && item.duration)) && item.rating_5based) ? `<p class="channel-card-info">Rating: ${Number(item.rating_5based).toFixed(1)}/5</p>` : ''}
                        ${((categoryType === 'vod' || ((categoryType === 'm3u' || categoryType === 'm3u_group') && item.duration)) && item.duration && item.duration !== '-1') ? `<p class="channel-card-info">Duration: ${item.duration}</p>` : ''}
                        ${item.language ? `<p class="channel-card-info language">Language: ${item.language}</p>` : ''}
                        ${item.country ? `<p class="channel-card-info country">Country: ${item.country}</p>` : ''}
                    </div>
                `;
                card.addEventListener('click', () => handleStreamClick(card.dataset));
                grid.appendChild(card);
            });
        }
    
        channelGridContainer.appendChild(grid);
        if (grid.childNodes.length === 0 && !(categoryType === 'series' && typeof items === 'object' && items.info)) {
           let message = isSearchResult ? "No results match your search." : (categoryType === 'm3u' || categoryType === 'm3u_group' ? "No channels in this M3U group." : "No items found in this category.");
           let icon = isSearchResult ? "search_off" : "sentiment_very_dissatisfied";
           showContentPlaceholder(channelGridContainer, icon, message);
        }
    }

    function updateBreadcrumbs(type, name) {
        const breadcrumbsBar = document.getElementById('breadcrumbs-bar');
        if (!breadcrumbsBar) return;
    
        let typeDisplay = '';
        if (type) {
            typeDisplay = type.toUpperCase().replace(/_/g, ' '); 
            if (type === 'm3u' || type === 'm3u_group') typeDisplay = 'M3U Playlist';
            else if (type === 'live') typeDisplay = 'Live TV';
            else if (type === 'vod') typeDisplay = 'Movies'; 
            else if (type === 'series') typeDisplay = 'TV Series';
        }
    
        let breadcrumbHtml = `<a href="#" id="breadcrumb-home">Home</a>`;
        if (typeDisplay && name) { 
            breadcrumbHtml += ` <span class="separator">&gt;</span> <span class="current-category-type">${typeDisplay}</span>`;
            breadcrumbHtml += ` <span class="separator">&gt;</span> <span class="current-category-name">${name}</span>`;
        } else if (typeDisplay) { 
            breadcrumbHtml += ` <span class="separator">&gt;</span> <span class="current-category-type">${typeDisplay}</span>`;
        }
        breadcrumbsBar.innerHTML = breadcrumbHtml;
        
        const homeLink = document.getElementById('breadcrumb-home');
        if (homeLink) {
            homeLink.addEventListener('click', (e) => {
                e.preventDefault();
                const channelsContainer = document.getElementById('channel-grid-container');
                const categoriesContainer = document.getElementById('category-nav'); 
                
                if (channelsContainer) showContentPlaceholder(channelsContainer, 'tv_off', 'Select a category to browse.');
                
                // Reset current category type for accurate rendering
                window.currentCategoryType = null; 
                window.originalChannelsForCategory = null;

                if (window.xtreamCategories && (Object.keys(window.xtreamCategories.live || {}).length > 0 || Object.keys(window.xtreamCategories.vod || {}).length > 0 || Object.keys(window.xtreamCategories.series || {}).length > 0 )) { 
                    renderCategories(window.xtreamCategories);
                } else if (window.m3uChannels && window.m3uChannels.length > 0) { 
                     displayM3UChannels(window.m3uChannels); 
                } else {
                     if (categoriesContainer) showContentPlaceholder(categoriesContainer, 'category', 'Load content via Login or M3U.');
                }
                if (document.getElementById('search-input')) document.getElementById('search-input').value = '';
                updateBreadcrumbs(null, null); 
            });
        }
    }

    async function handleStreamClick(streamData) {
        const decodedStreamName = decodeURIComponent(streamData.streamName);
        let streamUrlToPlay = '';
        let streamTypeMime = ''; 

        // Retrieve elements here, once, as they are needed early.
        const playerViewModal = document.getElementById('player-view-modal');
        const playerStreamTitle = document.getElementById('player-stream-title');
        const mainVideoPlayerElement = document.getElementById('main-video-player');
    
        if (!playerViewModal || !mainVideoPlayerElement || !playerStreamTitle) {
            console.error("Player modal, video element, or stream title element not found in DOM.");
            displayUIMessage("Player UI elements missing. Cannot play stream.", "error", loginMessageArea); // Use loginMessageArea if playerStreamTitle is part of the modal
            return;
        }
    
        if (streamData.streamType === 'm3u') {
            streamUrlToPlay = streamData.m3uUrl; 
            if (!streamUrlToPlay) {
                displayUIMessage('Error: M3U Stream URL not found in card data.', 'error', playerStreamTitle); 
                return;
            }
            if (streamUrlToPlay.toLowerCase().includes('.m3u8')) {
                streamTypeMime = 'application/x-mpegURL';
            } else if (streamUrlToPlay.toLowerCase().endsWith('.mp4')) {
                streamTypeMime = 'video/mp4';
            } else if (streamUrlToPlay.toLowerCase().endsWith('.ts')) {
                streamTypeMime = 'video/mp2t';
            } else {
                console.warn("Unknown M3U stream type, letting Video.js attempt detection:", streamUrlToPlay);
            }
        } else { 
            const userInfo = window.currentUserInfo;
            const serverUrl = window.currentServerUrl;
            if (!userInfo || !serverUrl) {
                displayUIMessage('Session error. Please log in again.', 'error', playerStreamTitle);
                return;
            }
            const { username, password } = userInfo;
            const streamId = streamData.streamId;
            const currentServerUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    
            switch (streamData.streamType) {
                case 'live':
                    streamUrlToPlay = `${currentServerUrl}/live/${username}/${password}/${streamId}.ts`;
                    streamTypeMime = 'application/x-mpegURL'; 
                    break;
                case 'vod':
                    let containerExtension = 'mp4';
                    if (window.originalChannelsForCategory && Array.isArray(window.originalChannelsForCategory)) {
                        const vodItem = window.originalChannelsForCategory.find(item => String(item.stream_id) === String(streamId));
                        if (vodItem && vodItem.container_extension) {
                            containerExtension = vodItem.container_extension.toLowerCase();
                        }
                    }
                    streamUrlToPlay = `${currentServerUrl}/movie/${username}/${password}/${streamId}.${containerExtension}`;
                    if (containerExtension === 'm3u8') streamTypeMime = 'application/x-mpegURL';
                    else if (containerExtension === 'mp4') streamTypeMime = 'video/mp4';
                    else if (containerExtension === 'mkv') streamTypeMime = 'video/x-matroska';
                    break;
                default:
                    displayUIMessage('Unknown stream type.', 'error', playerStreamTitle);
                    return;
            }
        }
    
        if (!streamUrlToPlay) {
            console.error("Stream URL could not be determined for stream ID:", streamData.streamId);
            displayUIMessage("Error: Could not determine stream URL.", "error", playerStreamTitle);
            return;
        }
        
        // ***** IMPORTANT CHANGE: Show modal BEFORE initializing Video.js *****
        playerViewModal.style.display = 'flex'; 
        playerStreamTitle.textContent = `Now Playing: ${decodedStreamName}`;
        // *********************************************************************
    
        console.log(`Attempting to play: ${streamUrlToPlay} (Type: ${streamTypeMime || 'auto'})`);
    
        if (videoJsPlayer) {
            videoJsPlayer.dispose();
            videoJsPlayer = null;
        }
        
        if (typeof videojs === 'undefined') {
            console.error("Video.js library is not loaded!");
            displayUIMessage("Error: Video player library not loaded.", "error", playerStreamTitle);
            playerViewModal.style.display = 'none'; 
            return;
        }
    
        const videoJsOptions = {
            autoplay: true,
            controls: true,
            responsive: true, 
            fluid: true, 
            sources: [{ src: streamUrlToPlay, type: streamTypeMime }]
        };
    
        videoJsPlayer = videojs(mainVideoPlayerElement, videoJsOptions, function onPlayerReady() {
            console.log('Video.js Player is ready.');
            this.on('error', function() {
                const error = this.error();
                console.error('Video.js Error:', error);
                const errorMsg = error && error.message ? error.message : 'Unknown player error';
                if(playerStreamTitle) playerStreamTitle.textContent = `Error: ${errorMsg}`;
            });
    
            this.on('loadedmetadata', function() {
                console.log('Metadata loaded. Video dimensions:', this.videoWidth(), this.videoHeight());
            });
        });
        
        document.querySelectorAll('#channel-grid-container .channel-card').forEach(card => card.classList.remove('active-stream'));
        const clickedCard = document.querySelector(`#channel-grid-container .channel-card[data-stream-id='${streamData.streamId}'][data-stream-type='${streamData.streamType}']`);
        if (clickedCard) {
            clickedCard.classList.add('active-stream');
        }
    }
    
    function closePlayer() { 
        if (playerViewModal) playerViewModal.style.display = 'none'; 
        if (videoJsPlayer) {
            videoJsPlayer.pause(); 
            videoJsPlayer.dispose();
            videoJsPlayer = null;
        }
        if (playerStreamTitle) playerStreamTitle.textContent = 'Now Playing: ...'; 
        document.querySelectorAll('#channel-grid-container .channel-card.active-stream').forEach(card => card.classList.remove('active-stream'));
        clearUIMessages(loginMessageArea); 
    }
    
    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const currentChannels = window.originalChannelsForCategory; 
        const currentType = window.currentCategoryType;
    
        if (!currentChannels) {
            return; 
        }
        
        if (currentType === 'series' && typeof currentChannels === 'object' && !Array.isArray(currentChannels) && currentChannels.info) {
            if (searchTerm) {
                displayUIMessage("Search applies to lists of channels/VODs, not the detailed series view.", "error", loginMessageArea); 
            } else {
                clearUIMessages(loginMessageArea); 
            }
            return; 
        }
    
        if (!searchTerm) {
            renderChannels(currentChannels, currentType, false); 
            return;
        }
    
        if (!Array.isArray(currentChannels)) {
            console.warn('Original data for category is not an array, cannot filter:', window.originalChannelsForCategory);
            renderChannels([], currentType, true); 
            return;
        }
    
        const filteredItems = currentChannels.filter(item => {
            const itemName = (item.name || item.title || '').toLowerCase();
            return itemName.includes(searchTerm);
        });
    
        renderChannels(filteredItems, currentType, true); 
    }

    const logoutButtonMain = document.getElementById('logout-button-main');
    if (logoutButtonMain) {
        logoutButtonMain.addEventListener('click', () => {
            closePlayer(); 
            localStorage.clear();
            window.currentUserInfo = null; 
            window.currentServerUrl = null;
            window.originalChannelsForCategory = null;
            window.currentCategoryType = null;
            window.m3uChannels = null;
            window.m3uEpgUrls = []; 
            window.m3uFileName = null;
            if (searchInput) searchInput.value = '';

            console.log('Session cleared. Logged out.');
            mainAppView.style.display = 'none';
            loginView.style.display = 'flex';
            if (serverUrlInput) serverUrlInput.value = ''; 
            if (usernameInput) usernameInput.value = ''; 
            if (passwordInput) passwordInput.value = '';
            clearUIMessages(loginMessageArea);
            
            const channelGridContainer = document.getElementById('channel-grid-container');
            if(channelGridContainer) showContentPlaceholder(channelGridContainer, 'tv_off', 'Select a category to see content.');
            const categoryNav = document.getElementById('category-nav');
            if(categoryNav) showContentPlaceholder(categoryNav, 'login', 'Login or upload M3U to load categories.');

            displayUIMessage('You have been logged out.', 'success', loginMessageArea);
            updateBreadcrumbs(null, null); 
        });
    }

    function parseM3U(m3uString) {
        const lines = m3uString.split(/\r\n|\n|\r/);
        const channels = [];
        let currentChannel = {}; 
        window.m3uEpgUrls = []; 
    
        let firstLineProcessed = false;
        for (const line of lines) {
            const trimmedLine = line.trim();
    
            if (!firstLineProcessed) {
                if (!trimmedLine.startsWith('#EXTM3U')) {
                    if (trimmedLine) { 
                        throw new Error("Invalid M3U file: Missing #EXTM3U header on the first non-empty line.");
                    }
                    continue; 
                }
                firstLineProcessed = true;
                const headerAttributesString = trimmedLine.substring(7).trim(); 
                const attributeRegexHeader = /([a-zA-Z0-9_-]+)=("([^"]*)"|([^\s]*))/g;
                let headerMatch;
                while ((headerMatch = attributeRegexHeader.exec(headerAttributesString)) !== null) {
                    if (headerMatch[1].toLowerCase() === 'x-tvg-url') {
                        const urls = (headerMatch[3] || headerMatch[4]).split(',');
                        urls.forEach(url => {
                            if (url.trim()) window.m3uEpgUrls.push(url.trim());
                        });
                    }
                }
                if (window.m3uEpgUrls.length > 0) {
                    console.log("EPG URLs found in M3U header:", window.m3uEpgUrls);
                }
                continue; 
            }
    
            if (trimmedLine.startsWith('#EXTINF:')) {
                currentChannel = { attributes: {} }; 
                const infoLine = trimmedLine.substring(8);
                const commaIndex = infoLine.lastIndexOf(',');
                
                let namePart = '';
                let attributesAndDuration = '';
    
                if (commaIndex !== -1) {
                    namePart = infoLine.substring(commaIndex + 1).trim();
                    attributesAndDuration = infoLine.substring(0, commaIndex).trim();
                } else {
                    namePart = infoLine.trim(); 
                    attributesAndDuration = "-1"; 
                }
                currentChannel.name = namePart;
    
                const firstSpaceIndex = attributesAndDuration.indexOf(' ');
                if (firstSpaceIndex !== -1) {
                    currentChannel.duration = attributesAndDuration.substring(0, firstSpaceIndex).trim();
                    const attributesString = attributesAndDuration.substring(firstSpaceIndex + 1).trim();
                    const attributeRegex = /([a-zA-Z0-9:._-]+)=("([^"]*)"|([^\s]*))/g; 
                    let match;
                    while ((match = attributeRegex.exec(attributesString)) !== null) {
                        currentChannel.attributes[match[1].toLowerCase()] = match[3] || match[4]; 
                    }
                } else {
                    currentChannel.duration = attributesAndDuration.trim();
                }
                
                currentChannel.logo = currentChannel.attributes['tvg-logo'] || currentChannel.attributes['logo'] || null;
                currentChannel.group = currentChannel.attributes['group-title'] || null;
                currentChannel.tvgId = currentChannel.attributes['tvg-id'] || null;
                currentChannel.tvgName = currentChannel.attributes['tvg-name'] || null;
                currentChannel.chno = currentChannel.attributes['tvg-chno'] || null; 
                currentChannel.language = currentChannel.attributes['tvg-language'] || null;
                currentChannel.country = currentChannel.attributes['tvg-country'] || null;
                currentChannel.epgShift = currentChannel.attributes['tvg-shift'] || null;
    
                if (currentChannel.name && !isNaN(currentChannel.name) && currentChannel.tvgName) {
                    currentChannel.name = currentChannel.tvgName;
                }
                if (!currentChannel.name && currentChannel.tvgName) {
                    currentChannel.name = currentChannel.tvgName;
                }
                if (!currentChannel.name) {
                    currentChannel.name = "Unnamed Channel";
                }
    
            } else if (trimmedLine && !trimmedLine.startsWith('#') && currentChannel.name) { 
                currentChannel.url = trimmedLine;
                currentChannel.stream_id = `m3u_${channels.length + 1}_${Date.now()}`;
                channels.push(currentChannel);
                currentChannel = {}; 
            }
        }
        return channels;
    }

});
