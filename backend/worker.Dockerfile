# backend/worker.Dockerfile

# Start with the full Rust image.
FROM rust:1.78

# Set ONE work directory for the entire build.
WORKDIR /app

# Install Python, git, UV, and Python requirements in one step
COPY backend/requirements.txt .
RUN apt-get update && apt-get install -y python3 python3-pip git curl && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    /root/.local/bin/uv pip install --system --break-system-packages -r requirements.txt

# Copy ALL source code needed for the build.
COPY backend/ .
COPY engine/ ./engine/

# Compile the Rust engine using an explicit path to its manifest.
# This will create the binary at /app/engine/helix-engine/target/release/helix-engine
RUN cargo build --release --manifest-path /app/engine/helix-engine/Cargo.toml