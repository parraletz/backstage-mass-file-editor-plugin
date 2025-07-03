import { useState } from 'react';
import {
  Content,
  Header,
  HeaderLabel,
  Page,
  InfoCard,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { massFileEditorApiRef } from '../../api';
import {
  Grid,
  Button,
  TextField,
  Typography,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Box,
  FormControlLabel,
  Checkbox,
  Tabs,
  Tab,
  Divider,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import EditIcon from '@material-ui/icons/Edit';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  chipContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1),
  },
  operationCard: {
    marginBottom: theme.spacing(2),
  },
}));

interface FileOperation {
  id: string;
  filePath: string;
  operation: 'replace' | 'append' | 'prepend' | 'delete';
  content?: string;
  searchPattern?: string;
  replaceWith?: string;
}

export const MassFileEditorPage = () => {
  const classes = useStyles();
  const massFileEditorApi = useApi(massFileEditorApiRef);
  const [repositories, setRepositories] = useState<string[]>([]);
  const [newRepo, setNewRepo] = useState('');
  const [searchMode, setSearchMode] = useState<'manual' | 'topics'>('manual');
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [fileOperations, setFileOperations] = useState<FileOperation[]>([]);
  const [commitMessage, setCommitMessage] = useState('');
  const [branchName, setBranchName] = useState('');
  const [createPR, setCreatePR] = useState(true);
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const addRepository = () => {
    if (newRepo && !repositories.includes(newRepo)) {
      setRepositories([...repositories, newRepo]);
      setNewRepo('');
    }
  };

  const removeRepository = (repo: string) => {
    setRepositories(repositories.filter(r => r !== repo));
  };

  const addTopic = () => {
    if (newTopic && !topics.includes(newTopic)) {
      setTopics([...topics, newTopic]);
      setNewTopic('');
    }
  };

  const removeTopic = (topic: string) => {
    setTopics(topics.filter(t => t !== topic));
  };

  const addFileOperation = () => {
    const newOperation: FileOperation = {
      id: Date.now().toString(),
      filePath: '',
      operation: 'replace',
    };
    setFileOperations([...fileOperations, newOperation]);
  };

  const updateFileOperation = (id: string, updates: Partial<FileOperation>) => {
    setFileOperations(operations =>
      operations.map(op => (op.id === id ? { ...op, ...updates } : op))
    );
  };

  const removeFileOperation = (id: string) => {
    setFileOperations(operations => operations.filter(op => op.id !== id));
  };

  const handleSubmit = async () => {
    const payload = {
      ...(searchMode === 'manual' 
        ? { repositories } 
        : { topics }
      ),
      fileOperations: fileOperations.map(({ id, ...op }) => op),
      commitMessage,
      branchName,
      createPullRequest: createPR,
      pullRequestTitle: prTitle,
      pullRequestBody: prBody,
    };
    
    setLoading(true);
    try {
      const response = await massFileEditorApi.executeFileEdit(payload);
      setResult(response);
      console.log('Mass file edit completed:', response);
    } catch (error) {
      console.error('Mass file edit failed:', error);
      setResult({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page themeId="tool">
      <Header title="Mass File Editor" subtitle="Edit files across multiple repositories">
        <HeaderLabel label="Owner" value="Platform Team" />
      </Header>
      <Content>
        <Grid container spacing={3}>
          {/* Repository Selection Section */}
          <Grid item xs={12}>
            <InfoCard title="Repository Selection" noPadding>
              <Tabs
                value={searchMode}
                onChange={(_, newValue) => setSearchMode(newValue)}
                indicatorColor="primary"
                textColor="primary"
              >
                <Tab label="Manual Selection" value="manual" />
                <Tab label="Filter by Topics" value="topics" />
              </Tabs>
              <Divider />
              <Box p={2}>
                {searchMode === 'manual' && (
                  <>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Add repository names (owner will be detected automatically)
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={8}>
                        <TextField
                          fullWidth
                          label="Repository name (e.g., devpod-manifests)"
                          value={newRepo}
                          onChange={e => setNewRepo(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && addRepository()}
                          placeholder="devpod-manifests"
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <Button variant="contained" color="primary" onClick={addRepository}>
                          Add Repository
                        </Button>
                      </Grid>
                    </Grid>
                    <div className={classes.chipContainer}>
                      {repositories.map(repo => (
                        <Chip
                          key={repo}
                          label={repo}
                          onDelete={() => removeRepository(repo)}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </div>
                    {repositories.length === 0 && (
                      <Box mt={2}>
                        <Typography variant="body2" color="textSecondary" style={{ fontStyle: 'italic' }}>
                          💡 Just enter the repository name (e.g., "devpod-manifests"). The owner will be automatically detected from your GitHub authentication.
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
                
                {searchMode === 'topics' && (
                  <>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Filter repositories by topics/tags. All repositories with these topics will be included.
                    </Typography>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={8}>
                        <TextField
                          fullWidth
                          label="Topic name (e.g., janitor, backend, frontend)"
                          value={newTopic}
                          onChange={e => setNewTopic(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && addTopic()}
                          placeholder="janitor"
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <Button variant="contained" color="primary" onClick={addTopic}>
                          Add Topic
                        </Button>
                      </Grid>
                    </Grid>
                    <div className={classes.chipContainer}>
                      {topics.map(topic => (
                        <Chip
                          key={topic}
                          label={topic}
                          onDelete={() => removeTopic(topic)}
                          color="secondary"
                          variant="outlined"
                        />
                      ))}
                    </div>
                    {topics.length === 0 && (
                      <Box mt={2}>
                        <Typography variant="body2" color="textSecondary" style={{ fontStyle: 'italic' }}>
                          Add topics to filter repositories. Common topics include: janitor, backend, frontend, microservice, library, etc.
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </InfoCard>
          </Grid>

          {/* File Operations Section */}
          <Grid item xs={12}>
            <InfoCard 
              title="File Operations" 
              action={
                <Button onClick={addFileOperation} color="primary">
                  Add Operation
                </Button>
              }
              noPadding
            >
              <Box p={2}>
                {fileOperations.map(operation => (
                  <Accordion key={operation.id} className={classes.operationCard}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography>
                        {operation.filePath || 'New operation'} - {operation.operation}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <TextField
                            fullWidth
                            label="File path"
                            value={operation.filePath}
                            onChange={e =>
                              updateFileOperation(operation.id, { filePath: e.target.value })
                            }
                          />
                        </Grid>
                        <Grid item xs={3}>
                          <FormControl className={classes.formControl} fullWidth>
                            <InputLabel>Operation</InputLabel>
                            <Select
                              value={operation.operation}
                              onChange={e =>
                                updateFileOperation(operation.id, {
                                  operation: e.target.value as any,
                                })
                              }
                            >
                              <MenuItem value="replace">Replace</MenuItem>
                              <MenuItem value="append">Append</MenuItem>
                              <MenuItem value="prepend">Prepend</MenuItem>
                              <MenuItem value="delete">Delete</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={3}>
                          <Button
                            color="secondary"
                            onClick={() => removeFileOperation(operation.id)}
                          >
                            Remove
                          </Button>
                        </Grid>

                        {operation.operation === 'replace' && (
                          <>
                            <Grid item xs={6}>
                              <TextField
                                fullWidth
                                label="Search pattern (regex)"
                                value={operation.searchPattern || ''}
                                onChange={e =>
                                  updateFileOperation(operation.id, {
                                    searchPattern: e.target.value,
                                  })
                                }
                              />
                            </Grid>
                            <Grid item xs={6}>
                              <TextField
                                fullWidth
                                label="Replace with"
                                value={operation.replaceWith || ''}
                                onChange={e =>
                                  updateFileOperation(operation.id, {
                                    replaceWith: e.target.value,
                                  })
                                }
                              />
                            </Grid>
                          </>
                        )}

                        {(operation.operation === 'append' ||
                          operation.operation === 'prepend' ||
                          (operation.operation === 'replace' && !operation.searchPattern)) && (
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              multiline
                              rows={4}
                              label="Content"
                              value={operation.content || ''}
                              onChange={e =>
                                updateFileOperation(operation.id, { content: e.target.value })
                              }
                            />
                          </Grid>
                        )}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            </InfoCard>
          </Grid>

          {/* Commit and PR Configuration */}
          <Grid item xs={12}>
            <InfoCard title="Commit and Pull Request Configuration" noPadding>
              <Box p={2}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Commit message"
                      value={commitMessage}
                      onChange={e => setCommitMessage(e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Branch name"
                      value={branchName}
                      onChange={e => setBranchName(e.target.value)}
                      placeholder="mass-file-edit"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="PR title"
                      value={prTitle}
                      onChange={e => setPrTitle(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="PR description"
                      value={prBody}
                      onChange={e => setPrBody(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={createPR}
                          onChange={e => setCreatePR(e.target.checked)}
                          color="primary"
                        />
                      }
                      label="Create Pull Request automatically"
                    />
                  </Grid>
                </Grid>
              </Box>
            </InfoCard>
          </Grid>

          {/* Execute Button */}
          <Grid item xs={12}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<EditIcon />}
              onClick={handleSubmit}
              disabled={loading || (searchMode === 'manual' ? repositories.length === 0 : topics.length === 0) || fileOperations.length === 0 || !commitMessage}
            >
              {loading ? 'Executing...' : 'Execute Mass Edit'}
            </Button>
          </Grid>

          {/* Show Result */}
          {result && (
            <Grid item xs={12}>
              <InfoCard title="Execution Results" noPadding>
                <Box p={2}>
                  {/* Summary Section */}
                  {result.summary && (
                    <Box mb={3}>
                      <Typography variant="h6" gutterBottom>
                        Summary
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={3}>
                          <Typography variant="body2" color="textSecondary">
                            Total Repositories: <strong>{result.summary.totalRepositories}</strong>
                          </Typography>
                        </Grid>
                        <Grid item xs={3}>
                          <Typography variant="body2" color="textSecondary">
                            Files Modified: <strong>{result.summary.totalFilesModified}</strong>
                          </Typography>
                        </Grid>
                        <Grid item xs={3}>
                          <Typography variant="body2" color="textSecondary">
                            Successful: <strong>{result.summary.successfulRepositories}</strong>
                          </Typography>
                        </Grid>
                        <Grid item xs={3}>
                          <Typography variant="body2" color="textSecondary">
                            Failed: <strong>{result.summary.failedRepositories}</strong>
                          </Typography>
                        </Grid>
                      </Grid>
                    </Box>
                  )}

                  {/* Pull Requests Created */}
                  {result.results && result.results.some((r: any) => r.pullRequestUrl) && (
                    <Box mb={3}>
                      <Typography variant="h6" gutterBottom>
                        Pull Requests Created
                      </Typography>
                      {result.results.map((repoResult: any, index: number) => 
                        repoResult.pullRequestUrl && (
                          <Box key={index} mb={1}>
                            <Typography variant="body1">
                              <strong>{repoResult.repository}:</strong>{' '}
                              <a
                                href={repoResult.pullRequestUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#1976d2', textDecoration: 'none' }}
                              >
                                {repoResult.pullRequestUrl}
                              </a>
                            </Typography>
                          </Box>
                        )
                      )}
                    </Box>
                  )}

                  {/* Repository Results */}
                  {result.results && result.results.length > 0 && (
                    <Box mb={3}>
                      <Typography variant="h6" gutterBottom>
                        Repository Details
                      </Typography>
                      {result.results.map((repoResult: any, index: number) => (
                        <Accordion key={index}>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography>
                              <strong>{repoResult.repository}</strong> - {repoResult.message}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box>
                              {repoResult.branchName && (
                                <Typography variant="body2" gutterBottom>
                                  <strong>Branch:</strong> {repoResult.branchName}
                                </Typography>
                              )}
                              {repoResult.pullRequestUrl && (
                                <Typography variant="body2" gutterBottom>
                                  <strong>Pull Request:</strong>{' '}
                                  <a
                                    href={repoResult.pullRequestUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: '#1976d2' }}
                                  >
                                    View PR
                                  </a>
                                </Typography>
                              )}
                              {repoResult.results && repoResult.results.length > 0 && (
                                <>
                                  <Typography variant="body2" gutterBottom>
                                    <strong>File Operations:</strong>
                                  </Typography>
                                  {repoResult.results.map((fileResult: any, fileIndex: number) => (
                                    <Typography key={fileIndex} variant="body2" style={{ marginLeft: 16 }}>
                                      • {fileResult.path}: {fileResult.status}
                                      {fileResult.error && (
                                        <span style={{ color: 'red' }}> - {fileResult.error}</span>
                                      )}
                                    </Typography>
                                  ))}
                                </>
                              )}
                            </Box>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </Box>
                  )}

                  {/* Errors */}
                  {result.errors && result.errors.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="h6" gutterBottom style={{ color: 'red' }}>
                        Errors
                      </Typography>
                      {result.errors.map((error: string, index: number) => (
                        <Typography key={index} variant="body2" style={{ color: 'red' }}>
                          • {error}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  {/* Raw Data (collapsed by default) */}
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" color="textSecondary">
                        View Raw Response Data
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              </InfoCard>
            </Grid>
          )}
        </Grid>
      </Content>
    </Page>
  );
};