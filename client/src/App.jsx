import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton } from './auth/clerk';
import Feed from './pages/Feed';
import PostItem from './pages/PostItem';
import ItemDetail from './pages/ItemDetail';
import Matches from './pages/Matches';
import Claim from './pages/Claim';
import Profile from './pages/Profile';
import Hotspots from './pages/Hotspots';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center gap-8">
                <Link to="/" className="text-xl font-bold text-blue-600">
                  BackToYou
                </Link>
                <div className="flex gap-4">
                  <Link to="/" className="text-gray-700 hover:text-blue-600">
                    Feed
                  </Link>
                  <SignedIn>
                    <Link to="/post" className="text-gray-700 hover:text-blue-600">
                      Post Item
                    </Link>
                    <Link to="/profile" className="text-gray-700 hover:text-blue-600">
                      Profile
                    </Link>
                  </SignedIn>
                  <Link to="/hotspots" className="text-gray-700 hover:text-blue-600">
                    Hotspots
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      Sign In
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Feed />} />
            <Route path="/post" element={<PostItem />} />
            <Route path="/items/:id" element={<ItemDetail />} />
            <Route path="/items/:id/matches" element={<Matches />} />
            <Route path="/items/:id/claim" element={<Claim />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/hotspots" element={<Hotspots />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
