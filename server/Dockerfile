# Use Node.js version 20
FROM node:20

# Set working directory inside container
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all your backend code
COPY . .

# Expose the port your backend uses
EXPOSE 80

# Run your backend using tsx
CMD ["npx", "tsx", "index.ts"]