document.addEventListener('DOMContentLoaded', function() {
    // Function to close overlay
    window.closeOverlay = function() {
        const overlay = document.querySelector('.overlay-background');
        const content = document.querySelector('.overlay-content-animate');
        
        if (content) {
            // Add closing animation class
            content.style.animation = window.innerWidth > 768 ? 
                'slideIn 0.3s reverse' : 
                'slideInMobile 0.3s reverse';
            
            // Remove overlay after animation
            setTimeout(() => {
                if (overlay) {
                    overlay.remove();
                    document.body.style.overflow = 'auto';
                    window.history.pushState({}, '', '/');
                }
            }, 300);
        }
    }

    // Handle post link clicks
    document.querySelectorAll('.post-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const slug = link.getAttribute('data-slug');
            try {
                const response = await fetch(`/api/posts/${slug}`);
                if (!response.ok) throw new Error('Failed to load post');
                const html = await response.text();
                document.getElementById('overlay-container').innerHTML = html;
                document.body.style.overflow = 'hidden';
                window.history.pushState({}, '', `/blog/${slug}`);

                // Add click handler to the newly created overlay
                const overlay = document.querySelector('.overlay-background');
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        closeOverlay();
                    }
                });
            } catch (error) {
                console.error('Error loading post:', error);
                window.location.href = `/blog/${slug}`;
            }
        });
    });

    // Handle case study link clicks
    document.querySelectorAll('.case-study-link').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const slug = link.getAttribute('data-slug');
            try {
                const response = await fetch(`/api/case-studies/${slug}`);
                if (!response.ok) throw new Error('Failed to load case study');
                const html = await response.text();
                document.getElementById('overlay-container').innerHTML = html;
                document.body.style.overflow = 'hidden';
                window.history.pushState({}, '', `/case-studies/${slug}`);

                // Add click handler to the newly created overlay
                const overlay = document.querySelector('.overlay-background');
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        closeOverlay();
                    }
                });
            } catch (error) {
                console.error('Error loading case study:', error);
                window.location.href = `/case-studies/${slug}`;
            }
        });
    });

    // Close overlay when clicking outside or on close button
    document.addEventListener('click', function(e) {
        const overlay = e.target.closest('.overlay-background');
        const content = e.target.closest('.bg-white');
        
        // If clicked element is the overlay background (not the content)
        if (overlay && !content) {
            closeOverlay();
        }
        
        // Close button click
        if (e.target.closest('#close-overlay')) {
            e.preventDefault();
            closeOverlay();
        }
    }, true);

    // Handle next/previous navigation in overlay
    document.addEventListener('click', async e => {
        const navButton = e.target.closest('.next-post, .prev-post');
        if (navButton) {
            e.preventDefault();
            const slug = navButton.getAttribute('data-post-slug');
            const type = window.location.pathname.includes('case-studies') ? 'case-studies' : 'posts';
            try {
                const response = await fetch(`/api/${type}/${slug}`);
                if (!response.ok) throw new Error('Failed to load content');
                const html = await response.text();
                document.getElementById('overlay-container').innerHTML = html;
                window.history.pushState({}, '', `/${type === 'posts' ? 'blog' : type}/${slug}`);

                // Add click handler to the newly created overlay
                const overlay = document.querySelector('.overlay-background');
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        closeOverlay();
                    }
                });
            } catch (error) {
                console.error('Error loading content:', error);
                window.location.href = `/${type === 'posts' ? 'blog' : type}/${slug}`;
            }
        }
    });

    // Handle browser back/forward
    window.addEventListener('popstate', () => {
        if (window.location.pathname === '/') {
            closeOverlay();
        }
    });
}); 