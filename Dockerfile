FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy source
COPY . .

# Make start script executable
RUN chmod +x ./start.sh || true

ENV PORT=3001
ENV JWT_SECRET=doechain_jwt_secret_hospital_ses_go_2026
# RPC endpoint (placeholder)
ENV RPC_URL=https://rpc.example.local
# Trusted forwarder address for meta-transactions (placeholder)
ENV TRUSTED_FORWARDER=0x0000000000000000000000000000000000000000
# Default admin credentials (used by create-admin script if no env provided)
ENV ADMIN_EMAIL=admin@doechain.gov.br
ENV ADMIN_PASSWORD=admin123456
EXPOSE 3001

# Start script handles DB init on first run
CMD ["./start.sh"]
