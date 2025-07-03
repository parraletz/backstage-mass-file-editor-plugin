# Mass File Editor Plugin

A Backstage frontend plugin that provides a user interface for mass file editing across multiple repositories.

## Features

- **Dual Repository Selection**: Choose repositories manually or filter by GitHub topics/tags
- **Multiple File Operations**: Support for replace, append, prepend, and delete operations
- **Topics-based Discovery**: Find repositories using GitHub topics like "janitor", "backend", "frontend"
- **Intuitive UI**: Material-UI based interface with tabbed navigation
- **Pull Request Integration**: Automatic branch creation and PR generation
- **Real-time Results**: View operation results and discovered repositories

## Installation

1. Install the plugin:

```bash
yarn workspace app add @internal/plugin-mass-file-editor
```

2. Add the plugin to your frontend app in `packages/app/src/App.tsx`:

```typescript
import { MassFileEditorPage } from '@internal/plugin-mass-file-editor';

// In your app routes
<Route path="/mass-file-editor" element={<MassFileEditorPage />} />
```

3. Add to your sidebar in `packages/app/src/components/Root/Root.tsx`:

```typescript
import EditIcon from '@material-ui/icons/Edit';

// In your sidebar
<SidebarItem icon={EditIcon} to="mass-file-editor" text="Mass File Editor" />
```

## Backend Dependency

This plugin requires the `@internal/plugin-mass-file-editor-backend` backend plugin to be installed and configured. See the backend plugin documentation for setup instructions.

## Configuration

No frontend configuration is required. All configuration is handled by the backend plugin.

## Usage

### Manual Repository Selection

1. Select the "Manual Selection" tab
2. Add repository names one by one
3. Configure your file operations
4. Execute the mass edit

### Topics-based Repository Selection

1. Select the "Filter by Topics" tab
2. Add GitHub topics/tags (e.g., "janitor", "backend", "frontend")
3. The system will automatically discover repositories with matching topics
4. Configure your file operations
5. Execute the mass edit

### File Operations

#### Replace Operation
- **Search Pattern**: Regular expression to find text
- **Replace With**: Text to replace matches with
- **Content**: Alternative to search/replace for full file replacement

#### Append Operation
- **Content**: Text to append to the end of the file

#### Prepend Operation
- **Content**: Text to prepend to the beginning of the file

#### Delete Operation
- Removes the specified file from repositories

## Example Use Cases

### Update Dependencies
- **Topics**: ["backend", "microservice"]
- **Operation**: Replace in `package.json`
- **Pattern**: `"lodash": ".*"`
- **Replace**: `"lodash": "^4.17.21"`

### Add License Headers
- **Topics**: ["janitor"]
- **Operation**: Prepend to `*.ts` files
- **Content**: License header text

### Remove Deprecated Files
- **Repositories**: Manual selection
- **Operation**: Delete
- **File**: `deprecated-config.json`

## API Reference

The plugin communicates with the backend via the `MassFileEditorApi`:

```typescript
interface MassFileEditRequest {
  repositories?: string[];
  topics?: string[];
  fileOperations: FileOperation[];
  commitMessage: string;
  branchName?: string;
  createPullRequest?: boolean;
  pullRequestTitle?: string;
  pullRequestBody?: string;
}
```

## Development

```bash
yarn install
yarn build
yarn start
```

## License

Apache-2.0