FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Rename the base image's "node" user (UID 1000) to "agent".
# This keeps UID 1000 so that --userns=keep-id (Podman) and
# --user 1000:1000 (Docker) map to the correct home directory owner.
RUN usermod -d /home/agent -m -l agent node

# The Sandcastle Docker provider runs containers as the host UID/GID while
# forcing HOME=/home/agent. Make that home writable for the runtime UID so
# git config --global and agent CLIs can create their state files there.
RUN mkdir -p /home/agent/.codex \
  && chmod -R a+rwX /home/agent

# Install the CLIs used by Sandcastle hooks and agents.
# Install pnpm as a real global binary so runtime hooks do not trigger a
# non-interactive Corepack download under /home/agent.
RUN npm install -g pnpm@10.33.0 @openai/codex

# Add Codex to PATH
ENV PATH="/home/agent/.local/bin:$PATH"

USER agent

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
