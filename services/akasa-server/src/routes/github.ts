import { Router, type Request, type Response, type NextFunction } from 'express';
import { db, toolConnections } from '@claw/db';
import { eq, and } from 'drizzle-orm';
import { getValidToken } from '../services/token-manager.js';
import { refreshGitHubToken } from '../services/token-manager.js';

const GITHUB_API_BASE = 'https://api.github.com';

function buildGitHubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export function githubRouter(): Router {
  const router = Router();

  async function getGithubToken(userId: string): Promise<string> {
    const rows = await db
      .select()
      .from(toolConnections)
      .where(and(
        eq(toolConnections.userId, userId),
        eq(toolConnections.toolId, 'github'),
      ))
      .limit(1);

    const connection = rows[0];
    if (!connection) {
      throw new Error(`GitHub connection not found for user ${userId}`);
    }

    return getValidToken(connection.id, refreshGitHubToken());
  }

  router.get('/github/repos', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.query['userId'] as string | undefined;
      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const token = await getGithubToken(userId);

      const response = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100`, {
        headers: buildGitHubHeaders(token),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} — ${errorBody}`);
      }

      const repos = await response.json() as Array<{
        id: number;
        name: string;
        full_name: string;
        owner: { login: string };
        private: boolean;
        html_url: string;
        clone_url: string;
        default_branch: string;
        description: string | null;
        updated_at: string;
      }>;

      res.json(repos.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        isPrivate: repo.private,
        htmlUrl: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
        description: repo.description,
        updatedAt: repo.updated_at,
      })));
    } catch (err) {
      next(err);
    }
  });

  router.get('/github/repos/:owner/:repo/branches', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { owner, repo } = req.params;
      const userId = req.query['userId'] as string | undefined;
      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const token = await getGithubToken(userId);

      const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches`, {
        headers: buildGitHubHeaders(token),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} — ${errorBody}`);
      }

      const branches = await response.json() as Array<{
        name: string;
        commit: { sha: string };
        protected: boolean;
      }>;

      res.json(branches.map(branch => ({
        name: branch.name,
        sha: branch.commit.sha,
        isProtected: branch.protected,
      })));
    } catch (err) {
      next(err);
    }
  });

  router.get('/github/repos/:owner/:repo', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { owner, repo } = req.params;
      const userId = req.query['userId'] as string | undefined;
      if (!userId) {
        res.status(400).json({ error: 'userId query parameter is required' });
        return;
      }

      const token = await getGithubToken(userId);

      const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
        headers: buildGitHubHeaders(token),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} — ${errorBody}`);
      }

      const repoData = await response.json() as {
        id: number;
        name: string;
        full_name: string;
        owner: { login: string };
        private: boolean;
        html_url: string;
        clone_url: string;
        default_branch: string;
        description: string | null;
        updated_at: string;
        visibility: string;
      };

      res.json({
        id: repoData.id,
        name: repoData.name,
        fullName: repoData.full_name,
        owner: repoData.owner.login,
        isPrivate: repoData.private,
        htmlUrl: repoData.html_url,
        cloneUrl: repoData.clone_url,
        defaultBranch: repoData.default_branch,
        description: repoData.description,
        updatedAt: repoData.updated_at,
        visibility: repoData.visibility,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
