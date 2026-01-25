FROM --platform=linux/amd64 docker.io/cloudflare/sandbox:0.7.0

# Required during local development to access exposed ports
EXPOSE 8080
EXPOSE 3000
