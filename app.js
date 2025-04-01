const API_BASE_URL = 'https://gemini-search-chatbot.onrender.com';
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const themeToggle = document.getElementById('theme-toggle');

let sessionId = localStorage.getItem('sessionId') || generateSessionId();
localStorage.setItem('sessionId', sessionId);

function generateSessionId() {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function addMessage(content, isBot = true, sources = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isBot ? 'bot-message' : 'user-message'} animate-fade-in`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content relative';
    
    // Add message tag
    const tag = document.createElement('span');
    tag.className = `message-tag absolute -top-6 ${isBot ? 'bot-tag' : 'user-tag'}`;
    tag.textContent = isBot ? 'BOT' : 'USER';
    contentDiv.appendChild(tag);
    
    const textElement = document.createElement('div');
    textElement.textContent = sanitize(content);
    textElement.className = 'pt-4';
    contentDiv.appendChild(textElement);
    
    if (sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'sources mt-2';
        sources.forEach(source => {
            const sourceElement = document.createElement('div');
            sourceElement.className = 'text-xs text-gray-400 dark:text-gray-500';
            sourceElement.textContent = `🔗 ${source}`;
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

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message text-red-500 dark:text-red-300 p-2 mt-2 border border-red-300 dark:border-red-800 rounded';
    errorDiv.textContent = message;
    
    const existingError = chatMessages.querySelector('.error-message');
    if (existingError) {
        chatMessages.replaceChild(errorDiv, existingError);
    } else {
        chatMessages.appendChild(errorDiv);
    }
}

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let loadingDiv = null;

    try {
        userInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        addMessage(message, false);
        userInput.value = '';

        loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator flex justify-center py-4';
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
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (loadingDiv) chatMessages.removeChild(loadingDiv);
        addMessage(data.response, true, data.sources || []);

    } catch (error) {
        console.error('Chat error:', error);
        if (loadingDiv) chatMessages.removeChild(loadingDiv);
        
        if (error.name === 'AbortError') {
            showError('Request timed out. Please try again.');
        } else if (error.message.includes('Failed to fetch')) {
            showError('Network error. Please check your connection.');
        } else {
            showError(error.message || 'An unexpected error occurred.');
        }
    } finally {
        clearTimeout(timeoutId);
        userInput.disabled = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    }
}

// Theme toggle functionality
function updateTheme() {
    const isDark = document.body.classList.contains('dark');
    themeToggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    updateTheme();
});

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.classList.toggle('dark', savedTheme === 'dark');
updateTheme();

// Event Listeners
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

sendBtn.addEventListener('click', sendMessage);