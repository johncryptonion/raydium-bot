# Stage 1: Build Stage
FROM node:20 AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and yarn.lock
COPY package.json yarn.lock ./

# Install dependencies using Yarn
RUN yarn install

# Copy the application source code
COPY . .

# Build the NestJS application
RUN yarn build

# Remove development dependencies
RUN yarn install --production --ignore-scripts --prefer-offline

# Stage 2: Runtime Stage
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 8080

# Command to run the application
CMD ["node", "dist/main"]