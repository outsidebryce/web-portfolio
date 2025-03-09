document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM elements with correct IDs
    const dynamicContainer = document.getElementById('dynamic-content-container');
    const dynamicContent = document.getElementById('dynamic-content');
    const closeButton = document.getElementById('close-dynamic-content');

    // Function to close overlay with animation
    function closeOverlayWithAnimation() {
        const overlay = document.querySelector('.overlay-content');
        const background = document.querySelector('.overlay-background');
        
        // Add exit animation classes based on screen width
        if (window.innerWidth >= 640) { // sm breakpoint
            overlay.classList.add('slide-out-right');
        } else {
            overlay.classList.add('slide-out-bottom');
        }
        background.classList.add('fade-out');
        
        // Wait for animation to complete before removing
        setTimeout(() => {
            document.getElementById('overlay-container').innerHTML = '';
            document.body.style.overflow = 'auto';
            // Replace current URL with homepage without adding to history
            window.history.replaceState({}, '', '/');
            // Dispatch event to resume autoplay
            document.dispatchEvent(new Event('overlayClose'));
        }, 300); // Match this with CSS transition duration
    }

    async function updateOverlayContent(slug, type = 'posts', isInitialOpen = true) {
        try {
            let response;
            let data;
            
            // Try case-studies endpoint
            if (type === 'case-studies') {
                response = await fetch(`/api/case-studies/${slug}?refresh=true`);
                if (!response.ok) {
                    console.log('Case studies endpoint failed, trying posts endpoint...');
                    response = await fetch(`/api/posts/${slug}?refresh=true`);
                }
            } else {
                response = await fetch(`/api/posts/${slug}?refresh=true`);
            }

            if (!response.ok) {
                throw new Error(`Failed to load content: ${response.status}`);
            }

            data = await response.json();
            
            if (isInitialOpen) {
                // Full overlay HTML with animations for initial open
                const overlayHTML = `
                    <div class="overlay-background fixed inset-0 bg-black bg-opacity-50 z-50 fade-in">
                        <div class="overlay-content fixed inset-y-0 right-0 w-full sm:max-w-[50%] sm:max-w-4xl bg-white dark:bg-[#141414] shadow-xl z-50
                            sm:translate-x-0 sm:slide-in-right
                            translate-y-0 slide-in-bottom
                            h-full">
                            ${getOverlayContent(data)}
                        </div>
                    </div>
                `;
                document.getElementById('overlay-container').innerHTML = overlayHTML;
                document.body.style.overflow = 'hidden';
            } else {
                // Just update the content without animations
                const overlayContent = document.querySelector('.overlay-content');
                overlayContent.innerHTML = getOverlayContent(data);
            }

            // Update URL
            const urlPath = type === 'case-studies' ? `/case-studies/${slug}` : `/blog/${slug}`;
            window.history.pushState({}, '', urlPath);

            // Always attach close button listeners, regardless of initial or update
            document.querySelector('.close-overlay').addEventListener('click', closeOverlayWithAnimation);
            document.querySelector('.overlay-background').addEventListener('click', (e) => {
                if (e.target === e.currentTarget) closeOverlayWithAnimation();
            });

            // Add navigation listeners
            document.querySelectorAll('.prev-post, .next-post').forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const nextSlug = button.getAttribute('data-post-slug');
                    if (nextSlug) await updateOverlayContent(nextSlug, type, false);
                });
            });
        } catch (error) {
            console.error('Error loading content:', error);
            window.location.href = type === 'case-studies' ? `/case-studies/${slug}` : `/blog/${slug}`;
        }
    }
    
    // Helper function to generate overlay content
    function getOverlayContent(data) {
        return `
            <div class="flex flex-col h-full">
                <!-- Header -->
                <div class="flex justify-between items-center px-6 py-4 border-b dark:border-gray-800">
                    <div class="flex items-center space-x-4">
                        <button class="close-overlay text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <div class="post-metadata text-sm text-gray-500 dark:text-gray-400">
                            ${data.reading_time} min read • ${data.published_at.split('T')[0]}
                        </div>
                    </div>
                    
                    <div class="flex space-x-4">
                        ${data.prev_post ? `
                            <button data-post-slug="${data.prev_post.slug}" class="prev-post text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                ← Prev
                            </button>
                        ` : ''}
                        ${data.next_post ? `
                            <button data-post-slug="${data.next_post.slug}" class="next-post text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                Next →
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Scrollable Content -->
                <div class="flex-1 overflow-y-auto">
                    <div class="ghost-content max-w-[960px] mx-auto">
                        ${data.feature_image ? `
                            <div class="md:px-[60px] featured-image-container">
                                <img src="${data.feature_image}" alt="${data.title}" class="w-full h-auto">
                            </div>
                        ` : ''}
                        <div class="px-6 py-4 md:px-[60px] md:py-[60px]">
                            <h2 class="text-2xl mb-4 dark:text-white">${data.title}</h2>
                            <div class="post-content prose max-w-none dark:prose-invert">${data.html}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Add escape key handler
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.querySelector('.overlay-content');
            if (overlay) {
                closeOverlayWithAnimation();
            }
        }
    });

    // Listen for all link clicks
    document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (!link) return;

        const path = link.getAttribute('href');
        if (!path) return;

        // Check if it's a dynamic page link
        const dynamicPages = ['/about', '/contact', '/blog'];
        if (dynamicPages.includes(path)) {
            e.preventDefault();
            // Close menu first, then load content
            closeMobileMenu();
            loadDynamicContent(path);
        }
    });

    // Listen for dynamic content links
    document.addEventListener('click', async function(e) {
        // Prevent multiple handlers from firing
        if (e.handled === true) return;
        
        const link = e.target.closest('.post-link, .case-study-link, [data-slug]');
        if (!link) return;
        
        e.preventDefault();
        e.stopPropagation();
        e.handled = true;
        
        const slug = link.getAttribute('data-slug');
        const type = link.classList.contains('case-study-link') ? 'case-studies' : 'posts';
        
        try {
            await updateOverlayContent(slug, type);
        } catch (error) {
            console.error('Error in click handler:', error);
        }
    });

    // Close/back button handler - with safety check
    if (closeButton) {
        closeButton.addEventListener('click', closeDynamicContent);
    }

    // Handle browser back/forward buttons
    window.addEventListener('popstate', function(e) {
        if (e.state && e.state.path) {
            loadDynamicContent(e.state.path);
        } else {
            closeDynamicContent();
            // Reset menu state
            const menuOverlay = document.getElementById('menuOverlay');
            const mobileMenu = document.querySelector('#mobile-menu');
            
            if (menuOverlay) {
                menuOverlay.classList.remove('sm:-translate-x-full', 'translate-x-full');
                menuOverlay.classList.add('hidden');
            }
            
            if (mobileMenu) {
                mobileMenu.classList.add('hidden');
            }
        }
    });

    // Comment out welcome message initialization
    // playWelcomeMessage();

    // Comment out welcome message click handler
    // document.getElementById('play-welcome')?.addEventListener('click', playWelcomeMessage);

    // Function to close mobile menu
    function closeMobileMenu() {
        const mobileMenu = document.querySelector('#mobile-menu');
        const mobileMenuButton = document.querySelector('[aria-controls="mobile-menu"]');
        
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
            if (mobileMenuButton) {
                mobileMenuButton.setAttribute('aria-expanded', 'false');
                // Toggle menu icons
                const icons = mobileMenuButton.querySelectorAll('svg');
                const menuIcon = icons[0];
                const closeIcon = icons[1];
                menuIcon.classList.remove('hidden');
                closeIcon.classList.add('hidden');
            }
        }
    }

    // Handle dynamic page loading
    async function loadDynamicContent(path) {
        try {
            // Hide menu overlay with slide animation if it exists
            const menuOverlay = document.getElementById('menuOverlay');
            if (menuOverlay) {
                menuOverlay.classList.add('sm:-translate-x-full');
                menuOverlay.classList.add('transition-transform');
                menuOverlay.classList.add('duration-300');
                menuOverlay.classList.add('ease-in-out');
                
                // Wait for animation to complete before hiding
                setTimeout(() => {
                    menuOverlay.classList.add('hidden');
                }, 300);
            }

            // Close mobile menu first
            closeMobileMenu();

            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const htmlText = await response.text();
            
            // Create a temporary container to parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');
            
            // Clear the dynamic content container
            dynamicContent.innerHTML = '';
            
            // Get the content after the header from the loaded page
            const header = doc.querySelector('header');
            let content = document.createElement('div');
            
            if (header) {
                let currentElement = header.nextElementSibling;
                while (currentElement) {
                    content.appendChild(currentElement.cloneNode(true));
                    currentElement = currentElement.nextElementSibling;
                }
            } else {
                content.innerHTML = doc.body.innerHTML;
            }

            // Get the existing header from the current page and clone it
            const existingHeader = document.querySelector('header');
            if (existingHeader) {
                // Clone the header for the dynamic content
                const headerClone = existingHeader.cloneNode(true);
                
                // Update IDs to be unique
                const dynamicMenuId = 'dynamic-mobile-menu';
                const dynamicOverlayId = 'dynamic-menuOverlay';
                
                const mobileMenu = headerClone.querySelector('#mobile-menu');
                const menuOverlay = headerClone.querySelector('#menuOverlay');
                
                if (mobileMenu) mobileMenu.id = dynamicMenuId;
                if (menuOverlay) menuOverlay.id = dynamicOverlayId;
                
                // Update aria-controls attribute
                const menuButton = headerClone.querySelector('[aria-controls="mobile-menu"]');
                if (menuButton) {
                    menuButton.setAttribute('aria-controls', dynamicMenuId);
                }
                
                dynamicContent.appendChild(headerClone);
                
                // Initialize the cloned header components with the new IDs
                initializeHeaderComponents(headerClone, {
                    menuId: dynamicMenuId,
                    overlayId: dynamicOverlayId
                });
            }
            
            // Add the main content
            dynamicContent.appendChild(content);
            
            // Show container with fade
            dynamicContainer.classList.remove('hidden');
            // Trigger reflow
            dynamicContainer.offsetHeight;
            dynamicContainer.classList.remove('opacity-0');
            
            // Update URL
            history.pushState({ path }, '', path);
            
            // Initialize any scripts needed for the loaded content
            initializeLoadedContent();

            // Reinitialize dark mode if it was set
            const isDark = localStorage.getItem('darkMode') === 'true';
            if (isDark) {
                document.documentElement.classList.add('dark');
            }
        } catch (error) {
            console.error('Error loading content:', error);
            dynamicContent.innerHTML = `
                <div class="flex flex-col items-center justify-center min-h-screen">
                    <p class="text-red-600 dark:text-red-400 mb-4">Error loading content</p>
                    <button onclick="window.location.reload()" class="text-blue-600 hover:text-blue-800">
                        Try refreshing the page
                    </button>
                </div>
            `;
        }
    }

    // Handle closing dynamic content - with safety check
    function closeDynamicContent() {
        if (!dynamicContainer) return;
        
        // Fade out
        dynamicContainer.classList.add('opacity-0');
        
        // After animation, hide and clear content
        setTimeout(() => {
            dynamicContainer.classList.add('hidden');
            if (dynamicContent) {
                dynamicContent.innerHTML = '';
            }
            // Update URL without refreshing
            history.pushState({}, '', '/');
        }, 300);
    }

    // Initialize any scripts needed for dynamically loaded content
    function initializeLoadedContent() {
        // Reinitialize Masonry if needed
        if (typeof Masonry !== 'undefined' && document.querySelector('.photo-grid')) {
            initializeMasonryLayout();
        }

        // Initialize header components immediately
        const dynamicHeader = document.querySelector('#dynamic-content header');
        if (dynamicHeader) {
            initializeHeaderComponents(dynamicHeader, {
                menuId: 'dynamic-mobile-menu',
                overlayId: 'dynamic-menuOverlay'
            });
        }
    }

    // Initialize header components
    function initializeHeaderComponents(headerElement = document, options = {}) {
        const { menuId = 'mobile-menu', overlayId = 'menuOverlay' } = options;
        
        // Initialize mobile menu button
        const mobileMenuButton = headerElement.querySelector(`[aria-controls="${menuId}"]`);
        const mobileMenu = headerElement.querySelector(`#${menuId}`);
        const menuOverlay = headerElement.querySelector(`#${overlayId}`);
        
        if (mobileMenuButton && mobileMenu) {
            // Instead of cloning, directly add the event listener
            mobileMenuButton.addEventListener('click', function(e) {
                const expanded = this.getAttribute('aria-expanded') === 'true';
                this.setAttribute('aria-expanded', !expanded);
                mobileMenu.classList.toggle('hidden');
                
                // Toggle menu icons
                const icons = this.querySelectorAll('svg');
                icons.forEach(icon => icon.classList.toggle('hidden'));
                
                // Show/hide menu overlay
                if (menuOverlay) {
                    if (!expanded) {
                        menuOverlay.classList.remove('hidden');
                        menuOverlay.classList.remove('sm:-translate-x-full');
                    } else {
                        menuOverlay.classList.add('sm:-translate-x-full');
                        setTimeout(() => {
                            menuOverlay.classList.add('hidden');
                        }, 300);
                    }
                }
                
                // Prevent event from bubbling
                e.stopPropagation();
            });
        }

        // Initialize dark mode toggle
        const darkModeToggle = headerElement.querySelector('#dark-mode-toggle');
        if (darkModeToggle) {
            // Instead of cloning, directly add the event listener
            darkModeToggle.addEventListener('click', function() {
                document.documentElement.classList.toggle('dark');
                const isDark = document.documentElement.classList.contains('dark');
                localStorage.setItem('darkMode', isDark ? 'true' : 'false');
            });
        }

        // Initialize time display
        const timeDisplay = headerElement.querySelector('#time-display');
        if (timeDisplay) {
            updateTime(); // Initial update
            // Clear any existing intervals
            if (window.timeUpdateInterval) {
                clearInterval(window.timeUpdateInterval);
            }
            // Update time every minute
            window.timeUpdateInterval = setInterval(updateTime, 60000);
        }
    }

    // Add helper function for time display
    function updateTime() {
        const timeDisplay = document.getElementById('time-display');
        if (timeDisplay) {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const formattedHours = hours % 12 || 12;
            const formattedMinutes = minutes.toString().padStart(2, '0');
            timeDisplay.textContent = `${formattedHours}:${formattedMinutes} ${ampm}`;
        }
    }
});

// Keep the function but comment it out for later use
/*
let currentAudio = null;
async function playWelcomeMessage() {
    // Stop any currently playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }

    const API_KEY = 'sk_63f366f1227aa36563292a4af2ab75900c704b6e9e7ed2aa';
    const VOICE_ID = 'jINhJbuT1SpPyz9weXfW';
    
    const text = "Hello, I'm Bryce. I'm a lead product designer in Austin, Texas, helping your health, marketplace, or B2B company ship innovative experiences for your customers.";
    
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': API_KEY
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`TTS request failed: ${errorData}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        // Set the current audio instance
        currentAudio = audio;
        
        // Clean up when audio finishes
        audio.addEventListener('ended', () => {
            URL.revokeObjectURL(audioUrl); // Clean up the blob URL
            currentAudio = null;
        });
        
        // Play the audio
        await audio.play();
        
    } catch (error) {
        console.error('Error playing welcome message:', error);
        currentAudio = null;
    }
}
*/ 