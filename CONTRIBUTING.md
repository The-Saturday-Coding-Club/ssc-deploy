# Contributing to SSC Deploy

Thank you for your interest in contributing to SSC Deploy!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/ssc-deploy.git
   ```
3. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Prerequisites

- Node.js 18+
- AWS Account
- Terraform CLI
- GitHub Account

### Local Development

1. Install dependencies:
   ```bash
   cd apps/web-next && npm install
   cd ../api && npm install
   ```

2. Copy environment files:
   ```bash
   cp .env.example .env
   cp apps/web-next/.env.example apps/web-next/.env.local
   ```

3. Fill in your environment variables

4. Run the development server:
   ```bash
   cd apps/web-next && npm run dev
   ```

## Making Changes

1. Make your changes
2. Test your changes locally
3. Commit with a clear message:
   ```bash
   git commit -m "Add: description of your change"
   ```

## Pull Request Process

1. Push your branch:
   ```bash
   git push origin feature/your-feature-name
   ```
2. Open a Pull Request against `main`
3. Describe your changes in the PR description
4. Wait for review

## Code Style

- Use TypeScript for frontend code
- Follow existing code patterns
- Keep commits focused and atomic

## Questions?

Open an issue if you have questions or need help.
