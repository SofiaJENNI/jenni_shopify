# Use Node.js 18 LTS (Alpine for smaller image size)
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production=false

# Copy application source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S jenni -u 1001 -G nodejs

# Change ownership of app directory to jenni user
RUN chown -R jenni:nodejs /app

# Switch to non-root user
USER jenni

# Expose port 4000
EXPOSE 4000

# Set environment variables
ENV NODE_ENV=development
ENV PORT=4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/_health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Default command - run development server
CMD ["npm", "run", "dev"]
