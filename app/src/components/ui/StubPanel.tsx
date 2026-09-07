import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function StubPanel({ title }: { title: string }) {
  useDocumentTitle(title);
  return (
    <div className="stub-panel">
      <h1>{title}</h1>
      <p>
        <Link to="/">Back to Home</Link>
      </p>
    </div>
  );
}
