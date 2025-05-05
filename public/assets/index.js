// Fallback JavaScript file for Docker deployment
console.log('Loading fallback JavaScript file');

// Create a simple React-like structure in pure JS
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (!root) return;

  // Clear loading container
  root.innerHTML = '';

  // Create app container
  const app = document.createElement('div');
  app.className = 'app-container';
  
  // Add header
  const header = document.createElement('header');
  header.className = 'app-header';
  
  // Add logo
  const logo = document.createElement('div');
  logo.className = 'logo';
  logo.innerHTML = `
    <h1>Trilogy Digital Media</h1>
    <p>Content Management System</p>
  `;
  
  // Add content
  const content = document.createElement('main');
  content.className = 'app-content';
  content.innerHTML = `
    <div class="card">
      <h2>Welcome to Trilogy Digital Media</h2>
      <p>This is a fallback interface while the main application assets are loading.</p>
      <p>You can access the following resources:</p>
      <ul>
        <li><a href="/api/debug/info">API Debug Info</a></li>
        <li><a href="/test-page">Application Test Page</a></li>
        <li><a href="/auth">Login Page</a></li>
      </ul>
    </div>
  `;
  
  // Add footer
  const footer = document.createElement('footer');
  footer.className = 'app-footer';
  footer.innerHTML = `
    <p>&copy; ${new Date().getFullYear()} Trilogy Digital Media. All rights reserved.</p>
  `;
  
  // Assemble elements
  header.appendChild(logo);
  app.appendChild(header);
  app.appendChild(content);
  app.appendChild(footer);
  root.appendChild(app);
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .app-container {
      font-family: Arial, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .app-header {
      background: linear-gradient(to right, #2c3e50, #4ca1af);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
    }
    
    .app-content {
      margin-bottom: 20px;
    }
    
    .app-footer {
      text-align: center;
      color: #666;
      padding: 10px;
      border-top: 1px solid #ddd;
    }
    
    .card {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .logo h1 {
      margin: 0;
      font-size: 32px;
    }
    
    .logo p {
      margin: 5px 0 0;
      opacity: 0.8;
    }
    
    a {
      color: #3498db;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
  `;
  document.head.appendChild(style);
});