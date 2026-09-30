import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from '../auth/clerk';
import { createAuthRequest } from '../utils/api';

export default function Matches() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadMatches();
  }, [id]);

  async function loadMatches() {
    try {
      const api = createAuthRequest(getToken);
      const data = await api(`/api/items/${id}/matches`);
      setMatches(data.matches);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SignedOut>
        <div className="text-center py-12">
          <p className="text-lg mb-4">Please sign in to view matches</p>
        </div>
      </SignedOut>

      <SignedIn>
        <Link
          to={`/items/${id}`}
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Back to Item
        </Link>

        <h1 className="text-3xl font-bold mb-6">Potential Matches</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : matches.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No matches found yet
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className="bg-white p-4 rounded-lg shadow hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{match.title}</h3>
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                        {match.score}% match
                      </span>
                    </div>

                    <p className="text-gray-600 mb-2">{match.description}</p>

                    <div className="text-sm text-gray-500 mb-2">
                      📍 {match.location_name} •{' '}
                      {new Date(match.happened_at).toLocaleDateString()}
                    </div>

                    {match.reason && (
                      <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                        <span className="font-medium">Why it matches:</span>{' '}
                        {match.reason}
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/items/${match.item_id}`}
                    className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SignedIn>
    </div>
  );
}
