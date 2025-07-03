import { DiscoveryApi, FetchApi, ConfigApi } from '@backstage/core-plugin-api';
import {
  MassFileEditorApi,
  MassFileEditRequest,
  MassFileEditResponse,
} from './MassFileEditorApi';

export class MassFileEditorClient implements MassFileEditorApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;
  private readonly configApi: ConfigApi;
  private githubOwner: string | null = null;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi; configApi: ConfigApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
    this.configApi = options.configApi;
  }

  private log(message: string, data?: any) {
    console.log(`[MassFileEditor] ${message}`, data || '');
  }

  private async getGitHubOwner(baseUrl: string): Promise<string> {
    if (this.githubOwner) {
      return this.githubOwner;
    }

    try {
      const response = await this.fetchApi.fetch(`${baseUrl}/github/api/user`);
      
      if (!response.ok) {
        this.log(`Failed to get GitHub user: ${response.statusText}`);
        // Fallback to configured owner
        return this.getConfiguredOwner();
      }
      
      const userData = await response.json();
      this.githubOwner = userData.login;
      this.log(`GitHub owner detected: ${this.githubOwner}`);
      return this.githubOwner;
    } catch (error) {
      this.log(`Error getting GitHub owner: ${error}`);
      // Fallback to configured owner
      return this.getConfiguredOwner();
    }
  }

  private getConfiguredOwner(): string {
    const defaultOwner = this.configApi.getOptionalString('massFileEditor.defaultOwner');
    if (!defaultOwner) {
      this.log('Warning: No defaultOwner configured in massFileEditor.defaultOwner, using fallback');
      return 'parraletz'; // Ultimate fallback
    }
    this.log(`Using configured default owner: ${defaultOwner}`);
    return defaultOwner;
  }

  private normalizeRepositoryName(repoName: string, owner: string): string {
    // If already in owner/repo format, return as is
    if (repoName.includes('/')) {
      return repoName;
    }
    // Otherwise, prepend the owner
    return `${owner}/${repoName}`;
  }

  async executeFileEdit(
    request: MassFileEditRequest,
  ): Promise<MassFileEditResponse> {
    try {
      const baseUrl = await this.discoveryApi.getBaseUrl('proxy');
      
      // Get GitHub owner first
      const githubOwner = await this.getGitHubOwner(baseUrl);

      let repositories = request.repositories || [];

      // Normalize repository names to include owner
      repositories = repositories.map(repo => this.normalizeRepositoryName(repo, githubOwner));

      // If topics are provided, discover repositories by topics
      if (request.topics && request.topics.length > 0) {
        const discoveredRepos = await this.discoverRepositoriesByTopics(
          request.topics,
          baseUrl,
        );
        repositories = [...repositories, ...discoveredRepos];
      }

      if (repositories.length === 0) {
        return {
          results: [],
          errors: ['No repositories specified or discovered'],
          summary: {
            totalRepositories: 0,
            successfulRepositories: 0,
            failedRepositories: 0,
            totalFilesModified: 0,
            discoveredRepositories: request.topics,
          },
        };
      }

      // Execute file operations on each repository
      const results: any[] = [];
      const errors: string[] = [];
      let totalFilesModified = 0;
      let successfulRepositories = 0;
      let failedRepositories = 0;

      for (const repo of repositories) {
        try {
          const result = await this.processRepository(repo, request, baseUrl);
          results.push(result);
          totalFilesModified += result.filesModified || 0;
          successfulRepositories++;
        } catch (error) {
          const errorMessage = `Failed to process repository ${repo}: ${error}`;
          errors.push(errorMessage);
          failedRepositories++;
        }
      }

      return {
        results,
        errors,
        summary: {
          totalRepositories: repositories.length,
          successfulRepositories,
          failedRepositories,
          totalFilesModified,
          discoveredRepositories: request.topics,
        },
      };
    } catch (error) {
      return {
        results: [],
        errors: [`Failed to execute mass file edit: ${error}`],
        summary: {
          totalRepositories: 0,
          successfulRepositories: 0,
          failedRepositories: 0,
          totalFilesModified: 0,
          discoveredRepositories: request.topics,
        },
      };
    }
  }

  private async discoverRepositoriesByTopics(
    topics: string[],
    baseUrl: string,
  ): Promise<string[]> {
    const repositories: string[] = [];

    for (const topic of topics) {
      try {
        const response = await this.fetchApi.fetch(
          `${baseUrl}/github/api/search/repositories?q=topic:${topic}&sort=updated&order=desc&per_page=50`,
        );

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = await response.json();
        const repoNames = data.items?.map((item: any) => item.full_name) || [];
        repositories.push(...repoNames);
      } catch (error) {
        this.log(`Failed to discover repositories for topic ${topic}:`, error);
      }
    }

    return [...new Set(repositories)]; // Remove duplicates
  }

  private async processRepository(
    repository: string,
    request: MassFileEditRequest,
    baseUrl: string,
  ): Promise<any> {
    if (!request.fileOperations || request.fileOperations.length === 0) {
      return {
        repository,
        message: 'No file operations specified',
        filesModified: 0,
      };
    }

    const results: any[] = [];
    let filesModified = 0;

    // Step 1: Get default branch info
    const defaultBranch = await this.getDefaultBranch(repository, baseUrl);
    this.log('Default branch:', defaultBranch); // Add this line for debugging
    // Add
    if (!defaultBranch) {
      return {
        repository,
        message: 'Failed to get repository information',
        filesModified: 0,
        results: [
          {
            path: 'N/A',
            status: 'error',
            error: 'Could not get default branch',
          },
        ],
      };
    }

    // Step 2: Create a new branch for our changes
    const branchName = request.branchName || `mass-file-edit-${Date.now()}`;
    const branchCreated = await this.createBranch(
      repository,
      defaultBranch,
      branchName,
      baseUrl,
    );
    if (!branchCreated) {
      return {
        repository,
        message: 'Failed to create branch',
        filesModified: 0,
        results: [
          {
            path: 'N/A',
            status: 'error',
            error: `Could not create branch ${branchName}`,
          },
        ],
      };
    }

    this.log(`Created branch: ${branchName}`);

    for (const operation of request.fileOperations) {
      try {
        // Get current file content
        const url = `${baseUrl}/github/api/repos/${repository}/contents/${operation.filePath}`;
        this.log(`Fetching file: ${url}`);

        const fileResponse = await this.fetchApi.fetch(url);

        this.log(
          `Response status: ${fileResponse.status} ${fileResponse.statusText}`,
        );

        if (fileResponse.ok) {
          const fileData = await fileResponse.json();
          this.log('File data received successfully');
          const currentContent = Buffer.from(
            fileData.content,
            'base64',
          ).toString('utf-8');

          // Apply the operation (this is a basic implementation)
          let newContent = currentContent;

          if (
            operation.operation === 'replace' &&
            operation.searchPattern &&
            operation.replaceWith !== undefined
          ) {
            newContent = currentContent.replace(
              new RegExp(operation.searchPattern, 'g'),
              operation.replaceWith,
            );
          } else if (operation.operation === 'append' && operation.content) {
            newContent = currentContent + '\n' + operation.content;
          } else if (operation.operation === 'prepend' && operation.content) {
            newContent = operation.content + '\n' + currentContent;
          }

          // Only update if content changed
          if (newContent !== currentContent) {
            const updateResponse = await this.fetchApi.fetch(
              `${baseUrl}/github/api/repos/${repository}/contents/${operation.filePath}`,
              {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message:
                    request.commitMessage || 'Mass file edit via Backstage',
                  content: Buffer.from(newContent).toString('base64'),
                  sha: fileData.sha,
                  branch: branchName,
                }),
              },
            );

            if (updateResponse.ok) {
              filesModified++;
              results.push({
                path: operation.filePath,
                status: 'updated',
              });
            } else {
              results.push({
                path: operation.filePath,
                status: 'failed',
                error: await updateResponse.text(),
              });
            }
          } else {
            results.push({
              path: operation.filePath,
              status: 'no_changes',
            });
          }
        } else {
          const errorText = await fileResponse.text();
          this.log(`Error response: ${errorText}`);
          results.push({
            path: operation.filePath,
            status: 'not_found',
            error: `HTTP ${fileResponse.status}: ${errorText}`,
          });
        }
      } catch (error) {
        results.push({
          path: operation.filePath,
          status: 'error',
          error: String(error),
        });
      }
    }

    // Step 3: Create Pull Request if changes were made and requested
    let pullRequestUrl = '';
    if (filesModified > 0 && request.createPullRequest) {
      pullRequestUrl = await this.createPullRequest(
        repository,
        defaultBranch.name,
        branchName,
        request,
        baseUrl,
      );
    }

    return {
      repository,
      message: `Processed ${filesModified} files${
        pullRequestUrl ? `, PR created: ${pullRequestUrl}` : ''
      }`,
      filesModified,
      results,
      pullRequestUrl,
      branchName,
    };
  }

  private async getDefaultBranch(
    repository: string,
    baseUrl: string,
  ): Promise<{ name: string; sha: string } | null> {
    try {
      const response = await this.fetchApi.fetch(
        `${baseUrl}/github/api/repos/${repository}`,
      );

      if (!response.ok) {
        this.log(`Failed to get repository info: ${response.statusText}`);
        return null;
      }

      const repoData = await response.json();
      return {
        name: repoData.default_branch,
        sha: repoData.default_branch_sha || 'main', // fallback
      };
    } catch (error) {
      this.log(`Error getting default branch: ${error}`);
      return null;
    }
  }

  private async createBranch(
    repository: string,
    defaultBranch: { name: string; sha: string },
    branchName: string,
    baseUrl: string,
  ): Promise<boolean> {
    try {
      // First get the SHA of the default branch
      const branchResponse = await this.fetchApi.fetch(
        `${baseUrl}/github/api/repos/${repository}/git/refs/heads/${defaultBranch.name}`,
      );

      if (!branchResponse.ok) {
        this.log(`Failed to get branch SHA: ${branchResponse.statusText}`);
        return false;
      }

      const branchData = await branchResponse.json();
      const sha = branchData.object.sha;

      // Create new branch
      const createResponse = await this.fetchApi.fetch(
        `${baseUrl}/github/api/repos/${repository}/git/refs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: sha,
          }),
        },
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        this.log(`Failed to create branch: ${errorText}`);
        return false;
      }

      return true;
    } catch (error) {
      this.log(`Error creating branch: ${error}`);
      return false;
    }
  }

  private async createPullRequest(
    repository: string,
    baseBranch: string,
    headBranch: string,
    request: MassFileEditRequest,
    baseUrl: string,
  ): Promise<string> {
    try {
      const response = await this.fetchApi.fetch(
        `${baseUrl}/github/api/repos/${repository}/pulls`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title:
              request.pullRequestTitle ||
              `Mass file edit: ${request.commitMessage || 'Automated changes'}`,
            head: headBranch,
            base: baseBranch,
            body:
              request.pullRequestBody ||
              `This PR was created automatically by the Mass File Editor plugin.\n\nCommit message: ${request.commitMessage}`,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.log(`Failed to create pull request: ${errorText}`);
        return '';
      }

      const prData = await response.json();
      this.log(`Pull request created: ${prData.html_url}`);
      return prData.html_url;
    } catch (error) {
      this.log(`Error creating pull request: ${error}`);
      return '';
    }
  }
}
