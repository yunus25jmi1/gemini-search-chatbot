const API_BASE_URL = 'https://gemini-search-chatbot.onrender.com';
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const themeToggle = document.getElementById('theme-toggle');

// Initialize Markdown converter
const mdConverter = new showdown.Converter({
    tables: true,
    simplifiedAutoLink: true,
    strikethrough: true,
    tasklists: true,
    ghCodeBlocks: true,
    emoji: true
});

// Theme Management
function initializeTheme() {
    const isDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    themeToggle.textContent = isDark ? '🌞' : '🌙';
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
    themeToggle.textContent = isDark ? '🌞' : '🌙';
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

// Message Handling with Markdown and Syntax Highlighting
function addMessage(content, isBot = true, sources = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isBot ? 'bot-message' : 'user-message'} animate-fade-in`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const tagSpan = document.createElement('span');
    tagSpan.className = 'message-tag';
    tagSpan.textContent = isBot ? 'AI' : 'You';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'prose dark:prose-invert max-w-full';
    textDiv.innerHTML = mdConverter.makeHtml(sanitize(content));
    
    // Apply syntax highlighting
    const preElements = textDiv.querySelectorAll('pre');
    preElements.forEach(pre => {
        pre.classList.add('language-none');
        if (!pre.firstElementChild?.classList.contains('language-none')) {
            const code = document.createElement('code');
            code.className = 'language-none';
            code.innerHTML = pre.innerHTML;
            pre.innerHTML = '';
            pre.appendChild(code);
        }
    });
    
    Prism.highlightAllUnder(textDiv);

    contentDiv.appendChild(tagSpan);
    contentDiv.appendChild(textDiv);

    if (sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'sources mt-2 space-y-1';
        sources.forEach(source => {
            const sourceElement = document.createElement('a');
            sourceElement.className = 'block text-xs text-blue-600 dark:text-blue-400 hover:underline';
            sourceElement.href = source;
            sourceElement.textContent = new URL(source).hostname;
            sourceElement.target = '_blank';
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
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    let loadingDiv = null;

    try {
        userInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        addMessage(message, false);
        userInput.value = '';

        loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = `
            <div class="loading-dot"></div>
            <div class="loading-dot" style="animation-delay: 0.2s"></div>
            <div class="loading-dot" style="animation-delay: 0.4s"></div>
        `;
        chatMessages.appendChild(loadingDiv);

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
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
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