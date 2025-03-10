// Weather/Schedule Overlay Controller
class WeatherScheduleOverlay {
    constructor() {
        this.overlayContainer = document.getElementById('overlay-container');
        this.clockButton = document.getElementById('chicago-clock');
        this.currentView = 'weather'; // 'weather' or 'schedule'
        this.weatherData = null;
        this.charts = {};
        
        // OpenWeatherMap API configuration
        this.weatherAPI = {
            key: '1ac9baa1bb6d9b78df9aced8ea8f2865',
            baseUrl: 'https://api.openweathermap.org/data/2.5',
            city: 'Austin,US',
            lat: 30.2672, // Austin coordinates
            lon: -97.7431
        };
        
        this.init();
    }

    init() {
        if (!this.overlayContainer || !this.clockButton) {
            console.error('Required DOM elements not found');
            return;
        }

        // Add display block to clock button
        this.clockButton.classList.add('block');

        // Bind clock button click
        this.clockButton.addEventListener('click', () => this.openOverlay());
        
        // Add theme change listener to update charts and calendar
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                setTimeout(() => {
                    if (this.weatherData) {
                        this.initializeCharts();
                    }
                    // Reload the current view to update Cal.com theme if needed
                    if (this.currentView === 'schedule') {
                        this.loadView('schedule');
                    }
                }, 100);
            });

            // Also listen for system theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                setTimeout(() => {
                    if (this.weatherData) {
                        this.initializeCharts();
                    }
                    // Reload the current view to update Cal.com theme if needed
                    if (this.currentView === 'schedule') {
                        this.loadView('schedule');
                    }
                }, 100);
            });
        }
    }

    async openOverlay() {
        if (!this.overlayContainer) return;
        
        // Create and insert overlay HTML
        const overlayHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-0 animate-overlay-fade z-[200]" id="weather-schedule-overlay">
                <div class="absolute inset-y-0 right-0 w-full bg-white dark:bg-[#111111] text-gray-900 dark:text-white overflow-y-auto translate-y-full animate-overlay-slide">
                    <!-- Header -->
                    <div class="sticky top-0 z-10 bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-gray-800">
                        <div class="flex justify-between items-center px-6 py-4 md:py-4 py-2">
                            <h1 class="font-['Inter'] text-[1.2rem] font-light opacity-0 translate-x-4 animate-title-slide" style="animation-delay: 300ms;">Austin, Texas</h1>
                            <button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 opacity-0 translate-x-4 animate-title-slide" style="animation-delay: 300ms;" id="close-weather-schedule">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Navigation -->
                    <div class="px-6 py-2">
                        <div class="flex space-x-4 opacity-0 translate-x-4 animate-nav-slide" style="animation-delay: 400ms;">
                            <button class="px-4 py-2 rounded-full text-sm font-medium transition-colors view-toggle ${this.currentView === 'weather' ? 'bg-blue-600 dark:bg-blue-900 text-white dark:text-blue-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}" data-view="weather">
                                Weather
                            </button>
                            <button class="px-4 py-2 rounded-full text-sm font-medium transition-colors view-toggle ${this.currentView === 'schedule' ? 'bg-blue-600 dark:bg-blue-900 text-white dark:text-blue-100' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}" data-view="schedule">
                                Schedule
                            </button>
                        </div>
                    </div>

                    <!-- Content Container -->
                    <div id="weather-schedule-content" class="pt-0 px-6 pb-6">
                        <!-- Content will be dynamically inserted here -->
                    </div>
                </div>
            </div>

            <style>
                @keyframes overlayFade {
                    from { background-opacity: 0; }
                    to { background-opacity: 0.5; }
                }
                
                @keyframes overlaySlide {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                
                @keyframes titleSlide {
                    from { 
                        opacity: 0;
                        transform: translateX(1rem);
                    }
                    to { 
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                @keyframes contentSlide {
                    from { 
                        opacity: 0;
                        transform: translateY(2rem);
                    }
                    to { 
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .animate-overlay-fade {
                    animation: overlayFade 300ms ease-out forwards;
                }
                
                .animate-overlay-slide {
                    animation: overlaySlide 300ms ease-out forwards;
                }
                
                .animate-title-slide {
                    animation: titleSlide 300ms ease-out forwards;
                }
                
                .animate-nav-slide {
                    animation: titleSlide 300ms ease-out forwards;
                }
                
                .animate-content-slide {
                    animation: contentSlide 300ms ease-out forwards;
                }
            </style>
        `;
        
        this.overlayContainer.innerHTML = overlayHTML;
        
        // Start clock update
        this.startClock();
        
        // Add event listeners
        const closeButton = document.getElementById('close-weather-schedule');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.closeOverlay());
        }
        
        document.querySelectorAll('.view-toggle').forEach(button => {
            button.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });
        
        // Load initial view
        try {
            await this.loadView(this.currentView);
        } catch (error) {
            console.error('Error loading view:', error);
            this.showError('Failed to load view');
        }
    }

    async loadView(view) {
        const contentContainer = document.getElementById('weather-schedule-content');
        if (!contentContainer) return;
        
        try {
            if (view === 'weather') {
                contentContainer.innerHTML = this.getLoadingHTML();
                // Load weather data if we haven't already
                if (!this.weatherData) {
                    await this.fetchWeatherData();
                }
                if (this.weatherData) {
                    contentContainer.innerHTML = this.getWeatherHTML();
                    this.initializeCharts();
                } else {
                    this.showError('Failed to load weather data');
                }
            } else {
                // Schedule view - simple iframe embed
                const isDarkMode = document.documentElement.classList.contains('dark');
                contentContainer.innerHTML = `
                    <div class="w-full h-full min-h-[700px] bg-white dark:bg-[#111111] opacity-0 translate-y-8 animate-content-slide">
                        <iframe
                            src="https://cal.com/brycethompson/30min?theme=${isDarkMode ? 'dark' : 'light'}&layout=week_view&hideEventTypeDetails=false&hideBranding=true"
                            style="width: 100%; height: 100%; min-height: 800px; border: none;"
                            frameborder="0"
                            allowfullscreen
                            loading="lazy"
                        ></iframe>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error in loadView:', error);
            this.showError('Failed to load view');
        }
    }

    async fetchWeatherData() {
        try {
            // Fetch current weather
            const currentWeatherResponse = await fetch(
                `${this.weatherAPI.baseUrl}/weather?lat=${this.weatherAPI.lat}&lon=${this.weatherAPI.lon}&appid=${this.weatherAPI.key}&units=imperial`
            );
            if (!currentWeatherResponse.ok) {
                throw new Error(`Weather API error: ${currentWeatherResponse.statusText}`);
            }
            const currentWeather = await currentWeatherResponse.json();

            // Fetch 5-day forecast with 3-hour intervals
            const forecastResponse = await fetch(
                `${this.weatherAPI.baseUrl}/forecast?lat=${this.weatherAPI.lat}&lon=${this.weatherAPI.lon}&appid=${this.weatherAPI.key}&units=imperial`
            );
            if (!forecastResponse.ok) {
                throw new Error(`Forecast API error: ${forecastResponse.statusText}`);
            }
            const forecast = await forecastResponse.json();

            this.weatherData = {
                current: currentWeather,
                forecast: forecast
            };

            return this.weatherData;
        } catch (error) {
            console.error('Error fetching weather data:', error);
            this.weatherData = null;
            return null;
        }
    }

    getWeatherIconSVG(iconCode) {
        // Map OpenWeatherMap icon codes to Weather Icons classes
        const iconMap = {
            '01d': 'wi-day-sunny',
            '01n': 'wi-night-clear',
            '02d': 'wi-day-cloudy',
            '02n': 'wi-night-alt-cloudy',
            '03d': 'wi-cloud',
            '03n': 'wi-cloud',
            '04d': 'wi-cloudy',
            '04n': 'wi-cloudy',
            '09d': 'wi-showers',
            '09n': 'wi-showers',
            '10d': 'wi-day-rain',
            '10n': 'wi-night-alt-rain',
            '11d': 'wi-thunderstorm',
            '11n': 'wi-thunderstorm',
            '13d': 'wi-snow',
            '13n': 'wi-snow',
            '50d': 'wi-fog',
            '50n': 'wi-fog'
        };

        const iconClass = iconMap[iconCode] || 'wi-cloud';
        return `<i class="wi ${iconClass}"></i>`;
    }

    getWeatherHTML() {
        if (!this.weatherData || !this.weatherData.current || !this.weatherData.forecast) {
            return this.getLoadingHTML();
        }

        try {
            const current = this.weatherData.current;
            const forecast = this.weatherData.forecast;

            if (!current.weather || !current.weather[0] || !current.main) {
                throw new Error('Invalid weather data structure');
            }

            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'America/Chicago'
            });

            // Get appropriate weather icon
            const weatherIcon = this.getWeatherIconSVG(current.weather[0].icon);

            return `
                <div class="space-y-8 opacity-0 translate-y-8 animate-content-slide">
                    <!-- Current Weather -->
                    <div class="flex items-start gap-6">
                        <div class="text-gray-900 dark:text-white text-[96px]">
                            ${weatherIcon}
                        </div>
                        <div class="space-y-2">
                            <div class="text-4xl font-light">${timeString}</div>
                            <div class="flex items-center gap-2">
                                <div class="text-5xl font-light">${Math.round(current.main.temp)}°F</div>
                                <div class="text-xl text-gray-600 dark:text-gray-400">${current.weather[0].main}</div>
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                                Feels like ${Math.round(current.main.feels_like)}°F • Humidity ${current.main.humidity}%
                            </div>
                        </div>
                    </div>

                    <!-- Charts Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- 5-day forecast -->
                        <div class="bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-4">
                            <h3 class="text-lg font-medium mb-4">5-Day Forecast</h3>
                            <div class="chart-container h-[300px]">
                                <canvas id="forecast-chart"></canvas>
                            </div>
                        </div>

                        <!-- Precipitation -->
                        <div class="bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-4">
                            <h3 class="text-lg font-medium mb-4">Precipitation</h3>
                            <div class="chart-container h-[300px]">
                                <canvas id="precipitation-chart"></canvas>
                            </div>
                        </div>

                        <!-- Temperature Comparison -->
                        <div class="bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-4">
                            <h3 class="text-lg font-medium mb-4">Temperature Comparison</h3>
                            <div class="chart-container h-[300px]">
                                <canvas id="comparison-chart"></canvas>
                            </div>
                        </div>
                    </div>

                    <!-- Historical Data -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-4">
                            <h3 class="text-lg font-medium mb-4">Temperature History</h3>
                            <div class="chart-container h-[300px]">
                                <canvas id="temperature-history-chart"></canvas>
                            </div>
                        </div>
                        <div class="bg-gray-100 dark:bg-[#1a1a1a] rounded-lg p-4">
                            <h3 class="text-lg font-medium mb-4">Historical Precipitation</h3>
                            <div class="chart-container h-[300px]">
                                <canvas id="precipitation-history-chart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error generating weather HTML:', error);
            return this.showError('Error displaying weather data');
        }
    }

    getLoadingHTML() {
        return `
            <div class="flex items-center justify-center h-full">
                <div class="text-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <p class="text-gray-500 dark:text-gray-400">Loading weather data...</p>
                </div>
            </div>
        `;
    }

    showError(message) {
        return `
            <div class="flex items-center justify-center h-full">
                <div class="text-center">
                    <div class="text-red-500 mb-4">
                        <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                    <p class="text-gray-500 dark:text-gray-400">${message}</p>
                </div>
            </div>
        `;
    }

    initializeCharts() {
        if (!this.weatherData) return;

        // Destroy existing charts to prevent memory leaks
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};

        const forecast = this.weatherData.forecast;
        const isDarkMode = document.documentElement.classList.contains('dark');
        const textColor = isDarkMode ? '#fff' : '#1f2937';
        const gridColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

        // Common chart options
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                        boxWidth: 12,
                        padding: 8,
                        font: {
                            size: 12
                        }
                    },
                    position: 'top'
                }
            },
            layout: {
                padding: {
                    left: 15,
                    right: 15,
                    top: 20,
                    bottom: 10
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        display: true
                    },
                    ticks: {
                        color: textColor,
                        maxRotation: 0,
                        minRotation: 0,
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: gridColor,
                        display: true
                    },
                    ticks: {
                        color: textColor,
                        font: {
                            size: 11
                        },
                        padding: 8
                    },
                    beginAtZero: true
                }
            }
        };

        // 5-day forecast chart
        const forecastData = forecast.list.filter((item, index) => index % 8 === 0).slice(0, 5);
        this.charts.forecast = new Chart(document.getElementById('forecast-chart'), {
            type: 'line',
            data: {
                labels: forecastData.map(item => new Date(item.dt * 1000).toLocaleDateString('en-US', { weekday: 'short' })),
                datasets: [{
                    label: 'High (°F)',
                    data: forecastData.map(item => Math.round(item.main.temp_max)),
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: false
                },
                {
                    label: 'Low (°F)',
                    data: forecastData.map(item => Math.round(item.main.temp_min)),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: false
                }]
            },
            options: {
                ...commonOptions,
                plugins: {
                    ...commonOptions.plugins,
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });

        // Precipitation chart (next 24 hours)
        const precipData = forecast.list.slice(0, 8);
        this.charts.precipitation = new Chart(document.getElementById('precipitation-chart'), {
            type: 'bar',
            data: {
                labels: precipData.map(item => new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric' })),
                datasets: [{
                    label: 'Precipitation (%)',
                    data: precipData.map(item => Math.round(item.pop * 100)),
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: '#3B82F6',
                    borderWidth: 1
                }]
            },
            options: {
                ...commonOptions,
                scales: {
                    ...commonOptions.scales,
                    y: {
                        ...commonOptions.scales.y,
                        max: 100,
                        ticks: {
                            callback: value => value + '%'
                        }
                    }
                }
            }
        });

        // Temperature comparison (today vs yesterday's forecast)
        const todayData = forecast.list.slice(0, 8);
        this.charts.comparison = new Chart(document.getElementById('comparison-chart'), {
            type: 'line',
            data: {
                labels: todayData.map(item => new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric' })),
                datasets: [{
                    label: 'Temperature (°F)',
                    data: todayData.map(item => Math.round(item.main.temp)),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true
                }]
            },
            options: commonOptions
        });

        // Temperature history (last 24 hours)
        const tempHistoryData = forecast.list.slice(0, 8).reverse();
        this.charts.temperatureHistory = new Chart(document.getElementById('temperature-history-chart'), {
            type: 'line',
            data: {
                labels: tempHistoryData.map(item => new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric' })),
                datasets: [{
                    label: 'Temperature (°F)',
                    data: tempHistoryData.map(item => Math.round(item.main.temp)),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true
                }]
            },
            options: commonOptions
        });

        // Historical precipitation (last 24 hours)
        this.charts.precipitationHistory = new Chart(document.getElementById('precipitation-history-chart'), {
            type: 'bar',
            data: {
                labels: tempHistoryData.map(item => new Date(item.dt * 1000).toLocaleTimeString('en-US', { hour: 'numeric' })),
                datasets: [{
                    label: 'Rain Volume (mm)',
                    data: tempHistoryData.map(item => item.rain ? item.rain['3h'] || 0 : 0),
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: '#3B82F6',
                    borderWidth: 1
                }]
            },
            options: commonOptions
        });
    }

    switchView(view) {
        this.currentView = view;
        document.querySelectorAll('.view-toggle').forEach(button => {
            if (button.dataset.view === view) {
                button.classList.add('bg-blue-600', 'dark:bg-blue-900', 'text-white', 'dark:text-blue-100');
                button.classList.remove('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-200');
            } else {
                button.classList.remove('bg-blue-600', 'dark:bg-blue-900', 'text-white', 'dark:text-blue-100');
                button.classList.add('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-200');
            }
        });
        this.loadView(view);
    }

    startClock() {
        const updateClock = () => {
            const clockElement = document.getElementById('overlay-clock');
            if (clockElement) {
                const now = new Date();
                const timeString = now.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                    timeZone: 'America/Chicago'
                });
                clockElement.textContent = timeString;
            }
        };

        // Update immediately and then every second
        updateClock();
        this.clockInterval = setInterval(updateClock, 1000);
    }

    closeOverlay() {
        // Clear clock interval
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }

        const overlay = document.getElementById('weather-schedule-overlay');
        const content = overlay.querySelector('.absolute');
        
        // Add closing animations
        overlay.classList.remove('animate-overlay-fade');
        overlay.classList.add('animate-overlay-fade-out');
        content.classList.add('animate-overlay-slide-out');
        
        setTimeout(() => {
            this.overlayContainer.innerHTML = '';
        }, 300);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.weatherScheduleOverlay = new WeatherScheduleOverlay();
}); 