import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth } from '../auth/clerk';
import { createAuthRequest } from '../utils/api';

const LOCATIONS = [
  { name: 'Library', lat: 21.1458, lng: 79.0882 },
  { name: 'Canteen', lat: 21.1465, lng: 79.0895 },
  { name: 'Main Building', lat: 21.1462, lng: 79.0888 },
  { name: 'Sports Ground', lat: 21.1472, lng: 79.0868 },
  { name: 'Hostel Block A', lat: 21.1448, lng: 79.0892 },
  { name: 'Lab 3', lat: 21.1455, lng: 79.0878 }
];

export default function PostItem() {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  
  const [form, setForm] = useState({
    type: 'lost',
    description: '',
    location: 'Library',
    image: null
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const location = LOCATIONS.find((l) => l.name === form.location);
      const formData = new FormData();
      
      formData.append('type', form.type);
      formData.append('description', form.description);
      formData.append('location_name', location.name);
      formData.append('lat', location.lat);
      formData.append('lng', location.lng);
      formData.append('happened_at', new Date().toISOString());
      
      if (form.image) {
        formData.append('image', form.image);
      }

      const api = createAuthRequest(getToken);
      const data = await api('/api/items', {
        method: 'POST',
        body: formData
      });

      setResult(data);
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
          <p className="text-lg mb-4">Please sign in to post an item</p>
        </div>
      </SignedOut>

      <SignedIn>
        <h1 className="text-3xl font-bold mb-6">Post Item</h1>

        {result ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold text-green-600 mb-4">
              ✓ Item Posted Successfully!
            </h2>
            
            <div className="mb-4">
              <h3 className="font-semibold mb-2">AI-Generated Tags:</h3>
              <div className="flex flex-wrap gap-2">
                {result.item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {result.matches && result.matches.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">
                  Found {result.matches.length} potential matches!
                </h3>
                <button
                  onClick={() => navigate(`/items/${result.item.id}/matches`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  View Matches
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setResult(null);
                setForm({ type: 'lost', description: '', location: 'Library', image: null });
              }}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              Post Another Item
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
            {error && (
              <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="lost"
                    checked={form.type === 'lost'}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="mr-2"
                  />
                  Lost
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="found"
                    checked={form.type === 'found'}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="mr-2"
                  />
                  Found
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                rows="3"
                placeholder="Describe the item..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location
              </label>
              <select
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc.name} value={loc.name}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image {form.type === 'found' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setForm({ ...form, image: e.target.files[0] })}
                className="w-full"
              />
              {form.type === 'found' && (
                <p className="text-sm text-gray-500 mt-1">
                  Image required for found items
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Posting...' : 'Post Item'}
            </button>
          </form>
        )}
      </SignedIn>
    </div>
  );
}
