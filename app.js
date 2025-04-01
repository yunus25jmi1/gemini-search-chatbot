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
    const crypto = window.crypto || window.msCrypto;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return `session-${Date.now()}-${array[0].toString(36)}`;
}

// Message Handling
function addMessage(content, isBot = true, sources = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isBot ? 'bot-message' : 'user-message'} animate-fade-in`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'prose dark:prose-invert';
    textDiv.innerHTML = mdConverter.makeHtml(sanitize(content));

    // Process code blocks
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

        // Add loading indicator
        loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = `
            <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <div class="loading-dot"></div>
                <div class="loading-dot" style="animation-delay: 0.2s"></div>
                <div class="loading-dot" style="animation-delay: 0.4s"></div>
            </div>
        `;
        chatMessages.appendChild(loadingDiv);

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

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Request failed (${response.status})`);
        }

        const data = await response.json();
        if (loadingDiv) chatMessages.removeChild(loadingDiv);
        addMessage(data.response, true, data.sources || []);

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