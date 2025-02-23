document.addEventListener('DOMContentLoaded', function() {
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
                response = await fetch(`/api/case-studies/${slug}`);
                if (!response.ok) {
                    console.log('Case studies endpoint failed, trying posts endpoint...');
                    response = await fetch(`/api/posts/${slug}`);
                }
            } else {
                response = await fetch(`/api/posts/${slug}`);
            }

            if (!response.ok) {
                throw new Error(`Failed to load content: ${response.status}`);
            }

            data = await response.json();
            
            if (isInitialOpen) {
                // Full overlay HTML with animations for initial open
                const overlayHTML = `
                    <div class="overlay-background fixed inset-0 bg-black bg-opacity-50 z-50 fade-in">
                        <div class="overlay-content fixed inset-y-0 right-0 w-full sm:min-w-[48rem] sm:max-w-4xl bg-white dark:bg-[#141414] shadow-xl z-50
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
                    ${data.feature_image ? `
                        <img src="${data.feature_image}" alt="${data.title}" class="w-full h-auto">
                    ` : ''}
                    <div class="px-6 py-4">
                        <h2 class="text-2xl mb-4 dark:text-white">${data.title}</h2>
                        <div class="post-content prose max-w-none dark:prose-invert">${data.html}</div>
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

    // Modify click handler to include article clicks
    document.addEventListener('click', async (e) => {
        const link = e.target.closest('.post-link, .case-study-link, article[data-slug]');
        if (!link) return;
        
        e.preventDefault();
        
        const slug = link.getAttribute('data-slug');
        const type = link.classList.contains('post-link') ? 'posts' : 'case-studies';
        
        try {
            await updateOverlayContent(slug, type);
        } catch (error) {
            console.error('Error in click handler:', error);
        }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        if (window.location.pathname === '/') {
            closeOverlayWithAnimation();
        }
    });
}); 