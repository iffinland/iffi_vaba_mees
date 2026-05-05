import { Routes, Route } from 'react-router-dom';
import './App.css'
import Layout from './components/Layout/Layout';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import HomePage from './pages/HomePage/HomePage';
import PostPage from './pages/PostPage/PostPage';
import ProjectsPage from './pages/ProjectsPage/ProjectsPage';
import ContactPage from './pages/ContactPage/ContactPage';
import GalleryPage from './pages/GalleryPage/GalleryPage';
import GuestbookPage from './pages/GuestbookPage/GuestbookPage'; // Veendu, et see rida on olemas
import VideosPage from './pages/VideosPage/VideosPage';

function App() {
  return (
    <Layout>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/post/:postId" element={<PostPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/guestbook" element={<GuestbookPage />} />
          {/* Võid lisada ka veateate lehe, kui URL on vale */}
          <Route path="*" element={<h1>404: Page Not Found</h1>} />
        </Routes>
      </main>
      <Footer />
    </Layout>
  )
}

export default App
