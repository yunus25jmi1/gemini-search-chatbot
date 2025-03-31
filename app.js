const API_BASE_URL = 'https://gemini-search-chatbot.onrender.com';
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

let sessionId = localStorage.getItem('sessionId') || generateSessionId();
localStorage.setItem('sessionId', sessionId);

// Session management
function generateSessionId() {
    const crypto = window.crypto || window.msCrypto;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return `session-${Date.now()}-${array[0].toString(36)}`;
}

// Message handling
function addMessage(content, isBot = true, sources = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${isBot ? 'bot-message' : 'user-message'} animate-fade-in`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = sanitize(content);
    
    if (sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'sources mt-2';
        sources.forEach(source => {
            const sourceElement = document.createElement('div');
            sourceElement.className = 'text-xs text-gray-600';
            sourceElement.textContent = `🔗 ${source}`;
            sourcesDiv.appendChild(sourceElement);
        });
        contentDiv.appendChild(sourcesDiv);
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Security sanitization
function sanitize(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Error handling
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message text-red-500 p-2 mt-2 border border-red-300 rounded';
    errorDiv.textContent = message;
    
    const existingError = chatMessages.querySelector('.error-message');
    if (existingError) {
        chatMessages.replaceChild(errorDiv, existingError);
    } else {
        chatMessages.appendChild(errorDiv);
    }
}

// Core chat functionality
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    let loadingDiv = null;
    try {
        // Disable UI during processing
        userInput.disabled = true;
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        // Add user message
        addMessage(message, false);
        userInput.value = '';

        // Add loading indicator
        loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = `
            <div class="loading-dot"></div>
            <div class="loading-dot" style="animation-delay: 0.2s"></div>
            <div class="loading-dot" style="animation-delay: 0.4s"></div>
        `;
        chatMessages.appendChild(loadingDiv);

        // API request
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-ID': sessionId
            },
            body: JSON.stringify({
                message: message,
                search_enabled: true // Fixed parameter name
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Cleanup and display
        if (loadingDiv) chatMessages.removeChild(loadingDiv);
        addMessage(data.response, true, data.sources || []);

    } catch (error) {
        console.error('Chat error:', error);
        if (loadingDiv) chatMessages.removeChild(loadingDiv);
        showError(error.message || 'Connection failed. Please try again.');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    }
}

// Event listeners
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage().catch(error => {
            console.error('Unhandled error:', error);
            showError('Unexpected error occurred');
        });
    }
});

sendBtn.addEventListener('click', () => {
    sendMessage().catch(error => {
        console.error('Unhandled error:', error);
        showError('Unexpected error occurred');
    });
});