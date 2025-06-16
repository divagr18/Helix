// frontend/src/pages/RepoDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Define the types to match our new API response
interface CodeFunction {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
}

interface CodeFile {
  id: number;
  file_path: string;
  functions: CodeFunction[];
}

interface Repository {
  id: number;
  full_name: string;
  status: string;
  files: CodeFile[];
}

export function RepoDetailPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (repoId) {
      axios.get(`http://localhost:8000/api/v1/repositories/${repoId}/`)
        .then(response => {
          setRepo(response.data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching repository details:", err);
          setError('Failed to load repository details.');
          setLoading(false);
        });
    }
  }, [repoId]);

  if (loading) return <p>Loading repository...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!repo) return <p>Repository not found.</p>;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* File Tree Panel */}
      <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px', overflowY: 'auto' }}>
        <h2>{repo.full_name}</h2>
        <h4>Files with Functions</h4>
        <ul>
          {repo.files.map(file => (
            <li key={file.id}>{file.file_path}</li>
          ))}
        </ul>
      </div>

      {/* Code View Panel */}
      <div style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
        <h3>Code & Analysis</h3>
        <p>Select a file to view its contents and analysis.</p>
        {/* We will add logic to show file content here later */}
      </div>

      {/* Analysis Panel */}
      <div style={{ width: '300px', borderLeft: '1px solid #ccc', padding: '10px', overflowY: 'auto' }}>
        <h3>Analysis</h3>
        {/* We will show function details here later */}
      </div>
    </div>
  );
}