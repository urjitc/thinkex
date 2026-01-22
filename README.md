<p align="center">
  <a href="https://thinkex.app">
    <img alt="ThinkEx" src="public/newreadmeimage.svg" width="500" />
  </a>
</p>

<p align="center">
  <a href="https://thinkex.app">Try ThinkEx</a> · <a href="#features">Features</a> · <a href="#self-hosting">Self-Host</a> · <a href="#contributing">Contribute</a>
</p>

## The Problem

AI needs context to think well, and humans need space to think well. Current tools split these functions: reasoning happens in chat logs, while information lives in scattered documents.

As a result, valuable reasoning gets buried in chat history. You find yourself explaining the same context repeatedly, and insights disappear into logs you never revisit.

ThinkEx solves this by making context explicit, structured, and persistent.

## What is ThinkEx?

Think of a large desk where you spread out textbooks, notes, and papers to study. You look back and forth, connecting dots and comparing sources.

ThinkEx is that desk, digitalized for the browser.

1.  **See Everything**: Bring PDFs, videos, and notes onto a visual canvas. Organize them spatially to make sense of the information.
2.  **Compare Sources**: Look across your sources side-by-side. Spot patterns and contradictions that only emerge when everything is visible.
3.  **Targeted Reasoning**: Select specific items on your desk for the AI to analyze. Point to a note and a paragraph and ask for the connection.
4.  **Capture Insights**: Extract findings into structured cards that become part of your permanent workspace.

## Features

*   **User-Controlled Context**: Manually select exact cards, notes, or document sections for the AI. No opaque retrieval mechanisms.
*   **Spatial Canvas**: Arrange notes, PDFs, videos, and chat side-by-side.
*   **First-Class Media**: Native PDF viewing with highlights; YouTube videos with transcript-backed context.
*   **Persistent Knowledge**: Saved cards (notes, flashcards, references) remain in your workspace.
*   **Multi-Model**: Switch AI models per task without locking into a single provider.
*   **Sharing**: Share or export workspaces with all context preserved.

## Why Existing Tools Fall Short

| Approach          | What It Does             | What It Loses                                     |
| :---------------- | :----------------------- | :------------------------------------------------ |
| **ThinkEx**       | **Integrated Reasoning** | --                                                |
| Chat-first tools  | Powerful reasoning       | Memory (context vanishes in logs)                 |
| Notes-first tools | Organization             | Reasoning (AI is not deeply integrated)           |
| RAG systems       | Auto-retrieval           | Control (you can't see/adjust selection)          |
| Long-context      | More tokens              | Understanding (coherence doesn't scale with size) |

## Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/)
*   **Database**: [PostgreSQL](https://github.com/postgres/postgres) with [Drizzle ORM](https://orm.drizzle.team/)
*   **State**: [TanStack Query](https://tanstack.com/query/latest), [Zustand](https://github.com/pmndrs/zustand)
*   **Auth**: [Better Auth](https://www.better-auth.com/)

## Self-Hosting

ThinkEx can be self-hosted using Docker. This is the easiest way to get started.

Docker Compose sets up the application and PostgreSQL database automatically.

#### Prerequisites

*   [Docker](https://docs.docker.com/get-docker/) (v20.10+)
*   [Docker Compose](https://docs.docker.com/compose/install/) (v2.0+)

#### Quick Start

**Option 1: Automated Setup (Recommended)**

Run the setup script to automatically configure and start everything:

```bash
git clone https://github.com/ThinkEx-OSS/thinkex.git
cd thinkex
./docker-setup.sh
```

The script will:
- Check for Docker and Docker Compose
- Create `.env` file from template
- Generate `BETTER_AUTH_SECRET` automatically
- Build and start Docker containers
- Initialize the database schema

You'll still need to edit `.env` to add your API keys (Google OAuth, Google AI, Supabase if needed).

**Option 2: Manual Setup**

1.  **Clone the repository**
    ```bash
    git clone https://github.com/ThinkEx-OSS/thinkex.git
    cd thinkex
    ```

2.  **Configure environment variables**
    ```bash
    cp docker-compose.env.example .env
    ```
    
    Edit `.env` and configure:
    
    *   **Database**: PostgreSQL credentials (defaults work for local development)
    *   **Better Auth**: Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`
    *   **Google OAuth**: Get credentials from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
    *   **Supabase**: Your Supabase project URL and keys (for file storage, if using Supabase storage)
    *   **Google AI**: API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

3.  **Start the services**
    ```bash
    docker-compose up -d
    ```
    This starts the app in development mode with hot reloading. Changes to your code will automatically reload in the browser. The source code is mounted as a volume, so edits on your host machine are immediately reflected in the container.

4.  **Initialize the database**
    ```bash
    docker-compose exec app pnpm db:push
    ```

5.  **Access the application**
    Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Storage Configuration

ThinkEx supports two storage backends for file uploads:

**Option 1: Local File Storage** (Recommended for Self-Hosting)
- Set `STORAGE_TYPE=local` in your `.env` file
- Files are stored in the `./uploads` directory (persisted as a Docker volume)
- No external dependencies required
- Simple setup with full control over your data

**Option 2: Supabase Storage** (Cloud-based)
- Set `STORAGE_TYPE=supabase` in your `.env` file
- Configure Supabase credentials:
  - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY`: Anon key from Supabase
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role key from Supabase
- Create a storage bucket named `file-upload` and set it to **Public**

#### Docker Commands

*   **View logs**: `docker-compose logs -f app`
*   **Stop services**: `docker-compose down`
*   **Stop and remove volumes**: `docker-compose down -v` (⚠️ deletes database)
*   **Rebuild after changes**: `docker-compose up -d --build`




## Contributing

We welcome contributions.

1.  Fork the repository.
2.  Create a feature branch: `git checkout -b feature/new-feature`
3.  Commit changes: `git commit -m 'Add new feature'`
4.  Push to branch: `git push origin feature/new-feature`
5.  Open a Pull Request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the [AGPL-3.0 License](LICENSE).
