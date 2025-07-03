import { createApiRef } from '@backstage/core-plugin-api';

export interface MassFileEditRequest {
  repositories?: string[];
  topics?: string[];
  fileOperations: {
    filePath: string;
    operation: 'replace' | 'append' | 'prepend' | 'delete';
    content?: string;
    searchPattern?: string;
    replaceWith?: string;
  }[];
  commitMessage: string;
  branchName?: string;
  createPullRequest?: boolean;
  pullRequestTitle?: string;
  pullRequestBody?: string;
}

export interface MassFileEditResponse {
  results: any[];
  errors: any[];
  summary: {
    totalRepositories: number;
    successfulRepositories: number;
    failedRepositories: number;
    totalFilesModified: number;
    discoveredRepositories?: string[];
  };
}

export interface MassFileEditorApi {
  executeFileEdit(request: MassFileEditRequest): Promise<MassFileEditResponse>;
}

export const massFileEditorApiRef = createApiRef<MassFileEditorApi>({
  id: 'plugin.mass-file-editor.service',
});