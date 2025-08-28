import { useParams } from 'react-router-dom';
import styles from './PostPage.module.css';
import { posts } from '../../data/postsData'; // Impordime postituste andmed

function PostPage() {
  const { postId } = useParams(); // Loeme URL-ist postituse ID
  const post = posts[postId]; // Leiame õige postituse andmebaasist

  // Kui postitust ei leita, kuvame veateate
  if (!post) {
    return (
      <div className={styles.post}>
        <h1>Post not found</h1>
        <p>The page you are looking for does not exist.</p>
      </div>
    );
  }

  return (
    <article className={styles.post}>
      <img src={post.image} alt={post.title} className={styles.postImage} />
      <h1 className={styles.postTitle}>{post.title}</h1>
      {/* Kasutame dangerouslySetInnerHTML, et lubada <br> täge tekstis */}
      <div className={styles.postContent} dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}

export default PostPage;