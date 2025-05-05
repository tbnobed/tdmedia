#!/bin/sh
set -e

# Enable more verbose debugging
set -x

echo "Waiting for PostgreSQL to become available..."

# Wait for PostgreSQL to be available
RETRIES=30
until pg_isready -h postgres -U ${POSTGRES_USER:-trilogy_user} -d ${POSTGRES_DB:-trilogy_db} || [ $RETRIES -eq 0 ]; do
  echo "Waiting for PostgreSQL ($RETRIES retries left)..."
  RETRIES=$((RETRIES-1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "Error: PostgreSQL not available"
  exit 1
fi

echo "PostgreSQL is ready!"

# Initialize the database schema
echo "Initializing database schema..."
npm run db:push

echo "Database schema initialized successfully!"

# Setup default users
echo "Setting up default users..."
chmod +x docker-setup-users.cjs
node docker-setup-users.cjs

# Examine the build directory
echo "Examining the build directory structure..."
find dist/ -type f | sort

# Generate dynamic config.js
echo "Generating dynamic config.js..."
cat > dist/public/config.js << EOF
// Docker-generated configuration for Trilogy Digital Media
window.TRILOGY_CONFIG = {
  // API URL from environment - empty string because we're serving from the same origin
  apiBaseUrl: '',
  
  // Other configuration options
  version: '1.0.0',
  features: {
    analytics: false,
    darkMode: false
  }
};
EOF

# Check and list all the assets in the dist directory
echo "Checking all assets in dist directory..."
echo "Content of dist directory:"
find dist -type f | grep -v "node_modules" | sort

# Create a minimal fallback index.html for debugging purposes
cat > dist/public/index.html << EOF
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>Trilogy Digital Media</title>
    <script src="/config.js"></script>
    <!-- We'll dynamically load the CSS file based on what we find -->
    <script>
      // Dynamically load CSS file
      function loadCss() {
        // Look for CSS files in assets directory
        fetch('/assets/')
          .then(response => {
            if (!response.ok) throw new Error('Failed to load assets directory');
            return response.text();
          })
          .then(html => {
            // Simple regex to find CSS files
            const cssFiles = html.match(/href="([^"]+\.css)"/g) || [];
            if (cssFiles.length > 0) {
              // Extract the first CSS filename
              const cssFile = cssFiles[0].match(/href="([^"]+)"/)[1];
              console.log('Found CSS file:', cssFile);
              
              // Create and append the CSS link
              const link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = cssFile;
              document.head.appendChild(link);
            } else {
              console.warn('No CSS files found in assets directory');
            }
          })
          .catch(err => {
            console.error('Error loading CSS:', err);
          });
      }
      
      // Try to load CSS when the page loads
      document.addEventListener('DOMContentLoaded', loadCss);
    </script>
    <style>
      body { 
        font-family: Arial, sans-serif;
        background-color: #f0f0f0;
        color: #333;
        margin: 0;
        padding: 0;
      }
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        text-align: center;
      }
      .spinner {
        border: 4px solid rgba(0, 0, 0, 0.1);
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border-left-color: #09f;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="loading-container">
        <div class="spinner"></div>
        <h1>Trilogy Digital Media</h1>
        <p>Loading application...</p>
        <script>
          // Capture runtime errors
          window.onerror = function(message, source, lineno, colno, error) {
            console.error('Runtime error:', message, 'at', source, lineno, colno);
            document.querySelector('.loading-container p').innerHTML = 
              'Error: ' + message + '<br><small>Please check console for details</small>';
            return false;
          };
          
          // Simple check to see if the app is loading
          document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM fully loaded');
            
            // Check if config is properly loaded
            if (!window.TRILOGY_CONFIG) {
              console.error('TRILOGY_CONFIG not found!');
              document.querySelector('.loading-container p').textContent = 
                'Configuration error. Please check console for details.';
              return;
            }
            
            // Debug info
            console.log('Attempting to load application in Docker environment');
            
            // Function to find and load the main JS file
            function loadMainScript() {
              // Try to find the main JS file in the assets directory
              fetch('/assets/')
                .then(response => {
                  if (!response.ok) throw new Error('Failed to load assets directory');
                  return response.text();
                })
                .then(html => {
                  // Look for JS files in the assets directory
                  const jsFiles = html.match(/href="([^"]+\.js)"/g) || [];
                  if (jsFiles.length > 0) {
                    // Extract the first JS filename
                    const jsFile = jsFiles[0].match(/href="([^"]+)"/)[1];
                    console.log('Found JS file:', jsFile);
                    
                    // Create and append the script
                    const script = document.createElement('script');
                    script.src = jsFile;
                    script.type = 'module';
                    script.onerror = function(e) {
                      console.error('Failed to load main script:', e);
                      document.querySelector('.loading-container p').textContent = 
                        'Error loading application. Please check console for details.';
                    };
                    script.onload = function() {
                      console.log('Main script loaded successfully');
                    };
                    document.body.appendChild(script);
                  } else {
                    console.error('No JS files found in assets directory');
                    document.querySelector('.loading-container p').textContent = 
                      'Error: No JavaScript files found in assets directory.';
                  }
                })
                .catch(err => {
                  console.error('Error loading JS:', err);
                  document.querySelector('.loading-container p').textContent = 
                    'Error loading assets: ' + err.message;
                });
            }
            
            // Try to load the main script
            try {
              loadMainScript();
            } catch (e) {
              console.error('Error while setting up script loader:', e);
              document.querySelector('.loading-container p').textContent = 
                'Error initializing application. Please check console for details.';
            }
          });
        </script>
      </div>
    </div>
  </body>
</html>
EOF

# Verify the config.js file was created
echo "Verifying config.js was created:"
ls -la dist/public/
cat dist/public/config.js

# Start the application
echo "Starting the application..."
exec "$@"