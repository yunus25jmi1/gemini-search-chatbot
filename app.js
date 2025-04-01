const API_BASE_URL = 'https://gemini-search-chatbot.onrender.com';
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const themeToggle = document.getElementById('theme-toggle');

// Markdown Converter Configuration
const mdConverter = new showdown.Converter({
    tables: true,
    simplifiedAutoLink: true,
    strikethrough: true,
    tasklists: true,
    ghCodeBlocks: true,
    emoji: true,
    openLinksInNewWindow: true
});

// Theme Management
function initializeTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    themeToggle.innerHTML = isDark ? '🌞' : '🌙';
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    applyPrismTheme(isDark);
}

function applyPrismTheme(isDark) {
    const prismLight = document.getElementById('prism-light');
    const prismDark = document.getElementById('prism-dark');
    if (isDark) {
        prismLight?.setAttribute('disabled', 'true');
        prismDark?.removeAttribute('disabled');
    } else {
        prismDark?.setAttribute('disabled', 'true');
        prismLight?.removeAttribute('disabled');
    }
}

themeToggle.addEventListener('click', () => {
    const isDark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.innerHTML = isDark ? '🌞' : '🌙';
    applyPrismTheme(isDark);
});

// Session Management
let sessionId = localStorage.getItem('sessionId') || generateSessionId();
localStorage.setItem('sessionId', sessionId);

function generateSessionId() {
    const cryptoObj = window.crypto || window.msCrypto;
    const array = new Uint32Array(1);
    cryptoObj.getRandomValues(array);
    return `session-${Date.now()}-${array[0].toString(36)}`;
}

// Message Handling
function addMessage(content, isBot = true, sources = [], thinkingLog = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isBot ? 'bot-message' : 'user-message'} animate-fade-in`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    // Add thinking log if provided
    if (thinkingLog.length > 0) {
        const logDiv = document.createElement('div');
        logDiv.className = 'thinking-log space-y-3 mb-4';
        
        thinkingLog.forEach((entry, index) => {
            const logEntry = document.createElement('div');
            logEntry.className = `log-entry flex items-start gap-3 opacity-0 animate-fade-in-delayed`;
            logEntry.style.animationDelay = `${index * 0.2}s`;
            
            const icon = document.createElement('div');
            icon.className = `log-icon w-5 h-5 mt-1 rounded-full flex items-center justify-center ${getStatusColor(entry.status)}`;
            icon.innerHTML = getStatusIcon(entry.status);
            
            const text = document.createElement('div');
            text.className = 'log-text flex-1 text-sm';
            text.innerHTML = `
                <div class="font-medium text-gray-600 dark:text-gray-300">${entry.message}</div>
                <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">Step ${entry.step} - ${capitalize(entry.status)}</div>
            `;
            
            logEntry.appendChild(icon);
            logEntry.appendChild(text);
            logDiv.appendChild(logEntry);
        });
        
        contentDiv.appendChild(logDiv);
    }

    // Add main response content
    const textDiv = document.createElement('div');
    textDiv.className = 'prose dark:prose-invert';
    textDiv.innerHTML = mdConverter.makeHtml(sanitize(content));

    // Process code blocks for syntax highlighting
    const preElements = textDiv.querySelectorAll('pre');
    preElements.forEach(pre => {
        pre.classList.add('language-none');
        const code = document.createElement('code');
        code.className = 'language-none';
        code.innerHTML = pre.innerHTML;
        pre.innerHTML = '';
        pre.appendChild(code);
    });
    Prism.highlightAllUnder(textDiv);

    contentDiv.appendChild(textDiv);

    // Add sources if provided
    if (sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'sources mt-4 space-y-2';
        sources.forEach(source => {
            const sourceElement = document.createElement('a');
            sourceElement.className = 'flex items-center text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors';
            sourceElement.href = source;
            sourceElement.target = '_blank';
            sourceElement.rel = 'noopener noreferrer';
            sourceElement.innerHTML = `
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
                ${new URL(source).hostname}
            `;
            sourcesDiv.appendChild(sourceElement);
        });
        contentDiv.appendChild(sourcesDiv);
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getStatusColor(status) {
    const colors = {
        planning: 'bg-purple-100 text-purple-600 dark:bg-purple-800/50',
        searching: 'bg-blue-100 text-blue-600 dark:bg-blue-800/50',
        analyzing: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-800/50',
        finalizing: 'bg-green-100 text-green-600 dark:bg-green-800/50'
    };
    return colors[status] || 'bg-gray-100 dark:bg-gray-700';
}

function getStatusIcon(status) {
    const icons = {
        planning: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>`,
        searching: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
        analyzing: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`,
        finalizing: `<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`
    };
    return icons[status] || '';
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Chat Functionality
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    let loadingDiv = null;

    try {
        // Disable input
        userInput.disabled = true;
        sendBtn.innerHTML = `
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
            </svg>
        `;

        // Add user message
        addMessage(message, false);
        userInput.value = '';

        // Add loading indicator with progress bar and status text
        loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = `
            <div class="thinking-process">
                <div class="progress-bar w-full mb-4">
                    <div class="progress-fill" style="width: 30%"></div>
                </div>
                <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    <div class="loading-dot"></div>
                    <div class="text-sm">Processing your request</div>
                </div>
            </div>
        `;
        chatMessages.appendChild(loadingDiv);

        // Simulate progress updates
        const progressFill = loadingDiv.querySelector('.progress-fill');
        let progress = 30;
        const progressInterval = setInterval(() => {
            progress = Math.min(progress + (Math.random() * 10), 95);
            progressFill.style.width = `${progress}%`;
        }, 800);

        // API call
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': sessionId
            },
            body: JSON.stringify({
                message: message,
                search_enabled: true
            }),
            signal: controller.signal
        });

        clearInterval(progressInterval);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Request failed (${response.status})`);
        }

        const data = await response.json();
        if (loadingDiv) chatMessages.removeChild(loadingDiv);
        addMessage(data.response, true, data.sources || [], data.thinking_log || []);

    } catch (error) {
        console.error('Chat error:', error);
        if (loadingDiv) chatMessages.removeChild(loadingDiv);
        const errorMessage = error.name === 'AbortError' 
            ? 'Request timed out. Please try again.' 
            : error.message || 'An error occurred. Please try again.';
        addMessage(errorMessage, true);
    } finally {
        clearTimeout(timeoutId);
        userInput.disabled = false;
        sendBtn.innerHTML = `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
        `;
        userInput.focus();
    }
}

// Initialize
initializeTheme();

// Event Listeners
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);
