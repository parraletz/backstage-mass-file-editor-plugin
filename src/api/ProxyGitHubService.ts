import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { GitHubRepository } from './GitHubService';
/** * ProxyGitHubService - A secure implementation that calls GitHub API through a backend proxy * This avoids exposing GitHub tokens in the frontend */
export class ProxyGitHubService {
  constructor(
    private readonly discoveryApi: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}
  async getRepositoriesByTopics(topics: string[]): Promise<GitHubRepository[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('proxy');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/github/api/repos/discover-by-topics`,
      {
        method: 'POST',
        body: JSON.stringify({ topics }),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to discover repositories: ${response.statusText}`,
      );
    }
    return await response.json();
  }
  async getRepositories(names: string[]): Promise<GitHubRepository[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('proxy');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/github/api/repos/batch`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to get repositories: ${response.statusText}`);
    }
    return await response.json();
  }
  async executeFileOperations(
    repositories: GitHubRepository[],
    operations: any[],
    options: {
      commitMessage: string;
      branchName: string;
      createPullRequest?: boolean;
      pullRequestTitle?: string;
      pullRequestBody?: string;
    },
  ): Promise<any> {
    const baseUrl = await this.discoveryApi.getBaseUrl('proxy');
    const response = await this.fetchApi.fetch(
      `${baseUrl}/github/api/mass-file-edit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repositories, operations, ...options }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to execute file operations: ${response.statusText}`,
      );
    }
    return await response.json();
  }
}
