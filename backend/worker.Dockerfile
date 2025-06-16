# backend/worker.Dockerfile

# Start with the full Rust image.
FROM rust:1.78

# Set ONE work directory for the entire build.
WORKDIR /app

# Install Python and pip.
RUN apt-get update && apt-get install -y python3 python3-pip git

# Copy Python requirements and install them.
COPY backend/requirements.txt .
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy ALL source code needed for the build.
COPY backend/ .
COPY engine/ ./engine/

# Compile the Rust engine using an explicit path to its manifest.
# This will create the binary at /app/engine/helix-engine/target/release/helix-engine
RUN cargo build --release --manifest-path /app/engine/helix-engine/Cargo.toml