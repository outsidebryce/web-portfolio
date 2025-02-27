class AIChatUI {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-message');
        this.currentAudio = null;
        
        // Bind event listeners
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Add initial welcome message
        this.addMessage({
            text: "Hi! I'm Bryce AI. How can I help you today?",
            isAI: true
        });
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Clear input
        this.chatInput.value = '';

        // Add user message to chat
        this.addMessage({
            text: message,
            isAI: false
        });

        // Show typing indicator
        const typingIndicator = this.addTypingIndicator();

        try {
            // Make API call to ElevenLabs AI
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error('API request failed');
            }

            const data = await response.json();
            
            // Remove typing indicator
            typingIndicator.remove();

            // Add AI response to chat
            this.addMessage({
                text: data.text,
                isAI: true,
                audioUrl: data.audioUrl
            });

        } catch (error) {
            console.error('Error:', error);
            typingIndicator.remove();
            this.addMessage({
                text: "Sorry, I encountered an error. Please try again.",
                isAI: true,
                isError: true
            });
        }
    }

    addMessage({ text, isAI, audioUrl, isError }) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `flex ${isAI ? 'justify-start' : 'justify-end'} items-start gap-2`;

        const contentDiv = document.createElement('div');
        contentDiv.className = `p-3 rounded-lg ${isAI 
            ? 'bg-gray-100 dark:bg-gray-700' 
            : 'bg-blue-100 dark:bg-blue-900'} ${
            isError ? 'text-red-600 dark:text-red-400' : ''
        }`;

        contentDiv.textContent = text;

        if (isAI && audioUrl) {
            const playButton = document.createElement('button');
            playButton.className = 'ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400';
            playButton.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            `;

            playButton.addEventListener('click', () => this.playAudio(audioUrl));
            contentDiv.appendChild(playButton);
        }

        messageDiv.appendChild(contentDiv);
        this.chatContainer.appendChild(messageDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    addTypingIndicator() {
        const indicatorDiv = document.createElement('div');
        indicatorDiv.className = 'flex justify-start items-center gap-2 p-3';
        indicatorDiv.innerHTML = `
            <div class="flex gap-1">
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
        `;
        this.chatContainer.appendChild(indicatorDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        return indicatorDiv;
    }

    async playAudio(audioUrl) {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        const audio = new Audio(audioUrl);
        this.currentAudio = audio;
        await audio.play();

        audio.addEventListener('ended', () => {
            this.currentAudio = null;
        });
    }
}

// Initialize chat UI when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AIChatUI();
}); 