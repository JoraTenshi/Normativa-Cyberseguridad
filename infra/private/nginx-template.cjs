'use strict';
const {validate,IP}=require('./profile.cjs');
function nginx(input){const p=validate(input);return `user nginx;
worker_processes auto;
pid /var/run/nginx.pid;
error_log /dev/stderr warn;
events { worker_connections 512; }
http {
 include /etc/nginx/mime.types;
 default_type application/octet-stream;
 server_tokens off;
 log_format private '$remote_addr [$time_local] "$request_method $uri" $status $body_bytes_sent';
 access_log /dev/stdout private;
 sendfile on;
 resolver 127.0.0.11 valid=10s ipv6=off;
 map $ssl_server_name $allowed_sni { default 0; "" 1; "${IP}" 1; }
 upstream api { zone private_api 64k; server backend:5000 resolve; }
 server { listen 127.0.0.1:8080; access_log off; location = /health { return 200 'ok'; } location / { return 404; } }
 server {
  listen 8443 ssl;
  server_name ${IP};
  if ($http_host != "${p.authority}") { return 421; }
  if ($allowed_sni = 0) { return 421; }
  ssl_certificate /run/secrets/tls_certificate;
  ssl_certificate_key /run/secrets/tls_key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_session_tickets off;
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy no-referrer always;
  add_header Cache-Control no-store always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
  client_max_body_size 6m;
  location /api/ {
   proxy_pass http://api/;
   proxy_http_version 1.1;
   proxy_set_header Host $http_host;
   proxy_set_header X-Real-IP $remote_addr;
   proxy_set_header X-Forwarded-For $remote_addr;
   proxy_set_header X-Forwarded-Proto https;
   proxy_set_header Connection "";
   proxy_hide_header Content-Security-Policy;
   proxy_hide_header X-Frame-Options;
   proxy_hide_header X-Content-Type-Options;
   proxy_hide_header Referrer-Policy;
   proxy_hide_header Cache-Control;
   proxy_read_timeout 60s;
   proxy_next_upstream off;
  }
  location = /api { return 404; }
  root /usr/share/nginx/html;
  location ~ /\\. { deny all; }
  location ~* \\.map$ { return 404; }
  location /static/ { try_files $uri =404; }
  location / { try_files $uri /index.html; }
 }
}
`;}
module.exports={nginx};
