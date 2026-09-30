import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from '../auth/clerk';
import { createAuthRequest } from '../utils/api';

export default function Profile() {
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const api = createAuthRequest(getToken);
      const result = await api('/api/me');
      setData(result);
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SignedOut>
        <div className="text-center py-12">
          <p className="text-lg mb-4">Please sign in to view your profile</p>
        </div>
      </SignedOut>

      <SignedIn>
        <h1 className="text-3xl font-bold mb-6">My Profile</h1>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : data ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Account Info</h2>
              <div className="space-y-2">
                <div>
                  <span className="text-gray-600">Name:</span>{' '}
                  <span className="font-medium">{data.user.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>{' '}
                  <span className="font-medium">{data.user.email}</span>
                </div>
                <div>
                  <span className="text-gray-600">Karma:</span>{' '}
                  <span className="font-bold text-blue-600">{data.user.karma}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                My Posts ({data.posts.length})
              </h2>
              {data.posts.length === 0 ? (
                <p className="text-gray-500">No posts yet</p>
              ) : (
                <div className="space-y-3">
                  {data.posts.map((post) => (
                    <div
                      key={post.id}
                      className="border-l-4 border-blue-500 pl-4 py-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded ${
                            post.type === 'lost'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {post.type}
                        </span>
                        <span className="font-medium">{post.title}</span>
                        <span className="text-xs text-gray-500">
                          ({post.status})
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {post.location_name} •{' '}
                        {new Date(post.created_at).toLocaleDateString()}
                      </div>
                      <Link
                        to={`/items/${post.id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                My Claims ({data.claims.length})
              </h2>
              {data.claims.length === 0 ? (
                <p className="text-gray-500">No claims yet</p>
              ) : (
                <div className="space-y-3">
                  {data.claims.map((claim) => (
                    <div
                      key={claim.id}
                      className="border-l-4 border-green-500 pl-4 py-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{claim.title}</span>
                        {claim.passed ? (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded">
                            PASSED
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">
                            Failed ({claim.score}/100)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        Attempts: {claim.attempts} •{' '}
                        {new Date(claim.created_at).toLocaleDateString()}
                      </div>
                      <Link
                        to={`/items/${claim.item_id}`}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View Item →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-red-600">
            Failed to load profile
          </div>
        )}
      </SignedIn>
    </div>
  );
}
