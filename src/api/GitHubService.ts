import { ConfigApi } from '@backstage/core-plugin-api';

export interface GitHubRepository {
  name: string;
  owner: string;
  defaultBranch: string;
}

export interface GitHubFile {
  path: string;
  content: string;
  sha: string;
  exists: boolean;
}

export interface GitHubPullRequest {
  number: number;
  url: string;
  title: string;
}

export class GitHubService {
  private readonly baseUrl = 'https://api.github.com';
  private readonly token: string;
  private readonly organization: string;

  constructor(config: ConfigApi) {
    // In a real implementation, you'd get this from a secure backend endpoint
    // For now, we'll throw an error to indicate this needs backend support
    this.token = config.getOptionalString('github.token') || '';
    this.organization = config.getOptionalString('github.organization') || 'parraletz';
    
    if (!this.token) {
      throw new Error('GitHub token not configured. This plugin requires backend support for secure token management.');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response;
  }

  async getRepositoriesByTopics(topics: string[]): Promise<GitHubRepository[]> {
    try {
      // Get all repositories for the organization
      const response = await this.makeRequest(`/orgs/${this.organization}/repos?per_page=100`);
      const repos = await response.json();

      const reposWithMatchingTopics: GitHubRepository[] = [];

      // Check topics for each repository
      for (const repo of repos) {
        try {
          const topicsResponse = await this.makeRequest(`/repos/${this.organization}/${repo.name}/topics`);
          const topicsData = await topicsResponse.json();
          
          const hasMatchingTopic = topics.some(topic => 
            topicsData.names.some((repoTopic: string) => 
              repoTopic.toLowerCase() === topic.toLowerCase()
            )
          );

          if (hasMatchingTopic) {
            reposWithMatchingTopics.push({
              name: repo.name,
              owner: repo.owner.login,
              defaultBranch: repo.default_branch,
            });
          }
        } catch (error) {
          console.warn(`Failed to get topics for ${repo.name}:`, error);
        }
      }

      return reposWithMatchingTopics;
    } catch (error) {
      throw new Error(`Failed to discover repositories by topics: ${error}`);
    }
  }

  async getRepositories(names: string[]): Promise<GitHubRepository[]> {
    const repositories: GitHubRepository[] = [];

    for (const name of names) {
      try {
        const response = await this.makeRequest(`/repos/${this.organization}/${name}`);
        const repo = await response.json();
        
        repositories.push({
          name: repo.name,
          owner: repo.owner.login,
          defaultBranch: repo.default_branch,
        });
      } catch (error) {
        console.warn(`Failed to get repository ${name}:`, error);
      }
    }

    return repositories;
  }

  async getFile(repo: GitHubRepository, filePath: string, branch?: string): Promise<GitHubFile> {
    try {
      const ref = branch || repo.defaultBranch;
      const response = await this.makeRequest(`/repos/${repo.owner}/${repo.name}/contents/${filePath}?ref=${ref}`);
      const fileData = await response.json();

      return {
        path: filePath,
        content: atob(fileData.content.replace(/\s/g, '')),
        sha: fileData.sha,
        exists: true,
      };
    } catch (error) {
      return {
        path: filePath,
        content: '',
        sha: '',
        exists: false,
      };
    }
  }

  async createBranch(repo: GitHubRepository, branchName: string): Promise<void> {
    // Get the SHA of the default branch
    const refResponse = await this.makeRequest(`/repos/${repo.owner}/${repo.name}/git/ref/heads/${repo.defaultBranch}`);
    const refData = await refResponse.json();

    try {
      // Create new branch
      await this.makeRequest(`/repos/${repo.owner}/${repo.name}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: refData.object.sha,
        }),
      });
    } catch (error) {
      // Branch might already exist, try to update it
      await this.makeRequest(`/repos/${repo.owner}/${repo.name}/git/refs/heads/${branchName}`, {
        method: 'PATCH',
        body: JSON.stringify({
          sha: refData.object.sha,
        }),
      });
    }
  }

  async updateFile(
    repo: GitHubRepository,
    filePath: string,
    content: string,
    message: string,
    branch: string,
    sha?: string,
  ): Promise<void> {
    const body: any = {
      message,
      content: btoa(content),
      branch,
    };

    if (sha) {
      body.sha = sha;
    }

    await this.makeRequest(`/repos/${repo.owner}/${repo.name}/contents/${filePath}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async deleteFile(
    repo: GitHubRepository,
    filePath: string,
    message: string,
    branch: string,
    sha: string,
  ): Promise<void> {
    await this.makeRequest(`/repos/${repo.owner}/${repo.name}/contents/${filePath}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message,
        sha,
        branch,
      }),
    });
  }

  async createPullRequest(
    repo: GitHubRepository,
    title: string,
    body: string,
    head: string,
    base?: string,
  ): Promise<GitHubPullRequest> {
    const response = await this.makeRequest(`/repos/${repo.owner}/${repo.name}/pulls`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head,
        base: base || repo.defaultBranch,
      }),
    });

    const prData = await response.json();
    
    return {
      number: prData.number,
      url: prData.html_url,
      title: prData.title,
    };
  }
}