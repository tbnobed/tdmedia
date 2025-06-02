#!/bin/bash

# Create nginx cache directories
sudo mkdir -p /var/cache/nginx
sudo mkdir -p /var/cache/nginx/client_temp
sudo mkdir -p /var/cache/nginx/proxy_temp
sudo mkdir -p /var/cache/nginx/fastcgi_temp
sudo mkdir -p /var/cache/nginx/uwsgi_temp
sudo mkdir -p /var/cache/nginx/scgi_temp

# Set proper ownership and permissions
sudo chown -R www-data:www-data /var/cache/nginx
sudo chmod -R 755 /var/cache/nginx

echo "Nginx cache directories created successfully"