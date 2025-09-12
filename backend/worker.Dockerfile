# backend/worker.Dockerfile

# Start with the full Rust image, which is a good base as it has build tools.
FROM rust:1.78

# --- FIX 1: Add the Python bin directory to the system PATH ---
# This ensures that executables installed by pip/uv (like 'celery') are found.
ENV PATH="/root/.local/bin:${PATH}"

# Set ONE work directory for the entire build.
WORKDIR /app

# Install Python, git, UV, and Python requirements in one step
# We need to copy the requirements file relative to the build context, which is '.'
COPY backend/requirements.txt .
RUN apt-get update && apt-get install -y python3 python3-pip git curl netcat-openbsd && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    uv pip install --system --break-system-packages -r requirements.txt && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy ALL source code needed for the build.
COPY backend/ .
COPY engine/ ./engine/
# --- FIX 2: Also copy the scripts directory ---
COPY scripts/ ./scripts/

# Compile the Rust engine using an explicit path to its manifest.
RUN cargo build --release --manifest-path /app/engine/helix-engine/Cargo.toml

# --- FIX 3: Make the compiled binary available in the PATH ---
# This copies the final executable to a standard location.
RUN cp /app/engine/helix-engine/target/release/helix-engine /usr/local/bin/

# The CMD will be provided by docker-compose.yml